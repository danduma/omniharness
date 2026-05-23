/**
 * GET /api/workers/:workerId/entries?afterSeq=N
 *
 * Returns the worker's transcript entries strictly newer than `afterSeq`
 * along with the latest persisted seq. Clients track the latest
 * contiguous seq locally; the SSE `worker.entry_appended` named event
 * is a wake-up hint that triggers a refetch via this endpoint. See
 * docs/architecture/worker-conversation-stream.md.
 */
import { errorResponse } from "@/server/api-errors";
import { requireApiSession } from "@/server/auth/guards";
import { readWorkerEntriesBefore, readWorkerEntriesSince, readWorkerEntriesTail } from "@/server/workers/output-store";
import type { OmniHttpHandler } from "@/runtime/http/registry";
import { startSlowProbe } from "@/server/slow-probe";
import { toNextRequest } from "./next-request";

const DEFAULT_TAIL_LIMIT = 100;
const MAX_TAIL_LIMIT = 1000;

function parsePositiveInt(value: string | null): number | null {
  if (value == null) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function parseAfterSeq(value: string | null): number {
  if (value == null) {
    return 0;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
}

function inferRunIdFromWorkerId(workerId: string) {
  const match = /^(?<runId>.+)-worker-\d+$/.exec(workerId);
  return match?.groups?.runId ?? null;
}

async function resolveRunIdForWorker(workerId: string) {
  const inferredRunId = inferRunIdFromWorkerId(workerId);
  if (inferredRunId) {
    return inferredRunId;
  }

  const [{ eq }, { db }, { runs, workers }] = await Promise.all([
    import("drizzle-orm"),
    import("@/server/db"),
    import("@/server/db/schema"),
  ]);
  const worker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
  if (!worker) {
    return null;
  }
  // The run row exists by FK on workers; this also keeps the fallback
  // auth surface consistent with /api/runs/[id], which gates by run visibility.
  const run = await db.select().from(runs).where(eq(runs.id, worker.runId)).get();
  return run ? run.id : null;
}

export const handleWorkerEntriesRequest: OmniHttpHandler = async (request, context) => {
  if (request.method !== "GET") {
    return Response.json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, {
      status: 405,
      headers: { allow: "GET" },
    });
  }

  const workerId = context.params?.workerId?.trim() ?? "?";
  const probe = startSlowProbe(`GET /api/workers/${workerId}/entries`);

  const auth = await requireApiSession(toNextRequest(request), {
    source: "Worker entries",
    action: "Load worker stream",
  });
  probe.mark("auth");
  if (auth.response) {
    probe.end();
    return auth.response;
  }

  if (!context.params?.workerId?.trim()) {
    probe.end();
    return Response.json({ error: "Worker not found" }, { status: 404 });
  }

  const runId = await resolveRunIdForWorker(workerId);
  probe.mark("resolveRunId");
  if (!runId) {
    probe.end();
    return Response.json({ error: "Worker not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const afterSeq = parseAfterSeq(url.searchParams.get("afterSeq"));
  const beforeSeq = parsePositiveInt(url.searchParams.get("beforeSeq"));
  const limitRaw = parsePositiveInt(url.searchParams.get("limit"));
  const limit = limitRaw == null ? null : Math.min(limitRaw, MAX_TAIL_LIMIT);

  try {
    // Scroll-back path: caller wants entries strictly older than beforeSeq.
    if (beforeSeq != null) {
      const result = await readWorkerEntriesBefore(runId, workerId, beforeSeq, limit ?? DEFAULT_TAIL_LIMIT);
      probe.mark("readBefore");
      return Response.json(result);
    }

    // Tail-first initial load: only `limit` (no afterSeq). Returns the
    // last N entries plus `hasOlder` so the client knows whether to wire
    // up scroll-back.
    if (limit != null && afterSeq === 0) {
      const tail = await readWorkerEntriesTail(runId, workerId, limit);
      if (tail) {
        probe.mark("readTail");
        return Response.json(tail);
      }
      // tail-scan couldn't prove the boundary; fall through to full read.
    }

    // Existing live-tail path: entries strictly newer than afterSeq.
    const result = await readWorkerEntriesSince(runId, workerId, afterSeq);
    probe.mark(`readEntries[${result._path ?? "?"}]`);
    return Response.json({ entries: result.entries, latestSeq: result.latestSeq });
  } catch (error) {
    return errorResponse(error, {
      status: 500,
      source: "Worker entries",
      action: "Load worker stream",
    });
  } finally {
    probe.end();
  }
};
