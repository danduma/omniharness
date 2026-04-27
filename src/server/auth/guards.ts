import { NextRequest, NextResponse } from "next/server";
import { buildAppError } from "@/server/api-errors";
import { getAuthConfigurationError, isAuthEnabled } from "@/server/auth/config";
import { getSessionFromRequest } from "@/server/auth/session";

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

  if (options.enforceSameOrigin && !isSameOriginRequest(request)) {
    return {
      session: null,
      response: jsonError(403, options.source ?? "Auth", options.action, "Cross-site request rejected."),
    };
  }

  const session = await getSessionFromRequest(request);
  if (!session) {
    return {
      session: null,
      response: jsonError(401, options.source ?? "Auth", options.action, "Authentication required."),
    };
  }

  return { session, response: null };
}
