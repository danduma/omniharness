import { NextRequest, NextResponse } from "next/server";
import { BRIDGE_URL, normalizeAgentRecord } from "@/server/bridge-client";
import { errorResponse } from "@/server/api-errors";
import { requireApiSession } from "@/server/auth/guards";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiSession(req, {
      source: "Agent runtime",
      action: "Load agents",
    });
    if (auth.response) {
      return auth.response;
    }

    const res = await fetch(`${BRIDGE_URL}/agents`);
    if (!res.ok) {
      return errorResponse(`Agent runtime list request failed with status ${res.status}`, {
        status: res.status,
        source: "Agent runtime",
        action: "Load agents",
      });
    }
    const data = await res.json();
    const normalized = Array.isArray(data) ? data.map((agent) => normalizeAgentRecord(agent)) : [];
    return NextResponse.json(normalized);
  } catch (error: unknown) {
    return errorResponse(error, {
      status: 500,
      source: "Agent runtime",
      action: "Load agents",
    });
  }
}
