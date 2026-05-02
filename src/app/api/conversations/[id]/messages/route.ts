import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/server/api-errors";
import { requireApiSession } from "@/server/auth/guards";
import { sendConversationMessage } from "@/server/conversations/send-message";
import { normalizeChatAttachments } from "@/lib/chat-attachments";
import { parseBusyMessageAction } from "@/server/conversations/queued-messages";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireApiSession(req, {
      source: "Conversations",
      action: "Send a conversation message",
      enforceSameOrigin: true,
    });
    if (auth.response) {
      return auth.response;
    }

    const { id } = await params;
    const body = await req.json();
    const content = String(body?.content ?? "").trim();
    const attachments = normalizeChatAttachments(body?.attachments);
    const busyAction = parseBusyMessageAction(body?.busyAction);
    if (!content && attachments.length === 0) {
      return errorResponse("Message content or attachment is required", {
        status: 400,
        source: "Conversations",
        action: "Send a conversation message",
      });
    }

    return NextResponse.json(await sendConversationMessage({ runId: id, content, attachments, busyAction }));
  } catch (error: unknown) {
    const status = typeof (error as { status?: unknown }).status === "number"
      ? (error as { status: number }).status
      : 500;
    return errorResponse(error, {
      status,
      source: "Conversations",
      action: "Send a conversation message",
    });
  }
}
