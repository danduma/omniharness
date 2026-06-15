import { NextRequest } from "next/server";
import { handleTerminalResizeRequest } from "@/runtime/http/routes/terminals";
import { withOuterProbe } from "@/server/slow-probe";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withOuterProbe(`POST /api/terminals/${id}/resize`, () =>
    handleTerminalResizeRequest(req, { surface: "web", params: { id } }),
  );
}
