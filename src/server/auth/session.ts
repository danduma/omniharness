import crypto from "crypto";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { authSessions } from "@/server/db/schema";
import {
  AUTH_SESSION_ABSOLUTE_MS,
  AUTH_SESSION_COOKIE,
  AUTH_SESSION_IDLE_MS,
  AUTH_NATIVE_SESSION_ABSOLUTE_MS,
  AUTH_NATIVE_SESSION_IDLE_MS,
  getAuthKey,
} from "@/server/auth/config";
import { insertAuthEvent } from "@/server/auth/audit";
import { emitNamedEvent } from "@/server/events/named-events";
import { announceAuthSessionRevocation } from "@/server/auth/session-revocation";

export const MAX_ACTIVE_AUTH_SESSIONS = 50;

let sessionCreationQueue = Promise.resolve();

async function withSessionCreationLock<T>(operation: () => Promise<T>) {
  const previous = sessionCreationQueue;
  let release!: () => void;
  sessionCreationQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await operation();
  } finally {
    release();
  }
}

export type AuthMethod = "password_login" | "qr_pair";
export type AuthSessionTransport = "cookie" | "bearer";
export type AuthSessionClientKind = "browser" | "native";

export interface ActiveAuthSession {
  id: string;
  label: string | null;
  userAgent: string | null;
  authMethod: string;
  transport: AuthSessionTransport;
  boundOrigin: string | null;
  clientKind: AuthSessionClientKind;
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
    id: row.id,
    label: row.label,
    userAgent: row.userAgent,
    authMethod: row.authMethod,
    transport: row.transport as AuthSessionTransport,
    boundOrigin: row.boundOrigin,
    clientKind: row.clientKind as AuthSessionClientKind,
    createdBySessionId: row.createdBySessionId,
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

function currentTimestamp() {
  return new Date(Math.floor(Date.now() / 1000) * 1000);
}

export async function createAuthSession(args: {
  label?: string | null;
  userAgent?: string | null;
  authMethod: AuthMethod;
  transport?: AuthSessionTransport;
  boundOrigin?: string | null;
  clientKind?: AuthSessionClientKind;
  createdBySessionId?: string | null;
}) {
  return withSessionCreationLock(async () => {
    const token = createOpaqueToken();
    const now = currentTimestamp();
    const clientKind = args.clientKind ?? "browser";
    const idleMs = clientKind === "native"
      ? AUTH_NATIVE_SESSION_IDLE_MS
      : AUTH_SESSION_IDLE_MS;
    const absoluteMs = clientKind === "native"
      ? AUTH_NATIVE_SESSION_ABSOLUTE_MS
      : AUTH_SESSION_ABSOLUTE_MS;
    const expiresAt = new Date(now.getTime() + idleMs);
    const absoluteExpiresAt = new Date(now.getTime() + absoluteMs);

    await db.insert(authSessions).values({
      id: token.id,
      tokenHash: hashOpaqueSecret(token.secret),
      label: args.label?.trim() || null,
      userAgent: args.userAgent?.trim() || null,
      authMethod: args.authMethod,
      transport: args.transport ?? "cookie",
      boundOrigin: args.boundOrigin?.trim() || null,
      clientKind,
      createdBySessionId: args.createdBySessionId ?? null,
      lastSeenAt: now,
      expiresAt,
      absoluteExpiresAt,
      revokedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    await enforceActiveSessionLimit(token.id, now);

    return {
      tokenValue: buildOpaqueTokenValue(token),
      sessionId: token.id,
      expiresAt,
      absoluteExpiresAt,
    };
  });
}

async function enforceActiveSessionLimit(newSessionId: string, now: Date) {
  const active = (await db.select().from(authSessions))
    .map(normalizeSessionRow)
    .filter((session) => (
      session.id !== newSessionId
      && !session.revokedAt
      && session.expiresAt.getTime() > now.getTime()
      && session.absoluteExpiresAt.getTime() > now.getTime()
    ))
    .sort((left, right) => (
      left.lastSeenAt.getTime() - right.lastSeenAt.getTime()
      || left.createdAt.getTime() - right.createdAt.getTime()
      || left.id.localeCompare(right.id)
    ));
  const excess = Math.max(0, active.length + 1 - MAX_ACTIVE_AUTH_SESSIONS);
  for (const session of active.slice(0, excess)) {
    const revokedAt = currentTimestamp();
    await db.update(authSessions).set({
      revokedAt,
      updatedAt: revokedAt,
    }).where(eq(authSessions.id, session.id));
    announceAuthSessionRevocation({
      sessionIds: [session.id],
      reason: "lru_evicted",
    });
    await insertAuthEvent({
      eventType: "auth.session_evicted",
      sessionId: session.id,
      details: { reason: "lru", replacementSessionId: newSessionId },
    });
    emitNamedEvent({
      kind: "auth.session_revoked",
      sessionId: session.id,
      reason: "lru_evicted",
    });
  }
}

export function getSessionCookieValue(request: Request) {
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
  if (
    session.revokedAt
    || session.expiresAt.getTime() <= Date.now()
    || session.absoluteExpiresAt.getTime() <= Date.now()
  ) {
    return null;
  }

  if (!crypto.timingSafeEqual(
    Buffer.from(row.tokenHash, "utf8"),
    Buffer.from(hashOpaqueSecret(parsed.secret), "utf8"),
  )) {
    return null;
  }

  if (options.touch !== false && shouldTouchSession(session)) {
    const nextLastSeenAt = currentTimestamp();
    const idleMs = session.clientKind === "native"
      ? AUTH_NATIVE_SESSION_IDLE_MS
      : AUTH_SESSION_IDLE_MS;
    const nextExpiresAt = new Date(Math.min(
      nextLastSeenAt.getTime() + idleMs,
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

export async function getSessionById(
  sessionId: string,
  options: { touch?: boolean } = {},
) {
  const row = await db.select().from(authSessions)
    .where(eq(authSessions.id, sessionId))
    .get();
  if (!row) {
    return null;
  }
  const session = normalizeSessionRow(row);
  if (
    session.revokedAt
    || session.expiresAt.getTime() <= Date.now()
    || session.absoluteExpiresAt.getTime() <= Date.now()
  ) {
    return null;
  }
  if (options.touch !== false && shouldTouchSession(session)) {
    const nextLastSeenAt = currentTimestamp();
    const idleMs = session.clientKind === "native"
      ? AUTH_NATIVE_SESSION_IDLE_MS
      : AUTH_SESSION_IDLE_MS;
    const nextExpiresAt = new Date(Math.min(
      nextLastSeenAt.getTime() + idleMs,
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

export async function getSessionFromRequest(request: Request, options: { touch?: boolean } = {}) {
  return getSessionFromTokenValue(getSessionCookieValue(request), options);
}

export async function revokeSession(
  sessionId: string,
  reason: "revoked" | "lru_evicted" | "password_rotated" = "revoked",
) {
  const revokedAt = new Date();
  await db.update(authSessions).set({
    revokedAt,
    updatedAt: revokedAt,
  }).where(eq(authSessions.id, sessionId));
  announceAuthSessionRevocation({ sessionIds: [sessionId], reason });
  emitNamedEvent({ kind: "auth.session_revoked", sessionId, reason });
}

export async function revokeAllSessions(
  reason: "revoked_all" | "password_rotated" = "revoked_all",
) {
  const revokedAt = new Date();
  const activeIds = (await listActiveSessions()).map((session) => session.id);
  await db.update(authSessions).set({
    revokedAt,
    updatedAt: revokedAt,
  });
  announceAuthSessionRevocation({ sessionIds: null, reason });
  emitNamedEvent({
    kind: "auth.sessions_revoked",
    reason,
    count: activeIds.length,
  });
}

export async function listActiveSessions() {
  const rows = await db.select().from(authSessions);
  return rows
    .map(normalizeSessionRow)
    .filter((session) => (
      !session.revokedAt
      && session.expiresAt.getTime() > Date.now()
      && session.absoluteExpiresAt.getTime() > Date.now()
    ))
    .sort((left, right) => right.lastSeenAt.getTime() - left.lastSeenAt.getTime());
}
