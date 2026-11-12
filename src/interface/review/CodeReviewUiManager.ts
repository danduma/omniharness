import { StateManager } from "@/lib/state-manager";
import type { CodeReviewRefusal } from "@/shared/code-review";

type CodeReviewUiState = {
  /** Bumped by code_review.* events; part of the panel's query key, so it refetches. */
  revisionByRunId: Readonly<Record<string, number>>;
  /** Last refusal from a start attempt, shown until the next attempt. */
  refusalByRunId: Readonly<Record<string, CodeReviewRefusal | null>>;
};

export class CodeReviewUiManager extends StateManager<CodeReviewUiState> {
  constructor() {
    super({ revisionByRunId: {}, refusalByRunId: {} });
  }

  onCodeReviewEvent(payload: unknown) {
    if (!payload || typeof payload !== "object") return;
    const runId = (payload as { runId?: unknown }).runId;
    if (typeof runId !== "string" || !runId) return;
    this.update((current) => ({
      ...current,
      revisionByRunId: { ...current.revisionByRunId, [runId]: (current.revisionByRunId[runId] ?? 0) + 1 },
    }));
  }

  setRefusal(runId: string, refusal: CodeReviewRefusal | null) {
    this.update((current) => (current.refusalByRunId[runId] === refusal
      ? current
      : { ...current, refusalByRunId: { ...current.refusalByRunId, [runId]: refusal } }));
  }
}

export const codeReviewUiManager = new CodeReviewUiManager();
