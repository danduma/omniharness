import { NextRequest } from "next/server";
import { handleAgentDetailRequest } from "@/runtime/http/routes/agent-detail";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  return handleAgentDetailRequest(req, { surface: "web", params: { name } });
}
