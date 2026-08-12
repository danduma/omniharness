import { describe, expect, it } from "vitest";
import { BusyMessageQueueManager } from "@/interface/home/BusyMessageQueueManager";
import type { QueuedConversationMessageRecord } from "@/interface/home/types";

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

  it("does not treat another run's empty snapshot as removal", () => {
    const manager = new BusyMessageQueueManager();
    const queuedMessage = buildQueuedMessage({ id: "run-a-queued", runId: "run-a" });

    manager.setQueuedMessages([queuedMessage], { runId: "run-a", notify: false });
    manager.setQueuedMessages([], { runId: "run-b", notify: false });
    manager.setQueuedMessages([queuedMessage], { runId: "run-a", notify: false });

    expect(manager.getQueuedMessagesForRun("run-a")).toEqual([queuedMessage]);
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

describe("BusyMessageQueueManager optimistic queue sends", () => {
  it("shows the row from the moment the user sends, without a transcript detour", () => {
    const manager = new BusyMessageQueueManager();
    const optimistic = buildQueuedMessage({ id: "client-generated-id", runId: "run-a" });

    manager.beginQueueSend(optimistic);

    expect(manager.getQueuedMessagesForRun("run-a").map((message) => message.id)).toEqual(["client-generated-id"]);
  });

  it("keeps the row through an event frame that lands before the POST returns", () => {
    // The server cannot know about the row yet, so its absence from the frame
    // is not a cancellation. Dropping it here made the queue entry blink out
    // and back in.
    const manager = new BusyMessageQueueManager();
    manager.beginQueueSend(buildQueuedMessage({ id: "client-generated-id", runId: "run-a" }));

    manager.setQueuedMessages([], true);

    expect(manager.getQueuedMessagesForRun("run-a").map((message) => message.id)).toEqual(["client-generated-id"]);
  });

  it("swaps in place when the server adopts the client id", () => {
    const manager = new BusyMessageQueueManager();
    manager.beginQueueSend(buildQueuedMessage({ id: "client-generated-id", runId: "run-a" }));

    manager.settleQueueSend("client-generated-id", buildQueuedMessage({
      id: "client-generated-id",
      runId: "run-a",
      content: "queued text",
      updatedAt: "2026-05-25T00:00:01.000Z",
    }));

    expect(manager.getQueuedMessagesForRun("run-a").map((message) => message.id)).toEqual(["client-generated-id"]);
    expect(manager.getQueuedMessagesForRun("run-a")[0]?.updatedAt).toBe("2026-05-25T00:00:01.000Z");

    // No longer in flight: a later frame that drops it is now authoritative.
    manager.setQueuedMessages([], true);
    expect(manager.getQueuedMessagesForRun("run-a")).toEqual([]);
  });

  it("drops the optimistic row when the server mints its own id instead", () => {
    const manager = new BusyMessageQueueManager();
    manager.beginQueueSend(buildQueuedMessage({ id: "client-generated-id", runId: "run-a" }));

    manager.settleQueueSend("client-generated-id", buildQueuedMessage({ id: "server-id", runId: "run-a" }));

    expect(manager.getQueuedMessagesForRun("run-a").map((message) => message.id)).toEqual(["server-id"]);
  });

  it("removes the row when the send fails", () => {
    const manager = new BusyMessageQueueManager();
    manager.beginQueueSend(buildQueuedMessage({ id: "client-generated-id", runId: "run-a" }));

    manager.failQueueSend("client-generated-id");

    expect(manager.getQueuedMessagesForRun("run-a")).toEqual([]);
    manager.setQueuedMessages([], true);
    expect(manager.getQueuedMessagesForRun("run-a")).toEqual([]);
  });

  // The composer predicts busy-ness from event-stream state, so it can render a
  // message as a transcript bubble while the server decides to queue it. The
  // queue row then arrives on the event stream before the POST returns and the
  // same text is on screen twice — once in the transcript, once in the drawer.
  // Neither surface's dedup can see the other, so visibility has to be resolved
  // where both are known.
  it("hides a queued row while the same message is in flight as a transcript bubble", () => {
    const manager = new BusyMessageQueueManager();
    manager.setQueuedMessages([buildQueuedMessage({ id: "message-1", runId: "run-a" })], false);

    expect(manager.getVisibleQueuedMessagesForRun("run-a", new Set(["message-1"]))).toEqual([]);
  });

  it("shows the queued row once the transcript send is no longer in flight", () => {
    const manager = new BusyMessageQueueManager();
    manager.setQueuedMessages([buildQueuedMessage({ id: "message-1", runId: "run-a" })], false);

    expect(
      manager.getVisibleQueuedMessagesForRun("run-a", new Set()).map((message) => message.id),
    ).toEqual(["message-1"]);
  });

  it("leaves queued rows from other sends visible while one is in flight", () => {
    const manager = new BusyMessageQueueManager();
    manager.setQueuedMessages([
      buildQueuedMessage({ id: "message-1", runId: "run-a" }),
      buildQueuedMessage({ id: "message-2", runId: "run-a" }),
    ], false);

    expect(
      manager.getVisibleQueuedMessagesForRun("run-a", new Set(["message-1"])).map((message) => message.id),
    ).toEqual(["message-2"]);
  });

  it("scopes visible queued rows to the selected run", () => {
    const manager = new BusyMessageQueueManager();
    manager.setQueuedMessages([
      buildQueuedMessage({ id: "run-a-queued", runId: "run-a" }),
      buildQueuedMessage({ id: "run-b-queued", runId: "run-b" }),
    ], false);

    expect(
      manager.getVisibleQueuedMessagesForRun("run-a", new Set()).map((message) => message.id),
    ).toEqual(["run-a-queued"]);
    expect(manager.getVisibleQueuedMessagesForRun(null, new Set())).toEqual([]);
  });
});
