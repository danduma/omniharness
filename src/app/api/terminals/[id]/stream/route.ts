import { NextRequest } from "next/server";
import { handleTerminalStreamRequest } from "@/runtime/http/routes/terminals";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  // Long-lived SSE: skip the outer probe (it would always trip the threshold).
  return handleTerminalStreamRequest(req, { surface: "web", params: { id } });
}
