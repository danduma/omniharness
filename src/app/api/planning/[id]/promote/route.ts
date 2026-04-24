import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/server/api-errors";
import { requireApiSession } from "@/server/auth/guards";
import { promotePlanningRun } from "@/server/planning/promote";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireApiSession(req, {
      source: "Planning",
      action: "Promote planning conversation",
      enforceSameOrigin: true,
    });
    if (auth.response) {
      return auth.response;
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const result = await promotePlanningRun({
      runId: id,
      planPath: typeof body?.planPath === "string" ? body.planPath : null,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const status = /not ready|no verified plan/i.test(message)
      ? 400
      : /not found/i.test(message)
        ? 404
        : 500;

    return errorResponse(error, {
      status,
      source: "Planning",
      action: "Promote planning conversation",
    });
  }
}
