import { randomUUID } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { executionEvents, messages, plans, queuedConversationMessages, runs, supervisorInterventions, workers } from "@/server/db/schema";
import {
  __resetOutputStoreCachesForTests,
  readWorkerOutputEntries,
  writeWorkerOutputEntries,
} from "@/server/workers/output-store";

const { mockAskAgent, mockGetAgent } = vi.hoisted(() => ({
  mockAskAgent: vi.fn().mockResolvedValue({
    response: "Worker received the queued note.",
    state: "idle",
  }),
  mockGetAgent: vi.fn(),
}));

vi.mock("@/server/bridge-client", () => ({
  askAgent: mockAskAgent,
  getAgent: mockGetAgent,
}));

import {
  cancelQueuedConversationMessage,
  createQueuedConversationMessage,
  drainQueuedImplementationMessages,
  drainQueuedWorkerMessages,
  sendQueuedConversationMessageNow,
} from "@/server/conversations/queued-messages";
import { __resetWorkerTurnChainsForTests } from "@/server/conversations/worker-turn-gate";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

async function waitFor<T>(read: () => T | Promise<T>, predicate: (value: T) => boolean, timeoutMs = 1_000) {
  const startedAt = Date.now();
  let latest = await read();

  while (!predicate(latest)) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`Timed out waiting for expected state. Last value: ${JSON.stringify(latest)}`);
    }

    await delay(10);
    latest = await read();
  }

  return latest;
}

