import { getAuthConfigurationError, getPublicOriginFromRequest, isAuthEnabled } from "@/server/auth/config";
import { insertAuthEvent } from "@/server/auth/audit";
import { getSessionFromRequest, listActiveSessions, revokeAllSessions, revokeSession } from "@/server/auth/session";
import { errorResponse } from "@/server/api-errors";
import { requireApiSession } from "@/server/auth/guards";
import type { OmniHttpHandler } from "@/runtime/http/registry";
import { toNextRequest } from "./next-request";
import { clearSessionCookie } from "./cookies";

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init);
}

async function getAuthSession(request: Request) {
  const nextRequest = toNextRequest(request);
  const publicOrigin = getPublicOriginFromRequest(nextRequest.url, nextRequest.headers);

  if (!isAuthEnabled()) {
    return json({
      enabled: false,
      authenticated: true,
      currentSession: null,
      sessions: [],
      configurationError: null,
      publicOrigin,
    });
  }

  const configurationError = getAuthConfigurationError();
  if (configurationError) {
    return json({
      enabled: true,
      authenticated: false,
      currentSession: null,
      sessions: [],
      configurationError,
      publicOrigin,
    });
  }

  const session = await getSessionFromRequest(nextRequest);
  if (!session) {
    return json({
      enabled: true,
      authenticated: false,
      currentSession: null,
      sessions: [],
      configurationError: null,
      publicOrigin,
    });
  }

  return json({
    enabled: true,
    authenticated: true,
    currentSession: session,
    sessions: await listActiveSessions(),
    configurationError: null,
    publicOrigin,
  });
}

async function deleteAuthSession(request: Request) {
  const nextRequest = toNextRequest(request);
  const auth = await requireApiSession(nextRequest, {
    source: "Auth",
    action: "Revoke session",
    enforceSameOrigin: true,
  });
  if (auth.response) {
    return auth.response;
  }

  const body = await request.json().catch(() => ({}));
  const targetSessionId = typeof body?.sessionId === "string" && body.sessionId.trim()
    ? body.sessionId.trim()
    : null;
  const revokeAll = body?.all === true;

  if (revokeAll) {
    await revokeAllSessions();
    await insertAuthEvent({
      eventType: "auth.logout_all",
      sessionId: auth.session?.id ?? null,
    });
  } else {
    await revokeSession(targetSessionId ?? auth.session!.id);
    await insertAuthEvent({
      eventType: "auth.session_revoked",
      sessionId: targetSessionId ?? auth.session?.id ?? null,
    });
  }

  const response = json({ ok: true });
  if (revokeAll || !targetSessionId || targetSessionId === auth.session?.id) {
    clearSessionCookie(response);
  }
  return response;
}

export const handleAuthSessionRequest: OmniHttpHandler = async (request) => {
  try {
    if (request.method === "GET") {
      return getAuthSession(request);
    }
    if (request.method === "DELETE") {
      return deleteAuthSession(request);
    }
    return json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, {
      status: 405,
      headers: { allow: "GET, DELETE" },
    });
  } catch (error) {
    return errorResponse(error, {
      status: 500,
      source: "Auth",
      action: request.method === "DELETE" ? "Revoke session" : "Load session state",
    });
  }
};
