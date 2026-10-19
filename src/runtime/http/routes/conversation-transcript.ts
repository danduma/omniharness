/**
 * GET /api/conversations/:runId/transcript?limit=N
 * GET /api/conversations/:runId/transcript?afterToken=<base64-json>
 * GET /api/conversations/:runId/transcript?beforeToken=<base64-json>&limit=N
 *
 * Returns a chronologically-merged view of every worker's entries for a
 * given run, so the conversation UI can render the full history when a
 * run has cycled through multiple workers (cancel → respawn). The
 * per-worker `/api/workers/:workerId/entries` endpoint only sees the
 * one worker the FE happens to be polling; after a cancel+respawn, all
 * prior worker entries disappear from view.
 *
 * Token-based pagination because seq is per-worker, not global: the
 * token encodes a per-worker seq cursor.
 */
import { eq } from "drizzle-orm";
import { errorResponse } from "@/server/api-errors";
import { requireApiSession } from "@/server/auth/guards";
import { db } from "@/server/db";
import { runs, workers } from "@/server/db/schema";
import { parseSupersededSeqRanges, type SupersededSeqRange, withoutSupersededEntries } from "@/lib/superseded-entries";
import { readWorkerEntriesBefore, readWorkerEntriesSince, readWorkerEntriesTail } from "@/server/workers/output-store";
import type { WorkerEntry } from "@/server/workers/entries-types";
import {
  compareConversationTranscriptEntries as compareTranscriptEntries,
  excludeDiagnosticTranscriptEntries as excludeDiagnosticEntries,
  sortConversationTranscriptEntries as sortTranscriptEntries,
  type ConversationTranscriptEntry,
} from "@/server/conversations/visible-transcript";
import {
  decodeConversationTranscriptToken,
  encodeConversationTranscriptToken,
  type ConversationTranscriptToken,
} from "@/shared/conversation-transcript-token";
import type { OmniHttpHandler } from "@/runtime/http/registry";
import { startSlowProbe } from "@/server/slow-probe";

// Highest contiguous seq the client has consumed from each worker.
// Workers not in the map are treated as afterSeq=0 (return everything).
// The codec is shared with the frontend, which mints its own `beforeToken`
// after the retention collector trims an in-memory window.
type AfterToken = ConversationTranscriptToken;

const DEFAULT_TRANSCRIPT_LIMIT = 100;
const MAX_TRANSCRIPT_LIMIT = 1000;

function parseLimit(value: string | null): number | null {
  if (value == null) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.min(parsed, MAX_TRANSCRIPT_LIMIT);
}

function decodeAfterToken(raw: string | null): AfterToken {
  return decodeConversationTranscriptToken(raw);
}

function encodeAfterToken(token: AfterToken): string {
  return encodeConversationTranscriptToken(token);
}

function latestReturnedSeq(entries: WorkerEntry[]) {
  return entries.reduce((latest, entry) => {
    const seq = typeof entry.seq === "number" && Number.isFinite(entry.seq)
      ? Math.floor(entry.seq)
      : 0;
    return seq > latest ? seq : latest;
  }, 0);
}

function earliestReturnedSeq(entries: WorkerEntry[]) {
  return entries.reduce((earliest, entry) => {
    const seq = typeof entry.seq === "number" && Number.isFinite(entry.seq)
      ? Math.floor(entry.seq)
      : 0;
    if (seq <= 0) return earliest;
    return earliest === 0 || seq < earliest ? seq : earliest;
  }, 0);
}

type WorkerPage = {
  workerId: string;
  // Seq-ascending entries the per-worker reader returned for this page.
  entries: WorkerEntry[];
  hasOlder: boolean;
  // `beforeToken` cursor to hand back when none of this worker's entries make
  // the page: everything at or above it has already been delivered.
  upperCursor: number;
};

function isPlainMessage(entry: WorkerEntry | undefined) {
  return Boolean(entry && entry.type === "message" && !entry.toolCallId && !entry.status);
}

/**
 * Keep the newest `limit` entries across *all* workers, not `limit` per worker.
 *
 * Each worker is read independently, so a long-dead worker's tail can be days
 * older than the active worker's. Merging per-worker tails as-is spanned the
 * window from the dead worker's last entry to now while carrying only the
 * newest slice of the active worker: every user message in between rendered
 * with no replies, and scroll-back paged both workers in lockstep so the gap
 * never closed.
 *
 * Each worker keeps a contiguous seq suffix of its page so its `beforeToken`
 * cursor stays exact, and a cut never splits a run of streamed message
 * fragments.
 */
