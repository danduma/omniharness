import { describe, expect, it } from "vitest";
import { BusyMessageQueueManager } from "@/app/home/BusyMessageQueueManager";
import type { QueuedConversationMessageRecord } from "@/app/home/types";

function buildQueuedMessage(overrides: Partial<QueuedConversationMessageRecord>): QueuedConversationMessageRecord {
  return {
    id: "queued-1",
    runId: "run-1",
    action: "queue",
    content: "queued text",
    status: "pending",
    createdAt: "2026-05-25T00:00:00.000Z",
    updatedAt: "2026-05-25T00:00:00.000Z",
    ...overrides,
  };
}

describe("BusyMessageQueueManager", () => {
  it("returns queued messages only for the selected run", () => {
    const manager = new BusyMessageQueueManager();
    manager.setQueuedMessages([
      buildQueuedMessage({ id: "run-a-queued", runId: "run-a" }),
      buildQueuedMessage({ id: "run-b-queued", runId: "run-b" }),
    ], false);

    expect(manager.getQueuedMessagesForRun("run-a").map((message) => message.id)).toEqual(["run-a-queued"]);
    expect(manager.getQueuedMessagesForRun("run-b").map((message) => message.id)).toEqual(["run-b-queued"]);
    expect(manager.getQueuedMessagesForRun(null)).toEqual([]);
  });

  it("keeps locally hidden queued messages hidden across stale server snapshots", () => {
    const manager = new BusyMessageQueueManager();
    const queuedMessage = buildQueuedMessage({ id: "queued-editing", runId: "run-a" });

    manager.setQueuedMessages([queuedMessage], false);
    manager.hideQueuedMessage("queued-editing");
    manager.setQueuedMessages([queuedMessage], false);

    expect(manager.getQueuedMessagesForRun("run-a")).toEqual([]);

    manager.restoreQueuedMessage(queuedMessage);

    expect(manager.getQueuedMessagesForRun("run-a").map((message) => message.id)).toEqual(["queued-editing"]);
  });
});
