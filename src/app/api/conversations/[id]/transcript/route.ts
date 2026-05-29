import { NextRequest } from "next/server";
import { handleConversationTranscriptRequest } from "@/runtime/http/routes/conversation-transcript";
import { withOuterProbe } from "@/server/slow-probe";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withOuterProbe(`GET /api/conversations/${id}/transcript`, () =>
    handleConversationTranscriptRequest(req, { surface: "web", params: { id } }),
  );
}