async function createRun(mode: "implementation" | "planning" | "direct" = "implementation") {
  const planId = randomUUID();
  const runId = randomUUID();
  await db.insert(plans).values({
    id: planId,
    path: "docs/superpowers/plans/example.md",
    status: "running",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(runs).values({
    id: runId,
    planId,
    mode,
    status: "running",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return runId;
}

describe("queued conversation messages", () => {
  beforeEach(async () => {
    mockAskAgent.mockReset();
    mockAskAgent.mockResolvedValue({
      response: "Worker received the queued note.",
      state: "idle",
    });
    mockGetAgent.mockReset();
    mockGetAgent.mockResolvedValue({
      name: "worker",
      type: "codex",
      cwd: "/workspace/app",
      state: "idle",
      outputEntries: [],
      renderedOutput: null,
      lastText: "",
      currentText: "",
      stderrBuffer: [],
      stopReason: null,
    });
    __resetWorkerTurnChainsForTests();
    __resetOutputStoreCachesForTests();
    await db.delete(executionEvents);
    await db.delete(supervisorInterventions);
    await db.delete(queuedConversationMessages);
    await db.delete(messages);
    await db.delete(workers);
    await db.delete(runs);
    await db.delete(plans);
  });

  it("creates and cancels pending queue entries without deleting audit rows", async () => {
    const runId = await createRun();
    const queued = await createQueuedConversationMessage({
      runId,
      action: "queue",
      content: "Remember to update the tests.",
      attachments: [],
    });

    await cancelQueuedConversationMessage({ runId, messageId: queued.id });

    const stored = await db.select().from(queuedConversationMessages).where(eq(queuedConversationMessages.id, queued.id)).get();
    expect(stored).toMatchObject({
      runId,
      content: "Remember to update the tests.",
      status: "cancelled",
    });
  });

  it("cancels delivering queue entries so stale send-now rows can be dismissed", async () => {
    const runId = await createRun();
    const queued = await createQueuedConversationMessage({
      runId,
      action: "steer",
      content: "This send-now row got stuck delivering.",
      attachments: [],
    });
    await db.update(queuedConversationMessages).set({
      status: "delivering",
      updatedAt: new Date(),
    }).where(eq(queuedConversationMessages.id, queued.id));

    const cancelled = await cancelQueuedConversationMessage({ runId, messageId: queued.id });

    expect(cancelled).toMatchObject({
      id: queued.id,
      status: "cancelled",
    });
    const stored = await db.select().from(queuedConversationMessages).where(eq(queuedConversationMessages.id, queued.id)).get();
    expect(stored).toMatchObject({
      runId,
      status: "cancelled",
    });
    const events = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId));
    expect(events.some((event) => event.eventType === "queued_message_cancelled")).toBe(true);
  });

  it("cancels failed queue entries so visible audit rows can be dismissed", async () => {
    const runId = await createRun("direct");
    const queued = await createQueuedConversationMessage({
      runId,
      action: "steer",
      content: "This queued row already failed.",
      attachments: [],
    });
    await db.update(queuedConversationMessages).set({
      status: "failed",
      lastError: "Agent stopped without producing output. Final state: idle.",
      updatedAt: new Date(),
    }).where(eq(queuedConversationMessages.id, queued.id));

    const cancelled = await cancelQueuedConversationMessage({ runId, messageId: queued.id });

    expect(cancelled).toMatchObject({
      id: queued.id,
      status: "cancelled",
      lastError: "Agent stopped without producing output. Final state: idle.",
    });
    const stored = await db.select().from(queuedConversationMessages).where(eq(queuedConversationMessages.id, queued.id)).get();
    expect(stored).toMatchObject({
      runId,
      status: "cancelled",
      lastError: "Agent stopped without producing output. Final state: idle.",
    });
    const events = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId));
    expect(events.some((event) => event.eventType === "queued_message_cancelled")).toBe(true);
  });

  it("drains implementation queue entries into user checkpoint messages in FIFO order", async () => {
    const runId = await createRun("implementation");
    await createQueuedConversationMessage({ runId, action: "queue", content: "First queued note", attachments: [] });
    await createQueuedConversationMessage({ runId, action: "queue", content: "Second queued note", attachments: [] });

    const drained = await drainQueuedImplementationMessages(runId);

    expect(drained).toBe(2);
    const storedMessages = await db.select().from(messages).where(eq(messages.runId, runId)).orderBy(messages.createdAt);
    expect(storedMessages.map((message) => message.content)).toEqual(["First queued note", "Second queued note"]);
    expect(storedMessages.every((message) => message.kind === "checkpoint")).toBe(true);

    const remainingPending = await db.select().from(queuedConversationMessages).where(eq(queuedConversationMessages.status, "pending"));
    expect(remainingPending).toHaveLength(0);
  });

  it("drains implementation steering to the active worker instead of only the supervisor transcript", async () => {
    const runId = await createRun("implementation");
    const workerId = `${runId}-worker-1`;
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "codex",
      status: "idle",
      cwd: "/workspace/app",
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await createQueuedConversationMessage({
      runId,
      action: "steer",
      content: "Spawn sub-agents when the work can be split safely.",
      attachments: [],
    });

    const drained = await drainQueuedImplementationMessages(runId);

    expect(drained).toBe(1);
    expect(mockAskAgent).toHaveBeenCalledWith(workerId, "Spawn sub-agents when the work can be split safely.");
    const storedQueued = await db.select().from(queuedConversationMessages).where(eq(queuedConversationMessages.runId, runId)).get();
    expect(storedQueued).toMatchObject({
      status: "delivered",
      action: "steer",
    });
    const interventions = await db.select().from(supervisorInterventions).where(eq(supervisorInterventions.runId, runId));
    expect(interventions).toHaveLength(1);
    expect(interventions[0]).toMatchObject({
      workerId,
      prompt: "Spawn sub-agents when the work can be split safely.",
    });
    const storedMessages = await db.select().from(messages).where(eq(messages.runId, runId)).orderBy(messages.createdAt);
    // Worker response now lives in the unified worker stream — only
    // user + supervisor narration remain in the `messages` table.
    expect(storedMessages.map((message) => message.role)).toEqual(["user", "supervisor"]);
    expect(storedMessages[1]?.content).toContain("sent that to worker 1");
  });

  it("keeps implementation steering pending when the active worker is still busy", async () => {
    const runId = await createRun("implementation");
    const workerId = `${runId}-worker-1`;
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "codex",
      status: "working",
      cwd: "/workspace/app",
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "Still working",
      lastText: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await createQueuedConversationMessage({
      runId,
      action: "steer",
      content: "Use parallel agents once the schema work is split.",
      attachments: [],
    });
    mockAskAgent.mockRejectedValueOnce(new Error(`Ask failed: Agent is busy: ${workerId}`));

    const drained = await drainQueuedImplementationMessages(runId);

    expect(drained).toBe(0);
    const storedQueued = await db.select().from(queuedConversationMessages).where(eq(queuedConversationMessages.runId, runId)).get();
    expect(storedQueued).toMatchObject({
      status: "pending",
      lastError: `Ask failed: Agent is busy: ${workerId}`,
    });
    expect(storedQueued?.deliveredAt).toBeNull();
    const storedMessages = await db.select().from(messages).where(eq(messages.runId, runId));
    expect(storedMessages).toHaveLength(0);
    const events = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId));
    expect(events.some((event) => event.eventType === "queued_message_deferred")).toBe(true);
  });

  it("drains worker queue entries through askAgent and records delivery output", async () => {
    const runId = await createRun("direct");
    const workerId = randomUUID();
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "codex",
      status: "idle",
      cwd: "/workspace/app",
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await createQueuedConversationMessage({ runId, targetWorkerId: workerId, action: "queue", content: "Queued worker note", attachments: [] });

    const drained = await drainQueuedWorkerMessages({ runId, workerId });

    expect(drained).toBe(1);
    expect(mockAskAgent).toHaveBeenCalledWith(workerId, "Queued worker note");
    const storedMessages = await db.select().from(messages).where(eq(messages.runId, runId)).orderBy(messages.createdAt);
    // Worker response now lives in the unified worker stream.
    expect(storedMessages.map((message) => message.role)).toEqual(["user"]);
    const entries = await readWorkerOutputEntries(runId, workerId);
    expect(entries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "user_input",
        text: "Queued worker note",
      }),
      expect.objectContaining({
        type: "message",
        text: "Worker received the queued note.",
      }),
    ]));
    const storedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    expect(storedRun).toMatchObject({ status: "done" });
  });

  it("keeps direct worker queue messages out of the conversation until delivery succeeds", async () => {
    const runId = await createRun("direct");
    const workerId = randomUUID();
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "codex",
      status: "working",
      cwd: "/workspace/app",
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "Still working",
      lastText: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await createQueuedConversationMessage({
      runId,
      targetWorkerId: workerId,
      action: "queue",
      content: "Please handle this once free.",
      attachments: [],
    });
    mockAskAgent.mockRejectedValueOnce(new Error(`Ask failed: Agent is busy: ${workerId}`));

    const drained = await drainQueuedWorkerMessages({ runId, workerId });

    expect(drained).toBe(0);
    const storedQueued = await db.select().from(queuedConversationMessages).where(eq(queuedConversationMessages.runId, runId)).get();
    const storedMessages = await db.select().from(messages).where(eq(messages.runId, runId));
    expect(storedQueued).toMatchObject({
      status: "pending",
      lastError: `Ask failed: Agent is busy: ${workerId}`,
    });
    expect(storedQueued?.deliveredAt).toBeNull();
    expect(storedMessages).toHaveLength(0);
  });

  it("keeps send-now worker queue entries pending when the worker is still busy", async () => {
    const runId = await createRun("direct");
    const workerId = randomUUID();
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "codex",
      status: "working",
      cwd: "/workspace/app",
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "Still working",
      lastText: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const queued = await createQueuedConversationMessage({
      runId,
      targetWorkerId: workerId,
      action: "queue",
      content: "Please handle this once free.",
      attachments: [],
    });
    mockAskAgent.mockRejectedValueOnce(new Error(`Ask failed: Agent is busy: ${workerId}`));

    await sendQueuedConversationMessageNow({ runId, messageId: queued.id });
    await delay(20);

    const stored = await db.select().from(queuedConversationMessages).where(eq(queuedConversationMessages.id, queued.id)).get();
    const storedMessages = await db.select().from(messages).where(eq(messages.runId, runId));
    const events = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId));

    expect(stored).toMatchObject({
      status: "pending",
      lastError: `Ask failed: Agent is busy: ${workerId}`,
    });
    expect(stored?.deliveredAt).toBeNull();
    expect(storedMessages).toHaveLength(0);
    expect(events.some((event) => event.eventType === "queued_message_deferred")).toBe(true);
  });

  it("anchors send-now queued worker input before bridge output can stream", async () => {
    const runId = await createRun("direct");
    const workerId = randomUUID();
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "codex",
      status: "idle",
      cwd: "/workspace/app",
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const queued = await createQueuedConversationMessage({
      runId,
      targetWorkerId: workerId,
      action: "queue",
      content: "Trace why the old warning is still rendering.",
      attachments: [],
    });
    mockAskAgent.mockImplementationOnce(async () => {
      await writeWorkerOutputEntries(runId, workerId, [
        {
          id: "bridge-during-queued-send",
          type: "message",
          text: "Got it. I will trace the stale warning.",
          timestamp: new Date().toISOString(),
        },
      ]);
      return {
        response: "Got it. I will trace the stale warning.",
        state: "idle",
      };
    });

    await sendQueuedConversationMessageNow({ runId, messageId: queued.id });

    const entries = await waitFor(
      () => readWorkerOutputEntries(runId, workerId),
      (items) => items.some((entry) => entry.id === queued.id)
        && items.some((entry) => entry.id === "bridge-during-queued-send"),
    );

    const userIndex = entries.findIndex((entry) => entry.id === queued.id);
    const bridgeIndex = entries.findIndex((entry) => entry.id === "bridge-during-queued-send");
    expect(userIndex).toBeGreaterThan(-1);
    expect(bridgeIndex).toBeGreaterThan(-1);
    expect(entries[userIndex]).toMatchObject({
      type: "user_input",
      text: "Trace why the old warning is still rendering.",
    });
    expect(userIndex).toBeLessThan(bridgeIndex);
  });

  it("persists send-now queued worker responses and clears direct running state", async () => {
    const runId = await createRun("direct");
    const workerId = randomUUID();
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "codex",
      status: "idle",
      cwd: "/workspace/app",
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const queued = await createQueuedConversationMessage({
      runId,
      targetWorkerId: workerId,
      action: "queue",
      content: "Why did force-send stay queued?",
      attachments: [],
    });
    mockAskAgent.mockResolvedValueOnce({
      response: "The force-send reached the worker and is complete.",
      state: "idle",
    });

    await sendQueuedConversationMessageNow({ runId, messageId: queued.id });

    const storedQueued = await waitFor(
      async () => db.select().from(queuedConversationMessages).where(eq(queuedConversationMessages.id, queued.id)).get(),
      (record) => record?.status === "delivered",
    );
    const entries = await readWorkerOutputEntries(runId, workerId);
    const storedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();

    expect(storedQueued).toMatchObject({
      status: "delivered",
      lastError: null,
    });
    expect(entries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: queued.id,
        type: "user_input",
        text: "Why did force-send stay queued?",
      }),
      expect.objectContaining({
        type: "message",
        text: "The force-send reached the worker and is complete.",
      }),
    ]));
    expect(storedRun).toMatchObject({ status: "done" });
  });

  it("does not mark send-now queued steering delivered when the worker produces no post-input output", async () => {
    const runId = await createRun("direct");
    const workerId = randomUUID();
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "codex",
      status: "idle",
      cwd: "/workspace/app",
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const previousTimestamp = new Date(Date.now() - 60_000).toISOString();
    await writeWorkerOutputEntries(runId, workerId, [
      {
        id: "previous-answer",
        type: "message",
        text: "Previous answer before the queued message.",
        timestamp: previousTimestamp,
      },
    ]);
    const queued = await createQueuedConversationMessage({
      runId,
      targetWorkerId: workerId,
      action: "queue",
      content: "Why did the goal force-send do nothing?",
      attachments: [],
    });
    mockAskAgent.mockResolvedValueOnce({
      response: "",
      state: "idle",
    });
    mockGetAgent.mockResolvedValueOnce({
      name: workerId,
      type: "codex",
      cwd: "/workspace/app",
      state: "idle",
      outputEntries: [
        {
          id: "previous-answer",
          type: "message",
          text: "Previous answer before the queued message.",
          timestamp: previousTimestamp,
        },
      ],
      renderedOutput: "Previous answer before the queued message.",
      lastText: "",
      currentText: "",
      stderrBuffer: [],
      stopReason: "end_turn",
    });

    await sendQueuedConversationMessageNow({ runId, messageId: queued.id });

    const storedQueued = await waitFor(
      async () => db.select().from(queuedConversationMessages).where(eq(queuedConversationMessages.id, queued.id)).get(),
      (record) => record?.status === "failed",
    );
    // The catch block updates the queue first and emits the failure
    // event last. With the artifact-storage adapter inserting a fresh
    // `artifact_streams` row before each event, the catch path has
    // several awaits between queue-update and event-emit. Wait for the
    // event itself so the assertions see the final state.
    const events = await waitFor(
      async () => db.select().from(executionEvents).where(eq(executionEvents.runId, runId)),
      (rows) => rows.some((event) => event.eventType === "queued_message_failed"),
    );
    const storedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const storedWorker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    const entries = await readWorkerOutputEntries(runId, workerId);

    expect(storedQueued?.lastError).toContain("stopped without producing output");
    expect(storedQueued?.deliveredAt).toBeNull();
    expect(storedRun).toMatchObject({
      status: "failed",
      lastError: expect.stringContaining("stopped without producing output"),
    });
    expect(storedWorker).toMatchObject({
      status: "error",
      outputLog: expect.stringContaining("stopped without producing output"),
    });
    expect(events.some((event) => event.eventType === "queued_message_failed")).toBe(true);
    expect(events.some((event) => event.eventType === "queued_message_delivered")).toBe(false);
    expect(entries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: queued.id,
        type: "user_input",
        text: "Why did the goal force-send do nothing?",
      }),
    ]));
    expect(entries.filter((entry) => entry.type === "message")).toHaveLength(1);
  });

  it("does not resurrect a cancelled send-now delivery when the background bridge call finishes", async () => {
    const runId = await createRun("direct");
    const workerId = randomUUID();
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "codex",
      status: "idle",
      cwd: "/workspace/app",
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const queued = await createQueuedConversationMessage({
      runId,
      targetWorkerId: workerId,
      action: "queue",
      content: "Cancel this while the bridge call is still open.",
      attachments: [],
    });
    const bridgeReply = deferred<{ response: string; state: string }>();
    mockAskAgent.mockImplementationOnce(() => bridgeReply.promise);

    await sendQueuedConversationMessageNow({ runId, messageId: queued.id });
    await waitFor(
      async () => db.select().from(queuedConversationMessages).where(eq(queuedConversationMessages.id, queued.id)).get(),
      (record) => record?.status === "delivering",
    );

    await cancelQueuedConversationMessage({ runId, messageId: queued.id });
    bridgeReply.resolve({
      response: "This response arrived after cancellation.",
      state: "idle",
    });

    const stored = await waitFor(
      async () => db.select().from(queuedConversationMessages).where(eq(queuedConversationMessages.id, queued.id)).get(),
      (record) => record?.status === "cancelled",
    );
    await delay(20);
    const afterBackgroundSettles = await db.select().from(queuedConversationMessages).where(eq(queuedConversationMessages.id, queued.id)).get();
    const events = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId));

    expect(stored).toMatchObject({ status: "cancelled" });
    expect(afterBackgroundSettles).toMatchObject({
      status: "cancelled",
      deliveredAt: null,
    });
    expect(events.some((event) => event.eventType === "queued_message_delivered")).toBe(false);
  });
});
