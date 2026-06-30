import { errorResponse } from "@/server/api-errors";
import { requireApiSession } from "@/server/auth/guards";
import { discoverExternalClaudeSessions, discoverExternalGeminiSessions } from "@/server/external-sessions/discovery";
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

    const [claudeSessions, geminiSessions] = await Promise.all([
      discoverExternalClaudeSessions(),
      discoverExternalGeminiSessions(),
    ]);

    return Response.json({
      sessions: claudeSessions.map((s) => ({
        ...s,
        lastModified: s.lastModified.toISOString(),
      })),
      claude: claudeSessions.map((s) => ({
        ...s,
        lastModified: s.lastModified.toISOString(),
      })),
      gemini: geminiSessions.map((s) => ({
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
