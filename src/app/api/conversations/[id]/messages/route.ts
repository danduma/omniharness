import { NextRequest } from "next/server";
import { handleConversationMessagesRequest } from "@/runtime/http/routes/conversation-messages";
import { withOuterProbe } from "@/server/slow-probe";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withOuterProbe(`POST /api/conversations/${id}/messages`, () =>
    handleConversationMessagesRequest(req, { surface: "web", params: { id } }),
  );
}
