import crypto from "crypto";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { authSessions } from "@/server/db/schema";
import {
  AUTH_SESSION_ABSOLUTE_MS,
  AUTH_SESSION_COOKIE,
  AUTH_SESSION_IDLE_MS,
  getAuthKey,
} from "@/server/auth/config";

export type AuthMethod = "password_login" | "qr_pair";

export interface ActiveAuthSession {
  id: string;
  label: string | null;
  userAgent: string | null;
  authMethod: string;
  createdBySessionId: string | null;
  lastSeenAt: Date;
  expiresAt: Date;
  absoluteExpiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ParsedOpaqueToken {
  id: string;
  secret: string;
}

function hashOpaqueSecret(secret: string) {
  return crypto.createHmac("sha256", getAuthKey()).update(secret).digest("base64url");
}

function createOpaqueToken() {
  return {
    id: randomUUID(),
    secret: crypto.randomBytes(32).toString("base64url"),
  };
}

export function buildOpaqueTokenValue(token: ParsedOpaqueToken) {
  return `${token.id}.${token.secret}`;
}

export function parseOpaqueTokenValue(value: string | null | undefined): ParsedOpaqueToken | null {
  if (!value) {
    return null;
  }

  const [id, secret] = value.split(".", 2);
  if (!id || !secret) {
    return null;
  }

  return { id, secret };
}

function normalizeSessionRow(row: typeof authSessions.$inferSelect): ActiveAuthSession {
  return {
    ...row,
    lastSeenAt: new Date(row.lastSeenAt),
    expiresAt: new Date(row.expiresAt),
    absoluteExpiresAt: new Date(row.absoluteExpiresAt),
    revokedAt: row.revokedAt ? new Date(row.revokedAt) : null,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

function shouldTouchSession(session: ActiveAuthSession) {
  return Date.now() - session.lastSeenAt.getTime() > 1000 * 60;
}

export async function createAuthSession(args: {
  label?: string | null;
  userAgent?: string | null;
  authMethod: AuthMethod;
  createdBySessionId?: string | null;
}) {
  const token = createOpaqueToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + AUTH_SESSION_IDLE_MS);
  const absoluteExpiresAt = new Date(now.getTime() + AUTH_SESSION_ABSOLUTE_MS);

  await db.insert(authSessions).values({
    id: token.id,
    tokenHash: hashOpaqueSecret(token.secret),
    label: args.label?.trim() || null,
    userAgent: args.userAgent?.trim() || null,
    authMethod: args.authMethod,
    createdBySessionId: args.createdBySessionId ?? null,
    lastSeenAt: now,
    expiresAt,
    absoluteExpiresAt,
    revokedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  return {
    tokenValue: buildOpaqueTokenValue(token),
    sessionId: token.id,
    expiresAt,
    absoluteExpiresAt,
  };
}

export function getSessionCookieValue(request: NextRequest) {
  return request.cookies.get(AUTH_SESSION_COOKIE)?.value ?? null;
}

export async function getSessionFromTokenValue(
  tokenValue: string | null | undefined,
  options: { touch?: boolean } = {},
) {
  const parsed = parseOpaqueTokenValue(tokenValue);
  if (!parsed) {
    return null;
  }

  const row = await db.select().from(authSessions).where(eq(authSessions.id, parsed.id)).get();
  if (!row) {
    return null;
  }

  const session = normalizeSessionRow(row);
  if (session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  if (!crypto.timingSafeEqual(
    Buffer.from(row.tokenHash, "utf8"),
    Buffer.from(hashOpaqueSecret(parsed.secret), "utf8"),
  )) {
    return null;
  }

  if (options.touch !== false && shouldTouchSession(session)) {
    const nextLastSeenAt = new Date();
    const nextExpiresAt = new Date(Math.min(
      nextLastSeenAt.getTime() + AUTH_SESSION_IDLE_MS,
      session.absoluteExpiresAt.getTime(),
    ));

    await db.update(authSessions).set({
      lastSeenAt: nextLastSeenAt,
      expiresAt: nextExpiresAt,
      updatedAt: nextLastSeenAt,
    }).where(eq(authSessions.id, session.id));

    session.lastSeenAt = nextLastSeenAt;
    session.expiresAt = nextExpiresAt;
    session.updatedAt = nextLastSeenAt;
  }

  return session;
}

export async function getSessionFromRequest(request: NextRequest, options: { touch?: boolean } = {}) {
  return getSessionFromTokenValue(getSessionCookieValue(request), options);
}

export async function revokeSession(sessionId: string) {
  const revokedAt = new Date();
  await db.update(authSessions).set({
    revokedAt,
    updatedAt: revokedAt,
  }).where(eq(authSessions.id, sessionId));
}

export async function revokeAllSessions() {
  const revokedAt = new Date();
  await db.update(authSessions).set({
    revokedAt,
    updatedAt: revokedAt,
  });
}

export async function listActiveSessions() {
  const rows = await db.select().from(authSessions);
  return rows
    .map(normalizeSessionRow)
    .filter((session) => !session.revokedAt && session.expiresAt.getTime() > Date.now())
    .sort((left, right) => right.lastSeenAt.getTime() - left.lastSeenAt.getTime());
}
