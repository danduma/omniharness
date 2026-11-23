import { eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { queuedConversationMessages, runs } from "@/server/db/schema";
import { isRecoverableAgentMissingError } from "./recovery-state";

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
