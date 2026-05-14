import { describe, expect, it, vi, beforeEach } from "vitest";
import { startPlanningReview } from "@/server/planning/review";
import { db } from "@/server/db";

vi.mock("@/server/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: vi.fn(),
          orderBy: vi.fn(() => ({
            desc: vi.fn(() => [])
          }))
        }))
      }))
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => Promise.resolve())
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve())
      }))
    }))
  }
}));

vi.mock("@/server/bridge-client", () => ({
  spawnAgent: vi.fn(() => Promise.resolve()),
  askAgent: vi.fn(() => Promise.resolve({ response: "ok" })),
  getAgent: vi.fn(() => Promise.resolve({})),
  cancelAgent: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/server/planning/refresh", () => ({
  refreshPlanningArtifactsForRun: vi.fn(() => Promise.resolve({ status: "ready" })),
}));

vi.mock("fs", () => ({
  default: {
    readFileSync: vi.fn(() => "content"),
    existsSync: vi.fn(() => true),
  }
}));

describe("planning review orchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects non-planning runs", async () => {
    const mockGet = vi.fn().mockReturnValueOnce({ mode: "implementation" });
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: mockGet,
          orderBy: vi.fn(() => ({
            desc: vi.fn(() => [])
          }))
        }))
      }))
    } as unknown as ReturnType<typeof db.select>);

    await expect(startPlanningReview({
      runId: "run-1",
      agentSelection: "auto",
      rounds: 1,
    })).rejects.toThrow("Invalid run");
  });

  it("starts a review run for a ready plan", async () => {
    const mockGet = vi.fn()
      .mockReturnValueOnce({
        id: "run-1",
        mode: "planning",
        plannerArtifactsJson: JSON.stringify({
          planPath: "plan.md",
          candidates: [{ kind: "plan", path: "plan.md", exists: true, readiness: { ready: true } }]
        })
      }) // run check
      .mockReturnValueOnce(null); // existing review check

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: mockGet,
          orderBy: vi.fn(() => ({
            desc: vi.fn(() => [])
          }))
        }))
      }))
    } as unknown as ReturnType<typeof db.select>);

    const result = await startPlanningReview({
      runId: "run-1",
      agentSelection: "auto",
      rounds: 1,
    });

    expect(result.status).toBe("running");
    expect(db.insert).toHaveBeenCalled();
  });
});
