import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { authEvents, authPairTokens, authSessions } from "@/server/db/schema";
import { handleAuthLoginRequest } from "@/runtime/http/routes/auth-login";
import {
  __resetApiSessionCacheForTests,
  requireApiSession,
} from "@/server/auth/guards";
import { resetLoginRateLimitsForTests } from "@/server/auth/rate-limit";

function nativeLogin(headers: Record<string, string> = {}) {
  return handleAuthLoginRequest(
    new Request("http://127.0.0.1:3050/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...headers,
      },
      body: JSON.stringify({
        password: "swordfish",
        tokenTransport: "bearer",
        clientLabel: "Test native client",
      }),
    }),
    { surface: "test" },
  );
}

describe("native password login", () => {
  beforeEach(async () => {
    process.env.NODE_ENV = "test";
    process.env.OMNIHARNESS_AUTH_PASSWORD = "swordfish";
    delete process.env.OMNIHARNESS_AUTH_PASSWORD_HASH;
    resetLoginRateLimitsForTests();
    __resetApiSessionCacheForTests();
    await db.delete(authEvents);
    await db.delete(authPairTokens);
    await db.delete(authSessions);
  });

  it("issues an originless native bearer session without setting a cookie", async () => {
    const response = await nativeLogin();
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    const payload = await response.json() as Record<string, unknown>;
    expect(payload.token).toEqual(expect.any(String));
    expect(payload).not.toHaveProperty("password");

    const rows = await db.select().from(authSessions);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      label: "Test native client",
      transport: "bearer",
      clientKind: "native",
      boundOrigin: null,
    });
    const events = await db.select().from(authEvents);
    expect(JSON.stringify(events)).not.toContain("swordfish");
  });

  it.each([
    ["origin", "https://app.example"],
    ["referer", "https://app.example/"],
    ["sec-fetch-site", "cross-site"],
  ])("rejects native login carrying %s", async (header, value) => {
    const response = await nativeLogin({ [header]: value });
    expect(response.status).toBe(403);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("refuses plaintext login from a non-loopback client", async () => {
    const response = await handleAuthLoginRequest(
      new Request("http://192.168.1.20:3050/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          password: "swordfish",
          tokenTransport: "bearer",
        }),
      }),
      { surface: "test" },
    );
    expect(response.status).toBe(403);
  });

  it("rejects a native bearer session when a later request carries Origin", async () => {
    const login = await nativeLogin();
    const { token } = await login.json() as { token: string };
    const result = await requireApiSession(new Request(
      "http://127.0.0.1:3050/api/settings",
      {
        headers: {
          authorization: `Bearer ${token}`,
          origin: "https://app.example",
        },
      },
    ), { action: "Load settings" });

    expect(result.session).toBeNull();
    expect(result.response?.status).toBe(403);
  });

  it("never accepts a cookie session as bearer or a bearer session as cookie", async () => {
    const cookieLogin = await handleAuthLoginRequest(
      new Request("http://127.0.0.1:3050/api/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://127.0.0.1:3050",
        },
        body: JSON.stringify({ password: "swordfish" }),
      }),
      { surface: "test" },
    );
    const cookieToken = cookieLogin.headers.get("set-cookie")
      ?.match(/omni_session=([^;]+)/)?.[1];
    expect(cookieToken).toBeTruthy();
    const cookieAsBearer = await requireApiSession(new Request(
      "http://127.0.0.1:3050/api/settings",
      { headers: { authorization: `Bearer ${cookieToken}` } },
    ), { action: "Load settings" });
    expect(cookieAsBearer.response?.status).toBe(401);

    const bearerLogin = await nativeLogin();
    const { token } = await bearerLogin.json() as { token: string };
    const bearerAsCookie = await requireApiSession(new Request(
      "http://127.0.0.1:3050/api/settings",
      { headers: { cookie: `omni_session=${token}` } },
    ), { action: "Load settings" });
    expect(bearerAsCookie.response?.status).toBe(401);
  });
});
