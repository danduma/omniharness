import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/server/api-errors";
import { requireApiSession } from "@/server/auth/guards";
import { cancelQueuedConversationMessage, sendQueuedConversationMessageNow } from "@/server/conversations/queued-messages";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> },
) {
  try {
    const auth = await requireApiSession(req, {
      source: "Conversations",
      action: "Send queued message now",
      enforceSameOrigin: true,
    });
    if (auth.response) {
      return auth.response;
    }

    const { id, messageId } = await params;
    return NextResponse.json(await sendQueuedConversationMessageNow({ runId: id, messageId }));
  } catch (error: unknown) {
    const status = typeof (error as { status?: unknown }).status === "number"
      ? (error as { status: number }).status
      : 500;
    return errorResponse(error, {
      status,
      source: "Conversations",
      action: "Send queued message now",
    });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> },
) {
  try {
    const auth = await requireApiSession(req, {
      source: "Conversations",
      action: "Cancel queued message",
      enforceSameOrigin: true,
    });
    if (auth.response) {
      return auth.response;
    }

    const { id, messageId } = await params;
    const queuedMessage = await cancelQueuedConversationMessage({ runId: id, messageId });
    return NextResponse.json({ ok: true, queuedMessage });
  } catch (error: unknown) {
    const status = typeof (error as { status?: unknown }).status === "number"
      ? (error as { status: number }).status
      : 500;
    return errorResponse(error, {
      status,
      source: "Conversations",
      action: "Cancel queued message",
    });
  }
}
