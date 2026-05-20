import { NextRequest } from "next/server";
import { handleEventsRequest } from "@/runtime/http/routes/events";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return handleEventsRequest(req, { surface: "web" });
}
