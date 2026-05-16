import { randomUUID } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { executionEvents, messages, plans, queuedConversationMessages, runs, supervisorInterventions, workers } from "@/server/db/schema";

const { mockAskAgent } = vi.hoisted(() => ({
  mockAskAgent: vi.fn().mockResolvedValue({
    response: "Worker received the queued note.",
    state: "idle",
  }),
}));

vi.mock("@/server/bridge-client", () => ({
  askAgent: mockAskAgent,
}));

import {
  cancelQueuedConversationMessage,
  createQueuedConversationMessage,
  drainQueuedImplementationMessages,
  drainQueuedWorkerMessages,
  sendQueuedConversationMessageNow,
} from "@/server/conversations/queued-messages";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    mockAskAgent.mockClear();
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
});
