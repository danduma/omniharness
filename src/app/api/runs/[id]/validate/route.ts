import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/server/api-errors";
import { validateRun } from "@/server/validation";
import { requireApiSession } from "@/server/auth/guards";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiSession(req, {
      source: "Validation",
      action: "Validate run",
      enforceSameOrigin: true,
    });
    if (auth.response) {
      return auth.response;
    }

    const { id: runId } = await params;
    const result = await validateRun(runId);
    return NextResponse.json(result);
  } catch (error: unknown) {
    return errorResponse(error, {
      status: 500,
      source: "Validation",
      action: "Validate run",
    });
  }
}
