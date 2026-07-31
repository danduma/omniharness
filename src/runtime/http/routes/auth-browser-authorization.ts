import { insertAuthEvent } from "@/server/auth/audit";
import {
  browserAuthorizationCodeManager,
  validateBrowserAuthorizationRequest,
} from "@/server/auth/browser-authorization";
import { requireApiSession } from "@/server/auth/guards";
import { verifyPasswordLoginAttempt } from "@/server/auth/login-attempt";
import { createAuthSession } from "@/server/auth/session";
import type { OmniHttpHandler } from "@/runtime/http/registry";

function withOriginCors(response: Response, origin: string) {
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", origin);
  headers.set("vary", "Origin");
  headers.delete("access-control-allow-credentials");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function authorizationError(error: unknown, status = 400) {
  return Response.json({
    error: {
      code: "auth.browser_authorization_failed",
      message: error instanceof Error ? error.message : String(error),
    },
  }, { status });
}

export const handleBrowserAuthorizationApproveRequest: OmniHttpHandler = async (
  request,
) => {
  try {
    const body = await request.json() as Record<string, unknown>;
    const authorization = validateBrowserAuthorizationRequest(body);
    if (body.approved !== true) {
      await insertAuthEvent({
        eventType: "auth.browser_authorization_denied",
        details: { origin: authorization.origin },
      });
      return authorizationError("Authorization was denied.", 403);
    }

    const password = typeof body.password === "string" ? body.password : "";
    let approvingSessionId: string | null = null;
    if (password) {
      const attempt = await verifyPasswordLoginAttempt({
        request,
        password,
        purpose: "browser_authorization",
      });
      if (!attempt.ok) {
        return authorizationError(attempt.message, attempt.status);
      }
    } else {
      const auth = await requireApiSession(request, {
        action: "Approve interface authorization",
        enforceSameOrigin: true,
      });
      if (auth.response) {
        return auth.response;
      }
      approvingSessionId = auth.session?.id ?? null;
    }

    const approved = browserAuthorizationCodeManager.approve(authorization);
    await insertAuthEvent({
      eventType: "auth.browser_authorization_approved",
      sessionId: approvingSessionId,
      details: { origin: authorization.origin },
    });
    return Response.json({
      code: approved.code,
      state: approved.state,
      expiresAt: approved.expiresAt,
    });
  } catch (error) {
    return authorizationError(error);
  }
};

export const handleBrowserAuthorizationExchangeRequest: OmniHttpHandler = async (
  request,
) => {
  const requestOrigin = request.headers.get("origin")?.trim() ?? "";
  if (request.method === "OPTIONS") {
    if (!requestOrigin || !browserAuthorizationCodeManager.hasPendingOrigin(requestOrigin)) {
      return authorizationError("Authorization origin is not pending.", 403);
    }
    const headers = new Headers({
      "access-control-allow-origin": requestOrigin,
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
      "access-control-max-age": "60",
      vary: "Origin",
    });
    return new Response(null, { status: 204, headers });
  }

  try {
    const body = await request.json() as Record<string, unknown>;
    const origin = typeof body.origin === "string" ? body.origin : "";
    if (!requestOrigin || requestOrigin !== origin) {
      return authorizationError("Authorization exchange origin does not match.", 403);
    }
    const consumed = browserAuthorizationCodeManager.consume({
      code: typeof body.code === "string" ? body.code : "",
      verifier: typeof body.verifier === "string" ? body.verifier : "",
      state: typeof body.state === "string" ? body.state : "",
      origin,
    });
    const session = await createAuthSession({
      label: typeof body.clientLabel === "string"
        ? body.clientLabel
        : "Browser profile",
      userAgent: request.headers.get("user-agent"),
      authMethod: "password_login",
      transport: "bearer",
      clientKind: "browser",
      boundOrigin: consumed.origin,
    });
    await insertAuthEvent({
      eventType: "auth.browser_bearer_issued",
      sessionId: session.sessionId,
      details: { origin: consumed.origin },
    });
    return withOriginCors(Response.json({
      ok: true,
      token: session.tokenValue,
      sessionId: session.sessionId,
      expiresAt: session.expiresAt,
    }), consumed.origin);
  } catch (error) {
    const response = authorizationError(error);
    return requestOrigin && browserAuthorizationCodeManager.hasPendingOrigin(requestOrigin)
      ? withOriginCors(response, requestOrigin)
      : response;
  }
};
