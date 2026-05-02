import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/server/api-errors";
import { requireApiSession } from "@/server/auth/guards";
import { sendConversationMessage } from "@/server/conversations/send-message";

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
    if (!content) {
      return errorResponse("Message content cannot be empty", {
        status: 400,
        source: "Conversations",
        action: "Send a conversation message",
      });
    }

    return NextResponse.json(await sendConversationMessage({ runId: id, content }));
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
