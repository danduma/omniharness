import { randomUUID } from "crypto";
import { asc, eq } from "drizzle-orm";
import { askAgent, cancelAgentTurn } from "@/server/bridge-client";
import { db } from "@/server/db";
import { messages, queuedConversationMessages, runs, workers } from "@/server/db/schema";
import { recordExecutionEvent } from "@/server/events/execution-event-store";
import { emitNamedEvent } from "@/server/events/named-events";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
import { reconcileRunRecovery } from "@/server/runs/recovery-reconciler";
import { appendAttachmentContext, normalizeChatAttachments, type ChatAttachment } from "@/lib/chat-attachments";
import { getAppDataPath } from "@/server/app-root";
import { appendUserInputOnDelivery } from "@/server/workers/stream-writer";
import { persistRunFailure } from "@/server/runs/failures";
import { serializeMessageRecord } from "./message-records";
import { serializeQueuedConversationMessage } from "./queued-message-records";
import {
  createQueuedConversationMessage,
  errorMessage,
  getLatestRunWorker,
  isAgentBusyError,
  isAgentNotFoundError,
  isCancelledWorkerStatus,
  isEmptyQueuedWorkerOutputError,
  persistDeliveredWorkerResponse,
} from "./queued-messages";
import {
  advanceWorkerTurnGeneration,
  isWorkerTurnGenerationCurrent,
  runWorkerTurn,
  trackConversationBackgroundTask,
} from "./worker-turn-gate";

type RunRecord = typeof runs.$inferSelect;
type WorkerRecord = typeof workers.$inferSelect;
type QueuedRecord = typeof queuedConversationMessages.$inferSelect;

export type InterruptSource = "escape" | "drawer" | "api";

export interface InterruptResult {
  ok: true;
  message?: ReturnType<typeof serializeMessageRecord>;
  queuedMessage: ReturnType<typeof serializeQueuedConversationMessage>;
  interruption: {
    status: "delivering" | "deferred";
    workerId: string;
    cancelDurationMs: number;
  };
}

function refusal(status: number, message: string) {
  return Object.assign(new Error(message), { status });
}

async function queuedRowStatus(messageId: string) {
  const record = await db
    .select({ status: queuedConversationMessages.status })
    .from(queuedConversationMessages)
    .where(eq(queuedConversationMessages.id, messageId))
    .get();
  return record?.status ?? null;
}

async function loadRun(runId: string): Promise<RunRecord> {
  const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
  if (!run) {
    throw refusal(404, "Conversation not found");
  }
  return run;
}

async function loadQueuedRecord(runId: string, messageId: string): Promise<QueuedRecord> {
  const record = await db
    .select()
    .from(queuedConversationMessages)
    .where(eq(queuedConversationMessages.id, messageId))
    .get();
  if (!record || record.runId !== runId) {
    throw refusal(404, "Queued message not found");
  }
  if (record.status === "delivered") {
    throw refusal(409, "Queued message was already delivered");
  }
  if (record.status === "cancelled") {
    throw refusal(409, "Queued message was cancelled");
  }
  return record;
}

async function selectOldestPendingRecord(runId: string): Promise<QueuedRecord> {
  const records = await db
    .select()
    .from(queuedConversationMessages)
    .where(eq(queuedConversationMessages.runId, runId))
    .orderBy(asc(queuedConversationMessages.createdAt), asc(queuedConversationMessages.id));
  const pending = records.find((record) => record.status === "pending");
  if (!pending) {
    emitNamedEvent({
      kind: "queue.interrupt_refused",
      runId,
      workerId: null,
      queuedMessageId: null,
      reason: "no_user_intent",
      source: "escape",
    });
    throw refusal(409, "No queued message to interrupt");
  }
  return pending;
}

async function resolveInterruptWorker(run: RunRecord, record: QueuedRecord): Promise<WorkerRecord | null> {
  const targetWorker = record.targetWorkerId
    ? await db.select().from(workers).where(eq(workers.id, record.targetWorkerId)).get()
    : null;
  if (targetWorker && targetWorker.runId === run.id && !isCancelledWorkerStatus(targetWorker.status)) {
    return targetWorker;
  }
  const latest = await getLatestRunWorker(run.id, record.targetWorkerId);
  if (latest && latest.runId === run.id && !isCancelledWorkerStatus(latest.status)) {
    return latest;
  }
  return null;
}

/**
 * Core control-plane flow shared by every interrupt entry point:
 * cancel the active turn, advance the worker turn fence into a delivery-safe
 * state, then deliver exactly one queued user message through the unified
 * worker stream. Emits named + execution events for every decision.
 */
