import { describe, expect, it } from "vitest";
import {
  buildWorkerLists,
  buildWorkerPreview,
  formatHumanDuration,
  getWorkerRuntimeLabel,
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
    expect(isWorkerActiveStatus("stopped")).toBe(false);
    expect(isWorkerActiveStatus("finished")).toBe(false);
    expect(isWorkerActiveStatus("done")).toBe(false);

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

  it("formats worker runtime from start and finish timestamps", () => {
    expect(formatHumanDuration(9_120_000)).toBe("2 hours, 32 minutes");
    expect(formatHumanDuration(59_000)).toBe("59 seconds");
    expect(formatHumanDuration(60_000)).toBe("1 minute");

    const finishedWorker: ConversationWorkerRecord = {
      id: "worker-done",
      runId: "run-1",
      type: "codex",
      status: "cancelled",
      createdAt: "2026-04-27T00:00:00.000Z",
      updatedAt: "2026-04-27T02:32:00.000Z",
    };
    const activeWorker: ConversationWorkerRecord = {
      id: "worker-live",
      runId: "run-1",
      type: "codex",
      status: "working",
      createdAt: "2026-04-27T00:00:00.000Z",
      updatedAt: "2026-04-27T00:10:00.000Z",
    };

    expect(getWorkerRuntimeLabel(finishedWorker)).toBe("Worked 2 hours, 32 minutes");
    expect(getWorkerRuntimeLabel(activeWorker, new Date("2026-04-27T01:15:00.000Z").getTime())).toBe("Working for 1 hour, 15 minutes");
  });
});
