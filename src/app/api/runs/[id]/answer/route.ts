import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/server/api-errors";
import { answerClarification } from "@/server/clarifications/store";
import { resumeRunAfterClarification } from "@/server/clarifications/loop";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: runId } = await params;
    const { clarificationId, answer } = await req.json();

    if (typeof clarificationId !== "string" || typeof answer !== "string") {
      return errorResponse("clarificationId and answer are required", {
        status: 400,
        source: "Clarifications",
        action: "Answer clarification",
      });
    }

    await answerClarification(clarificationId, answer);
    const resumeResult = await resumeRunAfterClarification(runId);

    return NextResponse.json({ ok: true, runId, ...resumeResult });
  } catch (error: unknown) {
    return errorResponse(error, {
      status: 500,
      source: "Clarifications",
      action: "Answer clarification",
    });
  }
}
