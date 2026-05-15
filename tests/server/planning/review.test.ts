import { describe, expect, it, vi, beforeEach } from "vitest";
import { startPlanningReview } from "@/server/planning/review";
import { db } from "@/server/db";

// Helper: drizzle's `where(...)` is both awaitable (yields a row array)
// AND chainable (`.get()`, `.orderBy()`, etc.). The mock returns a
// thenable-with-methods so `await db.select()...where(...)` resolves
// to `[]` for callers that iterate AND `.get()` still works.
function makeWhereResult(getFn: () => unknown = () => undefined) {
  const obj: Record<string, unknown> = {
    get: vi.fn(getFn),
    orderBy: vi.fn(() => ({ desc: vi.fn(() => []) })),
    then: (resolve: (value: unknown[]) => void) => resolve([]),
  };
  return obj;
}

vi.mock("@/server/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => makeWhereResult()),
      })),
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
        where: vi.fn(() => makeWhereResult(mockGet)),
      })),
    } as unknown as ReturnType<typeof db.select>);

    await expect(startPlanningReview({
      runId: "run-1",
      agentSelection: "auto",
      rounds: 1,
    })).rejects.toThrow("Invalid run");
  });

  it("starts a review run for a ready plan", async () => {
    const runRow = {
      id: "run-1",
      mode: "planning",
      status: "ready",
      plannerArtifactsJson: JSON.stringify({
        planPath: "plan.md",
        candidates: [{ kind: "plan", path: "plan.md", exists: true, readiness: { ready: true } }],
      }),
    };
    // The new orchestration calls `.get()` multiple times: the initial
    // run lookup, the post-refresh re-fetch, and the existing-review
    // check. Return the same run shape for any run-id lookup and null
    // when checking for an existing planningReviewRuns row.
    // Order of `.get()` calls inside startPlanningReview + helpers:
    //   1. initial run lookup → run
    //   2. reconcileOrphanedReviewsForRun: current-state run lookup → run
    //   3. reconcileOrphanedReviewsForRun: hasRunningReview check → null
    //   4. post-refresh re-fetch → run
    //   5. existing-planningReviewRuns check → null
    const getResponses: Array<typeof runRow | null> = [
      runRow,
      runRow,
      null,
      runRow,
      null,
    ];
    const mockGet = vi.fn(() => getResponses.shift() ?? null);

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => makeWhereResult(mockGet)),
      })),
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
