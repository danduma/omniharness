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
import { readCodexThreadTitle } from "@/server/conversations/agent-thread-title";
import { claudeConfigDirCandidates } from "@/server/conversations/agent-cli-homes";
import { emitNamedEvent } from "@/server/events/named-events";

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

type TitleCandidateStatus = "not_applicable" | "missing" | "rejected";

/**
 * Once per worker per process. This runs on every snapshot persist, and a
 * conversation whose provider never names it would otherwise report the same
 * miss hundreds of times and push everything else out of the ring buffer.
 */
const reportedTitleMisses = new Set<string>();

export function __resetTitleMissReportingForTests() {
  reportedTitleMisses.clear();
}

function reportMissingTitleSources(args: {
  worker: typeof workers.$inferSelect;
  streamCandidateStatus: TitleCandidateStatus;
  storeCandidateStatus: TitleCandidateStatus;
}) {
  if (reportedTitleMisses.has(args.worker.id)) {
    return;
  }
  reportedTitleMisses.add(args.worker.id);
  emitNamedEvent({
    kind: "conversation.title_sources_missing",
    runId: args.worker.runId,
    workerId: args.worker.id,
    workerType: args.worker.type,
    streamCandidateStatus: args.streamCandidateStatus,
    transcriptCandidateStatus: args.storeCandidateStatus,
    fallback: "initial_title",
  });
}

/**
 * Read the provider's own store for the title it gave this session.
 *
 * Claude keeps one in the session transcript, Codex in its thread index. Both
 * are found by the session id already on the worker, and both are read rather
 * than asked for: nothing here prompts a model or costs a token.
 */
async function providerStoreTitle(worker: typeof workers.$inferSelect, sessionId: string, snapshot: PersistableWorkerSnapshot) {
  const workerType = worker.type.trim().toLowerCase();
  if (workerType === "claude") {
    return readAgentSessionTitleFromTranscript({
      sessionId,
      cwd: worker.cwd,
      configDir: snapshot.claudeConfigDir ?? undefined,
      configDirs: await claudeConfigDirCandidates(worker),
    });
  }
  if (workerType === "codex") {
    // Codex seeds `threads.title` with the prompt and replaces it only on a
    // rename, so the row is always worth reading and rarely worth trusting.
    // `applyAgentSessionTitle` is what tells a name from an echo.
    return (await readCodexThreadTitle({ sessionId, worker }))?.title ?? null;
  }
  return null;
}

/**
 * Take the title the CLI gave this session, or leave the conversation with the
 * one it was created from.
 *
 * Every source here is something the provider wrote for its own purposes, and
 * none is guaranteed to hold anything. ACP `session_info_update` is checked
 * first because the payload is already in hand; Claude never sends it and what
 * Codex sends is usually the prompt rather than a name, so the provider's own
 * store is read next. When both come up empty the conversation keeps the first
 * line of what the user typed, and the miss is reported once — a source that
 * quietly stops producing (as Claude's transcript title did on 2026-08-16)
 * should show up in the event log rather than only in the sidebar.
 */
async function adoptAgentGeneratedTitle(
  worker: typeof workers.$inferSelect,
  snapshot: PersistableWorkerSnapshot,
) {
  const streamTitle = extractAgentSessionTitle(snapshot.outputEntries);
  let streamCandidateStatus: TitleCandidateStatus = "missing";
  if (streamTitle) {
    // A rejected stream title (Codex publishes the prompt here when its thread
    // has no name) is not an answer, so keep looking.
    const outcome = await applyAgentSessionTitle({ runId: worker.runId, title: streamTitle });
    if (outcome !== "rejected") {
      return;
    }
    streamCandidateStatus = "rejected";
  }

  const sessionId = (snapshot.sessionId ?? worker.bridgeSessionId)?.trim();
  if (!sessionId || !worker.cwd) {
    reportMissingTitleSources({ worker, streamCandidateStatus, storeCandidateStatus: "not_applicable" });
    return;
  }

  const storeTitle = await providerStoreTitle(worker, sessionId, snapshot);
  if (!storeTitle) {
    reportMissingTitleSources({ worker, streamCandidateStatus, storeCandidateStatus: "missing" });
    return;
  }

  const outcome = await applyAgentSessionTitle({
    runId: worker.runId,
    title: storeTitle,
    source: worker.type.trim().toLowerCase() === "codex" ? "agent_thread_index" : "agent_transcript",
  });
  if (outcome === "rejected") {
    reportMissingTitleSources({ worker, streamCandidateStatus, storeCandidateStatus: "rejected" });
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
