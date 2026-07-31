import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/server/db";
import { authSessions } from "@/server/db/schema";
import { getSessionFromTokenValue } from "@/server/auth/session";
import type { OmniRouteDescriptor } from "@/runtime/http/registry";

const ALLOWED_REQUEST_HEADERS = new Set(["authorization", "content-type"]);
const PREFLIGHT_MAX_AGE_SECONDS = 600;

function bearerToken(request: Request) {
  const header = request.headers.get("authorization")?.trim() ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function appendVary(headers: Headers, value: string) {
  const values = new Set(
    (headers.get("vary") ?? "").split(",").map((entry) => entry.trim()).filter(Boolean),
  );
  values.add(value);
  headers.set("vary", [...values].join(", "));
}

async function hasActiveBrowserOrigin(origin: string) {
  const rows = await db.select({ id: authSessions.id })
    .from(authSessions)
    .where(and(
      eq(authSessions.transport, "bearer"),
      eq(authSessions.clientKind, "browser"),
      eq(authSessions.boundOrigin, origin),
      isNull(authSessions.revokedAt),
      gt(authSessions.expiresAt, new Date()),
      gt(authSessions.absoluteExpiresAt, new Date()),
    ))
    .limit(1);
  return rows.length > 0;
}

function corsHeaders(origin: string) {
  const headers = new Headers({
    "access-control-allow-origin": origin,
  });
  appendVary(headers, "Origin");
  return headers;
}

export async function buildBearerCorsPreflight(
  request: Request,
  descriptors: readonly OmniRouteDescriptor[],
): Promise<Response | null> {
  const origin = request.headers.get("origin")?.trim();
  const requestedMethod = request.headers
    .get("access-control-request-method")
    ?.trim()
    .toUpperCase();
  if (!origin || !requestedMethod) {
    return null;
  }
  const eligible = descriptors.some(
    (descriptor) => descriptor.auth === "session" && descriptor.method === requestedMethod,
  );
  if (!eligible) {
    return null;
  }
  if (!await hasActiveBrowserOrigin(origin)) {
    return Response.json({
      error: {
        code: "auth.cors_origin_rejected",
        message: "Browser origin is not authorized for this server.",
      },
    }, { status: 403 });
  }

  const requestedHeaders = (request.headers.get("access-control-request-headers") ?? "")
    .split(",")
    .map((header) => header.trim().toLowerCase())
    .filter(Boolean);
  if (requestedHeaders.some((header) => !ALLOWED_REQUEST_HEADERS.has(header))) {
    return Response.json({
      error: {
        code: "auth.cors_headers_rejected",
        message: "Requested CORS headers are not allowed.",
      },
    }, { status: 400 });
  }

  const headers = corsHeaders(origin);
  headers.set("access-control-allow-methods", [
    ...new Set(descriptors
      .filter((descriptor) => descriptor.auth === "session")
      .map((descriptor) => descriptor.method)
      .concat("OPTIONS")),
  ].sort().join(", "));
  headers.set(
    "access-control-allow-headers",
    requestedHeaders.length > 0
      ? requestedHeaders.join(", ")
      : "authorization, content-type",
  );
  headers.set("access-control-max-age", String(PREFLIGHT_MAX_AGE_SECONDS));
  return new Response(null, { status: 204, headers });
}

export async function attachBearerCors(
  request: Request,
  response: Response,
  descriptor: OmniRouteDescriptor,
) {
  if (descriptor.auth !== "session") {
    return response;
  }
  const origin = request.headers.get("origin")?.trim();
  const token = bearerToken(request);
  if (!origin || !token) {
    return response;
  }
  const session = await getSessionFromTokenValue(token, { touch: false });
  if (
    !session
    || session.transport !== "bearer"
    || session.clientKind !== "browser"
    || session.boundOrigin !== origin
  ) {
    return response;
  }
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", origin);
  headers.delete("access-control-allow-credentials");
  appendVary(headers, "Origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
