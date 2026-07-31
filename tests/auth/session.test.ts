import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { authEvents, authPairTokens, authSessions } from "@/server/db/schema";
import {
  createAuthSession,
  getSessionFromTokenValue,
  listActiveSessions,
  revokeSession,
} from "@/server/auth/session";
import {
  AUTH_NATIVE_SESSION_ABSOLUTE_MS,
  AUTH_NATIVE_SESSION_IDLE_MS,
  AUTH_SESSION_ABSOLUTE_MS,
  AUTH_SESSION_IDLE_MS,
} from "@/server/auth/config";

describe("auth session persistence", () => {
  beforeEach(async () => {
    await db.delete(authEvents);
    await db.delete(authPairTokens);
    await db.delete(authSessions);
  });

  afterEach(() => {
    delete process.env.OMNIHARNESS_AUTH_PASSWORD;
    delete process.env.OMNIHARNESS_AUTH_PASSWORD_HASH;
  });

  it("creates a durable session that can be loaded from its opaque token", async () => {
    const created = await createAuthSession({
      label: "Test browser",
      userAgent: "Vitest",
      authMethod: "password_login",
    });

    const loaded = await getSessionFromTokenValue(created.tokenValue, { touch: false });

    expect(loaded).toEqual(expect.objectContaining({
      id: created.sessionId,
      label: "Test browser",
      userAgent: "Vitest",
      authMethod: "password_login",
      transport: "cookie",
      boundOrigin: null,
      clientKind: "browser",
    }));
  });

  it("persists bearer session provenance and device metadata", async () => {
    const created = await createAuthSession({
      label: "Alice's VSCode",
      userAgent: "vscode/1.120",
      authMethod: "password_login",
      transport: "bearer",
      clientKind: "native",
      boundOrigin: null,
    });

    await expect(
      getSessionFromTokenValue(created.tokenValue, { touch: false }),
    ).resolves.toEqual(expect.objectContaining({
      label: "Alice's VSCode",
      userAgent: "vscode/1.120",
      transport: "bearer",
      clientKind: "native",
      boundOrigin: null,
    }));
  });

  it("enforces both idle and absolute expiry", async () => {
    const created = await createAuthSession({
      label: "Expired absolute session",
      authMethod: "password_login",
    });
    const now = new Date();
    await db.update(authSessions).set({
      expiresAt: new Date(now.getTime() + 60_000),
      absoluteExpiresAt: new Date(now.getTime() - 1),
    });

    await expect(
      getSessionFromTokenValue(created.tokenValue, { touch: false }),
    ).resolves.toBeNull();
  });

  it("uses browser and native idle and absolute lifetimes", async () => {
    const browser = await createAuthSession({
      label: "Browser",
      authMethod: "password_login",
    });
    const native = await createAuthSession({
      label: "Native",
      authMethod: "password_login",
      transport: "bearer",
      clientKind: "native",
    });
    const [browserRow, nativeRow] = await Promise.all([
      getSessionFromTokenValue(browser.tokenValue, { touch: false }),
      getSessionFromTokenValue(native.tokenValue, { touch: false }),
    ]);

    expect(browserRow!.expiresAt.getTime() - browserRow!.createdAt.getTime()).toBe(AUTH_SESSION_IDLE_MS);
    expect(browserRow!.absoluteExpiresAt.getTime() - browserRow!.createdAt.getTime()).toBe(AUTH_SESSION_ABSOLUTE_MS);
    expect(nativeRow!.expiresAt.getTime() - nativeRow!.createdAt.getTime()).toBe(AUTH_NATIVE_SESSION_IDLE_MS);
    expect(nativeRow!.absoluteExpiresAt.getTime() - nativeRow!.createdAt.getTime()).toBe(AUTH_NATIVE_SESSION_ABSOLUTE_MS);
  });

  it("keeps at most 50 active sessions and evicts the least recently used old session", async () => {
    const first = await createAuthSession({
      label: "Least recently used",
      authMethod: "password_login",
    });
    await db.update(authSessions).set({
      lastSeenAt: new Date(Date.now() - 120_000),
    });
    for (let index = 1; index < 50; index += 1) {
      await createAuthSession({
        label: `Session ${index}`,
        authMethod: "password_login",
      });
    }
    const newest = await createAuthSession({
      label: "New session",
      authMethod: "password_login",
    });

    const active = await listActiveSessions();
    expect(active).toHaveLength(50);
    expect(active.some((session) => session.id === newest.sessionId)).toBe(true);
    expect(active.some((session) => session.id === first.sessionId)).toBe(false);
    const firstRow = await db.select().from(authSessions)
      .where(eq(authSessions.id, first.sessionId))
      .get();
    expect(firstRow?.revokedAt).toBeInstanceOf(Date);
  });

  it("keeps the session cap under concurrent successful logins", async () => {
    const created = await Promise.all(Array.from({ length: 60 }, (_, index) => (
      createAuthSession({
        label: `Concurrent ${index}`,
        authMethod: "password_login",
      })
    )));
    const active = await listActiveSessions();

    expect(active).toHaveLength(50);
    expect(active.some((session) => session.id === created.at(-1)?.sessionId)).toBe(true);
  });

  it("touches last-used timestamps at most once per minute", async () => {
    const created = await createAuthSession({
      label: "Throttled browser",
      authMethod: "password_login",
    });
    const stale = new Date(Date.now() - 61_000);
    await db.update(authSessions).set({
      lastSeenAt: stale,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const first = await getSessionFromTokenValue(created.tokenValue);
    const second = await getSessionFromTokenValue(created.tokenValue);

    expect(first).not.toBeNull();
    expect(second?.lastSeenAt.getTime()).toBe(first?.lastSeenAt.getTime());
  });

  it("rejects revoked sessions even if the opaque cookie still exists", async () => {
    const created = await createAuthSession({
      label: "Phone",
      userAgent: "Mobile Safari",
      authMethod: "qr_pair",
    });

    await revokeSession(created.sessionId);

    await expect(getSessionFromTokenValue(created.tokenValue, { touch: false })).resolves.toBeNull();
  });
});
