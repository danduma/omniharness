import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { authEvents, authPairTokens, authSessions } from "@/server/db/schema";
import { GET as getSessionRoute, DELETE as deleteSessionRoute } from "@/app/api/auth/session/route";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { POST as logoutRoute } from "@/app/api/auth/logout/route";
import { resetLoginRateLimitsForTests } from "@/server/auth/rate-limit";

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
  });

  afterEach(() => {
    setNodeEnv(originalNodeEnv);
    delete process.env.OMNIHARNESS_AUTH_PASSWORD;
    delete process.env.OMNIHARNESS_AUTH_PASSWORD_HASH;
    resetLoginRateLimitsForTests();
  });

  it("reports unauthenticated state before login and authenticated state after login", async () => {
    const beforeResponse = await getSessionRoute(new NextRequest("http://localhost/api/auth/session"));
    expect(beforeResponse.status).toBe(200);
    await expect(beforeResponse.json()).resolves.toEqual(expect.objectContaining({
      enabled: true,
      authenticated: false,
    }));

    const loginResponse = await loginRoute(new NextRequest("http://localhost/api/auth/login", {
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

    const afterResponse = await getSessionRoute(new NextRequest("http://localhost/api/auth/session", {
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

  it("logs out the current session and clears the cookie", async () => {
    const loginResponse = await loginRoute(new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ password: "swordfish" }),
      headers: {
        origin: "http://localhost",
        "content-type": "application/json",
      },
    }));
    const cookie = readCookie(loginResponse);

    const logoutResponse = await logoutRoute(new NextRequest("http://localhost/api/auth/logout", {
      method: "POST",
      headers: {
        cookie,
        origin: "http://localhost",
      },
    }));

    expect(logoutResponse.status).toBe(200);
    expect(logoutResponse.headers.get("set-cookie")).toContain("omni_session=");

    const afterResponse = await getSessionRoute(new NextRequest("http://localhost/api/auth/session", {
      headers: {
        cookie,
      },
    }));
    await expect(afterResponse.json()).resolves.toEqual(expect.objectContaining({
      authenticated: false,
    }));
  });

  it("can revoke all sessions through the session endpoint", async () => {
    const loginResponse = await loginRoute(new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ password: "swordfish" }),
      headers: {
        origin: "http://localhost",
        "content-type": "application/json",
      },
    }));
    const cookie = readCookie(loginResponse);

    const revokeResponse = await deleteSessionRoute(new NextRequest("http://localhost/api/auth/session", {
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

  it("reports a configuration error whenever auth credentials are not configured", async () => {
    setNodeEnv("test");
    delete process.env.OMNIHARNESS_AUTH_PASSWORD;
    delete process.env.OMNIHARNESS_AUTH_PASSWORD_HASH;

    const sessionResponse = await getSessionRoute(new NextRequest("http://localhost/api/auth/session"));
    expect(sessionResponse.status).toBe(200);
    await expect(sessionResponse.json()).resolves.toEqual(expect.objectContaining({
      enabled: true,
      authenticated: false,
      configurationError: expect.stringContaining("OMNIHARNESS_AUTH_PASSWORD"),
    }));

    const loginResponse = await loginRoute(new NextRequest("http://localhost/api/auth/login", {
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

  it("locks out repeated failed password attempts and does not verify the password during lockout", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await loginRoute(new NextRequest("http://localhost/api/auth/login", {
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

    const lockedResponse = await loginRoute(new NextRequest("http://localhost/api/auth/login", {
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
    const loginResponse = await loginRoute(new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ password: "swordfish", label: "Desktop" }),
      headers: {
        origin: "http://localhost",
        "content-type": "application/json",
        "user-agent": "Vitest Browser",
        "x-forwarded-for": "198.51.100.24",
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
  });
});
