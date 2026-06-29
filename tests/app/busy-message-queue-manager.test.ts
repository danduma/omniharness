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
  it("does not notify subscribers when the server queue snapshot is unchanged", () => {
    const manager = new BusyMessageQueueManager();
    const queuedMessage = buildQueuedMessage({ id: "queued-stable", runId: "run-a" });
    let notificationCount = 0;
    manager.subscribe(() => {
      notificationCount += 1;
    });

    manager.setQueuedMessages([], true);
    expect(notificationCount).toBe(0);

    manager.setQueuedMessages([queuedMessage], true);
    expect(notificationCount).toBe(1);

    manager.setQueuedMessages([queuedMessage], true);
    expect(notificationCount).toBe(1);
  });

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

  it("does not revive an active row after an authoritative server snapshot removes it", () => {
    const manager = new BusyMessageQueueManager();
    const queuedMessage = buildQueuedMessage({
      id: "queued-interrupted",
      runId: "run-a",
      status: "delivering",
    });

    manager.setQueuedMessages([queuedMessage], false);
    manager.setQueuedMessages([], false);
    manager.upsertQueuedMessage(queuedMessage);

    expect(manager.getQueuedMessagesForRun("run-a")).toEqual([]);
  });

  it("allows a server snapshot to restore a row that became pending again", () => {
    const manager = new BusyMessageQueueManager();
    const queuedMessage = buildQueuedMessage({
      id: "queued-deferred",
      runId: "run-a",
      status: "delivering",
    });
    const pendingAgain = buildQueuedMessage({
      ...queuedMessage,
      status: "pending",
      lastError: "Worker is busy",
      updatedAt: "2026-05-25T00:00:02.000Z",
    });

    manager.setQueuedMessages([queuedMessage], false);
    manager.setQueuedMessages([], false);
    manager.setQueuedMessages([pendingAgain], false);

    expect(manager.getQueuedMessagesForRun("run-a")).toEqual([pendingAgain]);
  });

  it("ignores older authoritative server snapshots after the server removed an active row", () => {
    const manager = new BusyMessageQueueManager();
    const queuedMessage = buildQueuedMessage({
      id: "queued-late-server-frame",
      runId: "run-a",
      status: "pending",
      updatedAt: "2026-05-25T00:00:01.000Z",
    });

    manager.setQueuedMessages([queuedMessage], false);
    manager.setQueuedMessages([], false);
    manager.setQueuedMessages([queuedMessage], false);

    expect(manager.getQueuedMessagesForRun("run-a")).toEqual([]);
  });

  it("removes terminal rows supplied by a mutation response", () => {
    const manager = new BusyMessageQueueManager();
    const queuedMessage = buildQueuedMessage({
      id: "queued-delivered",
      runId: "run-a",
      status: "delivering",
    });

    manager.setQueuedMessages([queuedMessage], false);
    manager.upsertQueuedMessage({
      ...queuedMessage,
      status: "delivered",
      deliveredAt: "2026-05-25T00:00:01.000Z",
    });

    expect(manager.getQueuedMessagesForRun("run-a")).toEqual([]);
  });
});
