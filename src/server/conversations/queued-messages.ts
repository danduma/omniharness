import { randomUUID } from "crypto";
import { asc, desc, eq } from "drizzle-orm";
import { askAgent } from "@/server/bridge-client";
import { db } from "@/server/db";
import { executionEvents, messages, queuedConversationMessages, runs, workers } from "@/server/db/schema";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
import { startSupervisorRun } from "@/server/supervisor/start";
import { appendAttachmentContext, normalizeChatAttachments, serializeChatAttachments, type ChatAttachment } from "@/lib/chat-attachments";
import { serializeMessageRecord } from "./message-records";

export type BusyMessageAction = "queue" | "steer";
export type QueuedConversationMessageStatus = "pending" | "delivering" | "delivered" | "cancelled" | "failed";

type QueuedConversationMessageRecord = typeof queuedConversationMessages.$inferSelect;

export function parseBusyMessageAction(value: unknown): BusyMessageAction | null {
  return value === "queue" || value === "steer" ? value : null;
}

function isAgentBusyError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /\bagent is busy\b/i.test(message);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isAgentNotFoundError(error: unknown) {
  return /\bagent not found\b/i.test(errorMessage(error));
}

async function getLatestRunWorker(runId: string, excludedWorkerId?: string | null) {
  const records = await db
    .select()
    .from(workers)
    .where(eq(workers.runId, runId))
    .orderBy(desc(workers.createdAt));

  return records.find((worker) => worker.id !== excludedWorkerId) ?? null;
}

async function insertQueueExecutionEvent(
  runId: string,
  eventType: string,
  details: Record<string, unknown>,
  workerId?: string | null,
) {
  await db.insert(executionEvents).values({
    id: randomUUID(),
    runId,
    workerId: workerId ?? null,
    eventType,
    details: JSON.stringify(details),
    createdAt: new Date(),
  });
}

export function serializeQueuedConversationMessage(record: QueuedConversationMessageRecord) {
  return {
    id: record.id,
    runId: record.runId,
    targetWorkerId: record.targetWorkerId,
    action: record.action as BusyMessageAction,
    content: record.content,
    status: record.status as QueuedConversationMessageStatus,
    lastError: record.lastError,
    attachments: normalizeChatAttachments(record.attachmentsJson ? JSON.parse(record.attachmentsJson) : []),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    deliveredAt: record.deliveredAt?.toISOString() ?? null,
  };
}

export async function listPendingQueuedConversationMessages(runId: string) {
  const records = await db
    .select()
    .from(queuedConversationMessages)
    .where(eq(queuedConversationMessages.runId, runId))
    .orderBy(asc(queuedConversationMessages.createdAt));

  return records
    .filter((record) => record.status === "pending" || record.status === "delivering")
    .map(serializeQueuedConversationMessage);
}

export async function createQueuedConversationMessage({
  runId,
  targetWorkerId = null,
  action,
  content,
  attachments = [],
}: {
  runId: string;
  targetWorkerId?: string | null;
  action: BusyMessageAction;
  content: string;
  attachments?: ChatAttachment[];
}) {
  const trimmedContent = content.trim();
  const normalizedAttachments = normalizeChatAttachments(attachments);
  if (!trimmedContent && normalizedAttachments.length === 0) {
    throw Object.assign(new Error("Message content or attachment is required"), { status: 400 });
  }

  const now = new Date();
  const record = {
    id: randomUUID(),
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

export async function cancelQueuedConversationMessage({
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

  if (!record || record.runId !== runId || record.status !== "pending") {
    throw Object.assign(new Error("Queued message not found"), { status: 404 });
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

async function deliverQueuedWorkerSteering(args: {
  run: typeof runs.$inferSelect;
  worker: typeof workers.$inferSelect;
  messageId: string;
  content: string;
}) {
  const response = await askAgent(args.worker.id, args.content);
  const deliveredAt = new Date();
  await db.update(workers).set({
    status: response.state,
    updatedAt: deliveredAt,
  }).where(eq(workers.id, args.worker.id));
  await db.insert(messages).values({
    id: randomUUID(),
    runId: args.run.id,
    role: "worker",
    kind: args.run.mode,
    content: response.response,
    workerId: args.worker.id,
    createdAt: deliveredAt,
  });
  await insertQueueExecutionEvent(args.run.id, "queued_message_delivered", {
    summary: `Delivered immediate queued steering to ${args.worker.id}.`,
    queuedMessageId: args.messageId,
    action: "steer",
  }, args.worker.id);
  notifyEventStreamSubscribers();
}

async function continueQueuedWorkerSteering(args: {
  run: typeof runs.$inferSelect;
  worker: typeof workers.$inferSelect;
  messageId: string;
  content: string;
}) {
  try {
    await deliverQueuedWorkerSteering(args);
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
          });
          return;
        } catch (fallbackError) {
          error = fallbackError;
        }
      }
    }

    const failedAt = new Date();
    await db.update(queuedConversationMessages).set({
      status: "failed",
      lastError: errorMessage(error),
      updatedAt: failedAt,
    }).where(eq(queuedConversationMessages.id, args.messageId));
    await insertQueueExecutionEvent(args.run.id, "queued_message_failed", {
      summary: `Immediate queued steering failed for ${args.worker.id}.`,
      queuedMessageId: args.messageId,
      action: "steer",
      error: errorMessage(error),
    }, args.worker.id);
    notifyEventStreamSubscribers();
  }
}

