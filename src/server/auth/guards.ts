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

  return origin === new URL(request.url).origin;
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
