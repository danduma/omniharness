import { NextRequest, NextResponse } from "next/server";
import { buildAppError } from "@/server/api-errors";
import { AUTH_SESSION_COOKIE, getAuthConfigurationError, isAuthEnabled, isAutomationAuthBypassEnabled } from "@/server/auth/config";
import type { ActiveAuthSession } from "@/server/auth/session";

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

function jsonError(status: number, source: string, action: string, message: string) {
  return NextResponse.json({
    error: buildAppError(message, { status, source, action }),
  }, { status });
}

export function isSafeMethod(method: string) {
  return method === "GET" || method === "HEAD" || method === "OPTIONS";
}

export function isSameOriginRequest(request: NextRequest) {
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
  const allowedOrigins = new Set([requestUrl.origin]);
  const host = firstHeaderValue(request.headers.get("x-forwarded-host")) || request.headers.get("host")?.trim();
  const protocol = firstHeaderValue(request.headers.get("x-forwarded-proto")) || requestUrl.protocol.replace(/:$/, "");

  if (host) {
    allowedOrigins.add(`${protocol}://${host}`);
  }

  return allowedOrigins.has(parsedOrigin);
}

function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}

export async function requireApiSession(
  request: NextRequest | undefined,
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

  if (isAutomationAuthBypassEnabled() && !request.cookies.get(AUTH_SESSION_COOKIE)) {
    return { session: null, response: null };
  }

  if (options.enforceSameOrigin && !isSameOriginRequest(request)) {
    return {
      session: null,
      response: jsonError(403, options.source ?? "Auth", options.action, "Cross-site request rejected."),
    };
  }

  const cookie = request.cookies.get(AUTH_SESSION_COOKIE)?.value ?? null;
  if (!cookie) {
    return {
      session: null,
      response: jsonError(401, options.source ?? "Auth", options.action, "Authentication required."),
    };
  }

  const cached = apiSessionCache().get(cookie);
  if (cached && cached.expiresAtMs > Date.now()) {
    return { session: cached.session, response: null };
  }

  const { getSessionFromRequest } = await import("@/server/auth/session");
  const session = await getSessionFromRequest(request);
  if (!session) {
    apiSessionCache().delete(cookie);
    return {
      session: null,
      response: jsonError(401, options.source ?? "Auth", options.action, "Authentication required."),
    };
  }

  setCachedApiSession(cookie, session);
  return { session, response: null };
}
