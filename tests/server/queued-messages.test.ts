import { randomUUID } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { executionEvents, messages, plans, queuedConversationMessages, runs, workers } from "@/server/db/schema";

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
} from "@/server/conversations/queued-messages";

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
    expect(storedMessages.map((message) => message.role)).toEqual(["user", "worker"]);
    expect(storedMessages[1]?.content).toBe("Worker received the queued note.");
  });
});
