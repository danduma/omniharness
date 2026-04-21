import { NextResponse } from "next/server";
import { errorResponse } from "@/server/api-errors";
import { validateRun } from "@/server/validation";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
