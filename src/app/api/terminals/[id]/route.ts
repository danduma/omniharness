import { NextRequest } from "next/server";
import { handleTerminalDeleteRequest } from "@/runtime/http/routes/terminals";
import { withOuterProbe } from "@/server/slow-probe";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withOuterProbe(`DELETE /api/terminals/${id}`, () =>
    handleTerminalDeleteRequest(req, { surface: "web", params: { id } }),
  );
}
