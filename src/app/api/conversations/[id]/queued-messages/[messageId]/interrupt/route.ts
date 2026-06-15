import { NextRequest } from "next/server";
import { handleQueuedConversationMessageInterruptRequest } from "@/runtime/http/routes/conversation-messages";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> },
) {
  const { id, messageId } = await params;
  return handleQueuedConversationMessageInterruptRequest(req, { surface: "web", params: { id, messageId } });
}