async function interruptAndDeliver(args: {
  run: RunRecord;
  record: QueuedRecord;
  source: InterruptSource;
}): Promise<InterruptResult> {
  const { run, record, source } = args;
  const runId = run.id;
  const requestedAt = Date.now();

  emitNamedEvent({
    kind: "queue.interrupt_requested",
    runId,
    workerId: record.targetWorkerId ?? null,
    queuedMessageId: record.id,
    source,
  });
  await recordExecutionEvent({
    runId,
    workerId: record.targetWorkerId ?? null,
    eventType: "queued_message_interrupt_requested",
    details: {
      summary: "User requested an interrupt-and-send for a queued message.",
      queuedMessageId: record.id,
      source,
    },
  });

  const worker = await resolveInterruptWorker(run, record);
  if (!worker) {
    emitNamedEvent({
      kind: "queue.interrupt_refused",
      runId,
      workerId: record.targetWorkerId ?? null,
      queuedMessageId: record.id,
      reason: "worker_missing",
      source,
    });
    emitNamedEvent({
      kind: "error.surfaced",
      code: "queue.interrupt.refused",
      message: "No active worker is available to interrupt.",
      surface: "toast",
      runId,
    });
    throw refusal(409, "No active worker is available to interrupt");
  }

  // Cancel the current worker turn (and any pending permissions).
  const cancelStartedAt = Date.now();
  try {
    await cancelAgentTurn(worker.id);
  } catch (error) {
    emitNamedEvent({
      kind: "queue.interrupt_delivery_failed",
      runId,
      workerId: worker.id,
      queuedMessageId: record.id,
      reason: "cancel_failed",
      deferred: false,
      totalInterruptLatencyMs: Date.now() - requestedAt,
      source,
    });
    emitNamedEvent({
      kind: "error.surfaced",
      code: "queue.interrupt.cancel_failed",
      message: `Could not interrupt the active turn: ${errorMessage(error)}`,
      surface: "toast",
      runId,
      workerId: worker.id,
    });
    await recordExecutionEvent({
      runId,
      workerId: worker.id,
      eventType: "queued_message_interrupt_failed",
      details: {
        summary: `Failed to cancel the active turn for ${worker.id}.`,
        queuedMessageId: record.id,
        error: errorMessage(error),
        source,
      },
    });
    // Keep the queued row pending so user intent is not lost.
    notifyEventStreamSubscribers();
    throw refusal(502, `Could not interrupt the active turn: ${errorMessage(error)}`);
  }
  const cancelDurationMs = Date.now() - cancelStartedAt;

  // Advance the fence and reset persisted worker state into a delivery-safe
  // shape in one mutation so immediate delivery cannot observe stale `working`.
  const cancelledAt = new Date();
  const generation = await advanceWorkerTurnGeneration(worker.id, {
    status: "idle",
    clearCurrentText: true,
    updatedAt: cancelledAt,
  });

  emitNamedEvent({
    kind: "queue.interrupt_cancelled_turn",
    runId,
    workerId: worker.id,
    queuedMessageId: record.id,
    cancelDurationMs,
    source,
  });
  await recordExecutionEvent({
    runId,
    workerId: worker.id,
    eventType: "queued_message_turn_cancelled",
    details: {
      summary: `Interrupted the active turn for ${worker.id}.`,
      queuedMessageId: record.id,
      cancelDurationMs,
      source,
    },
  });

  // Mark the row delivering and move the run back into an active state.
  const startedAt = new Date();
  await db.update(queuedConversationMessages).set({
    action: "steer",
    targetWorkerId: worker.id,
    status: "delivering",
    lastError: null,
    updatedAt: startedAt,
  }).where(eq(queuedConversationMessages.id, record.id));
  await db.update(runs).set({
    status: run.mode === "planning" ? "working" : "running",
    failedAt: null,
    lastError: null,
    updatedAt: startedAt,
  }).where(eq(runs.id, runId));

  emitNamedEvent({
    kind: "queue.interrupt_delivery_started",
    runId,
    workerId: worker.id,
    queuedMessageId: record.id,
    totalInterruptLatencyMs: Date.now() - requestedAt,
    source,
  });
  notifyEventStreamSubscribers();

  const normalizedAttachments = normalizeChatAttachments(
    record.attachmentsJson ? JSON.parse(record.attachmentsJson) : [],
  );
  const workerContent = appendAttachmentContext(record.content, normalizedAttachments, {
    resolvePath: (storagePath) => getAppDataPath(storagePath),
  });

  const userMessage = {
    id: record.id,
    runId,
    role: "user" as const,
    kind: "checkpoint" as const,
    content: record.content,
    attachmentsJson: record.attachmentsJson,
    createdAt: startedAt,
  };

  trackConversationBackgroundTask(
    deliverInterruptedQueuedMessage({
      run,
      worker,
      record,
      userMessage,
      workerContent,
      attachments: normalizedAttachments,
      generation,
      source,
      requestedAt,
    }).catch((error) => {
      console.error("Queued message interrupt delivery failed:", error);
    }),
  );

  return {
    ok: true,
    message: serializeMessageRecord(userMessage),
    queuedMessage: serializeQueuedConversationMessage({
      ...record,
      action: "steer",
      targetWorkerId: worker.id,
      status: "delivering",
      lastError: null,
      updatedAt: startedAt,
      deliveredAt: null,
    }),
    interruption: {
      status: "delivering",
      workerId: worker.id,
      cancelDurationMs,
    },
  };
}

