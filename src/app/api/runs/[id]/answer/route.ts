import { NextRequest, NextResponse } from "next/server";
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
      return NextResponse.json({ error: "clarificationId and answer are required" }, { status: 400 });
    }

    await answerClarification(clarificationId, answer);
    const resumeResult = await resumeRunAfterClarification(runId);

    return NextResponse.json({ ok: true, runId, ...resumeResult });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
