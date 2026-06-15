import { NextRequest } from "next/server";
import { handleAgentPermissionRequest } from "@/runtime/http/routes/agent-detail";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  return handleAgentPermissionRequest(req, { surface: "web", params: { name } });
}