export async function sendQueuedConversationMessageNow({
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

  if (!record || record.runId !== runId || record.status !== "pending") {
    throw Object.assign(new Error("Queued message not found"), { status: 404 });
  }

  const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
  if (!run) {
    throw Object.assign(new Error("Conversation not found"), { status: 404 });
  }

  const normalizedAttachments = normalizeChatAttachments(record.attachmentsJson ? JSON.parse(record.attachmentsJson) : []);
  const workerContent = appendAttachmentContext(record.content, normalizedAttachments);
  const startedAt = new Date();

  await db.update(queuedConversationMessages).set({
    action: "steer",
    status: "delivering",
    lastError: null,
    updatedAt: startedAt,
  }).where(eq(queuedConversationMessages.id, messageId));

  if (run.mode === "implementation") {
    const message = {
      id: randomUUID(),
      runId,
      role: "user",
      kind: "checkpoint",
      content: record.content,
      attachmentsJson: record.attachmentsJson,
      createdAt: startedAt,
    };

    await db.insert(messages).values(message);
    await db.update(runs).set({
      status: "running",
      failedAt: null,
      lastError: null,
      updatedAt: startedAt,
    }).where(eq(runs.id, runId));

    const deliveredAt = new Date();
    await db.update(queuedConversationMessages).set({
      action: "steer",
      status: "delivered",
      lastError: null,
      updatedAt: deliveredAt,
      deliveredAt,
    }).where(eq(queuedConversationMessages.id, messageId));
    await insertQueueExecutionEvent(runId, "queued_message_sent_now", {
      summary: "Sent queued message immediately as steering.",
      queuedMessageId: messageId,
      action: "steer",
    });
    startSupervisorRun(runId);
    notifyEventStreamSubscribers();

    return {
      ok: true,
      message: serializeMessageRecord(message),
      queuedMessage: serializeQueuedConversationMessage({
        ...record,
        action: "steer",
        status: "delivered",
        lastError: null,
        updatedAt: deliveredAt,
        deliveredAt,
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

  const userMessage = {
    id: randomUUID(),
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

  const deliveredAt = new Date();
  await db.update(queuedConversationMessages).set({
    action: "steer",
    targetWorkerId: worker.id,
    status: "delivered",
    lastError: null,
    updatedAt: deliveredAt,
    deliveredAt,
  }).where(eq(queuedConversationMessages.id, messageId));
  await insertQueueExecutionEvent(runId, "queued_message_sent_now", {
    summary: `Accepted queued message for immediate steering to ${worker.id}.`,
    queuedMessageId: messageId,
    action: "steer",
  }, worker.id);
  notifyEventStreamSubscribers();

  continueQueuedWorkerSteering({
    run,
    worker,
    messageId,
    content: workerContent,
  }).catch((error) => {
    console.error("Queued message immediate steering failed:", error);
  });

  return {
    ok: true,
    message: serializeMessageRecord(userMessage),
    queuedMessage: serializeQueuedConversationMessage({
      ...record,
      targetWorkerId: worker.id,
      action: "steer",
      status: "delivered",
      lastError: null,
      updatedAt: deliveredAt,
      deliveredAt,
    }),
  };
}

async function pendingQueueRecords(runId: string, workerId?: string | null) {
  const records = await db
    .select()
    .from(queuedConversationMessages)
    .where(eq(queuedConversationMessages.runId, runId))
    .orderBy(asc(queuedConversationMessages.createdAt));

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

export async function drainQueuedImplementationMessages(runId: string) {
  const records = await pendingQueueRecords(runId);
  let deliveredCount = 0;

  for (const record of records) {
    const now = new Date();
    await db.update(queuedConversationMessages).set({
      status: "delivering",
      updatedAt: now,
    }).where(eq(queuedConversationMessages.id, record.id));

    await db.insert(messages).values({
      id: randomUUID(),
      runId,
      role: "user",
      kind: "checkpoint",
      content: record.content,
      attachmentsJson: record.attachmentsJson,
      createdAt: now,
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

export async function drainQueuedWorkerMessages({
  runId,
  workerId,
}: {
  runId: string;
  workerId: string;
}) {
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
    const workerContent = appendAttachmentContext(record.content, normalizedAttachments);
    const startedAt = new Date();

    await db.update(queuedConversationMessages).set({
      status: "delivering",
      updatedAt: startedAt,
      lastError: null,
    }).where(eq(queuedConversationMessages.id, record.id));
    await db.insert(messages).values({
      id: randomUUID(),
      runId,
      role: "user",
      kind: "checkpoint",
      content: record.content,
      attachmentsJson: record.attachmentsJson,
      createdAt: startedAt,
    });
    await db.update(runs).set({
      status: run.mode === "planning" ? "working" : "running",
      failedAt: null,
      lastError: null,
      updatedAt: startedAt,
    }).where(eq(runs.id, runId));

    try {
      await db.update(workers).set({
        status: "working",
        updatedAt: startedAt,
      }).where(eq(workers.id, workerId));
      const response = await askAgent(workerId, workerContent);
      const deliveredAt = new Date();
      await db.update(workers).set({
        status: response.state,
        updatedAt: deliveredAt,
      }).where(eq(workers.id, workerId));
      await db.insert(messages).values({
        id: randomUUID(),
        runId,
        role: "worker",
        kind: run.mode,
        content: response.response,
        workerId,
        createdAt: deliveredAt,
      });
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
      deliveredCount += 1;
    } catch (error) {
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

      if (!isAgentBusyError(error)) {
        break;
      }
    }
  }

  if (deliveredCount > 0 || records.length > 0) {
    notifyEventStreamSubscribers();
  }

  return deliveredCount;
}