async function deliverInterruptedQueuedMessage(args: {
  run: RunRecord;
  worker: WorkerRecord;
  record: QueuedRecord;
  userMessage: {
    id: string;
    runId: string;
    role: "user";
    kind: "checkpoint";
    content: string;
    attachmentsJson: string | null;
    createdAt: Date;
  };
  workerContent: string;
  attachments: ChatAttachment[];
  generation: number;
  source: InterruptSource;
  requestedAt: number;
}) {
  const { run, worker, record, userMessage, workerContent, attachments, generation, source, requestedAt } = args;
  const runId = run.id;

  // A stale terminal write must never overwrite a newer interrupt delivery or a
  // row the user cancelled mid-flight. Every terminal mutation re-checks both.
  const isStillCurrent = async () => {
    if (await queuedRowStatus(record.id) !== "delivering") {
      return false;
    }
    return isWorkerTurnGenerationCurrent(worker.id, generation);
  };

  try {
    await runWorkerTurn(worker.id, async () => {
      if (!(await isStillCurrent())) {
        notifyEventStreamSubscribers();
        return;
      }

      await db.update(workers).set({
        status: "working",
        updatedAt: new Date(),
      }).where(eq(workers.id, worker.id));

      const deliveredAt = new Date();
      await appendUserInputOnDelivery({
        id: userMessage.id,
        runId,
        workerId: worker.id,
        text: record.content,
        deliveredAt,
        attachments: attachments.map((attachment) => ({
          id: attachment.id,
          filename: attachment.name,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.size,
        })),
      });
      await db.insert(messages).values(userMessage);
      notifyEventStreamSubscribers();

      if (!(await isStillCurrent())) {
        notifyEventStreamSubscribers();
        return;
      }

      const response = await askAgent(worker.id, workerContent);
      const finishedAt = new Date();

      // Before any terminal persistence, confirm a newer interrupt has not
      // superseded this delivery and the row was not cancelled.
      if (!(await isStillCurrent())) {
        notifyEventStreamSubscribers();
        return;
      }

      await persistDeliveredWorkerResponse({
        run: { id: runId, mode: run.mode },
        workerId: worker.id,
        response,
        deliveredAt: finishedAt,
        userInputEntryId: userMessage.id,
      });

      if (!(await isStillCurrent())) {
        notifyEventStreamSubscribers();
        return;
      }

      await db.update(queuedConversationMessages).set({
        status: "delivered",
        lastError: null,
        updatedAt: finishedAt,
        deliveredAt: finishedAt,
      }).where(eq(queuedConversationMessages.id, record.id));
      await recordExecutionEvent({
        runId,
        workerId: worker.id,
        eventType: "queued_message_interrupt_delivered",
        details: {
          summary: `Delivered interrupted queued message to ${worker.id}.`,
          queuedMessageId: record.id,
          source,
        },
      });
      emitNamedEvent({
        kind: "queue.interrupt_delivery_finished",
        runId,
        workerId: worker.id,
        queuedMessageId: record.id,
        totalInterruptLatencyMs: Date.now() - requestedAt,
        source,
      });
      notifyEventStreamSubscribers();
    });
  } catch (error) {
    await handleInterruptDeliveryError({ run, worker, record, userMessage, error, generation, source, requestedAt });
  }
}

