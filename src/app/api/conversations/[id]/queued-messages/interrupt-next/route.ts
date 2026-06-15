import { NextRequest } from "next/server";
import { handleQueuedConversationMessageInterruptNextRequest } from "@/runtime/http/routes/conversation-messages";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handleQueuedConversationMessageInterruptNextRequest(req, { surface: "web", params: { id } });
}
