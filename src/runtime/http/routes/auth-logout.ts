import { insertAuthEvent } from "@/server/auth/audit";
import { errorResponse } from "@/server/api-errors";
import { requireApiSession } from "@/server/auth/guards";
import { getSessionFromRequest, revokeSession } from "@/server/auth/session";
import type { OmniHttpHandler } from "@/runtime/http/registry";
import { toNextRequest } from "./next-request";
import { clearSessionCookie } from "./cookies";

export const handleAuthLogoutRequest: OmniHttpHandler = async (request) => {
  try {
    const nextRequest = toNextRequest(request);
    const auth = await requireApiSession(nextRequest, {
      source: "Auth",
      action: "Log out",
      enforceSameOrigin: true,
    });
    if (auth.response) {
      return auth.response;
    }

    const currentSession = await getSessionFromRequest(nextRequest, { touch: false });
    if (currentSession) {
      await revokeSession(currentSession.id);
      await insertAuthEvent({
        eventType: "auth.logout",
        sessionId: currentSession.id,
      });
    }

    const response = Response.json({ ok: true });
    clearSessionCookie(response);
    return response;
  } catch (error) {
    return errorResponse(error, {
      status: 500,
      source: "Auth",
      action: "Log out",
    });
  }
};