function takeNewestAcrossWorkers(
  pages: WorkerPage[],
  limit: number,
  workerCreationOrder: Map<string, number>,
) {
  const tagged: ConversationTranscriptEntry[] = [];
  const indexInPage = new Map<ConversationTranscriptEntry, number>();
  for (const page of pages) {
    page.entries.forEach((entry, index) => {
      const taggedEntry = { ...entry, workerId: page.workerId };
      tagged.push(taggedEntry);
      indexInPage.set(taggedEntry, index);
    });
  }
  sortTranscriptEntries(tagged, workerCreationOrder);

  const firstKeptIndex = new Map<string, number>();
  for (const entry of tagged.slice(Math.max(0, tagged.length - limit))) {
    const index = indexInPage.get(entry) ?? 0;
    const current = firstKeptIndex.get(entry.workerId);
    if (current === undefined || index < current) {
      firstKeptIndex.set(entry.workerId, index);
    }
  }

  const kept = new Map<string, WorkerEntry[]>();
  const oldestCursors: Record<string, number> = {};
  let hasOlder = false;
  for (const page of pages) {
    let start = firstKeptIndex.get(page.workerId) ?? page.entries.length;
    while (
      start > 0
      && start < page.entries.length
      && isPlainMessage(page.entries[start])
      && isPlainMessage(page.entries[start - 1])
    ) {
      start -= 1;
    }
    const workerKept = page.entries.slice(start);
    kept.set(page.workerId, workerKept);
    const earliestSeq = earliestReturnedSeq(workerKept);
    oldestCursors[page.workerId] = earliestSeq > 0 ? earliestSeq : page.upperCursor;
    if (start > 0 || page.hasOlder) {
      hasOlder = true;
    }
  }
  return { kept, oldestCursors, hasOlder };
}

function emptyTranscriptResponse(workerIds: string[] = []) {
  const token = encodeAfterToken({ cursors: {} });
  return {
    entries: [],
    latestToken: token,
    oldestToken: token,
    hasOlder: false,
    workerIds,
  };
}

