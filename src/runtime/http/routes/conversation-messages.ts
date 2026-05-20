import { errorResponse } from "@/server/api-errors";
import { requireApiSession } from "@/server/auth/guards";
import { sendConversationMessage } from "@/server/conversations/send-message";
import { normalizeChatAttachments } from "@/lib/chat-attachments";
import { db } from "@/server/db";
import { runs } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { normalizeSessionType } from "@/server/session-providers/capabilities";
import { getSessionProvider } from "@/server/session-providers/registry";
import {
  cancelQueuedConversationMessage,
  parseBusyMessageAction,
  sendQueuedConversationMessageNow,
} from "@/server/conversations/queued-messages";
import type { OmniHttpHandler } from "@/runtime/http/registry";
import { toNextRequest } from "./next-request";

function statusFromError(error: unknown) {
  return typeof (error as { status?: unknown }).status === "number"
    ? (error as { status: number }).status
    : 500;
}

function requireParam(params: Record<string, string> | undefined, key: string) {
  const value = params?.[key]?.trim();
  if (!value) {
    throw new Error(`${key} route parameter is required.`);
  }
  return value;
}

export const handleConversationMessagesRequest: OmniHttpHandler = async (request, context) => {
  try {
    if (request.method !== "POST") {
      return Response.json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, {
        status: 405,
        headers: { allow: "POST" },
      });
    }

    const auth = await requireApiSession(toNextRequest(request), {
      source: "Conversations",
      action: "Send a conversation message",
      enforceSameOrigin: true,
    });
    if (auth.response) {
      return auth.response;
    }

    const runId = requireParam(context.params, "id");
    const body = await request.json();
    const content = String(body?.content ?? "").trim();
    const attachments = normalizeChatAttachments(body?.attachments);
    const busyAction = parseBusyMessageAction(body?.busyAction);
    const preferredWorkerType = typeof body?.preferredWorkerType === "string" ? body.preferredWorkerType : null;
    const preferredWorkerModel = typeof body?.preferredWorkerModel === "string" ? body.preferredWorkerModel : null;
    const preferredWorkerEffort = typeof body?.preferredWorkerEffort === "string" ? body.preferredWorkerEffort : null;
    const allowedWorkerTypes = Array.isArray(body?.allowedWorkerTypes) || typeof body?.allowedWorkerTypes === "string"
      ? body.allowedWorkerTypes
      : null;
    if (!content && attachments.length === 0) {
      return errorResponse("Message content or attachment is required", {
        status: 400,
        source: "Conversations",
        action: "Send a conversation message",
      });
    }

    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    if (!run) {
      return errorResponse("Conversation not found", {
        status: 404,
        source: "Conversations",
        action: "Send a conversation message",
      });
    }
    const sessionType = normalizeSessionType(run.sessionType);
    if (sessionType === "omni") {
      return Response.json(await sendConversationMessage({
        runId,
        content,
        attachments,
        busyAction,
        preferredWorkerType,
        preferredWorkerModel,
        preferredWorkerEffort,
        allowedWorkerTypes,
      }));
    }
    const provider = getSessionProvider(sessionType);
    return Response.json(await provider.sendInput({ runId, content, attachments, busyAction }));
  } catch (error) {
    return errorResponse(error, {
      status: statusFromError(error),
      source: "Conversations",
      action: "Send a conversation message",
    });
  }
};

export const handleQueuedConversationMessageRequest: OmniHttpHandler = async (request, context) => {
  const action = request.method === "DELETE" ? "Cancel queued message" : "Send queued message now";
  try {
    if (request.method !== "PATCH" && request.method !== "DELETE") {
      return Response.json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, {
        status: 405,
        headers: { allow: "PATCH, DELETE" },
      });
    }

    const auth = await requireApiSession(toNextRequest(request), {
      source: "Conversations",
      action,
      enforceSameOrigin: true,
    });
    if (auth.response) {
      return auth.response;
    }

    const runId = requireParam(context.params, "id");
    const messageId = requireParam(context.params, "messageId");
    if (request.method === "PATCH") {
      return Response.json(await sendQueuedConversationMessageNow({ runId, messageId }));
    }

    const queuedMessage = await cancelQueuedConversationMessage({ runId, messageId });
    return Response.json({ ok: true, queuedMessage });
  } catch (error) {
    return errorResponse(error, {
      status: statusFromError(error),
      source: "Conversations",
      action,
    });
  }
};
