import { NextRequest } from "next/server";
import { handleEventsRequest } from "@/runtime/http/routes/events";
import { withOuterProbe } from "@/server/slow-probe";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const isSnapshot = url.searchParams.get("snapshot") === "1";
  // Skip the outer probe for the long-poll SSE stream: it is expected to
  // be long-lived and would always trip the threshold without signal.
  if (!isSnapshot) {
    return handleEventsRequest(req, { surface: "web" });
  }
  const label = `GET /api/events${url.search}`;
  return withOuterProbe(label, () => handleEventsRequest(req, { surface: "web" }));
}
