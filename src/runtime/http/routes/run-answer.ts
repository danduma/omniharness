import { randomUUID } from "crypto";
import { errorResponse } from "@/server/api-errors";
import { answerClarification } from "@/server/clarifications/store";
import { resumeRunAfterClarification } from "@/server/clarifications/loop";
import { requireApiSession } from "@/server/auth/guards";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
import { db } from "@/server/db";
import { messages } from "@/server/db/schema";
import type { OmniHttpHandler } from "@/runtime/http/registry";
import { toNextRequest } from "./next-request";

export const handleRunAnswerRequest: OmniHttpHandler = async (request, context) => {
  try {
    if (request.method !== "POST") {
      return Response.json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, {
        status: 405,
        headers: { allow: "POST" },
      });
    }

    const auth = await requireApiSession(toNextRequest(request), {
      source: "Clarifications",
      action: "Answer clarification",
      enforceSameOrigin: true,
    });
    if (auth.response) {
      return auth.response;
    }

    const runId = context.params?.id?.trim();
    if (!runId) {
      return errorResponse("run id is required", {
        status: 400,
        source: "Clarifications",
        action: "Answer clarification",
      });
    }

    const { clarificationId, answer } = await request.json();

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

    return Response.json({ ok: true, runId, ...resumeResult });
  } catch (error) {
    return errorResponse(error, {
      status: 500,
      source: "Clarifications",
      action: "Answer clarification",
    });
  }
};
