import { randomUUID } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { executionEvents, messages, plans, queuedConversationMessages, recoveryIncidents, runs, workers } from "@/server/db/schema";
import { __resetNamedEventsForTests, getNamedEventsSince } from "@/server/events/named-events";
import {
  __resetOutputStoreCachesForTests,
  readWorkerOutputEntries,
  writeWorkerOutputEntries,
} from "@/server/workers/output-store";

const { mockAskAgent, mockGetAgent, mockCancelAgent, mockCancelAgentTurn, mockSpawnAgent, mockSteerAgentTurn } = vi.hoisted(() => ({
  mockSteerAgentTurn: vi.fn(),
  mockAskAgent: vi.fn(),
  mockGetAgent: vi.fn(),
  mockCancelAgent: vi.fn(),
  mockCancelAgentTurn: vi.fn(),
  mockSpawnAgent: vi.fn(),
}));

vi.mock("@/server/bridge-client", () => ({
  askAgent: mockAskAgent,
  cancelAgent: mockCancelAgent,
  getAgent: mockGetAgent,
  cancelAgentTurn: mockCancelAgentTurn,
  spawnAgent: mockSpawnAgent,
  steerAgentTurn: mockSteerAgentTurn,
}));

import {
  createQueuedConversationMessage,
  drainQueuedWorkerMessages,
  listPendingQueuedConversationMessages,
  reclaimOrphanedDeliveringMessages,
} from "@/server/conversations/queued-messages";
import {
  interruptAndSendNextQueuedConversationMessage,
  interruptAndSendQueuedConversationMessageNow,
  interruptWithDraftMessage,
} from "@/server/conversations/queued-message-interrupt";
import {
  __resetWorkerTurnChainsForTests,
  currentWorkerTurnSignal,
  readWorkerTurnGeneration,
  runConversationMutation,
  runWorkerTurn,
  runConversationRecoveryWorkerTurn,
  beginConversationRecoveryPreemption,
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
    mockSteerAgentTurn.mockReset();
    mockSteerAgentTurn.mockResolvedValue({ name: "worker", outcome: "promptRequired", reason: "unsupported" });
    mockCancelAgent.mockReset();
    mockCancelAgent.mockResolvedValue(undefined);
    mockSpawnAgent.mockReset();
    mockSpawnAgent.mockResolvedValue({
      name: "worker",
      type: "codex",
      cwd: "/workspace/app",
      state: "idle",
      sessionId: "recreated-session",
      sessionMode: "full-access",
      outputEntries: [],
      currentText: "",
      lastText: "",
    });
    __resetNamedEventsForTests();
    __resetWorkerTurnChainsForTests();
    __resetOutputStoreCachesForTests();
    await db.delete(executionEvents);
    await db.delete(recoveryIncidents);
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
    expect(mockAskAgent).toHaveBeenCalledWith(workerId, expect.stringContaining("Actually, focus on the failing test first."));
    // The worker must learn the cancellation was the harness delivering a
    // steer, not the user rejecting its work.
    const steerPrompt = mockAskAgent.mock.calls.at(-1)?.[1] as string;
    expect(steerPrompt.startsWith("OmniHarness steer notice:")).toBe(true);
    expect(steerPrompt).toContain("They did not cancel, stop, or reject anything.");
    expect(steerPrompt).toContain("OmniHarness direct-control instruction:");

    const worker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    expect(worker?.turnGeneration).toBe(1);

    const entries = await readWorkerOutputEntries(runId, workerId);
    expect(entries.some((entry) => entry.type === "user_input" && entry.text.includes("failing test"))).toBe(true);
  });

  it("does not send the replacement prompt until the provider-side cancel settles", async () => {
    const runId = await createRun("direct");
    const workerId = await createBusyWorker(runId);
    const queued = await createQueuedConversationMessage({
      runId,
      targetWorkerId: workerId,
      action: "queue",
      content: "Use the session id I just sent.",
      attachments: [],
    });
    const cancel = deferred<{ ok: boolean; name: string; cancelledPermissions: number }>();
    mockCancelAgentTurn.mockReturnValueOnce(cancel.promise);

    await interruptAndSendQueuedConversationMessageNow({ runId, messageId: queued.id });
    await delay(20);
    const askedBeforeCancelSettled = mockAskAgent.mock.calls.length > 0;

    cancel.resolve({ ok: true, name: workerId, cancelledPermissions: 0 });
    await waitForConversationBackgroundTasksForTests();

    expect(askedBeforeCancelSettled).toBe(false);
    expect(mockAskAgent).toHaveBeenCalledWith(workerId, expect.stringContaining("Use the session id I just sent."));
    const stored = await db.select().from(queuedConversationMessages).where(eq(queuedConversationMessages.id, queued.id)).get();
    expect(stored?.status).toBe("delivered");
  });

  it("does not count late output from the cancelled turn as the replacement prompt response", async () => {
    const runId = await createRun("direct");
    const workerId = await createBusyWorker(runId);
    const queued = await createQueuedConversationMessage({
      runId,
      targetWorkerId: workerId,
      action: "queue",
      content: "Use the corrected session id.",
      attachments: [],
    });
    const oldTurnTimestamp = new Date(Date.now() - 60_000).toISOString();
    await writeWorkerOutputEntries(runId, workerId, [{
      id: "old-tool-start",
      type: "tool_call",
      text: "Terminal",
      timestamp: oldTurnTimestamp,
      toolCallId: "old-tool",
      status: "pending",
    }]);
    mockAskAgent.mockResolvedValueOnce({ response: "", state: "idle" });
    mockGetAgent.mockResolvedValueOnce({
      name: workerId,
      type: "codex",
      cwd: "/workspace/app",
      state: "idle",
      outputEntries: [
        {
          id: "old-tool-start",
          type: "tool_call",
          text: "Terminal",
          timestamp: oldTurnTimestamp,
          toolCallId: "old-tool",
          status: "pending",
        },
        {
          id: "old-tool-cancelled",
          type: "tool_call_update",
          text: "failed",
          timestamp: new Date().toISOString(),
          toolCallId: "old-tool",
          status: "failed",
        },
      ],
      renderedOutput: "failed",
      lastText: "",
      currentText: "",
      stderrBuffer: [],
      stopReason: null,
    });

    await interruptAndSendQueuedConversationMessageNow({ runId, messageId: queued.id });
    await waitForConversationBackgroundTasksForTests();

    const stored = await db.select().from(queuedConversationMessages).where(eq(queuedConversationMessages.id, queued.id)).get();
    expect(stored?.status).toBe("failed");
    const events = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId));
    expect(events.some((event) => event.eventType === "queued_message_interrupt_delivered")).toBe(false);
    expect(events.some((event) => event.eventType === "queued_message_interrupt_failed")).toBe(true);
  });

  it("selects the oldest pending queued message by (createdAt, id) for interrupt-next", async () => {
    const runId = await createRun("direct");
    const workerId = await createBusyWorker(runId);
    const first = await createQueuedConversationMessage({ runId, targetWorkerId: workerId, action: "queue", content: "First note", attachments: [] });
    await createQueuedConversationMessage({ runId, targetWorkerId: workerId, action: "queue", content: "Second note", attachments: [] });

    await interruptAndSendNextQueuedConversationMessage({ runId });
    await waitForConversationBackgroundTasksForTests();

    expect(mockAskAgent).toHaveBeenCalledTimes(1);
    expect(mockAskAgent).toHaveBeenCalledWith(workerId, expect.stringContaining("First note"));
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
    expect(mockAskAgent).toHaveBeenCalledWith(workerId, expect.stringContaining("Stop and run the linter."));
  });

  it("lets a steer draft break in on a recovery turn that holds the conversation mutex", async () => {
    const runId = await createRun("direct");
    const workerId = await createBusyWorker(runId);

    // Simulate recoverRun: hold the conversation mutex across a provider turn
    // that only ends when its ambient turn signal aborts.
    const epoch = beginConversationRecoveryPreemption(runId, "retry");
    const recoveryTurnStarted = deferred<void>();
    const recovery = runConversationMutation(runId, () =>
      runConversationRecoveryWorkerTurn(runId, epoch, workerId, (signal) => {
        recoveryTurnStarted.resolve();
        return new Promise<never>((_, reject) => {
          signal.addEventListener("abort", () => reject(new Error("worker turn aborted")), { once: true });
        });
      }),
    ).catch(() => undefined);
    await recoveryTurnStarted.promise;

    const result = await interruptWithDraftMessage({
      runId,
      content: "Stop — do this instead.",
      targetWorkerId: workerId,
      source: "api",
    });
    expect(result.interruption.status).toBe("delivering");

    await recovery;
    await waitForConversationBackgroundTasksForTests();
  });

  it("still steers when the agent-side cancel fails", async () => {
    // Steer is cancel-and-replace and must be instant. The local abort already
    // ended the turn, so `session/cancel` is only a courtesy to the agent —
    // refusing the user's steer because that courtesy failed (the old 502) made
    // a wedged or unreachable agent able to veto stopping it.
    const runId = await createRun("direct");
    const workerId = await createBusyWorker(runId);
    const queued = await createQueuedConversationMessage({ runId, targetWorkerId: workerId, action: "queue", content: "Try again", attachments: [] });
    mockCancelAgentTurn.mockRejectedValueOnce(new Error("Cancel turn failed: bridge unreachable"));

    const result = await interruptAndSendQueuedConversationMessageNow({ runId, messageId: queued.id });
    await waitForConversationBackgroundTasksForTests();

    expect(result.ok).toBe(true);
    const stored = await db.select().from(queuedConversationMessages).where(eq(queuedConversationMessages.id, queued.id)).get();
    expect(stored?.status).toBe("delivered");
    expect(mockAskAgent).toHaveBeenCalledWith(workerId, expect.stringContaining("Try again"));
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

  it("recovers a missing runtime agent without surfacing the internal 404", async () => {
    const runId = await createRun("direct");
    const workerId = await createBusyWorker(runId);
    const queued = await createQueuedConversationMessage({
      runId,
      targetWorkerId: workerId,
      action: "queue",
      content: "Continue after the runtime restart.",
      attachments: [],
    });
    mockAskAgent
      .mockRejectedValueOnce(new Error(`Ask failed: Agent not found: ${workerId}`))
      .mockResolvedValueOnce({ response: "Continued after recovery.", state: "idle" });
    mockSpawnAgent.mockRejectedValueOnce(new Error(`Spawn failed: Agent is already starting: ${workerId}`));
    mockGetAgent
      .mockRejectedValueOnce(new Error(`Get agent failed: Agent not found: ${workerId}`))
      .mockResolvedValue({
        name: workerId,
        type: "codex",
        cwd: "/workspace/app",
        state: "idle",
        sessionId: "recreated-session",
        sessionMode: "full-access",
        outputEntries: [],
        renderedOutput: null,
        currentText: "",
        lastText: "",
        stderrBuffer: [],
        stopReason: null,
      });

    await interruptAndSendQueuedConversationMessageNow({ runId, messageId: queued.id });
    await waitForConversationBackgroundTasksForTests();

    const stored = await db.select().from(queuedConversationMessages)
      .where(eq(queuedConversationMessages.id, queued.id))
      .get();
    expect(stored?.status).toBe("delivered");
    expect(stored?.lastError).toBeNull();
    expect(mockSpawnAgent).toHaveBeenCalledWith(expect.objectContaining({ name: workerId }));
    expect(mockAskAgent).toHaveBeenCalledTimes(2);
    expect(await db.select().from(messages).where(eq(messages.id, queued.id))).toHaveLength(1);

    const namedEvents = getNamedEventsSince(0, { runId }).events.map((entry) => entry.event);
    expect(namedEvents).toContainEqual(expect.objectContaining({
      kind: "worker.recreated",
      runId,
      workerId,
    }));
    expect(namedEvents).not.toContainEqual(expect.objectContaining({
      kind: "error.surfaced",
      message: expect.stringMatching(/agent not found/i),
    }));
  });

  it("redelivers a blocked interrupt after resuming its saved session", async () => {
    const runId = await createRun("direct");
    const workerId = await createBusyWorker(runId);
    await db.update(workers).set({
      bridgeSessionId: "saved-session",
      bridgeSessionMode: "full-access",
    }).where(eq(workers.id, workerId));
    const queued = await createQueuedConversationMessage({
      runId,
      targetWorkerId: workerId,
      action: "queue",
      content: "Resume and deliver this once.",
      attachments: [],
    });
    mockAskAgent
      .mockRejectedValueOnce(new Error(`Ask failed: Agent not found: ${workerId}`))
      .mockResolvedValueOnce({ response: "Delivered after resume.", state: "idle" });
    mockSpawnAgent.mockResolvedValueOnce({
      name: workerId,
      type: "codex",
      cwd: "/workspace/app",
      state: "idle",
      sessionId: "saved-session",
      sessionMode: "full-access",
      outputEntries: [],
      currentText: "",
      lastText: "",
    });
    mockGetAgent.mockResolvedValue({
      name: workerId,
      type: "codex",
      cwd: "/workspace/app",
      state: "idle",
      sessionId: "saved-session",
      sessionMode: "full-access",
      outputEntries: [],
      renderedOutput: null,
      currentText: "",
      lastText: "",
      stderrBuffer: [],
      stopReason: null,
    });

    await interruptAndSendQueuedConversationMessageNow({ runId, messageId: queued.id });
    await waitForConversationBackgroundTasksForTests();

    const stored = await db.select().from(queuedConversationMessages)
      .where(eq(queuedConversationMessages.id, queued.id))
      .get();
    expect(stored?.status).toBe("delivered");
    expect(stored?.lastError).toBeNull();
    expect(mockSpawnAgent).toHaveBeenCalledWith(expect.objectContaining({
      name: workerId,
      resumeSessionId: "saved-session",
    }));
    expect(mockAskAgent.mock.calls.filter((call) => call[1].includes("Resume and deliver this once."))).toHaveLength(2);
    expect(await db.select().from(messages).where(eq(messages.id, queued.id))).toHaveLength(1);
  });

  it("does not redeliver a recovered queue row into a newer worker turn", async () => {
    const runId = await createRun("direct");
    const workerId = await createBusyWorker(runId);
    const queued = await createQueuedConversationMessage({
      runId,
      targetWorkerId: workerId,
      action: "steer",
      content: "This belongs to the superseded turn.",
      attachments: [],
    });

    const delivered = await drainQueuedWorkerMessages({
      runId,
      workerId,
      expectedTurnGeneration: 1,
    });

    expect(delivered).toBe(0);
    expect(mockAskAgent).not.toHaveBeenCalled();
    expect((await db.select().from(queuedConversationMessages)
      .where(eq(queuedConversationMessages.id, queued.id)).get())?.status).toBe("pending");
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

    // The stale turn must not persist its late response over the newer one.
    // That guard runs before `persistDeliveredWorkerResponse`, so the late
    // output never reaches the transcript.
    const entries = await readWorkerOutputEntries(runId, workerId);
    expect(entries.some((entry) => entry.text.includes("Late output from the interrupted turn."))).toBe(false);

    // Its queue row must still end up terminal. Bailing out used to leave it in
    // `delivering` forever, which no longer merely looks untidy: `delivering`
    // rows are not listed as queued, so a dangling row is a message that
    // vanished from the queue without ever resolving.
    const storedFirst = await db.select().from(queuedConversationMessages).where(eq(queuedConversationMessages.id, first.id)).get();
    expect(storedFirst?.status).not.toBe("delivering");
    expect(await listPendingQueuedConversationMessages(runId)).toHaveLength(0);
    const supersededEvents = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId));
    expect(supersededEvents.some((event) => event.eventType === "queued_message_interrupt_superseded")).toBe(true);

    const worker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    expect(worker?.turnGeneration).toBe(2);
  });

  it("releases a delivery row when a newer steer aborts its worker turn", async () => {
    const runId = await createRun("direct");
    const workerId = await createBusyWorker(runId);
    const first = await createQueuedConversationMessage({
      runId,
      targetWorkerId: workerId,
      action: "queue",
      content: "First interrupt",
      attachments: [],
    });
    mockAskAgent.mockImplementationOnce(() => {
      const signal = currentWorkerTurnSignal();
      return new Promise((_resolve, reject) => {
        signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
    });

    await interruptAndSendQueuedConversationMessageNow({ runId, messageId: first.id });
    await delay(20);
    const second = await interruptWithDraftMessage({
      runId,
      content: "Second interrupt",
      attachments: [],
    });
    await waitForConversationBackgroundTasksForTests();

    const storedFirst = await db
      .select()
      .from(queuedConversationMessages)
      .where(eq(queuedConversationMessages.id, first.id))
      .get();
    const storedSecond = await db
      .select()
      .from(queuedConversationMessages)
      .where(eq(queuedConversationMessages.id, second.queuedMessage.id))
      .get();

    expect(storedFirst?.status).not.toBe("delivering");
    expect(storedSecond?.status).toBe("delivered");
  });

  it("removes a message from the queue as soon as it is dispatched", async () => {
    // The row goes to `delivered` only after the agent's whole turn ends, so a
    // force-sent message used to sit in the queue for the entire turn even
    // though it was already in the transcript.
    const runId = await createRun("direct");
    const workerId = await createBusyWorker(runId);
    const queued = await createQueuedConversationMessage({ runId, targetWorkerId: workerId, action: "queue", content: "Send this now", attachments: [] });
    const inFlight = deferred<{ response: string; state: string }>();
    mockAskAgent.mockReturnValueOnce(inFlight.promise);

    await interruptAndSendQueuedConversationMessageNow({ runId, messageId: queued.id });
    await delay(20);

    // Turn still running, but the message has left the queue.
    const stored = await db.select().from(queuedConversationMessages).where(eq(queuedConversationMessages.id, queued.id)).get();
    expect(stored?.status).toBe("delivering");
    expect(await listPendingQueuedConversationMessages(runId)).toHaveLength(0);

    inFlight.resolve({ response: "done", state: "idle" });
    await waitForConversationBackgroundTasksForTests();
    const settled = await db.select().from(queuedConversationMessages).where(eq(queuedConversationMessages.id, queued.id)).get();
    expect(settled?.status).toBe("delivered");
    expect(await listPendingQueuedConversationMessages(runId)).toHaveLength(0);
  });

  it("reclaims a delivery orphaned by a restart instead of dangling forever", async () => {
    const runId = await createRun("direct");
    const workerId = await createBusyWorker(runId);
    const queued = await createQueuedConversationMessage({ runId, targetWorkerId: workerId, action: "queue", content: "Orphan me", attachments: [] });
    // A process death mid-delivery leaves exactly this row shape behind.
    await db.update(queuedConversationMessages)
      .set({ status: "delivering" })
      .where(eq(queuedConversationMessages.id, queued.id));
    const messageId = randomUUID();
    await db.insert(messages).values({
      id: messageId,
      runId,
      role: "user",
      kind: "checkpoint",
      content: "Accepted before the runner stopped",
      deliveryStatus: "delivering",
      createdAt: new Date(),
    });
    expect(await listPendingQueuedConversationMessages(runId)).toHaveLength(0);

    const reclaimed = await reclaimOrphanedDeliveringMessages();

    expect(reclaimed).toBe(2);
    const stored = await db.select().from(queuedConversationMessages).where(eq(queuedConversationMessages.id, queued.id)).get();
    expect(stored?.status).toBe("pending");
    expect(await listPendingQueuedConversationMessages(runId)).toHaveLength(1);
    const reclaimedMessage = await db.select().from(messages).where(eq(messages.id, messageId)).get();
    expect(reclaimedMessage?.deliveryStatus).toBe("accepted");
    expect(getNamedEventsSince(0, { runId }).events).toContainEqual(expect.objectContaining({
      event: expect.objectContaining({ kind: "conversation.message_delivery_reclaimed", messageId }),
    }));
  });

  it("does not replay an orphaned queue delivery after provider output has started", async () => {
    const runId = await createRun("direct");
    const workerId = await createBusyWorker(runId);
    const queued = await createQueuedConversationMessage({
      runId,
      targetWorkerId: workerId,
      action: "queue",
      content: "Already reached the provider",
      attachments: [],
      operationFingerprint: "progressed-operation",
    });
    const now = new Date().toISOString();
    await writeWorkerOutputEntries(runId, workerId, [
      { id: queued.id, type: "user_input", text: queued.content, timestamp: now },
      { id: randomUUID(), type: "message", text: "Provider started answering", timestamp: now },
    ]);
    await db.update(queuedConversationMessages)
      .set({ status: "delivering" })
      .where(eq(queuedConversationMessages.id, queued.id));

    await expect(reclaimOrphanedDeliveringMessages()).resolves.toBe(1);

    const storedQueue = await db.select().from(queuedConversationMessages)
      .where(eq(queuedConversationMessages.id, queued.id)).get();
    const storedMessage = await db.select().from(messages).where(eq(messages.id, queued.id)).get();
    expect(storedQueue?.status).toBe("delivered");
    expect(storedMessage).toMatchObject({
      role: "user",
      content: "Already reached the provider",
      deliveryStatus: "delivered",
      operationFingerprint: "progressed-operation",
    });
    expect(mockAskAgent).not.toHaveBeenCalled();
    expect(getNamedEventsSince(0, { runId }).events).toContainEqual(expect.objectContaining({
      event: expect.objectContaining({ kind: "conversation.queued_delivery_recovered", messageId: queued.id }),
    }));
  });

  describe("in-turn steer (ACP _session/steering)", () => {
    // Holds a live worker turn open, the way a direct conversation's running
    // ask does, until the test releases it.
    function holdLiveTurn(workerId: string) {
      const release = deferred<void>();
      let signal: AbortSignal | null = null;
      const turn = runWorkerTurn(workerId, async (turnSignal) => {
        signal = turnSignal;
        await Promise.race([
          release.promise,
          new Promise<void>((resolve) => turnSignal.addEventListener("abort", () => resolve(), { once: true })),
        ]);
      });
      return {
        turn,
        release: () => release.resolve(),
        aborted: () => Boolean((signal as AbortSignal | null)?.aborted),
      };
    }

    it("delivers into the running turn without cancelling it", async () => {
      const runId = await createRun("direct");
      const workerId = await createBusyWorker(runId);
      const live = holdLiveTurn(workerId);
      await delay(5);
      const generationBefore = await readWorkerTurnGeneration(workerId);
      mockSteerAgentTurn.mockResolvedValue({ name: workerId, outcome: "injected" });

      const result = await interruptWithDraftMessage({
        runId,
        content: "Keep the old API exported too.",
        targetWorkerId: workerId,
        source: "api",
      });

      expect(result.interruption.status).toBe("injected");
      expect(result.queuedMessage.status).toBe("delivered");
      expect(result.message?.content).toBe("Keep the old API exported too.");
      expect(mockSteerAgentTurn).toHaveBeenCalledTimes(1);
      expect(mockSteerAgentTurn.mock.calls[0]?.[0]).toBe(workerId);
      // The raw message goes in: no harness preamble, no steer notice.
      expect(mockSteerAgentTurn.mock.calls[0]?.[1]).toBe("Keep the old API exported too.");
      expect(mockCancelAgentTurn).not.toHaveBeenCalled();
      expect(mockAskAgent).not.toHaveBeenCalled();
      expect(live.aborted()).toBe(false);
      expect(await readWorkerTurnGeneration(workerId)).toBe(generationBefore);

      const stored = await db.select().from(queuedConversationMessages)
        .where(eq(queuedConversationMessages.id, result.queuedMessage.id)).get();
      expect(stored?.status).toBe("delivered");
      expect(stored?.action).toBe("steer");
      const storedMessage = await db.select().from(messages).where(eq(messages.id, result.queuedMessage.id)).get();
      expect(storedMessage?.content).toBe("Keep the old API exported too.");
      expect(storedMessage?.role).toBe("user");

      const entries = await readWorkerOutputEntries(runId, workerId);
      expect(entries).toContainEqual(expect.objectContaining({
        id: result.queuedMessage.id,
        type: "user_input",
        text: "Keep the old API exported too.",
      }));

      const kinds = getNamedEventsSince(0, { runId }).events.map((entry) => entry.event.kind);
      expect(kinds).toContain("queue.interrupt_injected");
      expect(kinds).not.toContain("queue.interrupt_cancelled_turn");
      expect(kinds).not.toContain("queue.interrupt_delivery_failed");

      live.release();
      await live.turn;
      await waitForConversationBackgroundTasksForTests();
      expect(mockAskAgent).not.toHaveBeenCalled();
    });

    it.each([
      ["the worker does not support steering", () => mockSteerAgentTurn.mockResolvedValue({ name: "w", outcome: "promptRequired", reason: "unsupported" })],
      ["the adapter turn already ended", () => mockSteerAgentTurn.mockResolvedValue({ name: "w", outcome: "promptRequired", reason: "adapter_idle" })],
      ["the adapter rejected the steer", () => mockSteerAgentTurn.mockResolvedValue({ name: "w", outcome: "failed", reason: "steering exploded" })],
      ["the runtime request failed", () => mockSteerAgentTurn.mockRejectedValue(new Error("Steer turn failed: 500 boom"))],
    ])("falls back to cancel-and-replace when %s", async (_label, arrange) => {
      const runId = await createRun("direct");
      const workerId = await createBusyWorker(runId);
      const live = holdLiveTurn(workerId);
      await delay(5);
      arrange();

      const result = await interruptWithDraftMessage({
        runId,
        content: "Switch to the failing test first.",
        targetWorkerId: workerId,
        source: "api",
      });

      expect(result.interruption.status).toBe("delivering");
      expect(mockSteerAgentTurn).toHaveBeenCalledTimes(1);
      expect(mockCancelAgentTurn).toHaveBeenCalledWith(workerId);
      await live.turn;
      expect(live.aborted()).toBe(true);
      await waitForConversationBackgroundTasksForTests();

      expect(mockAskAgent).toHaveBeenCalledTimes(1);
      const prompt = mockAskAgent.mock.calls[0]?.[1] as string;
      expect(prompt.startsWith("OmniHarness steer notice:")).toBe(true);
      expect(prompt).toContain("Switch to the failing test first.");
      const stored = await db.select().from(queuedConversationMessages)
        .where(eq(queuedConversationMessages.id, result.queuedMessage.id)).get();
      expect(stored?.status).toBe("delivered");
      const kinds = getNamedEventsSince(0, { runId }).events.map((entry) => entry.event.kind);
      expect(kinds).toContain("queue.interrupt_inject_fallback");
      expect(kinds).not.toContain("queue.interrupt_injected");
      expect(kinds).not.toContain("queue.interrupt_delivery_failed");
    });

    it("does not try an in-turn steer for supervised runs", async () => {
      const runId = await createRun("implementation");
      const workerId = await createBusyWorker(runId);
      const live = holdLiveTurn(workerId);
      await delay(5);
      mockSteerAgentTurn.mockResolvedValue({ name: workerId, outcome: "injected" });

      await interruptWithDraftMessage({ runId, content: "Change course.", targetWorkerId: workerId, source: "api" });
      await live.turn;
      await waitForConversationBackgroundTasksForTests();

      expect(mockSteerAgentTurn).not.toHaveBeenCalled();
      expect(mockCancelAgentTurn).toHaveBeenCalledWith(workerId);
    });

    it("does not try an in-turn steer when no worker turn is live", async () => {
      const runId = await createRun("direct");
      const workerId = await createBusyWorker(runId);
      mockSteerAgentTurn.mockResolvedValue({ name: workerId, outcome: "injected" });

      const result = await interruptWithDraftMessage({ runId, content: "Hello again.", targetWorkerId: workerId, source: "api" });
      await waitForConversationBackgroundTasksForTests();

      expect(result.interruption.status).toBe("delivering");
      expect(mockSteerAgentTurn).not.toHaveBeenCalled();
      expect(mockAskAgent).toHaveBeenCalledTimes(1);
    });
  });
});
