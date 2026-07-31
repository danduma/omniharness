import { describe, expect, it } from "vitest";
import { resolveRunComposerSelection } from "@/interface/home/useRunSelectionEffects";
import type { RunRecord } from "@/interface/home/types";

function createRun(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    id: "run-1",
    planId: "plan-1",
    mode: "direct",
    status: "running",
    createdAt: "2026-07-11T12:00:00.000Z",
    projectPath: null,
    title: "Claude conversation",
    ...overrides,
  };
}

describe("resolveRunComposerSelection", () => {
  it("restores the account saved on a reopened conversation", () => {
    const selection = resolveRunComposerSelection({
      run: createRun({
        preferredWorkerType: "claude",
        preferredWorkerModel: "claude-opus-4-8",
        preferredWorkerEffort: "high",
        preferredWorkerAccountId: "claude-sub-1",
      }),
      activeAllowedWorkerTypes: ["claude"],
    });

    expect(selection.accountId).toBe("claude-sub-1");
  });
});
