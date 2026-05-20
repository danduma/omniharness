import { NextRequest } from "next/server";
import { handleConversationMessagesRequest } from "@/runtime/http/routes/conversation-messages";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handleConversationMessagesRequest(req, { surface: "web", params: { id } });
}
