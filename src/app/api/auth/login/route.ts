import { NextRequest, NextResponse } from "next/server";
import { AUTH_SESSION_COOKIE, getAuthConfigurationError, isAuthEnabled } from "@/server/auth/config";
import { verifyConfiguredAuthPassword } from "@/server/auth/password";
import { createAuthSession } from "@/server/auth/session";
import { insertAuthEvent } from "@/server/auth/audit";
import { errorResponse } from "@/server/api-errors";
import { isSameOriginRequest } from "@/server/auth/guards";
import { getLoginRateLimitStatus, recordFailedLoginAttempt, recordSuccessfulLoginAttempt } from "@/server/auth/rate-limit";

function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}

function getClientIp(req: NextRequest) {
  return firstHeaderValue(req.headers.get("x-forwarded-for"))
    || firstHeaderValue(req.headers.get("x-real-ip"))
    || null;
}

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
    const ipAddress = getClientIp(req);
    const userAgent = req.headers.get("user-agent") ?? null;

    if (!password.trim()) {
      return errorResponse("Password is required.", {
        status: 400,
        source: "Auth",
        action: "Log in",
      });
    }

    const rateLimitStatus = getLoginRateLimitStatus(ipAddress);
    if (rateLimitStatus.locked) {
      const response = errorResponse("Too many login attempts. Try again later.", {
        status: 429,
        source: "Auth",
        action: "Log in",
      });
      response.headers.set("Retry-After", String(rateLimitStatus.retryAfterSeconds));
      await insertAuthEvent({
        eventType: "auth.login_rate_limited",
        details: {
          ipAddress,
          userAgent,
          retryAfterSeconds: rateLimitStatus.retryAfterSeconds,
        },
      });
      return response;
    }

    const valid = await verifyConfiguredAuthPassword(password);
    if (!valid) {
      recordFailedLoginAttempt(ipAddress);
      await insertAuthEvent({
        eventType: "auth.login_failed",
        details: {
          ipAddress,
          userAgent,
        },
      });
      return errorResponse("Incorrect password.", {
        status: 401,
        source: "Auth",
        action: "Log in",
      });
    }

    recordSuccessfulLoginAttempt(ipAddress);
    const session = await createAuthSession({
      label: label.trim() || "Browser session",
      userAgent,
      authMethod: "password_login",
    });

    await insertAuthEvent({
      eventType: "auth.login_succeeded",
      sessionId: session.sessionId,
      details: {
        label: label.trim() || "Browser session",
        ipAddress,
        userAgent,
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
