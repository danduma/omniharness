import { randomUUID } from "crypto";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { askAgent, getAgent, respondElicitation } from "@/server/bridge-client";
import { db } from "@/server/db";
import { messages, queuedConversationMessages, runs, supervisorInterventions, workers } from "@/server/db/schema";
import { recordExecutionEvent } from "@/server/events/execution-event-store";
import { emitNamedEvent } from "@/server/events/named-events";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
import { startSupervisorRun } from "@/server/supervisor/start";
import { recordSupervisorIntervention } from "@/server/supervisor/interventions";
import { reconcileRunRecovery } from "@/server/runs/recovery-reconciler";
import { appendAttachmentContext, normalizeChatAttachments, resolveImageAttachments, serializeChatAttachments, type ChatAttachment } from "@/lib/chat-attachments";
import { getAppDataPath } from "@/server/app-root";
import { serializeMessageRecord } from "./message-records";
import { appendUserInputOnDelivery } from "@/server/workers/stream-writer";
import { appendAskResponseFallbackEntry } from "@/server/workers/response-fallback";
import { readWorkerOutputEntries } from "@/server/workers/output-store";
import { closeStaleHumanInputEntries } from "@/server/workers/human-input-entries";
import { persistWorkerSnapshot } from "@/server/workers/snapshots";
import {
  isWorkerTurnGenerationCurrent,
  runConversationMutation,
  runWorkerTurn,
  trackConversationBackgroundTask,
} from "./worker-turn-gate";
import { updateDirectRunStatusFromWorkerOutput } from "./direct-run-status";
import { persistRunFailure } from "@/server/runs/failures";
import { buildDirectWorkerPrompt } from "./direct-worker-prompt";
import { extractQuotaResetInfo } from "@/server/quota/reset-parser";
import { handleWorkerQuotaExhaustion } from "@/server/quota/recovery";
import { resolveRecoveryIncidentsAfterHealthyTurn } from "@/server/runs/recovery-incidents";
import { assertRunNotHandoffFenced } from "@/server/handoff/fence";
import {
  serializeQueuedConversationMessage,
  type BusyMessageAction,
  type QueuedConversationMessageStatus,
} from "./queued-message-records";
export type { BusyMessageAction, QueuedConversationMessageStatus } from "./queued-message-records";

type QueuedConversationMessageRecord = typeof queuedConversationMessages.$inferSelect;
export type WorkerAskResponse = Awaited<ReturnType<typeof askAgent>>;
type WorkerSnapshot = Awaited<ReturnType<typeof getAgent>>;
export type WorkerResponseRun = Pick<typeof runs.$inferSelect, "id" | "mode">;
type PendingElicitation = NonNullable<WorkerSnapshot["pendingElicitations"]>[number];
type ElicitationSchema = PendingElicitation["requestedSchema"];
type ElicitationContent = Record<string, string | number | boolean | string[]>;

export class EmptyQueuedWorkerOutputError extends Error {
  constructor(
    readonly runId: string,
    readonly workerId: string,
    readonly responseState: string,
    readonly stopReason?: string | null,
  ) {
    const suffix = stopReason?.trim()
      ? `Stop reason: ${stopReason.trim()}.`
      : `Final state: ${responseState || "unknown"}.`;
    super(`Agent stopped without producing output. ${suffix}`);
    this.name = "EmptyQueuedWorkerOutputError";
  }
}

function workerPromptForRun(run: WorkerResponseRun, content: string) {
  return run.mode === "direct" || run.mode === "commit"
    ? buildDirectWorkerPrompt(content)
    : content;
}

const lastQueuedMessageCreatedAtByRun = new Map<string, number>();

export function parseBusyMessageAction(value: unknown): BusyMessageAction | null {
  return value === "queue" || value === "steer" ? value : null;
}

export function isAgentBusyError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /\bagent is busy\b/i.test(message);
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function handleQueuedWorkerQuotaError(args: {
  runId: string;
  workerId: string;
  workerType?: string | null;
  error: unknown;
}) {
  const quotaInfo = extractQuotaResetInfo(args.error, { provider: args.workerType });
  if (!quotaInfo.isQuotaError) {
    return false;
  }

  await handleWorkerQuotaExhaustion({
    runId: args.runId,
    workerId: args.workerId,
    text: quotaInfo.rawText,
    provider: args.workerType,
  });
  notifyEventStreamSubscribers();
  return true;
}

