import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { authEvents, authPairTokens, authSessions } from "@/server/db/schema";
import { createAuthSession, getSessionFromTokenValue, revokeSession } from "@/server/auth/session";

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
    }));
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
