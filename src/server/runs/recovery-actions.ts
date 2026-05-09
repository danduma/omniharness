import { randomUUID } from "crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { messages, plans, queuedConversationMessages, runs, workers } from "@/server/db/schema";
import { clearSupervisorWakeLease } from "@/server/supervisor/lease";
import { startSupervisorRun } from "@/server/supervisor/start";
import { isRecoverableAgentMissingError } from "./recovery-state";

export async function findLatestUserCheckpoint(runId: string) {
  const runMessages = await db.select()
    .from(messages)
    .where(eq(messages.runId, runId))
    .orderBy(asc(messages.createdAt));

  return runMessages.filter((message) => message.role === "user").at(-1) ?? null;
}

export async function requeueRecoverableQueuedMessages(args: {
  runId: string;
  workerId?: string | null;
}) {
  const records = await db.select()
    .from(queuedConversationMessages)
    .where(eq(queuedConversationMessages.runId, args.runId));

  const recoverableIds = records
    .filter((record) => (
      (record.status === "failed" || record.status === "delivering")
      && isRecoverableAgentMissingError(record.lastError)
      && (!args.workerId || !record.targetWorkerId || record.targetWorkerId === args.workerId)
    ))
    .map((record) => record.id);

  if (recoverableIds.length === 0) {
    return 0;
  }

  await db.update(queuedConversationMessages).set({
    status: "pending",
    action: "queue",
    targetWorkerId: null,
    lastError: null,
    updatedAt: new Date(),
    deliveredAt: null,
  }).where(inArray(queuedConversationMessages.id, recoverableIds));

  return recoverableIds.length;
}

export async function drainPendingImplementationQueuedMessages(runId: string) {
  const records = await db.select()
    .from(queuedConversationMessages)
    .where(eq(queuedConversationMessages.runId, runId))
    .orderBy(asc(queuedConversationMessages.createdAt));
  let deliveredCount = 0;

  for (const record of records) {
    if (record.status !== "pending" || record.targetWorkerId !== null) {
      continue;
    }

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
    deliveredCount += 1;
  }

  return deliveredCount;
}

export async function restartImplementationRunFromLatestCheckpoint(args: {
  runId: string;
  workerId?: string | null;
  preserveQueuedMessages?: boolean;
}) {
  const run = await db.select().from(runs).where(eq(runs.id, args.runId)).get();
  if (!run) {
    throw new Error("Run not found");
  }

  if (run.mode !== "implementation") {
    throw new Error("Checkpoint restart is only available for implementation runs");
  }

  const latestCheckpoint = await findLatestUserCheckpoint(run.id);
  if (!latestCheckpoint) {
    throw new Error("No user checkpoint is available for recovery");
  }

  await clearSupervisorWakeLease(run.id);

  if (args.workerId) {
    await db.update(workers).set({
      status: "lost",
      updatedAt: new Date(),
    }).where(and(
      eq(workers.id, args.workerId),
      eq(workers.runId, run.id),
    ));
  }

  const requeuedCount = args.preserveQueuedMessages === false
    ? 0
    : await requeueRecoverableQueuedMessages({
      runId: run.id,
      workerId: args.workerId,
    });

  const plan = await db.select().from(plans).where(eq(plans.id, run.planId)).get();
  if (plan) {
    await db.update(plans).set({
      status: "running",
      updatedAt: new Date(),
    }).where(eq(plans.id, plan.id));
  }

  await db.update(runs).set({
    status: "running",
    failedAt: null,
    lastError: null,
    updatedAt: new Date(),
  }).where(eq(runs.id, run.id));

  const drainedCount = args.preserveQueuedMessages === false
    ? 0
    : await drainPendingImplementationQueuedMessages(run.id);

  startSupervisorRun(run.id);

  return {
    runId: run.id,
    checkpointMessageId: latestCheckpoint.id,
    requeuedCount,
    drainedCount,
  };
}

export async function setRunNeedsRecovery(args: {
  runId: string;
  reason: string;
}) {
  await db.update(runs).set({
    status: "needs_recovery",
    lastError: args.reason,
    updatedAt: new Date(),
  }).where(eq(runs.id, args.runId));
}
