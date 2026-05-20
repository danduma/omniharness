import { NextRequest } from "next/server";
import { handleQueuedConversationMessageRequest } from "@/runtime/http/routes/conversation-messages";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> },
) {
  const { id, messageId } = await params;
  return handleQueuedConversationMessageRequest(req, { surface: "web", params: { id, messageId } });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> },
) {
  const { id, messageId } = await params;
  return handleQueuedConversationMessageRequest(req, { surface: "web", params: { id, messageId } });
}
