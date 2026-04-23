import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { authEvents, authPairTokens, authSessions } from "@/server/db/schema";
import { GET as getSessionRoute, DELETE as deleteSessionRoute } from "@/app/api/auth/session/route";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { POST as logoutRoute } from "@/app/api/auth/logout/route";

function readCookie(response: Response) {
  return response.headers.get("set-cookie")?.split(";")[0] ?? "";
}

describe("auth routes", () => {
  beforeEach(async () => {
    process.env.OMNIHARNESS_AUTH_PASSWORD = "swordfish";
    delete process.env.OMNIHARNESS_AUTH_PASSWORD_HASH;
    await db.delete(authEvents);
    await db.delete(authPairTokens);
    await db.delete(authSessions);
  });

  afterEach(() => {
    delete process.env.OMNIHARNESS_AUTH_PASSWORD;
    delete process.env.OMNIHARNESS_AUTH_PASSWORD_HASH;
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
});
