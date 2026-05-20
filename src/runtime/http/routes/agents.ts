import { BRIDGE_URL, normalizeAgentRecord } from "@/server/bridge-client";
import { errorResponse } from "@/server/api-errors";
import { requireApiSession } from "@/server/auth/guards";
import type { OmniHttpHandler } from "@/runtime/http/registry";
import { toNextRequest } from "./next-request";

export const handleAgentsRequest: OmniHttpHandler = async (request) => {
  try {
    const auth = await requireApiSession(toNextRequest(request), {
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
    return Response.json(Array.isArray(data) ? data.map((agent) => normalizeAgentRecord(agent)) : []);
  } catch (error: unknown) {
    return errorResponse(error, {
      status: 500,
      source: "Agent runtime",
      action: "Load agents",
    });
  }
};
