import { describe, expect, it } from "vitest";
import { CodeReviewUiManager } from "@/interface/review/CodeReviewUiManager";

describe("CodeReviewUiManager", () => {
  it("bumps the per-run revision on events and keeps refusals per run", () => {
    const manager = new CodeReviewUiManager();
    manager.onCodeReviewEvent({ runId: "a" });
    manager.onCodeReviewEvent({ runId: "a" });
    manager.onCodeReviewEvent({ runId: "b" });
    manager.onCodeReviewEvent({ reviewId: "no-run" });
    manager.onCodeReviewEvent(null);
    expect(manager.getSnapshot().revisionByRunId).toEqual({ a: 2, b: 1 });

    manager.setRefusal("a", "no_changes");
    const snapshot = manager.getSnapshot();
    manager.setRefusal("a", "no_changes");
    expect(manager.getSnapshot()).toBe(snapshot);
    expect(manager.getSnapshot().refusalByRunId).toEqual({ a: "no_changes" });
  });
});