async function handleInterruptDeliveryError(args: {
  run: RunRecord;
  worker: WorkerRecord;
  record: QueuedRecord;
  userMessage: { id: string };
  error: unknown;
  generation: number;
  source: InterruptSource;
  requestedAt: number;
}) {
  const { run, worker, record, userMessage, error, generation, source, requestedAt } = args;
  const runId = run.id;
  const failedAt = new Date();

  // A late failure from an interrupted (older) turn or a row the user cancelled
  // must not flip queue state.
  if (await queuedRowStatus(record.id) !== "delivering") {
    notifyEventStreamSubscribers();
    return;
  }
  if (!(await isWorkerTurnGenerationCurrent(worker.id, generation))) {
    notifyEventStreamSubscribers();
    return;
  }

  const busy = isAgentBusyError(error);
  await db.update(queuedConversationMessages).set({
    status: busy ? "pending" : "failed",
    lastError: errorMessage(error),
    updatedAt: failedAt,
  }).where(eq(queuedConversationMessages.id, record.id));

  if (isEmptyQueuedWorkerOutputError(error)) {
    await db.update(workers).set({
      status: "error",
      outputLog: error.message,
      updatedAt: failedAt,
    }).where(eq(workers.id, worker.id));
    if (run.mode === "direct" || run.mode === "commit") {
      await persistRunFailure(runId, error, {
        surface: { code: "worker.idle.empty_output", workerId: worker.id },
      });
    }
  }

  if (busy) {
    await recordExecutionEvent({
      runId,
      workerId: worker.id,
      eventType: "queued_message_interrupt_deferred",
      details: {
        summary: `Worker ${worker.id} was still busy after cancel; queued message kept pending.`,
        queuedMessageId: record.id,
        error: errorMessage(error),
        source,
      },
    });
  } else {
    await recordExecutionEvent({
      runId,
      workerId: worker.id,
      eventType: "queued_message_interrupt_failed",
      details: {
        summary: `Interrupt delivery failed for ${worker.id}.`,
        queuedMessageId: record.id,
        error: errorMessage(error),
        source,
      },
    });
    emitNamedEvent({
      kind: "error.surfaced",
      code: "queue.interrupt.delivery_failed",
      message: `Interrupt delivery failed: ${errorMessage(error)}`,
      surface: "toast",
      runId,
      workerId: worker.id,
    });
  }

  emitNamedEvent({
    kind: "queue.interrupt_delivery_failed",
    runId,
    workerId: worker.id,
    queuedMessageId: record.id,
    reason: busy ? "busy_after_cancel" : "delivery_failed",
    deferred: busy,
    totalInterruptLatencyMs: Date.now() - requestedAt,
    source,
  });

  if (isAgentNotFoundError(error)) {
    await recordExecutionEvent({
      runId,
      workerId: worker.id,
      eventType: "queued_message_recovery_blocked",
      details: {
        summary: `Queued message ${record.id} is blocked because ${worker.id} is missing.`,
        queuedMessageId: record.id,
        error: errorMessage(error),
        source,
      },
    });
    await reconcileRunRecovery({
      runId,
      liveAgents: [],
      source: "queued-message-interrupt",
    });
  }

  // A busy delivery already removed nothing; non-recoverable failures keep the
  // appended worker-stream input for audit. Drop the duplicate checkpoint
  // message row only when we deferred so a later retry re-appends cleanly.
  if (busy) {
    await db.delete(messages).where(eq(messages.id, userMessage.id));
  }

  notifyEventStreamSubscribers();
}

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

export async function interruptAndSendQueuedConversationMessageNow(params: {
  runId: string;
  messageId: string;
  source?: InterruptSource;
}): Promise<InterruptResult> {
  const run = await loadRun(params.runId);
  const record = await loadQueuedRecord(params.runId, params.messageId);
  return interruptAndDeliver({ run, record, source: params.source ?? "drawer" });
}

export async function interruptAndSendNextQueuedConversationMessage(params: {
  runId: string;
  source?: InterruptSource;
}): Promise<InterruptResult> {
  const run = await loadRun(params.runId);
  const record = await selectOldestPendingRecord(params.runId);
  return interruptAndDeliver({ run, record, source: params.source ?? "escape" });
}

export async function interruptWithDraftMessage(params: {
  runId: string;
  content: string;
  attachments?: ChatAttachment[];
  targetWorkerId?: string | null;
  source?: InterruptSource;
}): Promise<InterruptResult> {
  const run = await loadRun(params.runId);
  const trimmed = params.content.trim();
  const normalizedAttachments = normalizeChatAttachments(params.attachments ?? []);
  if (!trimmed && normalizedAttachments.length === 0) {
    emitNamedEvent({
      kind: "queue.interrupt_refused",
      runId: params.runId,
      workerId: params.targetWorkerId ?? null,
      queuedMessageId: null,
      reason: "no_user_intent",
      source: params.source ?? "escape",
    });
    throw refusal(400, "Message content or attachment is required");
  }

  // Persist the draft as exactly one queued row, then deliver that same id.
  const created = await createQueuedConversationMessage({
    runId: params.runId,
    targetWorkerId: params.targetWorkerId ?? null,
    action: "steer",
    content: params.content,
    attachments: normalizedAttachments,
  });
  const record = await loadQueuedRecord(params.runId, created.id);
  return interruptAndDeliver({ run, record, source: params.source ?? "escape" });
}
