import { NextRequest, NextResponse } from "next/server";
import { AUTH_SESSION_COOKIE } from "@/server/auth/config";
import { revokeSession, getSessionFromRequest } from "@/server/auth/session";
import { insertAuthEvent } from "@/server/auth/audit";
import { errorResponse } from "@/server/api-errors";
import { requireApiSession } from "@/server/auth/guards";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiSession(req, {
      source: "Auth",
      action: "Log out",
      enforceSameOrigin: true,
    });
    if (auth.response) {
      return auth.response;
    }

    const currentSession = await getSessionFromRequest(req, { touch: false });
    if (currentSession) {
      await revokeSession(currentSession.id);
      await insertAuthEvent({
        eventType: "auth.logout",
        sessionId: currentSession.id,
      });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(AUTH_SESSION_COOKIE, "", {
      expires: new Date(0),
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    return response;
  } catch (error) {
    return errorResponse(error, {
      status: 500,
      source: "Auth",
      action: "Log out",
    });
  }
}
