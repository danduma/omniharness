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
import { readWorkerEntriesBefore, readWorkerEntriesSince, readWorkerEntriesTail } from "@/server/workers/output-store";
import type { WorkerEntry } from "@/server/workers/entries-types";
import type { OmniHttpHandler } from "@/runtime/http/registry";
import { startSlowProbe } from "@/server/slow-probe";
import { toNextRequest } from "./next-request";

interface ConversationTranscriptEntry extends WorkerEntry {
  workerId: string;
}

interface AfterToken {
  // Highest contiguous seq the client has consumed from each worker.
  // Workers not in the map are treated as afterSeq=0 (return everything).
  cursors: Record<string, number>;
}

const DEFAULT_TRANSCRIPT_LIMIT = 100;
const MAX_TRANSCRIPT_LIMIT = 1000;

function parseLimit(value: string | null): number | null {
  if (value == null) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.min(parsed, MAX_TRANSCRIPT_LIMIT);
}

function decodeAfterToken(raw: string | null): AfterToken {
  if (!raw) {
    return { cursors: {} };
  }
  try {
    const buf = Buffer.from(raw, "base64url");
    const parsed = JSON.parse(buf.toString("utf8")) as AfterToken;
    if (parsed && typeof parsed === "object" && parsed.cursors && typeof parsed.cursors === "object") {
      const cursors: Record<string, number> = {};
      for (const [workerId, value] of Object.entries(parsed.cursors)) {
        if (typeof workerId === "string" && typeof value === "number" && Number.isFinite(value) && value >= 0) {
          cursors[workerId] = value;
        }
      }
      return { cursors };
    }
  } catch {
    // Malformed token → treat as cold start.
  }
  return { cursors: {} };
}

function encodeAfterToken(token: AfterToken): string {
  return Buffer.from(JSON.stringify(token), "utf8").toString("base64url");
}

function entryTimestampMs(entry: WorkerEntry): number {
  if (!entry.timestamp) return 0;
  const ms = Date.parse(entry.timestamp);
  return Number.isFinite(ms) ? ms : 0;
}

// Sort comparator for the merged transcript. Primary key: timestamp ms
// (so user input lands next to the worker turn it triggered, even
// across workers). Secondary: worker creation order (older worker
// first). Tertiary: per-worker seq.
function compareTranscriptEntries(
  a: ConversationTranscriptEntry,
  b: ConversationTranscriptEntry,
  workerCreationOrder: Map<string, number>,
): number {
  const at = entryTimestampMs(a);
  const bt = entryTimestampMs(b);
  if (at !== bt) return at - bt;
  const ao = workerCreationOrder.get(a.workerId) ?? Number.MAX_SAFE_INTEGER;
  const bo = workerCreationOrder.get(b.workerId) ?? Number.MAX_SAFE_INTEGER;
  if (ao !== bo) return ao - bo;
  return (a.seq ?? 0) - (b.seq ?? 0);
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

function sortTranscriptEntries(
  entries: ConversationTranscriptEntry[],
  workerCreationOrder: Map<string, number>,
) {
  entries.sort((a, b) => compareTranscriptEntries(a, b, workerCreationOrder));
  return entries;
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

  const auth = await requireApiSession(toNextRequest(request), {
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
      .select({ id: workers.id, createdAt: workers.createdAt })
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

      const merged: ConversationTranscriptEntry[] = [];
      const latestCursors: Record<string, number> = {};
      const oldestCursors: Record<string, number> = { ...beforeToken.cursors };
      let hasOlder = false;

      for (const { workerId, entries, latestSeq, hasOlder: workerHasOlder } of perWorkerResults) {
        latestCursors[workerId] = latestSeq;
        if (workerHasOlder) {
          hasOlder = true;
        }
        for (const entry of entries) {
          merged.push({ ...entry, workerId });
        }
        const earliestSeq = earliestReturnedSeq(entries);
        if (earliestSeq > 0) {
          oldestCursors[workerId] = earliestSeq;
          if (earliestSeq > 1) {
            hasOlder = true;
          }
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

      const merged: ConversationTranscriptEntry[] = [];
      const latestCursors: Record<string, number> = {};
      const oldestCursors: Record<string, number> = {};
      let hasOlder = false;

      for (const { workerId, entries, latestSeq, hasOlder: workerHasOlder } of perWorkerResults) {
        latestCursors[workerId] = latestSeq;
        const earliestSeq = earliestReturnedSeq(entries);
        oldestCursors[workerId] = earliestSeq > 0 ? earliestSeq : latestSeq + 1;
        if (workerHasOlder) {
          hasOlder = true;
        }
        for (const entry of entries) {
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
      for (const entry of entries) {
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
};
