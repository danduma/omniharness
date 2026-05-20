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
import { readWorkerEntriesSince } from "@/server/workers/output-store";
import type { OmniHttpHandler } from "@/runtime/http/registry";
import { toNextRequest } from "./next-request";

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

  const auth = await requireApiSession(toNextRequest(request), {
    source: "Worker entries",
    action: "Load worker stream",
  });
  if (auth.response) {
    return auth.response;
  }

  const workerId = context.params?.workerId?.trim();
  if (!workerId) {
    return Response.json({ error: "Worker not found" }, { status: 404 });
  }

  const runId = await resolveRunIdForWorker(workerId);
  if (!runId) {
    return Response.json({ error: "Worker not found" }, { status: 404 });
  }

  const afterSeq = parseAfterSeq(new URL(request.url).searchParams.get("afterSeq"));

  try {
    const { entries, latestSeq } = await readWorkerEntriesSince(runId, workerId, afterSeq);
    return Response.json({ entries, latestSeq });
  } catch (error) {
    return errorResponse(error, {
      status: 500,
      source: "Worker entries",
      action: "Load worker stream",
    });
  }
};
