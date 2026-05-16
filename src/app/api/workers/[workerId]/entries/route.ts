/**
 * GET /api/workers/:workerId/entries?afterSeq=N
 *
 * Returns the worker's transcript entries strictly newer than `afterSeq`
 * along with the latest persisted seq. Clients track the latest
 * contiguous seq locally; the SSE `worker.entry_appended` named event
 * is a wake-up hint that triggers a refetch via this endpoint. See
 * docs/architecture/worker-conversation-stream.md.
 */
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { runs, workers } from "@/server/db/schema";
import { errorResponse } from "@/server/api-errors";
import { requireApiSession } from "@/server/auth/guards";
import { readWorkerEntriesSince } from "@/server/workers/output-store";

export const dynamic = "force-dynamic";

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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ workerId: string }> },
) {
  const auth = await requireApiSession(req, {
    source: "Worker entries",
    action: "Load worker stream",
  });
  if (auth.response) {
    return auth.response;
  }

  const { workerId } = await params;
  const worker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
  if (!worker) {
    return NextResponse.json({ error: "Worker not found" }, { status: 404 });
  }
  // The run row exists by FK on workers; this also keeps the auth surface
  // consistent with /api/runs/[id], which gates by run visibility.
  const run = await db.select().from(runs).where(eq(runs.id, worker.runId)).get();
  if (!run) {
    return NextResponse.json({ error: "Worker not found" }, { status: 404 });
  }

  const afterSeq = parseAfterSeq(req.nextUrl.searchParams.get("afterSeq"));

  try {
    const { entries, latestSeq } = await readWorkerEntriesSince(run.id, workerId, afterSeq);
    return NextResponse.json({ entries, latestSeq });
  } catch (error: unknown) {
    return errorResponse(error, {
      status: 500,
      source: "Worker entries",
      action: "Load worker stream",
    });
  }
}
