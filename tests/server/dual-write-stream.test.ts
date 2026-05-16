import { randomUUID } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
  executionEvents,
  messages,
  plans,
  queuedConversationMessages,
  runs,
  supervisorInterventions,
  workers,
} from "@/server/db/schema";
import {
  __resetOutputStoreCachesForTests,
  readWorkerOutputEntries,
} from "@/server/workers/output-store";

const { mockAskAgent } = vi.hoisted(() => ({
  mockAskAgent: vi.fn().mockResolvedValue({
    response: "Worker received the steering note.",
    state: "idle",
  }),
}));

vi.mock("@/server/bridge-client", () => ({
  askAgent: mockAskAgent,
}));

import {
  createQueuedConversationMessage,
  drainQueuedImplementationMessages,
  drainQueuedWorkerMessages,
} from "@/server/conversations/queued-messages";

async function createDirectRun() {
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
    mode: "direct",
    status: "running",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return runId;
}

async function createImplementationRun() {
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
    mode: "implementation",
    status: "running",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return runId;
}

async function insertActiveWorker(runId: string) {
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
    workerNumber: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return workerId;
}

describe("unified worker stream — dual-write on delivery", () => {
  beforeEach(async () => {
    mockAskAgent.mockClear();
    __resetOutputStoreCachesForTests();
    await db.delete(executionEvents);
    await db.delete(supervisorInterventions);
    await db.delete(queuedConversationMessages);
    await db.delete(messages);
    await db.delete(workers);
    await db.delete(runs);
    await db.delete(plans);
  });

  afterEach(() => {
    __resetOutputStoreCachesForTests();
  });

  it("queued worker delivery appends user_input exactly once with the literal user text", async () => {
    const runId = await createDirectRun();
    const workerId = await insertActiveWorker(runId);
    await createQueuedConversationMessage({
      runId,
      targetWorkerId: workerId,
      action: "queue",
      content: "Add a sanity test for the cache invalidator.",
      attachments: [],
    });

    const delivered = await drainQueuedWorkerMessages({ runId, workerId });
    expect(delivered).toBe(1);

    const entries = await readWorkerOutputEntries(runId, workerId);
    const userInputs = entries.filter((entry) => (entry as any).type === "user_input");
    const storedMessages = await db.select().from(messages).where(eq(messages.runId, runId));
    expect(userInputs).toHaveLength(1);
    expect((userInputs[0] as any).id).toBe(storedMessages[0]?.id);
    expect((userInputs[0] as any).text).toBe("Add a sanity test for the cache invalidator.");
    expect((userInputs[0] as any).authorRole).toBe("user");
  });

  it("queued worker delivery that fails busy appends zero user_input entries", async () => {
    const runId = await createDirectRun();
    const workerId = await insertActiveWorker(runId);
    await createQueuedConversationMessage({
      runId,
      targetWorkerId: workerId,
      action: "queue",
      content: "Try again later.",
      attachments: [],
    });
    mockAskAgent.mockRejectedValueOnce(new Error(`Ask failed: Agent is busy: ${workerId}`));

    const delivered = await drainQueuedWorkerMessages({ runId, workerId });
    expect(delivered).toBe(0);

    const entries = await readWorkerOutputEntries(runId, workerId);
    const userInputs = entries.filter((entry) => (entry as any).type === "user_input");
    expect(userInputs).toHaveLength(0);
  });

  it("implementation steering delivery appends user_input exactly once", async () => {
    const runId = await createImplementationRun();
    const workerId = await insertActiveWorker(runId);
    await createQueuedConversationMessage({
      runId,
      action: "steer",
      content: "Pause and run the failing test under --inspect.",
      attachments: [],
    });

    const delivered = await drainQueuedImplementationMessages(runId);
    expect(delivered).toBe(1);

    const entries = await readWorkerOutputEntries(runId, workerId);
    const userInputs = entries.filter((entry) => (entry as any).type === "user_input");
    const storedMessages = await db.select().from(messages).where(eq(messages.runId, runId));
    expect(userInputs).toHaveLength(1);
    expect((userInputs[0] as any).id).toBe(storedMessages.find((message) => message.role === "user")?.id);
    expect((userInputs[0] as any).text).toBe("Pause and run the failing test under --inspect.");
  });

  it("appends a user_input entry on queued delivery (post-Phase-5: flag is gone, stream is unconditional)", async () => {
    const runId = await createDirectRun();
    const workerId = await insertActiveWorker(runId);
    await createQueuedConversationMessage({
      runId,
      targetWorkerId: workerId,
      action: "queue",
      content: "Always persists to the unified worker stream now.",
      attachments: [],
    });

    const delivered = await drainQueuedWorkerMessages({ runId, workerId });
    expect(delivered).toBe(1);

    const entries = await readWorkerOutputEntries(runId, workerId);
    const userInputs = entries.filter((entry) => (entry as any).type === "user_input");
    expect(userInputs).toHaveLength(1);
  });
});
