import { buildAppError } from "@/server/api-errors";
import {
  AUTH_SESSION_COOKIE,
  getAuthConfigurationError,
  getPublicOriginFromUrl,
  isAuthEnabled,
  isAutomationAuthBypassEnabled,
} from "@/server/auth/config";
import type { ActiveAuthSession } from "@/server/auth/session";
import {
  getRequestNetworkIdentity,
  isSecureOrLoopbackRequest,
} from "@/server/auth/trusted-proxy";
import { subscribeAuthSessionRevocations } from "@/server/auth/session-revocation";

const API_SESSION_CACHE_TTL_MS = 10_000;
const API_SESSION_CACHE_MAX_ENTRIES = 128;

type ApiSessionCacheEntry = {
  session: ActiveAuthSession;
  expiresAtMs: number;
};

const processAuthGuards = process as NodeJS.Process & {
  __omniHarnessApiSessionCache?: Map<string, ApiSessionCacheEntry>;
};

function apiSessionCache() {
  return processAuthGuards.__omniHarnessApiSessionCache ??= new Map();
}

function pruneExpiredApiSessions(now: number) {
  const cache = apiSessionCache();
  for (const [cookie, entry] of cache) {
    if (entry.expiresAtMs <= now) {
      cache.delete(cookie);
    }
  }
  return cache;
}

function setCachedApiSession(cookie: string, session: ActiveAuthSession) {
  const now = Date.now();
  const cache = pruneExpiredApiSessions(now);
  cache.delete(cookie);
  cache.set(cookie, {
    session,
    expiresAtMs: now + API_SESSION_CACHE_TTL_MS,
  });

  while (cache.size > API_SESSION_CACHE_MAX_ENTRIES) {
    const oldestCookie = cache.keys().next().value;
    if (!oldestCookie) {
      break;
    }
    cache.delete(oldestCookie);
  }
}

export function __resetApiSessionCacheForTests() {
  processAuthGuards.__omniHarnessApiSessionCache?.clear();
}

export function invalidateApiSessionCache(sessionIds: ReadonlySet<string> | null = null) {
  const cache = apiSessionCache();
  if (sessionIds === null) {
    cache.clear();
    return;
  }
  for (const [key, entry] of cache) {
    if (sessionIds.has(entry.session.id)) {
      cache.delete(key);
    }
  }
}

subscribeAuthSessionRevocations((revocation) => {
  invalidateApiSessionCache(revocation.sessionIds);
});

function jsonError(status: number, source: string, action: string, message: string) {
  return Response.json({
    error: buildAppError(message, { status, source, action }),
  }, { status });
}

export function isSafeMethod(method: string) {
  return method === "GET" || method === "HEAD" || method === "OPTIONS";
}

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin")?.trim();
  if (!origin) {
    return true;
  }

  let parsedOrigin: string;
  try {
    parsedOrigin = new URL(origin).origin;
  } catch {
    return false;
  }

  const requestUrl = new URL(request.url);
  const identity = getRequestNetworkIdentity(request);
  const configuredPublicOrigin = new URL(getPublicOriginFromUrl(request.url)).origin;
  return parsedOrigin === requestUrl.origin
    || parsedOrigin === identity.publicOrigin
    || parsedOrigin === configuredPublicOrigin;
}

export async function requireApiSession(
  request: Request | undefined,
  options: {
    action: string;
    source?: string;
    enforceSameOrigin?: boolean;
  },
) {
  if (!isAuthEnabled()) {
    return { session: null, response: null };
  }

  const configurationError = getAuthConfigurationError();
  if (configurationError) {
    return {
      session: null,
      response: jsonError(503, options.source ?? "Auth", options.action, configurationError),
    };
  }

  if (!request) {
    return {
      session: null,
      response: jsonError(401, options.source ?? "Auth", options.action, "Authentication required."),
    };
  }

  const cookie = getSessionCookieValue(request);
  const bearer = getBearerTokenValue(request);
  if (isAutomationAuthBypassEnabled() && !cookie && !bearer) {
    return { session: null, response: null };
  }

  if (cookie && bearer) {
    return {
      session: null,
      response: jsonError(401, options.source ?? "Auth", options.action, "Use exactly one session transport."),
    };
  }

  if (options.enforceSameOrigin && !bearer && !isSameOriginRequest(request)) {
    return {
      session: null,
      response: jsonError(403, options.source ?? "Auth", options.action, "Cross-site request rejected."),
    };
  }

  const credential = bearer ?? cookie;
  if (!credential) {
    return {
      session: null,
      response: jsonError(401, options.source ?? "Auth", options.action, "Authentication required."),
    };
  }

  const cacheKey = `${bearer ? "bearer" : "cookie"}:${credential}`;
  const cached = apiSessionCache().get(cacheKey);
  if (cached && cached.expiresAtMs > Date.now()) {
    const rejection = validateSessionTransport(request, cached.session, Boolean(bearer));
    return rejection
      ? { session: null, response: rejection }
      : { session: cached.session, response: null };
  }

  const { getSessionFromTokenValue } = await import("@/server/auth/session");
  const session = await getSessionFromTokenValue(credential);
  if (!session) {
    apiSessionCache().delete(cacheKey);
    return {
      session: null,
      response: jsonError(401, options.source ?? "Auth", options.action, "Authentication required."),
    };
  }

  const rejection = validateSessionTransport(request, session, Boolean(bearer));
  if (rejection) {
    return { session: null, response: rejection };
  }

  setCachedApiSession(cacheKey, session);
  return { session, response: null };
}

function getBearerTokenValue(request: Request) {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function validateSessionTransport(
  request: Request,
  session: ActiveAuthSession,
  usedBearer: boolean,
) {
  const expectedTransport = usedBearer ? "bearer" : "cookie";
  if (session.transport !== expectedTransport) {
    return jsonError(401, "Auth", "Validate session", "Authentication required.");
  }
  if (!usedBearer) {
    return null;
  }
  if (!isSecureOrLoopbackRequest(getRequestNetworkIdentity(request))) {
    return jsonError(403, "Auth", "Validate session", "Bearer sessions require HTTPS for non-loopback clients.");
  }

  const origin = request.headers.get("origin")?.trim() ?? null;
  if (session.clientKind === "native") {
    return origin
      ? jsonError(403, "Auth", "Validate session", "Native sessions cannot be used by browser-origin requests.")
      : null;
  }
  if (!origin || origin === "null" || origin !== session.boundOrigin) {
    return jsonError(403, "Auth", "Validate session", "Bearer session origin rejected.");
  }
  return null;
}

function getSessionCookieValue(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) {
      continue;
    }
    const name = part.slice(0, separator).trim();
    if (name === AUTH_SESSION_COOKIE) {
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
  }
  return null;
}
