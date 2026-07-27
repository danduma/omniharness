import { NextRequest } from "next/server";
import { handleAgentAcpRequest } from "@/runtime/http/routes/agent-detail";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  return handleAgentAcpRequest(req, { surface: "web", params: { name } });
}
