import {
  AUTH_SESSION_COOKIE,
  getAuthConfigurationError,
  getPublicOriginFromRequest,
  isAutomationAuthBypassEnabled,
  isAuthEnabled,
} from "@/server/auth/config";
import type { ActiveAuthSession } from "@/server/auth/session";
import type { AuthSessionResponse, AuthSessionRecord } from "@/shared/home-types";

function serializeSession(session: ActiveAuthSession): AuthSessionRecord {
  return {
    ...session,
    lastSeenAt: session.lastSeenAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
    absoluteExpiresAt: session.absoluteExpiresAt.toISOString(),
    revokedAt: session.revokedAt?.toISOString() ?? null,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

export function getCookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) {
    return null;
  }

  for (const segment of cookieHeader.split(";")) {
    const [rawKey, ...rawValueParts] = segment.trim().split("=");
    if (rawKey === name) {
      return rawValueParts.join("=") || null;
    }
  }

  return null;
}

export async function buildAuthSessionState(args: {
  url: string;
  headers: Headers;
}): Promise<AuthSessionResponse> {
  const publicOrigin = getPublicOriginFromRequest(args.url, args.headers);

  if (isAutomationAuthBypassEnabled()) {
    return {
      enabled: false,
      authenticated: true,
      currentSession: null,
      sessions: [],
      configurationError: null,
      publicOrigin,
    };
  }

  if (!isAuthEnabled()) {
    return {
      enabled: false,
      authenticated: true,
      currentSession: null,
      sessions: [],
      configurationError: null,
      publicOrigin,
    };
  }

  const configurationError = getAuthConfigurationError();
  if (configurationError) {
    return {
      enabled: true,
      authenticated: false,
      currentSession: null,
      sessions: [],
      configurationError,
      publicOrigin,
    };
  }

  const cookie = getCookieValue(args.headers.get("cookie"), AUTH_SESSION_COOKIE);
  const bearer = args.headers.get("authorization")?.trim() ?? "";
  if (!cookie && !bearer) {
    return {
      enabled: true,
      authenticated: false,
      currentSession: null,
      sessions: [],
      configurationError: null,
      publicOrigin,
    };
  }

  const [{ requireApiSession }, { listActiveSessions }] = await Promise.all([
    import("@/server/auth/guards"),
    import("@/server/auth/session"),
  ]);
  const auth = await requireApiSession(new Request(args.url, {
    headers: args.headers,
  }), {
    source: "Auth",
    action: "Load bootstrap session state",
  });
  if (auth.response || !auth.session) {
    return {
      enabled: true,
      authenticated: false,
      currentSession: null,
      sessions: [],
      configurationError: null,
      publicOrigin,
    };
  }

  const sessions = await listActiveSessions();
  return {
    enabled: true,
    authenticated: true,
    currentSession: serializeSession(auth.session),
    sessions: sessions.map(serializeSession),
    configurationError: null,
    publicOrigin,
  };
}
