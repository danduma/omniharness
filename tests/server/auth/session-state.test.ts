import { beforeEach, describe, expect, it } from "vitest";
import { buildAuthSessionState } from "@/server/auth/session-state";
import { createAuthSession } from "@/server/auth/session";
import { db } from "@/server/db";
import { authSessions } from "@/server/db/schema";

describe("auth session state", () => {
  beforeEach(async () => {
    process.env.NODE_ENV = "test";
    process.env.OMNIHARNESS_AUTH_PASSWORD = "test-password";
    process.env.OMNIHARNESS_TEST_BYPASS_AUTH = "false";
    await db.delete(authSessions);
  });

  it("recognizes an origin-bound browser bearer during runtime bootstrap", async () => {
    const origin = "http://127.0.0.1:3050";
    const session = await createAuthSession({
      authMethod: "password_login",
      transport: "bearer",
      clientKind: "browser",
      boundOrigin: origin,
    });

    const state = await buildAuthSessionState({
      url: "http://127.0.0.1:4011/",
      headers: new Headers({
        authorization: `Bearer ${session.tokenValue}`,
        origin,
      }),
    });

    expect(state.authenticated).toBe(true);
    expect(state.currentSession?.id).toBe(session.sessionId);
  });

  it("does not accept the browser bearer from another origin", async () => {
    const session = await createAuthSession({
      authMethod: "password_login",
      transport: "bearer",
      clientKind: "browser",
      boundOrigin: "http://127.0.0.1:3050",
    });

    const state = await buildAuthSessionState({
      url: "http://127.0.0.1:4011/",
      headers: new Headers({
        authorization: `Bearer ${session.tokenValue}`,
        origin: "http://127.0.0.1:3051",
      }),
    });

    expect(state.authenticated).toBe(false);
    expect(state.currentSession).toBeNull();
  });
});
