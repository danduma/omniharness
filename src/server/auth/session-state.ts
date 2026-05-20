import {
  AUTH_SESSION_COOKIE,
  getAuthConfigurationError,
  getPublicOriginFromRequest,
  isAutomationAuthBypassEnabled,
  isAuthEnabled,
} from "@/server/auth/config";
import type { ActiveAuthSession } from "@/server/auth/session";
import type { AuthSessionResponse, AuthSessionRecord } from "@/app/home/types";

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
  if (!cookie) {
    return {
      enabled: true,
      authenticated: false,
      currentSession: null,
      sessions: [],
      configurationError: null,
      publicOrigin,
    };
  }

  const { getSessionFromTokenValue, listActiveSessions } = await import("@/server/auth/session");
  const session = await getSessionFromTokenValue(cookie);
  if (!session) {
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
    currentSession: serializeSession(session),
    sessions: sessions.map(serializeSession),
    configurationError: null,
    publicOrigin,
  };
}