export const handleConversationTranscriptRequest: OmniHttpHandler = async (request, context) => {
  if (request.method !== "GET") {
    return Response.json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, {
      status: 405,
      headers: { allow: "GET" },
    });
  }

  const runId = context.params?.id?.trim() ?? "";
  if (!runId) {
    return Response.json({ error: "Run id is required" }, { status: 400 });
  }
  const probe = startSlowProbe(`GET /api/conversations/${runId}/transcript`);

  const auth = await requireApiSession(request, {
    source: "Conversation transcript",
    action: "Load conversation transcript",
  });
  probe.mark("auth");
  if (auth.response) {
    probe.end();
    return auth.response;
  }

  try {
    const run = await db.select({ id: runs.id }).from(runs).where(eq(runs.id, runId)).get();
    if (!run) {
      probe.end();
      return Response.json({ error: "Run not found" }, { status: 404 });
    }

    const runWorkers = await db
      .select({ id: workers.id, createdAt: workers.createdAt, supersededSeqRanges: workers.supersededSeqRanges })
      .from(workers)
      .where(eq(workers.runId, runId));
    probe.mark("workers");

    if (runWorkers.length === 0) {
      probe.end();
      return Response.json(emptyTranscriptResponse());
    }

    const workerCreationOrder = new Map<string, number>();
    const sortedWorkers = [...runWorkers].sort((a, b) => {
      const ad = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
      const bd = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
      if (ad !== bd) return ad - bd;
      return a.id.localeCompare(b.id);
    });
    sortedWorkers.forEach((worker, index) => workerCreationOrder.set(worker.id, index));

    // Entries a retry/edit rewound past stay on disk but must not re-enter the
    // conversation: they are the branch the user discarded, and their copy of
    // the rewound user message would render a second time above the new one.
    const supersededByWorker = new Map<string, SupersededSeqRange[]>();
    for (const worker of sortedWorkers) {
      supersededByWorker.set(worker.id, parseSupersededSeqRanges(worker.supersededSeqRanges));
    }
    const visibleEntriesFor = (workerId: string, entries: WorkerEntry[]) =>
      excludeDiagnosticEntries(
        withoutSupersededEntries(entries, supersededByWorker.get(workerId) ?? []),
      );

    const url = new URL(request.url);
    const limit = parseLimit(url.searchParams.get("limit")) ?? DEFAULT_TRANSCRIPT_LIMIT;
    const beforeTokenRaw = url.searchParams.get("beforeToken");

    if (beforeTokenRaw) {
      const beforeToken = decodeAfterToken(beforeTokenRaw);
      const perWorkerResults = await Promise.all(
        sortedWorkers.map(async (worker) => {
          const beforeSeq = beforeToken.cursors[worker.id] ?? 0;
          if (beforeSeq <= 1) {
            return { workerId: worker.id, entries: [] as WorkerEntry[], latestSeq: 0, hasOlder: false };
          }
          const result = await readWorkerEntriesBefore(runId, worker.id, beforeSeq, limit);
          return { workerId: worker.id, ...result };
        }),
      );
      probe.mark("readBeforeEntries");

      const { kept, oldestCursors: pageOldestCursors, hasOlder: pageHasOlder } = takeNewestAcrossWorkers(
        perWorkerResults.map(({ workerId, entries, hasOlder: workerHasOlder }) => ({
          workerId,
          entries,
          hasOlder: workerHasOlder || earliestReturnedSeq(entries) > 1,
          upperCursor: beforeToken.cursors[workerId] ?? 0,
        })),
        limit,
        workerCreationOrder,
      );
      const merged: ConversationTranscriptEntry[] = [];
      const latestCursors: Record<string, number> = {};
      const oldestCursors: Record<string, number> = { ...beforeToken.cursors, ...pageOldestCursors };
      const hasOlder = pageHasOlder;

      for (const { workerId, latestSeq } of perWorkerResults) {
        latestCursors[workerId] = latestSeq;
        for (const entry of visibleEntriesFor(workerId, kept.get(workerId) ?? [])) {
          merged.push({ ...entry, workerId });
        }
      }

      return Response.json({
        entries: sortTranscriptEntries(merged, workerCreationOrder),
        latestToken: encodeAfterToken({ cursors: latestCursors }),
        oldestToken: encodeAfterToken({ cursors: oldestCursors }),
        hasOlder,
        workerIds: sortedWorkers.map((worker) => worker.id),
      });
    }

    const afterTokenRaw = url.searchParams.get("afterToken");

    if (!afterTokenRaw && url.searchParams.has("limit")) {
      const perWorkerResults = await Promise.all(
        sortedWorkers.map(async (worker) => {
          const tail = await readWorkerEntriesTail(runId, worker.id, limit);
          if (tail) {
            return { workerId: worker.id, ...tail };
          }
          const all = await readWorkerEntriesSince(runId, worker.id, 0);
          const entries = all.entries.length > limit ? all.entries.slice(-limit) : all.entries;
          return {
            workerId: worker.id,
            entries,
            latestSeq: all.latestSeq,
            hasOlder: all.entries.length > entries.length || earliestReturnedSeq(entries) > 1,
          };
        }),
      );
      probe.mark("readTailEntries");

      const { kept, oldestCursors, hasOlder } = takeNewestAcrossWorkers(
        perWorkerResults.map(({ workerId, entries, latestSeq, hasOlder: workerHasOlder }) => ({
          workerId,
          entries,
          hasOlder: workerHasOlder,
          upperCursor: latestSeq + 1,
        })),
        limit,
        workerCreationOrder,
      );
      const merged: ConversationTranscriptEntry[] = [];
      const latestCursors: Record<string, number> = {};

      for (const { workerId, latestSeq } of perWorkerResults) {
        latestCursors[workerId] = latestSeq;
        for (const entry of visibleEntriesFor(workerId, kept.get(workerId) ?? [])) {
          merged.push({ ...entry, workerId });
        }
      }

      return Response.json({
        entries: sortTranscriptEntries(merged, workerCreationOrder),
        latestToken: encodeAfterToken({ cursors: latestCursors }),
        oldestToken: encodeAfterToken({ cursors: oldestCursors }),
        hasOlder,
        workerIds: sortedWorkers.map((worker) => worker.id),
      });
    }

    const incomingToken = decodeAfterToken(afterTokenRaw);

    const perWorkerResults = await Promise.all(
      sortedWorkers.map(async (worker) => {
        const afterSeq = incomingToken.cursors[worker.id] ?? 0;
        const result = await readWorkerEntriesSince(runId, worker.id, afterSeq);
        return { workerId: worker.id, ...result };
      }),
    );
    probe.mark("readEntries");

    const merged: ConversationTranscriptEntry[] = [];
    const nextCursors: Record<string, number> = { ...incomingToken.cursors };
    for (const { workerId, entries, latestSeq } of perWorkerResults) {
      for (const entry of visibleEntriesFor(workerId, entries)) {
        merged.push({ ...entry, workerId });
      }
      // readWorkerEntriesSince may cap a large forward page. Only
      // advance to the highest seq actually returned; otherwise the
      // next token can skip unseen transcript rows. Empty pages still
      // advance to latestSeq so caught-up polls stay cheap.
      const consumedSeq = entries.length > 0 ? latestReturnedSeq(entries) : latestSeq;
      if (consumedSeq > (nextCursors[workerId] ?? 0)) {
        nextCursors[workerId] = consumedSeq;
      }
    }

    return Response.json({
      entries: sortTranscriptEntries(merged, workerCreationOrder),
      latestToken: encodeAfterToken({ cursors: nextCursors }),
      oldestToken: encodeAfterToken({ cursors: {} }),
      hasOlder: false,
      workerIds: sortedWorkers.map((worker) => worker.id),
    });
  } catch (error) {
    return errorResponse(error, {
      status: 500,
      source: "Conversation transcript",
      action: "Load conversation transcript",
    });
  } finally {
    probe.end();
  }
};

// Re-export for unused-import linters when tests want a handle to the
// internal token codec.
export const __testInternals = {
  decodeAfterToken,
  encodeAfterToken,
  compareTranscriptEntries,
  excludeDiagnosticEntries,
  takeNewestAcrossWorkers,
};
