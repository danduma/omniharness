import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGatherHandoffCandidates } = vi.hoisted(() => ({
  mockGatherHandoffCandidates: vi.fn(),
}));

vi.mock("@/server/handoff/candidates", () => ({
  gatherHandoffCandidates: mockGatherHandoffCandidates,
}));

import { buildPersistedHandoff } from "@/server/handoff/request";

describe("buildPersistedHandoff", () => {
  beforeEach(() => {
    mockGatherHandoffCandidates.mockReset();
  });

  it("builds target context from persisted conversation and workspace evidence", async () => {
    mockGatherHandoffCandidates.mockResolvedValue({
      worker: { type: "codex" },
      originalRequest: "Fix browser exports",
      currentObjective: "Add Safari coverage",
      recentUserMessages: ["Fix browser exports", "Add Safari coverage"],
      recentAssistantSummary: "Safari uses the slow export path.",
      verification: [{ command: "pnpm test", result: "passed", importantOutput: "12 tests passed" }],
      workspace: {
        warnings: [],
        modifiedFiles: [{ path: "src/export.ts" }],
      },
    });

    const report = await buildPersistedHandoff({
      runId: "run-1",
      workerId: "worker-1",
      reason: "quota_exhausted",
      originalPrompt: "Fix browser exports",
    });

    expect(mockGatherHandoffCandidates).toHaveBeenCalledWith({ runId: "run-1", workerId: "worker-1" });
    expect(report.task).toBe("Add Safari coverage");
    expect(report.progress).toContain("Fix browser exports");
    expect(report.progress).toContain("Safari uses the slow export path");
    expect(report.progress).toContain("12 tests passed");
    expect(report.relevantFiles).toEqual(["src/export.ts"]);
    expect(report.source).toBe("synthetic");
  });
});
