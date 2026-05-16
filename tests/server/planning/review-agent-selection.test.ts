import { describe, expect, it, vi, beforeEach } from "vitest";
import { resolvePlanningReviewWorkerType } from "@/server/planning/review-agent-selection";
import * as workerAvailability from "@/server/supervisor/worker-availability";
import type { SupportedWorkerType } from "@/server/supervisor/worker-types";

const makeEmptyChain = () => {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.innerJoin = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.then = (resolve: (value: unknown) => unknown) => resolve([]);
  return chain;
};

vi.mock("@/server/db", () => ({
  db: {
    select: vi.fn(() => makeEmptyChain()),
  }
}));

vi.mock("@/server/supervisor/worker-availability", () => ({
  isSpawnableWorkerType: vi.fn((type) => ({ ok: true, type }))
}));

describe("planning review agent selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves explicit healthy selection", async () => {
    const result = await resolvePlanningReviewWorkerType({
      agentSelection: "claude",
      allowedWorkerTypes: ["claude", "gemini"],
    });
    expect(result.workerType).toBe("claude");
    expect(result.reason).toBe("explicit selection");
  });

  it("throws for unavailable explicit selection", async () => {
    vi.mocked(workerAvailability.isSpawnableWorkerType).mockReturnValueOnce({ ok: false, type: "claude", reason: "not installed" } as ReturnType<typeof workerAvailability.isSpawnableWorkerType>);
    await expect(resolvePlanningReviewWorkerType({
      agentSelection: "claude",
      allowedWorkerTypes: ["claude"],
    })).rejects.toThrow(/not available: not installed/);
  });

  it("resolves 'same' as planner worker type", async () => {
    const result = await resolvePlanningReviewWorkerType({
      agentSelection: "same",
      allowedWorkerTypes: ["claude", "gemini"],
      plannerWorkerType: "gemini",
    });
    expect(result.workerType).toBe("gemini");
    expect(result.reason).toBe("same as planner");
  });

  it("resolves 'auto' by preferring a different healthy worker", async () => {
    const result = await resolvePlanningReviewWorkerType({
      agentSelection: "auto",
      allowedWorkerTypes: ["claude", "gemini"],
      plannerWorkerType: "claude",
    });
    expect(result.workerType).toBe("gemini");
    expect(result.reason).toContain("preferred different healthy worker");
  });

  it("resolves 'auto' to planner worker if no other healthy option", async () => {
    // mock gemini as not installed
    vi.mocked(workerAvailability.isSpawnableWorkerType).mockImplementation((type) => {
      const workerType = type as SupportedWorkerType;
      if (workerType === "gemini") return { ok: false, type: workerType, reason: "not installed" } as ReturnType<typeof workerAvailability.isSpawnableWorkerType>;
      return { ok: true, type: workerType };
    });

    const result = await resolvePlanningReviewWorkerType({
      agentSelection: "auto",
      allowedWorkerTypes: ["claude", "gemini"],
      plannerWorkerType: "claude",
    });
    expect(result.workerType).toBe("claude");
    expect(result.reason).toContain("fallback to planner worker");
  });

  it("throws for 'auto' if no healthy worker found", async () => {
    vi.mocked(workerAvailability.isSpawnableWorkerType).mockReturnValue({ ok: false, type: "codex", reason: "failed" } as ReturnType<typeof workerAvailability.isSpawnableWorkerType>);
    await expect(resolvePlanningReviewWorkerType({
      agentSelection: "auto",
      allowedWorkerTypes: ["claude", "gemini"],
    })).rejects.toThrow(/No healthy reviewer worker is available/);
  });
});
