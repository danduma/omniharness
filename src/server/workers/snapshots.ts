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
import { queueConversationTitleGeneration } from "@/server/conversation-title";

type PersistableWorkerSnapshot = Pick<AgentRecord, "outputEntries" | "currentText" | "lastText"> & {
  sessionId?: string | null;
  sessionMode?: string | null;
  claudeConfigDir?: string | null;
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
 * Take a provider-generated title when one exists, then fall back to the
 * harness title generator after the first assistant reply.
 *
 * Provider sources are checked cheapest-first. ACP `session_info_update` is
 * useful when an adapter sends a genuine title. Claude's transcript title is
 * opportunistic because ACP-spawned Claude sessions may never write one.
 */
async function adoptAgentGeneratedTitle(
  worker: typeof workers.$inferSelect,
  snapshot: PersistableWorkerSnapshot,
) {
  const streamTitle = extractAgentSessionTitle(snapshot.outputEntries);
  let streamCandidateStatus: "missing" | "rejected" = "missing";
  if (streamTitle) {
    // A rejected stream title (Codex echoes the prompt here rather than
    // summarising it) is not an answer, so keep looking.
    const outcome = await applyAgentSessionTitle({ runId: worker.runId, title: streamTitle });
    if (outcome !== "rejected") {
      return;
    }
    streamCandidateStatus = "rejected";
  }

  const sessionId = (snapshot.sessionId ?? worker.bridgeSessionId)?.trim();
  const transcriptLookupAttempted = worker.type === "claude" && Boolean(sessionId && worker.cwd);
  let transcriptCandidateStatus: "not_applicable" | "missing" | "rejected" = transcriptLookupAttempted
    ? "missing"
    : "not_applicable";
  if (transcriptLookupAttempted && sessionId) {
    const transcriptTitle = await readAgentSessionTitleFromTranscript({
      sessionId,
      cwd: worker.cwd,
      configDir: snapshot.claudeConfigDir ?? undefined,
    });
    if (transcriptTitle) {
      const outcome = await applyAgentSessionTitle({ runId: worker.runId, title: transcriptTitle });
      if (outcome !== "rejected") {
        return;
      }
      transcriptCandidateStatus = "rejected";
    }
  }

  const assistantReply = snapshot.outputEntries
      ?.find((entry) => entry.type === "message" && entry.status !== "archived")
      ?.text.trim()
    || snapshot.lastText?.trim()
    || snapshot.currentText?.trim()
    || "";
  await queueConversationTitleGeneration({
    runId: worker.runId,
    workerId: worker.id,
    workerType: worker.type,
    assistantReply,
    streamCandidateStatus,
    transcriptCandidateStatus,
  });
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
  }
  if (
    snapshot.outputEntries?.length
    || snapshot.lastText?.trim()
    || snapshot.currentText?.trim()
    || snapshot.sessionId?.trim()
    || worker.bridgeSessionId?.trim()
  ) {
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
