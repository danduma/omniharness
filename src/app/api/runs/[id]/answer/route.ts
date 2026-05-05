import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { errorResponse } from "@/server/api-errors";
import { answerClarification } from "@/server/clarifications/store";
import { resumeRunAfterClarification } from "@/server/clarifications/loop";
import { requireApiSession } from "@/server/auth/guards";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
import { db } from "@/server/db";
import { messages } from "@/server/db/schema";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiSession(req, {
      source: "Clarifications",
      action: "Answer clarification",
      enforceSameOrigin: true,
    });
    if (auth.response) {
      return auth.response;
    }

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
    await db.insert(messages).values({
      id: randomUUID(),
      runId,
      role: "user",
      kind: "clarification",
      content: answer,
      createdAt: new Date(),
    });
    const resumeResult = await resumeRunAfterClarification(runId);
    notifyEventStreamSubscribers();

    return NextResponse.json({ ok: true, runId, ...resumeResult });
  } catch (error: unknown) {
    return errorResponse(error, {
      status: 500,
      source: "Clarifications",
      action: "Answer clarification",
    });
  }
}
