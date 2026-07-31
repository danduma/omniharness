import { getAuthConfigurationError, isAuthEnabled } from "@/server/auth/config";
import { createAuthSession } from "@/server/auth/session";
import { insertAuthEvent } from "@/server/auth/audit";
import { errorResponse } from "@/server/api-errors";
import { isSameOriginRequest } from "@/server/auth/guards";
import type { OmniHttpHandler } from "@/runtime/http/registry";
import { setSessionCookie } from "./cookies";
import {
  getRequestNetworkIdentity,
  hasBrowserProvenanceHeaders,
  isSecureOrLoopbackRequest,
} from "@/server/auth/trusted-proxy";
import { verifyPasswordLoginAttempt } from "@/server/auth/login-attempt";

export const handleAuthLoginRequest: OmniHttpHandler = async (request) => {
  try {
    if (!isAuthEnabled()) {
      return errorResponse("Authentication is not enabled for this OmniHarness instance.", {
        status: 400,
        source: "Auth",
        action: "Log in",
      });
    }

    const configurationError = getAuthConfigurationError();
    if (configurationError) {
      return errorResponse(configurationError, {
        status: 503,
        source: "Auth",
        action: "Log in",
      });
    }

    const body = await request.json();
    const password = typeof body?.password === "string" ? body.password : "";
    const tokenTransport = body?.tokenTransport === "bearer" ? "bearer" : "cookie";
    const label = typeof body?.clientLabel === "string"
      ? body.clientLabel
      : typeof body?.label === "string"
        ? body.label
        : "";
    const networkIdentity = getRequestNetworkIdentity(request);
    if (!isSecureOrLoopbackRequest(networkIdentity)) {
      return errorResponse("Password login requires HTTPS for non-loopback clients.", {
        status: 403,
        source: "Auth",
        action: "Log in",
      });
    }

    if (tokenTransport === "bearer") {
      if (
        hasBrowserProvenanceHeaders(request)
      ) {
        await insertAuthEvent({
          eventType: "auth.native_login_rejected",
          details: {
            ipAddress: networkIdentity.clientAddress,
            userAgent: request.headers.get("user-agent") ?? null,
          },
        });
        return errorResponse("Native bearer login requires an originless secure or loopback request.", {
          status: 403,
          source: "Auth",
          action: "Log in",
        });
      }
    } else if (!isSameOriginRequest(request)) {
      return errorResponse("Cross-site request rejected.", {
        status: 403,
        source: "Auth",
        action: "Log in",
      });
    }

    if (!password.trim()) {
      return errorResponse("Password is required.", {
        status: 400,
        source: "Auth",
        action: "Log in",
      });
    }

    const attempt = await verifyPasswordLoginAttempt({
      request,
      password,
      purpose: "password_login",
    });
    if (!attempt.ok) {
      const response = errorResponse(attempt.message, {
        status: attempt.status,
        source: "Auth",
        action: "Log in",
      });
      if (attempt.retryAfterSeconds > 0) {
        response.headers.set("Retry-After", String(attempt.retryAfterSeconds));
      }
      return response;
    }

    const session = await createAuthSession({
      label: label.trim() || (
        tokenTransport === "bearer" ? "Native session" : "Browser session"
      ),
      userAgent: attempt.userAgent,
      authMethod: "password_login",
      transport: tokenTransport,
      clientKind: tokenTransport === "bearer" ? "native" : "browser",
      boundOrigin: null,
    });

    await insertAuthEvent({
      eventType: "auth.login_succeeded",
      sessionId: session.sessionId,
      details: {
        label: label.trim() || (
          tokenTransport === "bearer" ? "Native session" : "Browser session"
        ),
        ipAddress: attempt.ipAddress,
        userAgent: attempt.userAgent,
        transport: tokenTransport,
      },
    });

    const response = Response.json({
      ok: true,
      sessionId: session.sessionId,
      expiresAt: session.expiresAt,
      ...(tokenTransport === "bearer" ? { token: session.tokenValue } : {}),
    });
    if (tokenTransport === "cookie") {
      setSessionCookie(response, session.tokenValue, session.expiresAt);
    }
    return response;
  } catch (error) {
    return errorResponse(error, {
      status: 500,
      source: "Auth",
      action: "Log in",
    });
  }
};
