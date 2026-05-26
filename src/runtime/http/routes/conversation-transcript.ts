/**
 * GET /api/conversations/:runId/transcript?afterToken=<base64-json>
 *
 * Returns a chronologically-merged view of every worker's entries for a
 * given run, so the conversation UI can render the full history when a
 * run has cycled through multiple workers (cancel → respawn). The
 * per-worker `/api/workers/:workerId/entries` endpoint only sees the
 * one worker the FE happens to be polling; after a cancel+respawn, all
 * prior worker entries disappear from view.
 *
 * Token-based pagination because seq is per-worker, not global: the
 * token encodes the highest seq the client has consumed per worker.
 */
import { eq, inArray } from "drizzle-orm";
import { errorResponse } from "@/server/api-errors";
import { requireApiSession } from "@/server/auth/guards";
import { db } from "@/server/db";
import { runs, workers } from "@/server/db/schema";
import { readWorkerEntriesSince } from "@/server/workers/output-store";
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
      return Response.json({
        entries: [],
        latestToken: encodeAfterToken({ cursors: {} }),
        workerIds: [],
      });
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
    const incomingToken = decodeAfterToken(url.searchParams.get("afterToken"));

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
      // Advance the cursor even when entries is empty — readWorkerEntriesSince
      // returns the persisted latestSeq, so a future poll won't re-fetch
      // entries we've already seen.
      if (latestSeq > (nextCursors[workerId] ?? 0)) {
        nextCursors[workerId] = latestSeq;
      }
    }

    merged.sort((a, b) => compareTranscriptEntries(a, b, workerCreationOrder));

    return Response.json({
      entries: merged,
      latestToken: encodeAfterToken({ cursors: nextCursors }),
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
