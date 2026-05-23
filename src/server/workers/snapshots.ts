import { asc, eq } from "drizzle-orm";
import type { AgentRecord } from "@/server/bridge-client";
import { db } from "@/server/db";
import { messages, runs, workers } from "@/server/db/schema";
import { parseChatAttachmentsJson } from "@/lib/chat-attachments";
import { appendUserInputOnDelivery } from "@/server/workers/stream-writer";
import {
  parseLegacyOutputEntriesJson,
  readWorkerOutputEntries,
  writeWorkerOutputEntries,
} from "@/server/workers/output-store";

type PersistableWorkerSnapshot = Pick<AgentRecord, "outputEntries" | "currentText" | "lastText">;

/**
 * Backward-compatible synchronous parser for legacy DB-stored JSON.
 * New code should call readWorkerOutputEntries(runId, workerId) instead.
 */
export function parseWorkerOutputEntries(value: string | null | undefined) {
  return parseLegacyOutputEntriesJson(value);
}

/**
 * Serializes for legacy callers that still need a single string blob (tests, exports).
 * The live persistence path no longer writes this to the DB.
 */
export function serializeWorkerOutputEntries(
  outputEntries: AgentRecord["outputEntries"],
) {
  if (!Array.isArray(outputEntries) || outputEntries.length === 0) {
    return "";
  }
  try {
    return JSON.stringify(outputEntries);
  } catch {
    return "";
  }
}

async function seedInitialDirectUserPrompt(worker: typeof workers.$inferSelect) {
  const initialPrompt = worker.initialPrompt.trim();
  if (!initialPrompt) {
    return;
  }

  const run = await db.select({ mode: runs.mode }).from(runs).where(eq(runs.id, worker.runId)).get();
  if (run?.mode !== "direct" && run?.mode !== "commit") {
    return;
  }

  const userMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.runId, worker.runId))
    .orderBy(asc(messages.createdAt), asc(messages.id));
  const initialMessage = userMessages.find((message) => (
    message.role === "user"
    && message.content.trim() === initialPrompt
  ));
  if (!initialMessage) {
    return;
  }

  const attachments = parseChatAttachmentsJson(initialMessage.attachmentsJson);
  await appendUserInputOnDelivery({
    id: initialMessage.id,
    runId: worker.runId,
    workerId: worker.id,
    text: initialMessage.content,
    deliveredAt: initialMessage.createdAt,
    attachments: attachments.map((attachment) => ({
      id: attachment.id,
      filename: attachment.name,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.size,
    })),
  });
}

export async function persistWorkerSnapshot(
  workerId: string,
  snapshot: PersistableWorkerSnapshot,
) {
  const worker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
  if (!worker) {
    return;
  }

  if (Array.isArray(snapshot.outputEntries) && snapshot.outputEntries.length > 0) {
    await seedInitialDirectUserPrompt(worker);
    await writeWorkerOutputEntries(worker.runId, workerId, snapshot.outputEntries);
  }
  await db.update(workers).set({
    currentText: snapshot.currentText,
    lastText: snapshot.lastText || worker.lastText,
    updatedAt: new Date(),
  }).where(eq(workers.id, workerId));
}

export { readWorkerOutputEntries };
