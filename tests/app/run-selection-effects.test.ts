import { describe, expect, it } from "vitest";
import { resolveRunComposerSelection } from "@/interface/home/useRunSelectionEffects";
import { buildOptimisticCreatedConversationSnapshot } from "@/interface/home/utils";
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
  it("resolves the launched model from the conversation's optimistic placeholder", () => {
    const snapshot = buildOptimisticCreatedConversationSnapshot({
      runId: "run-new",
      content: "start here",
      projectPath: null,
      mode: "direct",
      preferredWorkerType: "claude",
      preferredWorkerModel: "claude-fable-5-1",
      preferredWorkerEffort: "high",
      preferredWorkerAccountId: null,
    });

    const selection = resolveRunComposerSelection({
      run: snapshot.run as RunRecord,
      activeAllowedWorkerTypes: ["claude"],
    });

    expect(selection).toMatchObject({ worker: "claude", model: "claude-fable-5-1", effort: "High" });
  });
});
