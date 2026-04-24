import { NextRequest, NextResponse } from "next/server";
import { getAgent } from "@/server/bridge-client";
import { db } from "@/server/db";
import { runs, workers } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { errorResponse } from "@/server/api-errors";
import { requireApiSession } from "@/server/auth/guards";
import { buildLiveWorkerSnapshot } from "@/server/workers/live-snapshots";
import { formatErrorMessage } from "@/server/runs/failures";

function isMissingAgentError(error: unknown) {
  const message = formatErrorMessage(error).toLowerCase();
  return message.includes("404") || message.includes("not_found") || message.includes("agent not found");
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const auth = await requireApiSession(req, {
    source: "Bridge",
    action: "Load worker details",
  });
  if (auth.response) {
    return auth.response;
  }

  const { name } = await params;
  const worker = await db.select().from(workers).where(eq(workers.id, name)).get();
  const run = worker ? await db.select().from(runs).where(eq(runs.id, worker.runId)).get() : null;

  try {
    const data = await getAgent(name);
    const snapshot = buildLiveWorkerSnapshot({
      agent: data,
      worker,
      run,
    });
    return NextResponse.json(snapshot);
  } catch (error: unknown) {
    if (worker && isMissingAgentError(error)) {
      const snapshot = buildLiveWorkerSnapshot({
        worker,
        run,
        bridgeError: error,
      });
      return NextResponse.json(snapshot);
    }

    return errorResponse(error, {
      status: 500,
      source: "Bridge",
      action: "Load worker details",
    });
  }
}
