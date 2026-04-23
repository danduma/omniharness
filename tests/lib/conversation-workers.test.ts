import { describe, expect, it } from "vitest";
import {
  buildWorkerLists,
  buildWorkerPreview,
  isWorkerActiveStatus,
  type ConversationWorkerAgent,
  type ConversationWorkerRecord,
} from "@/lib/conversation-workers";

describe("conversation worker helpers", () => {
  it("treats live and waiting workers as active while grouping terminal workers as finished", () => {
    const workers: ConversationWorkerRecord[] = [
      { id: "worker-starting", runId: "run-1", type: "codex", status: "starting" },
      { id: "worker-idle", runId: "run-1", type: "claude", status: "idle" },
      { id: "worker-stuck", runId: "run-1", type: "gemini", status: "stuck" },
      { id: "worker-cancelled", runId: "run-1", type: "codex", status: "cancelled" },
      { id: "worker-error", runId: "run-1", type: "codex", status: "error" },
    ];

    expect(isWorkerActiveStatus("starting")).toBe(true);
    expect(isWorkerActiveStatus("idle")).toBe(true);
    expect(isWorkerActiveStatus("working")).toBe(true);
    expect(isWorkerActiveStatus("stuck")).toBe(true);
    expect(isWorkerActiveStatus("cancelled")).toBe(false);

    expect(buildWorkerLists(workers)).toEqual({
      active: [workers[0], workers[1], workers[2]],
      finished: [workers[3], workers[4]],
    });
  });

  it("prefers live text, then persisted output, then errors for collapsed worker previews", () => {
    const activeAgent: ConversationWorkerAgent = {
      name: "worker-live",
      state: "working",
      currentText: "Investigating the retry bug in the worker cleanup path.",
      lastText: "Older output",
    };
    const persistedAgent: ConversationWorkerAgent = {
      name: "worker-persisted",
      state: "idle",
      displayText: "Completed a clean terminal snapshot for the worker.",
      lastText: "Older output",
    };
    const failedAgent: ConversationWorkerAgent = {
      name: "worker-failed",
      state: "error",
      lastError: "Bridge request failed",
    };

    expect(buildWorkerPreview(activeAgent)).toContain("Investigating the retry bug");
    expect(buildWorkerPreview(persistedAgent)).toContain("Completed a clean terminal snapshot");
    expect(buildWorkerPreview(failedAgent)).toBe("Bridge request failed");
  });
});
