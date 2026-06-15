import { randomUUID } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { executionEvents, messages, plans, queuedConversationMessages, runs, workers } from "@/server/db/schema";
import {
  __resetOutputStoreCachesForTests,
  readWorkerOutputEntries,
} from "@/server/workers/output-store";

const { mockAskAgent, mockGetAgent, mockCancelAgentTurn } = vi.hoisted(() => ({
  mockAskAgent: vi.fn(),
  mockGetAgent: vi.fn(),
  mockCancelAgentTurn: vi.fn(),
}));

vi.mock("@/server/bridge-client", () => ({
  askAgent: mockAskAgent,
  getAgent: mockGetAgent,
  cancelAgentTurn: mockCancelAgentTurn,
}));

import {
  createQueuedConversationMessage,
} from "@/server/conversations/queued-messages";
import {
  interruptAndSendNextQueuedConversationMessage,
  interruptAndSendQueuedConversationMessageNow,
  interruptWithDraftMessage,
} from "@/server/conversations/queued-message-interrupt";
import {
  __resetWorkerTurnChainsForTests,
  waitForConversationBackgroundTasksForTests,
} from "@/server/conversations/worker-turn-gate";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function createRun(mode: "implementation" | "planning" | "direct" = "direct") {
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

async function createBusyWorker(runId: string, suffix = 1) {
  const workerId = `${runId}-worker-${suffix}`;
  await db.insert(workers).values({
    id: workerId,
    runId,
    type: "codex",
    status: "working",
    cwd: "/workspace/app",
    outputLog: "",
    outputEntriesJson: "[]",
    currentText: "Busy on the previous turn...",
    lastText: "",
    createdAt: new Date(Date.now() - 1000),
    updatedAt: new Date(),
  });
  return workerId;
}

describe("queued conversation message interrupt", () => {
  beforeEach(async () => {
    mockAskAgent.mockReset();
    mockAskAgent.mockResolvedValue({ response: "Acknowledged the interrupt.", state: "idle" });
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
    mockCancelAgentTurn.mockReset();
    mockCancelAgentTurn.mockResolvedValue({ ok: true, name: "worker", cancelledPermissions: 0 });
    __resetWorkerTurnChainsForTests();
    __resetOutputStoreCachesForTests();
    await db.delete(executionEvents);
    await db.delete(queuedConversationMessages);
    await db.delete(messages);
    await db.delete(workers);
    await db.delete(runs);
    await db.delete(plans);
  });

  it("interrupts the active turn and delivers a specific queued message", async () => {
    const runId = await createRun("direct");
    const workerId = await createBusyWorker(runId);
    const queued = await createQueuedConversationMessage({
      runId,
      targetWorkerId: workerId,
      action: "queue",
      content: "Actually, focus on the failing test first.",
      attachments: [],
    });

    const result = await interruptAndSendQueuedConversationMessageNow({ runId, messageId: queued.id });
    expect(result.interruption.status).toBe("delivering");
    expect(mockCancelAgentTurn).toHaveBeenCalledWith(workerId);

    await waitForConversationBackgroundTasksForTests();

    const stored = await db.select().from(queuedConversationMessages).where(eq(queuedConversationMessages.id, queued.id)).get();
    expect(stored?.status).toBe("delivered");
    expect(mockAskAgent).toHaveBeenCalledWith(workerId, "Actually, focus on the failing test first.");

    const worker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    expect(worker?.turnGeneration).toBe(1);

    const entries = await readWorkerOutputEntries(runId, workerId);
    expect(entries.some((entry) => entry.type === "user_input" && entry.text.includes("failing test"))).toBe(true);
  });

  it("selects the oldest pending queued message by (createdAt, id) for interrupt-next", async () => {
    const runId = await createRun("direct");
    const workerId = await createBusyWorker(runId);
    const first = await createQueuedConversationMessage({ runId, targetWorkerId: workerId, action: "queue", content: "First note", attachments: [] });
    await createQueuedConversationMessage({ runId, targetWorkerId: workerId, action: "queue", content: "Second note", attachments: [] });

    await interruptAndSendNextQueuedConversationMessage({ runId });
    await waitForConversationBackgroundTasksForTests();

    expect(mockAskAgent).toHaveBeenCalledTimes(1);
    expect(mockAskAgent).toHaveBeenCalledWith(workerId, "First note");
    const stored = await db.select().from(queuedConversationMessages).where(eq(queuedConversationMessages.id, first.id)).get();
    expect(stored?.status).toBe("delivered");
  });

  it("creates exactly one queued row from a draft and delivers that same id", async () => {
    const runId = await createRun("direct");
    const workerId = await createBusyWorker(runId);

    const result = await interruptWithDraftMessage({ runId, content: "Stop and run the linter.", attachments: [] });
    await waitForConversationBackgroundTasksForTests();

    const rows = await db.select().from(queuedConversationMessages).where(eq(queuedConversationMessages.runId, runId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(result.queuedMessage.id);
    expect(rows[0]?.status).toBe("delivered");
    expect(mockAskAgent).toHaveBeenCalledWith(workerId, "Stop and run the linter.");
  });

  it("keeps the queued message pending when cancelling the turn fails", async () => {
    const runId = await createRun("direct");
    const workerId = await createBusyWorker(runId);
    const queued = await createQueuedConversationMessage({ runId, targetWorkerId: workerId, action: "queue", content: "Try again", attachments: [] });
    mockCancelAgentTurn.mockRejectedValueOnce(new Error("Cancel turn failed: bridge unreachable"));

    await expect(interruptAndSendQueuedConversationMessageNow({ runId, messageId: queued.id })).rejects.toThrow(/interrupt the active turn/i);
    await waitForConversationBackgroundTasksForTests();

    const stored = await db.select().from(queuedConversationMessages).where(eq(queuedConversationMessages.id, queued.id)).get();
    expect(stored?.status).toBe("pending");
    expect(mockAskAgent).not.toHaveBeenCalled();
  });

  it("keeps the queued message pending when the worker is still busy after cancel", async () => {
    const runId = await createRun("direct");
    const workerId = await createBusyWorker(runId);
    const queued = await createQueuedConversationMessage({ runId, targetWorkerId: workerId, action: "queue", content: "Hurry up", attachments: [] });
    mockAskAgent.mockRejectedValueOnce(new Error("Ask failed: Agent is busy: " + workerId));

    await interruptAndSendQueuedConversationMessageNow({ runId, messageId: queued.id });
    await waitForConversationBackgroundTasksForTests();

    const stored = await db.select().from(queuedConversationMessages).where(eq(queuedConversationMessages.id, queued.id)).get();
    expect(stored?.status).toBe("pending");
    expect(stored?.lastError).toMatch(/agent is busy/i);
    const events = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId));
    expect(events.some((event) => event.eventType === "queued_message_interrupt_deferred")).toBe(true);
  });

  it("does not let a stale interrupted-turn completion overwrite a newer delivery", async () => {
    const runId = await createRun("direct");
    const workerId = await createBusyWorker(runId);
    const first = await createQueuedConversationMessage({ runId, targetWorkerId: workerId, action: "queue", content: "First interrupt", attachments: [] });

    // The first delivery's askAgent hangs until we release it, simulating the
    // interrupted turn finishing late.
    const firstAsk = deferred<{ response: string; state: string }>();
    mockAskAgent.mockReturnValueOnce(firstAsk.promise);

    await interruptAndSendQueuedConversationMessageNow({ runId, messageId: first.id });
    await delay(20);

    // A second interrupt with a draft advances the worker turn fence (to gen 2)
    // while the first delivery is still in flight. Its delivery queues behind
    // the first on the per-worker turn gate.
    const second = await interruptWithDraftMessage({ runId, content: "Second interrupt", attachments: [] });
    await delay(20);

    // Now the stale first turn finally resolves. Its captured generation (1) is
    // behind the fence, so it must no-op instead of marking itself delivered,
    // which frees the gate for the second delivery to run and deliver.
    firstAsk.resolve({ response: "Late output from the interrupted turn.", state: "idle" });
    await waitForConversationBackgroundTasksForTests();

    const storedSecond = await db.select().from(queuedConversationMessages).where(eq(queuedConversationMessages.id, second.queuedMessage.id)).get();
    expect(storedSecond?.status).toBe("delivered");

    // The stale first delivery must not have flipped to delivered after the
    // fence advanced past its captured generation.
    const storedFirst = await db.select().from(queuedConversationMessages).where(eq(queuedConversationMessages.id, first.id)).get();
    expect(storedFirst?.status).not.toBe("delivered");

    const worker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    expect(worker?.turnGeneration).toBe(2);
  });
});