function timestampMs(value: Date | string | number | null | undefined) {
  if (value instanceof Date) {
    return value.getTime();
  }
  const parsed = new Date(value ?? 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

async function nextQueuedMessageCreatedAt(runId: string) {
  const latest = await db
    .select({ createdAt: queuedConversationMessages.createdAt })
    .from(queuedConversationMessages)
    .where(eq(queuedConversationMessages.runId, runId))
    .orderBy(desc(queuedConversationMessages.createdAt), desc(queuedConversationMessages.id))
    .get();
  const previousMs = Math.max(
    timestampMs(latest?.createdAt),
    lastQueuedMessageCreatedAtByRun.get(runId) ?? 0,
  );
  // Drizzle's SQLite timestamp mode stores integer seconds in this schema,
  // so use a one-second logical tick to preserve FIFO order through DB reads
  // that sort only by createdAt.
  const nextMs = Math.max(Date.now(), previousMs + 1_000);
  lastQueuedMessageCreatedAtByRun.set(runId, nextMs);
  return new Date(nextMs);
}

async function queuedMessageStatus(messageId: string) {
  const record = await db
    .select({ status: queuedConversationMessages.status })
    .from(queuedConversationMessages)
    .where(eq(queuedConversationMessages.id, messageId))
    .get();
  return record?.status ?? null;
}

export function isAgentNotFoundError(error: unknown) {
  return /\bagent not found\b/i.test(errorMessage(error));
}

/**
 * The runtime holds a pending elicitation only in memory. A runner restart, a
 * worker respawn, or the agent simply moving on drops it while the durable
 * stream still advertises the question, so a queued answer can be routed at an
 * elicitation that no longer exists. The runtime answers `no_pending_elicitations`.
 */
export function isElicitationNoLongerPendingError(error: unknown) {
  return /\bno_pending_elicitations\b/i.test(errorMessage(error));
}

export function isEmptyQueuedWorkerOutputError(error: unknown): error is EmptyQueuedWorkerOutputError {
  return error instanceof EmptyQueuedWorkerOutputError;
}

function workerStreamHasOutputAfterInput(
  entries: Awaited<ReturnType<typeof readWorkerOutputEntries>>,
  userInputEntryId: string,
) {
  const inputEntry = entries.find((entry) => entry.id === userInputEntryId);
  if (!inputEntry) {
    return false;
  }

  const entryIdsBeforeInput = new Set(
    entries
      .filter((entry) => entry.seq < inputEntry.seq)
      .map((entry) => entry.id),
  );
  const toolCallIdsBeforeInput = new Set(
    entries
      .filter((entry) => entry.seq < inputEntry.seq && entry.toolCallId)
      .map((entry) => entry.toolCallId),
  );
  const responseEntryTypes = new Set([
    "message",
    "thought",
    "tool_call",
    "tool_call_update",
    "permission",
    "elicitation",
    "plan",
    "plan_update",
    "agent_content",
  ]);

  return entries.some((entry) => {
    if (
      entry.seq <= inputEntry.seq
      || !responseEntryTypes.has(entry.type)
      || entry.text.trim().length === 0
      || entryIdsBeforeInput.has(entry.id)
    ) {
      return false;
    }

    if (entry.type === "tool_call" || entry.type === "tool_call_update") {
      return Boolean(
        entry.toolCallId
        && !toolCallIdsBeforeInput.has(entry.toolCallId),
      );
    }

    return true;
  });
}

async function assertQueuedDeliveryProducedOutput({
  runId,
  workerId,
  userInputEntryId,
  response,
  snapshot,
}: {
  runId: string;
  workerId: string;
  userInputEntryId: string;
  response: WorkerAskResponse;
  snapshot: WorkerSnapshot | null;
}) {
  if (response.response.trim()) {
    return;
  }

  const entries = await readWorkerOutputEntries(runId, workerId);
  if (workerStreamHasOutputAfterInput(entries, userInputEntryId)) {
    return;
  }

  throw new EmptyQueuedWorkerOutputError(
    runId,
    workerId,
    response.state,
    snapshot?.stopReason,
  );
}

export async function getLatestRunWorker(runId: string, excludedWorkerId?: string | null) {
  const records = await db
    .select()
    .from(workers)
    .where(eq(workers.runId, runId))
    .orderBy(desc(workers.createdAt), desc(workers.id));

  return records.find((worker) => worker.id !== excludedWorkerId) ?? null;
}

export function isCancelledWorkerStatus(status: string | null | undefined) {
  const normalized = status?.trim().toLowerCase().split(":")[0]?.trim() ?? "";
  return normalized === "cancelled" || normalized === "canceled";
}

function isActiveWorkerStatus(status: string | null | undefined) {
  const normalized = status?.trim().toLowerCase().split(":")[0]?.trim() ?? "";
  return normalized === "starting" || normalized === "working" || normalized === "stuck";
}

function hasVisibleWorkerProgress(worker: typeof workers.$inferSelect) {
  return Boolean(
    worker.currentText.trim()
      || worker.lastText.trim()
      || worker.outputLog.trim(),
  );
}

export function isWorkerClearlyBusy(worker: typeof workers.$inferSelect) {
  return isActiveWorkerStatus(worker.status) && hasVisibleWorkerProgress(worker);
}

function formatWorkerLabel(worker: typeof workers.$inferSelect) {
  if (typeof worker.workerNumber === "number" && Number.isFinite(worker.workerNumber)) {
    return `worker ${worker.workerNumber}`;
  }

  const match = worker.id.match(/-worker-(\d+)$/);
  return match ? `worker ${match[1]}` : "the active worker";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asRequestedSchema(value: unknown): ElicitationSchema | null {
  const schema = asRecord(value);
  if (!schema) {
    return null;
  }
  const properties = asRecord(schema.properties) ?? {};
  const required = Array.isArray(schema.required)
    ? schema.required.filter((item): item is string => typeof item === "string")
    : undefined;
  const type = asString(schema.type);
  return {
    properties,
    ...(type ? { type } : {}),
    ...(required ? { required } : {}),
  };
}

function isOpenElicitationEntry(entry: NonNullable<WorkerSnapshot["outputEntries"]>[number]) {
  if (entry.type !== "elicitation") {
    return false;
  }
  const status = (entry.status ?? "pending").trim().toLowerCase();
  return !["answered", "approved", "cancelled", "canceled", "completed", "declined", "denied", "failed", "rejected", "skipped"].includes(status);
}

function pendingElicitationFromEntry(entry: NonNullable<WorkerSnapshot["outputEntries"]>[number]): PendingElicitation | null {
  if (!isOpenElicitationEntry(entry)) {
    return null;
  }
  const raw = asRecord(entry.raw);
  const requestId = raw?.requestId;
  if (!raw || typeof requestId !== "number" || !Number.isFinite(requestId)) {
    return null;
  }
  return {
    requestId,
    requestedAt: entry.timestamp,
    sessionId: asString(raw.sessionId),
    toolCallId: asString(raw.toolCallId ?? entry.toolCallId),
    message: asString(raw.message),
    requestedSchema: asRequestedSchema(raw.requestedSchema),
  };
}

function selectPendingWorkerElicitation(snapshot: WorkerSnapshot | null): PendingElicitation | null {
  const pending = snapshot?.pendingElicitations?.[0] ?? null;
  if (pending) {
    return pending;
  }
  const entries = snapshot?.outputEntries ?? [];
  for (const entry of entries) {
    const elicitation = pendingElicitationFromEntry(entry);
    if (elicitation) {
      return elicitation;
    }
  }
  return null;
}

function elicitationAnswerContent(text: string, requestedSchema: ElicitationSchema | null | undefined): ElicitationContent {
  const properties = requestedSchema?.properties ?? {};
  const propertyNames = Object.keys(properties);
  if (propertyNames.includes("customAnswer")) {
    return { customAnswer: text };
  }

  const nonCustomFields = propertyNames.filter((name) => name !== "customAnswer");
  if (nonCustomFields.length === 1 && nonCustomFields[0]) {
    return { [nonCustomFields[0]]: text };
  }

  return { response: text };
}

async function answerPendingWorkerElicitation(args: {
  run: typeof runs.$inferSelect;
  worker: typeof workers.$inferSelect;
  snapshot: WorkerSnapshot | null;
  content: string;
  deliveredAt: Date;
}) {
  const elicitation = selectPendingWorkerElicitation(args.snapshot);
  if (!elicitation) {
    return false;
  }

  try {
    await respondElicitation(args.worker.id, {
      action: "accept",
      content: elicitationAnswerContent(args.content, elicitation.requestedSchema),
    });
  } catch (error) {
    if (!isElicitationNoLongerPendingError(error)) {
      throw error;
    }
    // The question is gone, but the user's answer is not. Close the stale
    // stream row so the card stops advertising an open question, then report
    // "not delivered as an elicitation" so the caller falls through to normal
    // prompt delivery. Rethrowing here would fail the queued row and silently
    // discard everything the user typed.
    await closeStaleHumanInputEntries({
      workerId: args.worker.id,
      kind: "elicitation",
      requestId: elicitation.requestId,
      reason: "the worker stopped waiting for an answer",
      expectedTurnGeneration: args.worker.turnGeneration,
    });
    return false;
  }
  const workerClaimed = await db.update(workers).set({
    status: "working",
    updatedAt: args.deliveredAt,
  }).where(and(
    eq(workers.id, args.worker.id),
    eq(workers.turnGeneration, args.worker.turnGeneration),
  )).returning({ id: workers.id }).get();
  if (!workerClaimed) {
    return false;
  }
  await db.update(runs).set({
    status: "running",
    failedAt: null,
    lastError: null,
    updatedAt: args.deliveredAt,
  }).where(eq(runs.id, args.run.id));
  emitNamedEvent({
    kind: "worker.status",
    runId: args.run.id,
    workerId: args.worker.id,
    prev: args.worker.status,
    next: "working",
  });
  return true;
}

export async function persistDeliveredWorkerResponse({
  run,
  workerId,
  response,
  deliveredAt,
  userInputEntryId,
  expectedTurnGeneration,
}: {
  run: WorkerResponseRun;
  workerId: string;
  response: WorkerAskResponse;
  deliveredAt: Date;
  userInputEntryId: string;
  expectedTurnGeneration: number;
}) {
  const snapshot = await Promise.resolve(getAgent(workerId)).catch(() => null);
  if (snapshot) {
    await persistWorkerSnapshot(workerId, snapshot, { expectedTurnGeneration });
  }
  await appendAskResponseFallbackEntry({
    runId: run.id,
    workerId,
    responseText: response.response,
    snapshot,
    expectedTurnGeneration,
  });
  if (!await isWorkerTurnGenerationCurrent(workerId, expectedTurnGeneration)) {
    return;
  }
  await assertQueuedDeliveryProducedOutput({
    runId: run.id,
    workerId,
    userInputEntryId,
    response,
    snapshot,
  });

  const workerUpdated = await db.update(workers).set({
    status: snapshot?.state ?? response.state,
    updatedAt: deliveredAt,
  }).where(and(
    eq(workers.id, workerId),
    eq(workers.turnGeneration, expectedTurnGeneration),
  )).returning({ id: workers.id }).get();
  if (!workerUpdated) {
    return;
  }

  await resolveRecoveryIncidentsAfterHealthyTurn({
    runId: run.id,
    workerId,
    summary: `${workerId} delivered a queued message normally after recovery was pending.`,
    reason: "queued_message_delivered",
  });

  if (run.mode === "direct" || run.mode === "commit") {
    await updateDirectRunStatusFromWorkerOutput({
      runId: run.id,
      workerId,
      workerStatus: snapshot?.state ?? response.state,
      responseText: response.response,
      renderedOutput: snapshot?.renderedOutput,
      currentText: snapshot?.currentText,
      lastText: snapshot?.lastText,
      outputEntries: snapshot?.outputEntries,
      pendingPermissions: snapshot?.pendingPermissions,
      pendingElicitations: snapshot?.pendingElicitations,
    });
  }
}

async function insertQueueExecutionEvent(
  runId: string,
  eventType: string,
  details: Record<string, unknown>,
  workerId?: string | null,
) {
  await recordExecutionEvent({
    runId,
    workerId: workerId ?? null,
    eventType,
    details,
  });
}

export async function listPendingQueuedConversationMessages(runId: string) {
  const records = await db
    .select()
    .from(queuedConversationMessages)
    .where(eq(queuedConversationMessages.runId, runId))
    .orderBy(asc(queuedConversationMessages.createdAt), asc(queuedConversationMessages.id));

  // `delivering` has left the queue: the message is with the worker and already
  // shown in the transcript. Failed dispatches return to `pending`.
  return records
    .filter((record) => record.status === "pending")
    .map(serializeQueuedConversationMessage);
}

/**
 * `delivering` means "an in-process delivery owns this row". No such delivery
 * survives a process restart, so any row still marked `delivering` at boot is
 * orphaned: its owner died mid-flight. Left alone it dangles forever — and
 * since `delivering` rows are no longer listed as queued, it would dangle
 * invisibly. Reclaim them as `pending` so the user's message comes back.
 */
export async function reclaimOrphanedDeliveringMessages() {
  const orphaned = await db
    .select({ id: queuedConversationMessages.id, runId: queuedConversationMessages.runId })
    .from(queuedConversationMessages)
    .where(eq(queuedConversationMessages.status, "delivering"));
  if (orphaned.length === 0) {
    return 0;
  }

  const now = new Date();
  await db.update(queuedConversationMessages).set({
    status: "pending",
    lastError: null,
    updatedAt: now,
    deliveredAt: null,
  }).where(inArray(queuedConversationMessages.id, orphaned.map((record) => record.id)));

  for (const record of orphaned) {
    await insertQueueExecutionEvent(record.runId, "queued_message_reclaimed", {
      summary: "Requeued a message whose delivery was interrupted by a restart.",
      queuedMessageId: record.id,
    });
  }
  notifyEventStreamSubscribers();
  return orphaned.length;
}

const CLIENT_MESSAGE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Falls back to a fresh uuid when the client id is unusable — malformed, or
 * already taken by an earlier queue row — so a resend degrades to a duplicate
 * row rather than a primary-key failure that would lose the user's text.
 */
async function resolveQueuedConversationMessageId(clientMessageId: string | null | undefined) {
  const candidate = typeof clientMessageId === "string" ? clientMessageId.trim().toLowerCase() : "";
  if (!CLIENT_MESSAGE_ID_PATTERN.test(candidate)) {
    return randomUUID();
  }
  const existing = await db
    .select({ id: queuedConversationMessages.id })
    .from(queuedConversationMessages)
    .where(eq(queuedConversationMessages.id, candidate))
    .get();
  return existing ? randomUUID() : candidate;
}

async function createQueuedConversationMessageUnlocked({
  runId,
  targetWorkerId = null,
  action,
  content,
  attachments = [],
  clientMessageId = null,
}: {
  runId: string;
  targetWorkerId?: string | null;
  action: BusyMessageAction;
  content: string;
  attachments?: ChatAttachment[];
  /**
   * Id the sending client already rendered its queue row under. Adopting it
   * keeps that row and this one the same row, so the queue entry does not
   * blink out and back when the event stream catches up.
   */
  clientMessageId?: string | null;
}) {
  await assertRunNotHandoffFenced(runId);
  const trimmedContent = content.trim();
  const normalizedAttachments = normalizeChatAttachments(attachments);
  if (!trimmedContent && normalizedAttachments.length === 0) {
    throw Object.assign(new Error("Message content or attachment is required"), { status: 400 });
  }

  const now = await nextQueuedMessageCreatedAt(runId);
  const record = {
    id: await resolveQueuedConversationMessageId(clientMessageId),
    runId,
    targetWorkerId,
    action,
    content: trimmedContent,
    attachmentsJson: serializeChatAttachments(normalizedAttachments),
    status: "pending",
    lastError: null,
    createdAt: now,
    updatedAt: now,
    deliveredAt: null,
  };

  await db.insert(queuedConversationMessages).values(record);
  await insertQueueExecutionEvent(runId, "queued_message_created", {
    summary: action === "steer" ? "Steering message was deferred into the queue." : "Message queued for the next safe turn.",
    queuedMessageId: record.id,
    action,
  }, targetWorkerId);
  notifyEventStreamSubscribers();
  return serializeQueuedConversationMessage(record);
}

export function createQueuedConversationMessage(args: Parameters<typeof createQueuedConversationMessageUnlocked>[0]) {
  return runConversationMutation(args.runId, () => createQueuedConversationMessageUnlocked(args));
}

async function cancelQueuedConversationMessageUnlocked({
  runId,
  messageId,
}: {
  runId: string;
  messageId: string;
}) {
  const record = await db
    .select()
    .from(queuedConversationMessages)
    .where(eq(queuedConversationMessages.id, messageId))
    .get();

  if (!record || record.runId !== runId) {
    throw Object.assign(new Error("Queued message not found"), { status: 404 });
  }

  if (record.status === "delivered") {
    throw Object.assign(new Error("Queued message was already delivered and cannot be cancelled"), { status: 409 });
  }

  if (record.status === "cancelled") {
    return serializeQueuedConversationMessage(record);
  }

  const now = new Date();
  await db.update(queuedConversationMessages).set({
    status: "cancelled",
    updatedAt: now,
  }).where(eq(queuedConversationMessages.id, messageId));
  await insertQueueExecutionEvent(runId, "queued_message_cancelled", {
    summary: "Cancelled queued message.",
    queuedMessageId: messageId,
  }, record.targetWorkerId);
  notifyEventStreamSubscribers();

  return serializeQueuedConversationMessage({
    ...record,
    status: "cancelled",
    updatedAt: now,
  });
}

export function cancelQueuedConversationMessage(args: Parameters<typeof cancelQueuedConversationMessageUnlocked>[0]) {
  return runConversationMutation(args.runId, () => cancelQueuedConversationMessageUnlocked(args));
}

async function deliverQueuedWorkerSteering(args: {
  run: typeof runs.$inferSelect;
  worker: typeof workers.$inferSelect;
  messageId: string;
  userMessageId?: string | null;
  content: string;
  userText: string;
  attachments: ChatAttachment[];
  onUserInputAppended?: () => void;
}) {
  await runWorkerTurn(args.worker.id, async () => {
    const appendQueuedUserInput = async (deliveredAt: Date) => {
      await appendUserInputOnDelivery({
        id: args.userMessageId ?? args.messageId,
        runId: args.run.id,
        workerId: args.worker.id,
        text: args.userText,
        deliveredAt,
        attachments: args.attachments.map((attachment) => ({
          id: attachment.id,
          filename: attachment.name,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.size,
          storagePath: attachment.storagePath,
        })),
        expectedTurnGeneration: args.worker.turnGeneration,
      });
      if (!await isWorkerTurnGenerationCurrent(args.worker.id, args.worker.turnGeneration)) {
        return false;
      }
      args.onUserInputAppended?.();
      return true;
    };

    if (
      await queuedMessageStatus(args.messageId) !== "delivering"
      || !await isWorkerTurnGenerationCurrent(args.worker.id, args.worker.turnGeneration)
    ) {
      notifyEventStreamSubscribers();
      return;
    }

    const snapshotBeforeAsk = await Promise.resolve(getAgent(args.worker.id)).catch(() => null);
    const deliveredAt = new Date();
    if (await queuedMessageStatus(args.messageId) !== "delivering") {
      notifyEventStreamSubscribers();
      return;
    }
    if (await answerPendingWorkerElicitation({
      run: args.run,
      worker: args.worker,
      snapshot: snapshotBeforeAsk,
      content: args.userText,
      deliveredAt,
    })) {
      if (!await appendQueuedUserInput(deliveredAt)) {
        return;
      }
      await db.update(queuedConversationMessages).set({
        status: "delivered",
        lastError: null,
        updatedAt: deliveredAt,
        deliveredAt,
      }).where(eq(queuedConversationMessages.id, args.messageId));
      await insertQueueExecutionEvent(args.run.id, "queued_message_delivered", {
        summary: `Delivered queued answer to ${args.worker.id}'s pending question.`,
        queuedMessageId: args.messageId,
        action: "steer",
        delivery: "elicitation",
      }, args.worker.id);
      notifyEventStreamSubscribers();
      return;
    }

    // Anchor the user's message before the ask: this is the user-initiated
    // send-now path, and the bridge starts streaming output during askAgent, so
    // appending afterwards would order the reply ahead of the prompt.
    if (!await appendQueuedUserInput(deliveredAt)) {
      return;
    }
    notifyEventStreamSubscribers();

    if (await queuedMessageStatus(args.messageId) !== "delivering") {
      notifyEventStreamSubscribers();
      return;
    }

    const queuedPrompt = workerPromptForRun(args.run, args.content);
    const queuedImages = resolveImageAttachments(args.attachments, getAppDataPath);
    const response = queuedImages.length
      ? await askAgent(args.worker.id, queuedPrompt, queuedImages)
      : await askAgent(args.worker.id, queuedPrompt);
    await persistDeliveredWorkerResponse({
      run: args.run,
      workerId: args.worker.id,
      response,
      deliveredAt,
      userInputEntryId: args.userMessageId ?? args.messageId,
      expectedTurnGeneration: args.worker.turnGeneration,
    });
    // Worker response now lives in the unified worker stream; the
    // legacy role:"worker" messages row is no longer written.
    await db.update(queuedConversationMessages).set({
      status: "delivered",
      lastError: null,
      updatedAt: deliveredAt,
      deliveredAt,
    }).where(eq(queuedConversationMessages.id, args.messageId));
    await insertQueueExecutionEvent(args.run.id, "queued_message_delivered", {
      summary: `Delivered immediate queued steering to ${args.worker.id}.`,
      queuedMessageId: args.messageId,
      action: "steer",
    }, args.worker.id);
    notifyEventStreamSubscribers();
  });
}

async function continueQueuedWorkerSteering(args: {
  run: typeof runs.$inferSelect;
  worker: typeof workers.$inferSelect;
  messageId: string;
  userMessageId?: string | null;
  content: string;
  userText: string;
  attachments: ChatAttachment[];
}) {
  let userInputAppended = false;
  try {
    await deliverQueuedWorkerSteering({
      ...args,
      onUserInputAppended: () => {
        userInputAppended = true;
      },
    });
    return;
  } catch (error) {
    if (isAgentNotFoundError(error)) {
      const fallbackWorker = await getLatestRunWorker(args.run.id, args.worker.id);
      if (fallbackWorker) {
        try {
          await db.update(queuedConversationMessages).set({
            targetWorkerId: fallbackWorker.id,
            updatedAt: new Date(),
          }).where(eq(queuedConversationMessages.id, args.messageId));
          await deliverQueuedWorkerSteering({
            ...args,
            worker: fallbackWorker,
            onUserInputAppended: () => {
              userInputAppended = true;
            },
          });
          return;
        } catch (fallbackError) {
          error = fallbackError;
        }
      }
    }

    const failedAt = new Date();
    if (await queuedMessageStatus(args.messageId) !== "delivering") {
      notifyEventStreamSubscribers();
      return;
    }
    if (await handleQueuedWorkerQuotaError({
      runId: args.run.id,
      workerId: args.worker.id,
      workerType: args.worker.type,
      error,
    })) {
      await db.update(queuedConversationMessages).set({
        status: "pending",
        lastError: null,
        updatedAt: new Date(),
      }).where(eq(queuedConversationMessages.id, args.messageId));
      return;
    }

    await db.update(queuedConversationMessages).set({
      status: isAgentBusyError(error) ? "pending" : "failed",
      lastError: errorMessage(error),
      updatedAt: failedAt,
    }).where(eq(queuedConversationMessages.id, args.messageId));
    if (isEmptyQueuedWorkerOutputError(error)) {
      await db.update(workers).set({
        status: "error",
        outputLog: error.message,
        updatedAt: failedAt,
      }).where(eq(workers.id, args.worker.id));
      if (args.run.mode === "direct" || args.run.mode === "commit") {
        await persistRunFailure(args.run.id, error, {
          surface: { code: "worker.idle.empty_output", workerId: args.worker.id },
        });
      }
    }
    if (args.userMessageId && (isAgentBusyError(error) || !userInputAppended)) {
      await db.delete(messages).where(eq(messages.id, args.userMessageId));
    }
    await insertQueueExecutionEvent(args.run.id, isAgentBusyError(error) ? "queued_message_deferred" : "queued_message_failed", {
      summary: isAgentBusyError(error)
        ? `Worker ${args.worker.id} is still busy; queued message will be retried.`
        : `Immediate queued steering failed for ${args.worker.id}.`,
      queuedMessageId: args.messageId,
      action: "steer",
      error: errorMessage(error),
    }, args.worker.id);
    if (isAgentNotFoundError(error)) {
      await insertQueueExecutionEvent(args.run.id, "queued_message_recovery_blocked", {
        summary: `Queued message ${args.messageId} is blocked because ${args.worker.id} is missing.`,
        queuedMessageId: args.messageId,
        action: "steer",
        error: errorMessage(error),
      }, args.worker.id);
      await reconcileRunRecovery({
        runId: args.run.id,
        liveAgents: [],
        source: "queued-message-delivery",
      });
    }
    notifyEventStreamSubscribers();
  }
}

async function sendQueuedConversationMessageNowUnlocked({
  runId,
  messageId,
}: {
  runId: string;
  messageId: string;
}) {
  await assertRunNotHandoffFenced(runId);
  const record = await db
    .select()
    .from(queuedConversationMessages)
    .where(eq(queuedConversationMessages.id, messageId))
    .get();

  if (!record || record.runId !== runId || record.status !== "pending") {
    throw Object.assign(new Error("Queued message not found"), { status: 404 });
  }

  const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
  if (!run) {
    throw Object.assign(new Error("Conversation not found"), { status: 404 });
  }

  const normalizedAttachments = normalizeChatAttachments(record.attachmentsJson ? JSON.parse(record.attachmentsJson) : []);
  const workerContent = appendAttachmentContext(record.content, normalizedAttachments, {
    resolvePath: (storagePath) => getAppDataPath(storagePath),
    imagesInlined: true,
  });
  const startedAt = new Date();

  await db.update(queuedConversationMessages).set({
    action: "steer",
    status: "delivering",
    lastError: null,
    updatedAt: startedAt,
  }).where(eq(queuedConversationMessages.id, messageId));

  if (run.mode === "implementation") {
    await db.update(runs).set({
      status: "running",
      failedAt: null,
      lastError: null,
      updatedAt: startedAt,
    }).where(eq(runs.id, runId));
    await db.update(queuedConversationMessages).set({
      action: "steer",
      status: "pending",
      lastError: null,
      updatedAt: startedAt,
      deliveredAt: null,
    }).where(eq(queuedConversationMessages.id, messageId));
    await insertQueueExecutionEvent(runId, "queued_message_sent_now", {
      summary: "Accepted queued message for implementation worker steering.",
      queuedMessageId: messageId,
      action: "steer",
    });
    startSupervisorRun(runId);
    notifyEventStreamSubscribers();

    return {
      ok: true,
      queuedMessage: serializeQueuedConversationMessage({
        ...record,
        action: "steer",
        status: "pending",
        lastError: null,
        updatedAt: startedAt,
        deliveredAt: null,
      }),
    };
  }

  const targetWorker = record.targetWorkerId
    ? await db.select().from(workers).where(eq(workers.id, record.targetWorkerId)).get()
    : null;
  const worker = targetWorker && targetWorker.runId === runId
    ? targetWorker
    : await getLatestRunWorker(runId, record.targetWorkerId);
  if (!worker || worker.runId !== runId) {
    await db.update(queuedConversationMessages).set({
      status: "pending",
      updatedAt: new Date(),
    }).where(eq(queuedConversationMessages.id, messageId));
    throw Object.assign(new Error("Conversation worker not found"), { status: 404 });
  }

  if (isWorkerClearlyBusy(worker)) {
    const error = `Ask failed: Agent is busy: ${worker.id}`;
    await db.update(queuedConversationMessages).set({
      action: "steer",
      targetWorkerId: worker.id,
      status: "pending",
      lastError: error,
      updatedAt: new Date(),
    }).where(eq(queuedConversationMessages.id, messageId));
    await insertQueueExecutionEvent(runId, "queued_message_deferred", {
      summary: `Worker ${worker.id} is still busy; queued message will be retried.`,
      queuedMessageId: messageId,
      action: "steer",
      error,
    }, worker.id);
    notifyEventStreamSubscribers();

    return {
      ok: true,
      queuedMessage: serializeQueuedConversationMessage({
        ...record,
        targetWorkerId: worker.id,
        action: "steer",
        status: "pending",
        lastError: error,
        updatedAt: startedAt,
        deliveredAt: null,
      }),
    };
  }

  const userMessage = {
    id: messageId,
    runId,
    role: "user",
    kind: "checkpoint",
    content: record.content,
    attachmentsJson: record.attachmentsJson,
    createdAt: startedAt,
  };

  await db.insert(messages).values(userMessage);
  await db.update(runs).set({
    status: run.mode === "planning" ? "working" : "running",
    failedAt: null,
    lastError: null,
    updatedAt: startedAt,
  }).where(eq(runs.id, runId));
  await db.update(workers).set({
    status: "working",
    updatedAt: startedAt,
  }).where(eq(workers.id, worker.id));

  await insertQueueExecutionEvent(runId, "queued_message_sent_now", {
    summary: `Accepted queued message for immediate steering to ${worker.id}.`,
    queuedMessageId: messageId,
    action: "steer",
  }, worker.id);
  notifyEventStreamSubscribers();

  trackConversationBackgroundTask(continueQueuedWorkerSteering({
    run,
    worker,
    messageId,
    userMessageId: userMessage.id,
    content: workerContent,
    userText: record.content,
    attachments: normalizedAttachments,
  }), { runId }).catch((error) => {
    console.error("Queued message immediate steering failed:", error);
  });

  return {
    ok: true,
    message: serializeMessageRecord(userMessage),
    queuedMessage: serializeQueuedConversationMessage({
      ...record,
      targetWorkerId: worker.id,
      action: "steer",
      status: "delivering",
      lastError: null,
      updatedAt: startedAt,
      deliveredAt: null,
    }),
  };
}

export function sendQueuedConversationMessageNow(args: Parameters<typeof sendQueuedConversationMessageNowUnlocked>[0]) {
  return runConversationMutation(args.runId, () => sendQueuedConversationMessageNowUnlocked(args));
}

async function pendingQueueRecords(runId: string, workerId?: string | null) {
  const records = await db
    .select()
    .from(queuedConversationMessages)
    .where(eq(queuedConversationMessages.runId, runId))
    .orderBy(asc(queuedConversationMessages.createdAt), asc(queuedConversationMessages.id));

  return records.filter((record) => {
    if (record.status !== "pending") {
      return false;
    }

    if (workerId === undefined) {
      return record.targetWorkerId === null;
    }

    return record.targetWorkerId === workerId;
  });
}

async function drainQueuedImplementationMessagesUnlocked(runId: string) {
  await assertRunNotHandoffFenced(runId);
  const records = await pendingQueueRecords(runId);
  let deliveredCount = 0;

  for (const record of records) {
    const now = new Date();
    await db.update(queuedConversationMessages).set({
      status: "delivering",
      updatedAt: now,
    }).where(eq(queuedConversationMessages.id, record.id));

    if (record.action === "steer") {
      const targetWorker = record.targetWorkerId
        ? await db.select().from(workers).where(eq(workers.id, record.targetWorkerId)).get()
        : null;
      const worker = targetWorker && targetWorker.runId === runId && !isCancelledWorkerStatus(targetWorker.status)
        ? targetWorker
        : await getLatestRunWorker(runId, record.targetWorkerId);

      if (!worker || worker.runId !== runId || isCancelledWorkerStatus(worker.status)) {
        await db.update(queuedConversationMessages).set({
          status: "pending",
          lastError: "Conversation worker not found",
          updatedAt: new Date(),
        }).where(eq(queuedConversationMessages.id, record.id));
        await insertQueueExecutionEvent(runId, "queued_message_deferred", {
          summary: "No active implementation worker is available; queued steering will be retried.",
          queuedMessageId: record.id,
          action: "steer",
          error: "Conversation worker not found",
        });
        continue;
      }

      const normalizedAttachments = normalizeChatAttachments(record.attachmentsJson ? JSON.parse(record.attachmentsJson) : []);
      const workerContent = appendAttachmentContext(record.content, normalizedAttachments, {
        resolvePath: (storagePath) => getAppDataPath(storagePath),
      });
      let interventionId: string | null = null;

      try {
        await runWorkerTurn(worker.id, async () => {
          await db.update(workers).set({
            status: "working",
            updatedAt: now,
          }).where(eq(workers.id, worker.id));
          const intervention = await recordSupervisorIntervention({
            runId,
            workerId: worker.id,
            prompt: workerContent,
            summary: `Sent user steering to ${worker.id}`,
            interventionType: "continue",
          });
          interventionId = intervention.id;
          const steerImages = resolveImageAttachments(normalizedAttachments, getAppDataPath);
          const response = steerImages.length
            ? await askAgent(worker.id, workerContent, steerImages)
            : await askAgent(worker.id, workerContent);
          const deliveredAt = new Date();
          const userMessage = {
            id: randomUUID(),
            runId,
            role: "user" as const,
            kind: "checkpoint" as const,
            content: record.content,
            attachmentsJson: record.attachmentsJson,
            createdAt: record.createdAt,
          };
          await appendUserInputOnDelivery({
            id: userMessage.id,
            runId,
            workerId: worker.id,
            text: record.content,
            deliveredAt,
            attachments: normalizedAttachments.map((attachment) => ({
              id: attachment.id,
              filename: attachment.name,
              mimeType: attachment.mimeType,
              sizeBytes: attachment.size,
              storagePath: attachment.storagePath,
            })),
            expectedTurnGeneration: worker.turnGeneration,
          });
          await db.insert(messages).values(userMessage);
          await db.insert(messages).values({
            id: randomUUID(),
            runId,
            role: "supervisor",
            kind: "update",
            content: `Got it. I sent that to ${formatWorkerLabel(worker)} and will keep watching the run.`,
            attachmentsJson: null,
            createdAt: deliveredAt,
          });
          await persistDeliveredWorkerResponse({
            run: { id: runId, mode: "implementation" },
            workerId: worker.id,
            response,
            deliveredAt,
            userInputEntryId: userMessage.id,
            expectedTurnGeneration: worker.turnGeneration,
          });
          // Worker response now lives in the unified worker stream.
          await db.update(queuedConversationMessages).set({
            targetWorkerId: worker.id,
            status: "delivered",
            updatedAt: deliveredAt,
            deliveredAt,
            lastError: null,
          }).where(eq(queuedConversationMessages.id, record.id));
          await insertQueueExecutionEvent(runId, "queued_message_delivered", {
            summary: `Delivered queued steering to ${worker.id}.`,
            queuedMessageId: record.id,
            action: "steer",
          }, worker.id);
        });
        deliveredCount += 1;
      } catch (error) {
        if (await handleQueuedWorkerQuotaError({
          runId,
          workerId: worker.id,
          workerType: worker.type,
          error,
        })) {
          await db.update(queuedConversationMessages).set({
            targetWorkerId: worker.id,
            status: "pending",
            lastError: null,
            updatedAt: new Date(),
          }).where(eq(queuedConversationMessages.id, record.id));
          continue;
        }

        const failedAt = new Date();
        await db.update(queuedConversationMessages).set({
          targetWorkerId: worker.id,
          status: isAgentBusyError(error) ? "pending" : "failed",
          lastError: errorMessage(error),
          updatedAt: failedAt,
        }).where(eq(queuedConversationMessages.id, record.id));
        if (isAgentBusyError(error) && interventionId) {
          await db.update(supervisorInterventions).set({
            summary: `Deferred user steering to ${worker.id}; worker is busy.`,
          }).where(eq(supervisorInterventions.id, interventionId));
        }
        await insertQueueExecutionEvent(runId, isAgentBusyError(error) ? "queued_message_deferred" : "queued_message_failed", {
          summary: isAgentBusyError(error)
            ? `Worker ${worker.id} is still busy; queued steering will be retried.`
            : `Queued steering delivery failed for ${worker.id}.`,
          queuedMessageId: record.id,
          action: "steer",
          error: errorMessage(error),
        }, worker.id);
      }
      continue;
    }

    await db.insert(messages).values({
      id: randomUUID(),
      runId,
      role: "user" as const,
      kind: "checkpoint" as const,
      content: record.content,
      attachmentsJson: record.attachmentsJson,
      createdAt: record.createdAt,
    });

    await db.update(queuedConversationMessages).set({
      status: "delivered",
      updatedAt: now,
      deliveredAt: now,
      lastError: null,
    }).where(eq(queuedConversationMessages.id, record.id));
    await insertQueueExecutionEvent(runId, "queued_message_delivered", {
      summary: "Delivered queued message into the supervisor conversation.",
      queuedMessageId: record.id,
    });
    deliveredCount += 1;
  }

  if (deliveredCount > 0) {
    notifyEventStreamSubscribers();
  }

  return deliveredCount;
}

export function drainQueuedImplementationMessages(runId: string) {
  return runConversationMutation(runId, () => drainQueuedImplementationMessagesUnlocked(runId));
}

async function drainQueuedWorkerMessagesUnlocked({
  runId,
  workerId,
  snapshot,
}: {
  runId: string;
  workerId: string;
  snapshot?: WorkerSnapshot | null;
}) {
  await assertRunNotHandoffFenced(runId);
  const worker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
  if (!worker || worker.runId !== runId) {
    return 0;
  }

  const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
  if (!run) {
    return 0;
  }

  const records = await pendingQueueRecords(runId, workerId);
  let deliveredCount = 0;

  for (const record of records) {
    const normalizedAttachments = normalizeChatAttachments(record.attachmentsJson ? JSON.parse(record.attachmentsJson) : []);
    const workerContent = appendAttachmentContext(record.content, normalizedAttachments, {
      resolvePath: (storagePath) => getAppDataPath(storagePath),
      imagesInlined: true,
    });
    const startedAt = new Date();

    // Keyed by the queue row id, matching the send-now path: the stream entry
    // is anchored before the ask, so a deferred retry must land on the same id
    // for `appendUserInputOnDelivery` to dedup instead of double-appending.
    const userMessage = {
      id: record.id,
      runId,
      role: "user" as const,
      kind: "checkpoint" as const,
      content: record.content,
      attachmentsJson: record.attachmentsJson,
      createdAt: startedAt,
    };
    const claimed = await db.update(queuedConversationMessages).set({
      status: "delivering",
      updatedAt: startedAt,
      lastError: null,
    }).where(and(
      eq(queuedConversationMessages.id, record.id),
      eq(queuedConversationMessages.status, "pending"),
    )).returning({ id: queuedConversationMessages.id });
    if (claimed.length === 0) {
      continue;
    }
    await db.update(runs).set({
      status: run.mode === "planning" ? "working" : "running",
      failedAt: null,
      lastError: null,
      updatedAt: startedAt,
    }).where(eq(runs.id, runId));

    // A pending elicitation belongs to the turn that is already running. Do
    // not queue its answer behind that same turn: the turn cannot finish until
    // the answer arrives, so acquiring the per-worker turn gate here creates a
    // self-deadlock and leaves the queue row in `delivering` forever.
    if (selectPendingWorkerElicitation(snapshot ?? null)) {
      const deliveredAt = new Date();
      const answered = await answerPendingWorkerElicitation({
        run,
        worker,
        snapshot: snapshot ?? null,
        content: record.content,
        deliveredAt,
      });
      if (answered) {
        await appendUserInputOnDelivery({
          id: userMessage.id,
          runId,
          workerId,
          text: record.content,
          deliveredAt,
          attachments: normalizedAttachments.map((attachment) => ({
            id: attachment.id,
            filename: attachment.name,
            mimeType: attachment.mimeType,
            sizeBytes: attachment.size,
            storagePath: attachment.storagePath,
          })),
          expectedTurnGeneration: worker.turnGeneration,
        });
        await db.insert(messages).values(userMessage);
        await db.update(queuedConversationMessages).set({
          status: "delivered",
          lastError: null,
          updatedAt: deliveredAt,
          deliveredAt,
        }).where(eq(queuedConversationMessages.id, record.id));
        await insertQueueExecutionEvent(runId, "queued_message_delivered", {
          summary: `Delivered queued answer to ${workerId}'s pending question.`,
          queuedMessageId: record.id,
          delivery: "elicitation",
        }, workerId);
        deliveredCount += 1;
        continue;
      }
    }

    try {
      const turnDelivered = await runWorkerTurn(workerId, async () => {
        const workerClaimed = await db.update(workers).set({
          status: "working",
          updatedAt: startedAt,
        }).where(and(
          eq(workers.id, workerId),
          eq(workers.turnGeneration, worker.turnGeneration),
        )).returning({ id: workers.id }).get();
        if (!workerClaimed) {
          return false;
        }
        const snapshotBeforeAsk = snapshot ?? await Promise.resolve(getAgent(workerId)).catch(() => null);
        const deliveredAt = new Date();
        if (await answerPendingWorkerElicitation({
          run,
          worker,
          snapshot: snapshotBeforeAsk,
          content: record.content,
          deliveredAt,
        })) {
          await appendUserInputOnDelivery({
            id: userMessage.id,
            runId,
            workerId,
            text: record.content,
            deliveredAt,
            attachments: normalizedAttachments.map((attachment) => ({
              id: attachment.id,
              filename: attachment.name,
              mimeType: attachment.mimeType,
              sizeBytes: attachment.size,
              storagePath: attachment.storagePath,
            })),
            expectedTurnGeneration: worker.turnGeneration,
          });
          await db.insert(messages).values(userMessage);
          await db.update(queuedConversationMessages).set({
            status: "delivered",
            lastError: null,
            updatedAt: deliveredAt,
            deliveredAt,
          }).where(eq(queuedConversationMessages.id, record.id));
          await insertQueueExecutionEvent(runId, "queued_message_delivered", {
            summary: `Delivered queued answer to ${workerId}'s pending question.`,
            queuedMessageId: record.id,
            delivery: "elicitation",
          }, workerId);
          return true;
        }

        // Anchor the user's message before the ask. The turn can block for its
        // whole duration — indefinitely, if the agent raises an elicitation
        // mid-turn — and appending only after `askAgent` resolves left the
        // prompt, the streamed output and the question itself invisible for
        // that entire window: the conversation looked finished while the
        // status said working. The queue row is already claimed `delivering`
        // above, so no concurrent drain can re-enter this record, and the
        // entry id is the queue row id, so a deferred retry dedups rather
        // than appending the prompt twice.
        await appendUserInputOnDelivery({
          id: userMessage.id,
          runId,
          workerId,
          text: record.content,
          deliveredAt,
          attachments: normalizedAttachments.map((attachment) => ({
            id: attachment.id,
            filename: attachment.name,
            mimeType: attachment.mimeType,
            sizeBytes: attachment.size,
            storagePath: attachment.storagePath,
          })),
          expectedTurnGeneration: worker.turnGeneration,
        });
        notifyEventStreamSubscribers();

        const drainImages = resolveImageAttachments(normalizedAttachments, getAppDataPath);
        const response = drainImages.length
          ? await askAgent(workerId, workerPromptForRun(run, workerContent), drainImages)
          : await askAgent(workerId, workerPromptForRun(run, workerContent));
        await db.insert(messages).values(userMessage);
        await persistDeliveredWorkerResponse({
          run,
          workerId,
          response,
          deliveredAt,
          userInputEntryId: userMessage.id,
          expectedTurnGeneration: worker.turnGeneration,
        });
        // Worker response now lives in the unified worker stream.
        await db.update(queuedConversationMessages).set({
          status: "delivered",
          lastError: null,
          updatedAt: deliveredAt,
          deliveredAt,
        }).where(eq(queuedConversationMessages.id, record.id));
        await insertQueueExecutionEvent(runId, "queued_message_delivered", {
          summary: `Delivered queued message to ${workerId}.`,
          queuedMessageId: record.id,
        }, workerId);
        return true;
      });
      if (!turnDelivered) {
        await db.update(queuedConversationMessages).set({
          status: "pending",
          lastError: null,
          updatedAt: new Date(),
        }).where(and(
          eq(queuedConversationMessages.id, record.id),
          eq(queuedConversationMessages.status, "delivering"),
        ));
        await insertQueueExecutionEvent(runId, "queued_message_superseded", {
          summary: `Requeued ${record.id} because a newer worker turn took over before delivery.`,
          queuedMessageId: record.id,
        }, workerId);
        continue;
      }
      deliveredCount += 1;
    } catch (error) {
      if (await handleQueuedWorkerQuotaError({
        runId,
        workerId,
        workerType: worker.type,
        error,
      })) {
        await db.update(queuedConversationMessages).set({
          status: "pending",
          lastError: null,
          updatedAt: new Date(),
        }).where(eq(queuedConversationMessages.id, record.id));
        continue;
      }

      const failedAt = new Date();
      await db.update(queuedConversationMessages).set({
        status: isAgentBusyError(error) ? "pending" : "failed",
        lastError: errorMessage(error),
        updatedAt: failedAt,
      }).where(eq(queuedConversationMessages.id, record.id));
      await insertQueueExecutionEvent(runId, isAgentBusyError(error) ? "queued_message_deferred" : "queued_message_failed", {
        summary: isAgentBusyError(error)
          ? `Worker ${workerId} is still busy; queued message will be retried.`
          : `Queued message delivery failed for ${workerId}.`,
        queuedMessageId: record.id,
        error: errorMessage(error),
      }, workerId);

      if (isAgentNotFoundError(error)) {
        await insertQueueExecutionEvent(runId, "queued_message_recovery_blocked", {
          summary: `Queued message ${record.id} is blocked because ${workerId} is missing.`,
          queuedMessageId: record.id,
          error: errorMessage(error),
        }, workerId);
        await reconcileRunRecovery({
          runId,
          liveAgents: [],
          source: "queued-message-drain",
        });
      }

      if (isAgentBusyError(error)) {
        await db.delete(messages).where(eq(messages.id, userMessage.id));
      } else {
        break;
      }
    }
  }

  if (deliveredCount > 0 || records.length > 0) {
    notifyEventStreamSubscribers();
  }

  return deliveredCount;
}

export function drainQueuedWorkerMessages(args: Parameters<typeof drainQueuedWorkerMessagesUnlocked>[0]) {
  // Queue delivery already owns rows with an atomic pending -> delivering
  // claim, then serializes actual provider I/O through the per-worker turn
  // gate. Holding the conversation mutex across askAgent can block later
  // sends for minutes and surface as HTTP 524 at the proxy.
  return drainQueuedWorkerMessagesUnlocked(args);
}
