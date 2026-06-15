import { NextRequest } from "next/server";
import { handleTerminalCreateRequest } from "@/runtime/http/routes/terminals";
import { withOuterProbe } from "@/server/slow-probe";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return withOuterProbe("POST /api/terminals", () =>
    handleTerminalCreateRequest(req, { surface: "web" }),
  );
}
