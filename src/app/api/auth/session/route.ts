import { NextRequest, NextResponse } from "next/server";
import { isAuthEnabled, AUTH_SESSION_COOKIE, getAuthConfigurationError } from "@/server/auth/config";
import { listActiveSessions, getSessionFromRequest, revokeSession, revokeAllSessions } from "@/server/auth/session";
import { insertAuthEvent } from "@/server/auth/audit";
import { errorResponse } from "@/server/api-errors";
import { requireApiSession } from "@/server/auth/guards";

export async function GET(req: NextRequest) {
  try {
    if (!isAuthEnabled()) {
      return NextResponse.json({
        enabled: false,
        authenticated: true,
        currentSession: null,
        sessions: [],
        configurationError: null,
      });
    }

    const configurationError = getAuthConfigurationError();
    if (configurationError) {
      return NextResponse.json({
        enabled: true,
        authenticated: false,
        currentSession: null,
        sessions: [],
        configurationError,
      });
    }

    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({
        enabled: true,
        authenticated: false,
        currentSession: null,
        sessions: [],
        configurationError: null,
      });
    }

    const sessions = await listActiveSessions();
    return NextResponse.json({
      enabled: true,
      authenticated: true,
      currentSession: session,
      sessions,
      configurationError: null,
    });
  } catch (error) {
    return errorResponse(error, {
      status: 500,
      source: "Auth",
      action: "Load session state",
    });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireApiSession(req, {
      source: "Auth",
      action: "Revoke session",
      enforceSameOrigin: true,
    });
    if (auth.response) {
      return auth.response;
    }

    const body = await req.json().catch(() => ({}));
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

    const response = NextResponse.json({ ok: true });
    if (revokeAll || !targetSessionId || targetSessionId === auth.session?.id) {
      response.cookies.set(AUTH_SESSION_COOKIE, "", {
        expires: new Date(0),
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
      });
    }

    return response;
  } catch (error) {
    return errorResponse(error, {
      status: 500,
      source: "Auth",
      action: "Revoke session",
    });
  }
}
