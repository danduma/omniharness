import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { authEvents, authPairTokens, authSessions } from "@/server/db/schema";
import {
  authLoginRoute as loginRoute,
  authLogoutRoute as logoutRoute,
  authSessionDeleteRoute as deleteSessionRoute,
  authSessionGetRoute as getSessionRoute,
} from "@/../tests/helpers/runtime-routes";
import { resetLoginRateLimitsForTests } from "@/server/auth/rate-limit";
import { hashPasswordForTests } from "@/server/auth/password";
import {
  __resetNamedEventsForTests,
  getEventCursor,
  getNamedEventsSince,
} from "@/server/events/named-events";
import { createAuthSession, getSessionById } from "@/server/auth/session";

function readCookie(response: Response) {
  return response.headers.get("set-cookie")?.split(";")[0] ?? "";
}

describe("auth routes", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const setNodeEnv = (value: string | undefined) => {
    (process.env as Record<string, string | undefined>).NODE_ENV = value;
  };

  beforeEach(async () => {
    setNodeEnv("test");
    process.env.OMNIHARNESS_AUTH_PASSWORD = "swordfish";
    delete process.env.OMNIHARNESS_AUTH_PASSWORD_HASH;
    await db.delete(authEvents);
    await db.delete(authPairTokens);
    await db.delete(authSessions);
    resetLoginRateLimitsForTests();
    __resetNamedEventsForTests();
  });

  afterEach(() => {
    setNodeEnv(originalNodeEnv);
    delete process.env.OMNIHARNESS_AUTH_PASSWORD;
    delete process.env.OMNIHARNESS_AUTH_PASSWORD_HASH;
    delete process.env.OMNIHARNESS_PUBLIC_ORIGIN;
    resetLoginRateLimitsForTests();
  });

  it("reports unauthenticated state before login and authenticated state after login", async () => {
    const beforeResponse = await getSessionRoute(new Request("http://localhost/api/auth/session"));
    expect(beforeResponse.status).toBe(200);
    await expect(beforeResponse.json()).resolves.toEqual(expect.objectContaining({
      enabled: true,
      authenticated: false,
    }));

    const loginResponse = await loginRoute(new Request("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ password: "swordfish" }),
      headers: {
        origin: "http://localhost",
        "content-type": "application/json",
      },
    }));

    expect(loginResponse.status).toBe(200);
    const cookie = readCookie(loginResponse);
    expect(cookie).toContain("omni_session=");

    const afterResponse = await getSessionRoute(new Request("http://localhost/api/auth/session", {
      headers: {
        cookie,
      },
    }));

    expect(afterResponse.status).toBe(200);
    await expect(afterResponse.json()).resolves.toEqual(expect.objectContaining({
      enabled: true,
      authenticated: true,
      currentSession: expect.objectContaining({
        authMethod: "password_login",
      }),
    }));
  });

  it("reports the configured public origin for frontend pairing links", async () => {
    process.env.OMNIHARNESS_PUBLIC_ORIGIN = "https://pair.example.test/";

    const response = await getSessionRoute(new Request("http://localhost/api/auth/session"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({
      publicOrigin: "https://pair.example.test",
    }));
  });

  it("logs out the current session and clears the cookie", async () => {
    const loginResponse = await loginRoute(new Request("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ password: "swordfish" }),
      headers: {
        origin: "http://localhost",
        "content-type": "application/json",
      },
    }));
    const cookie = readCookie(loginResponse);

    const logoutResponse = await logoutRoute(new Request("http://localhost/api/auth/logout", {
      method: "POST",
      headers: {
        cookie,
        origin: "http://localhost",
      },
    }));

    expect(logoutResponse.status).toBe(200);
    expect(logoutResponse.headers.get("set-cookie")).toContain("omni_session=");

    const afterResponse = await getSessionRoute(new Request("http://localhost/api/auth/session", {
      headers: {
        cookie,
      },
    }));
    await expect(afterResponse.json()).resolves.toEqual(expect.objectContaining({
      authenticated: false,
    }));
  });

  it("can revoke all sessions through the session endpoint", async () => {
    const loginResponse = await loginRoute(new Request("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ password: "swordfish" }),
      headers: {
        origin: "http://localhost",
        "content-type": "application/json",
      },
    }));
    const cookie = readCookie(loginResponse);

    const revokeResponse = await deleteSessionRoute(new Request("http://localhost/api/auth/session", {
      method: "DELETE",
      headers: {
        cookie,
        origin: "http://localhost",
        "content-type": "application/json",
      },
      body: JSON.stringify({ all: true }),
    }));

    expect(revokeResponse.status).toBe(200);
    const sessions = await db.select().from(authSessions);
    expect(sessions.every((session) => session.revokedAt)).toBe(true);
  });

  it("lists browser bearer sessions and immediately revokes a selected session", async () => {
    const origin = "https://interface.example.test";
    const admin = await createAuthSession({
      label: "Interface",
      authMethod: "password_login",
      transport: "bearer",
      clientKind: "browser",
      boundOrigin: origin,
    });
    const target = await createAuthSession({
      label: "Phone",
      authMethod: "password_login",
      transport: "bearer",
      clientKind: "native",
    });
    const headers = {
      authorization: `Bearer ${admin.tokenValue}`,
      origin,
    };
    const listResponse = await getSessionRoute(new Request(
      "https://runner.example.test/api/auth/session",
      { headers },
    ));
    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toEqual(expect.objectContaining({
      authenticated: true,
      currentSession: expect.objectContaining({ id: admin.sessionId }),
      sessions: expect.arrayContaining([
        expect.objectContaining({ id: target.sessionId }),
      ]),
    }));

    const cursor = getEventCursor();
    const revokeResponse = await deleteSessionRoute(new Request(
      "https://runner.example.test/api/auth/session",
      {
        method: "DELETE",
        headers: {
          ...headers,
          "content-type": "application/json",
        },
        body: JSON.stringify({ sessionId: target.sessionId }),
      },
    ));
    expect(revokeResponse.status).toBe(200);
    await expect(getSessionById(target.sessionId, { touch: false })).resolves.toBeNull();
    expect(getNamedEventsSince(cursor).events.map((entry) => entry.event)).toContainEqual({
      kind: "auth.session_revoked",
      sessionId: target.sessionId,
      reason: "revoked",
    });
  });

  it("reports a configuration error whenever auth credentials are not configured", async () => {
    setNodeEnv("test");
    delete process.env.OMNIHARNESS_AUTH_PASSWORD;
    delete process.env.OMNIHARNESS_AUTH_PASSWORD_HASH;

    const sessionResponse = await getSessionRoute(new Request("http://localhost/api/auth/session"));
    expect(sessionResponse.status).toBe(200);
    await expect(sessionResponse.json()).resolves.toEqual(expect.objectContaining({
      enabled: true,
      authenticated: false,
      configurationError: expect.stringContaining("OMNIHARNESS_AUTH_PASSWORD"),
    }));

    const loginResponse = await loginRoute(new Request("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ password: "anything" }),
      headers: {
        origin: "http://localhost",
        "content-type": "application/json",
      },
    }));

    expect(loginResponse.status).toBe(503);
    await expect(loginResponse.json()).resolves.toEqual({
      error: expect.objectContaining({
        source: "Auth",
        action: "Log in",
        message: expect.stringContaining("OMNIHARNESS_AUTH_PASSWORD"),
      }),
    });
  });

  it("reports malformed password hashes as configuration errors", async () => {
    delete process.env.OMNIHARNESS_AUTH_PASSWORD;
    process.env.OMNIHARNESS_AUTH_PASSWORD_HASH = "v=19$m=19456,t=2,p=1$bad";

    const loginResponse = await loginRoute(new Request("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ password: "anything" }),
      headers: {
        origin: "http://localhost",
        "content-type": "application/json",
      },
    }));

    expect(loginResponse.status).toBe(503);
    await expect(loginResponse.json()).resolves.toEqual({
      error: expect.objectContaining({
        source: "Auth",
        action: "Log in",
        message: expect.stringContaining("OMNIHARNESS_AUTH_PASSWORD_HASH"),
      }),
    });
  });

  it("accepts dotenv-escaped Argon2 password hashes", async () => {
    delete process.env.OMNIHARNESS_AUTH_PASSWORD;
    process.env.OMNIHARNESS_AUTH_PASSWORD_HASH = (await hashPasswordForTests("escaped-secret")).replace(/\$/g, "\\$");

    const loginResponse = await loginRoute(new Request("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ password: "escaped-secret" }),
      headers: {
        origin: "http://localhost",
        "content-type": "application/json",
      },
    }));

    expect(loginResponse.status).toBe(200);
  });

  it("locks out repeated failed password attempts and does not verify the password during lockout", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await loginRoute(new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ password: "wrong-password" }),
        headers: {
          origin: "http://localhost",
          "content-type": "application/json",
          "x-forwarded-for": "203.0.113.10",
        },
      }));
      expect(response.status).toBe(401);
    }

    const lockedResponse = await loginRoute(new Request("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ password: "swordfish" }),
      headers: {
        origin: "http://localhost",
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.10",
      },
    }));

    expect(lockedResponse.status).toBe(429);
    expect(lockedResponse.headers.get("retry-after")).toBeTruthy();
    await expect(lockedResponse.json()).resolves.toEqual({
      error: expect.objectContaining({
        message: expect.stringContaining("Too many login attempts"),
      }),
    });
  });

  it("logs successful password logins with request metadata", async () => {
    process.env.OMNIHARNESS_TRUSTED_PROXIES = "localhost";
    const loginResponse = await loginRoute(new Request("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ password: "swordfish", label: "Desktop" }),
      headers: {
        origin: "http://localhost",
        "content-type": "application/json",
        "user-agent": "Vitest Browser",
        "x-forwarded-for": "198.51.100.24",
        "x-forwarded-proto": "https",
      },
    }));

    expect(loginResponse.status).toBe(200);

    const events = await db.select().from(authEvents);
    expect(events).toContainEqual(expect.objectContaining({
      eventType: "auth.login_succeeded",
    }));
    const success = events.find((event) => event.eventType === "auth.login_succeeded");
    expect(JSON.parse(success?.details ?? "{}")).toEqual(expect.objectContaining({
      label: "Desktop",
      ipAddress: "198.51.100.24",
      userAgent: "Vitest Browser",
    }));
    delete process.env.OMNIHARNESS_TRUSTED_PROXIES;
  });
});
