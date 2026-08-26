import { describe, expect, it } from "vitest";
import { SentConversationMessagesManager } from "@/interface/home/SentConversationMessagesManager";
import { mergePendingSentConversationMessages } from "@/interface/home/utils";
import type { EventStreamState, MessageRecord } from "@/interface/home/types";

function buildMessage(overrides: Partial<MessageRecord> = {}): MessageRecord {
  return {
    id: "11111111-2222-4333-8444-555555555555",
    runId: "run-1",
    role: "user",
    kind: null,
    content: "hello",
    attachments: [],
    createdAt: "2026-04-27T00:01:00.000Z",
    ...overrides,
  };
}

function buildState(overrides: Partial<EventStreamState> = {}): EventStreamState {
  return {
    messages: [],
    runs: [{
      id: "run-1",
      planId: "plan-1",
      // Terminal, and updated *after* the message's client timestamp: the
      // clock-skew shape that used to drop a just-sent bubble.
      status: "done",
      createdAt: "2026-04-27T00:00:00.000Z",
      updatedAt: "2026-04-27T00:02:00.000Z",
      projectPath: null,
      title: null,
    }],
    plans: [],
    accounts: [],
    agents: [],
    workers: [],
    planItems: [],
    clarifications: [],
    executionEvents: [],
    supervisorInterventions: [],
    messageScope: { runIds: ["run-1"], complete: true },
    ...overrides,
  };
}

describe("SentConversationMessagesManager", () => {
  it("keeps an in-flight bubble across a frame that does not carry it yet", () => {
    const manager = new SentConversationMessagesManager();
    const message = buildMessage();
    manager.beginSend(message);

    expect(manager.getInFlightMessageIds().has(message.id)).toBe(true);

    const merged = mergePendingSentConversationMessages(
      buildState(),
      manager.getPendingMessages(),
      manager.getInFlightMessageIds(),
    );

    expect(merged.state.messages).toEqual([message]);
    expect(merged.settledMessageIds).toEqual([]);
  });

  it("clears the in-flight flag once the send settles, then stops shadowing on stream arrival", () => {
    const manager = new SentConversationMessagesManager();
    const message = buildMessage();
    manager.beginSend(message);
    // The server adopts the client id, so settling is an in-place swap.
    manager.settleSend(message.id, message);

    expect(manager.getInFlightMessageIds().size).toBe(0);
    expect(manager.getLocallySentMessageIds().has(message.id)).toBe(true);

    const merged = mergePendingSentConversationMessages(
      buildState({ messages: [message] }),
      manager.getPendingMessages(),
      manager.getInFlightMessageIds(),
    );
    manager.acknowledge(merged.settledMessageIds);

    expect(merged.settledMessageIds).toEqual([message.id]);
    expect(manager.getPendingMessages().size).toBe(0);
  });

  it("treats an authoritative queued row as acknowledgement when the POST response is lost", () => {
    const manager = new SentConversationMessagesManager();
    const message = buildMessage();
    manager.beginSend(message);

    const merged = mergePendingSentConversationMessages(
      buildState({
        queuedMessages: [{
          id: message.id,
          runId: message.runId,
          targetWorkerId: "run-1-worker-1",
          action: "steer",
          content: message.content,
          status: "delivering",
          createdAt: message.createdAt,
          updatedAt: message.createdAt,
        }],
      }),
      manager.getPendingMessages(),
      manager.getInFlightMessageIds(),
    );

    expect(merged.state.messages).toEqual([]);
    expect(merged.settledMessageIds).toEqual([message.id]);
  });

  it("drops the row when the send fails", () => {
    const manager = new SentConversationMessagesManager();
    const message = buildMessage();
    manager.beginSend(message);
    manager.failSend(message.id);

    expect(manager.getPendingMessages().size).toBe(0);
    expect(manager.getInFlightMessageIds().size).toBe(0);
  });

  it("takes a new snapshot identity on every transition so subscribers re-render", () => {
    const manager = new SentConversationMessagesManager();
    const message = buildMessage();
    const initial = manager.getSnapshot();

    manager.beginSend(message);
    const afterBegin = manager.getSnapshot();
    manager.settleSend(message.id, message);
    const afterSettle = manager.getSnapshot();

    // Mutating a shared Set in place was the old behaviour, and it never
    // invalidated the memo that reads the sending ids.
    expect(afterBegin).not.toBe(initial);
    expect(afterSettle).not.toBe(afterBegin);
  });
});
