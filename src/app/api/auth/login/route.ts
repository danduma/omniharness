import { NextRequest, NextResponse } from "next/server";
import { AUTH_SESSION_COOKIE, getAuthConfigurationError, isAuthEnabled } from "@/server/auth/config";
import { verifyConfiguredAuthPassword } from "@/server/auth/password";
import { createAuthSession } from "@/server/auth/session";
import { insertAuthEvent } from "@/server/auth/audit";
import { errorResponse } from "@/server/api-errors";
import { isSameOriginRequest } from "@/server/auth/guards";

export async function POST(req: NextRequest) {
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

    if (!isSameOriginRequest(req)) {
      return errorResponse("Cross-site request rejected.", {
        status: 403,
        source: "Auth",
        action: "Log in",
      });
    }

    const body = await req.json();
    const password = typeof body?.password === "string" ? body.password : "";
    const label = typeof body?.label === "string" ? body.label : "";

    if (!password.trim()) {
      return errorResponse("Password is required.", {
        status: 400,
        source: "Auth",
        action: "Log in",
      });
    }

    const valid = await verifyConfiguredAuthPassword(password);
    if (!valid) {
      await insertAuthEvent({
        eventType: "auth.login_failed",
        details: {
          userAgent: req.headers.get("user-agent") ?? null,
        },
      });
      return errorResponse("Incorrect password.", {
        status: 401,
        source: "Auth",
        action: "Log in",
      });
    }

    const session = await createAuthSession({
      label: label.trim() || "Browser session",
      userAgent: req.headers.get("user-agent"),
      authMethod: "password_login",
    });

    await insertAuthEvent({
      eventType: "auth.login_succeeded",
      sessionId: session.sessionId,
      details: {
        label: label.trim() || "Browser session",
      },
    });

    const response = NextResponse.json({
      ok: true,
      sessionId: session.sessionId,
      expiresAt: session.expiresAt,
    });
    response.cookies.set(AUTH_SESSION_COOKIE, session.tokenValue, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: session.expiresAt,
    });
    return response;
  } catch (error) {
    return errorResponse(error, {
      status: 500,
      source: "Auth",
      action: "Log in",
    });
  }
}
