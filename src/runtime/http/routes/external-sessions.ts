import { errorResponse } from "@/server/api-errors";
import { requireApiSession } from "@/server/auth/guards";
import { discoverExternalClaudeSessions } from "@/server/external-sessions/discovery";
import type { OmniHttpHandler } from "@/runtime/http/registry";
import { toNextRequest } from "./next-request";

export const handleExternalSessionsRequest: OmniHttpHandler = async (request) => {
  try {
    if (request.method !== "GET") {
      return Response.json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, {
        status: 405,
        headers: { allow: "GET" },
      });
    }

    const auth = await requireApiSession(toNextRequest(request), {
      source: "External sessions",
      action: "List external sessions",
    });
    if (auth.response) {
      return auth.response;
    }

    const sessions = await discoverExternalClaudeSessions();

    return Response.json({
      sessions: sessions.map((s) => ({
        ...s,
        lastModified: s.lastModified.toISOString(),
      })),
    });
  } catch (error: unknown) {
    return errorResponse(error, {
      status: 500,
      source: "External sessions",
      action: "List external sessions",
    });
  }
};
