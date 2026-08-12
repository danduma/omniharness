import { and, asc, eq } from "drizzle-orm";
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
import { appendWorkerSessionMetadata } from "@/server/workers/session-metadata";
import {
  applyAgentSessionTitle,
  extractAgentSessionTitle,
} from "@/server/conversations/agent-session-title";
import { readAgentSessionTitleFromTranscript } from "@/server/conversations/agent-transcript-title";

type PersistableWorkerSnapshot = Pick<AgentRecord, "outputEntries" | "currentText" | "lastText"> & {
  sessionId?: string | null;
  sessionMode?: string | null;
};

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
      storagePath: attachment.storagePath,
    })),
  });
}

/**
 * Take the title the agent generated for itself, in preference to anything
 * derived from the user's first message.
 *
 * Two sources, checked cheapest-first. The ACP `session_info_update` route is
 * the one the protocol intends, but Claude Code does not currently send it;
 * its title lives in its own session transcript instead, found by the session
 * id already recorded on the worker.
 */
async function adoptAgentGeneratedTitle(
  worker: typeof workers.$inferSelect,
  snapshot: PersistableWorkerSnapshot,
) {
  const streamTitle = extractAgentSessionTitle(snapshot.outputEntries);
  if (streamTitle) {
    // A rejected stream title (Codex echoes the prompt here rather than
    // summarising it) is not an answer, so keep looking.
    const outcome = await applyAgentSessionTitle({ runId: worker.runId, title: streamTitle });
    if (outcome !== "rejected") {
      return;
    }
  }

  const sessionId = (snapshot.sessionId ?? worker.bridgeSessionId)?.trim();
  if (!sessionId || !worker.cwd) {
    return;
  }
  const transcriptTitle = await readAgentSessionTitleFromTranscript({ sessionId, cwd: worker.cwd });
  if (transcriptTitle) {
    await applyAgentSessionTitle({ runId: worker.runId, title: transcriptTitle });
  }
}

export async function persistWorkerSnapshot(
  workerId: string,
  snapshot: PersistableWorkerSnapshot,
  options: { expectedTurnGeneration?: number } = {},
) {
  const worker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
  if (
    !worker
    || (options.expectedTurnGeneration !== undefined
      && worker.turnGeneration !== options.expectedTurnGeneration)
  ) {
    return;
  }

  if (Array.isArray(snapshot.outputEntries) && snapshot.outputEntries.length > 0) {
    await seedInitialDirectUserPrompt(worker);
    await writeWorkerOutputEntries(worker.runId, workerId, snapshot.outputEntries);
    await adoptAgentGeneratedTitle(worker, snapshot);
  }
  await appendWorkerSessionMetadata({
    runId: worker.runId,
    workerId,
    sessionId: snapshot.sessionId,
    sessionMode: snapshot.sessionMode,
    source: "snapshot",
  });
  await db.update(workers).set({
    currentText: snapshot.currentText,
    lastText: snapshot.lastText || worker.lastText,
    updatedAt: new Date(),
  }).where(options.expectedTurnGeneration === undefined
    ? eq(workers.id, workerId)
    : and(
      eq(workers.id, workerId),
      eq(workers.turnGeneration, options.expectedTurnGeneration),
    ));
}

export { readWorkerOutputEntries };
