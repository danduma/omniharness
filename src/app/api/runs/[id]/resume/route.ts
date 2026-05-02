import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/server/api-errors";
import { requireApiSession } from "@/server/auth/guards";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
import { resumeSupervisorRun } from "@/server/supervisor/resume";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiSession(req, {
      source: "Runs",
      action: "Resume run",
      enforceSameOrigin: true,
    });
    if (auth.response) {
      return auth.response;
    }

    const { id: runId } = await params;
    await resumeSupervisorRun(runId);
    notifyEventStreamSubscribers();

    return NextResponse.json({ ok: true, runId });
  } catch (error: unknown) {
    return errorResponse(error, {
      status: 500,
      source: "Runs",
      action: "Resume run",
    });
  }
}
