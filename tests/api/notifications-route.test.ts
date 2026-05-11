import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
  authEvents,
  authPairTokens,
  authSessions,
  notificationSubscriptions,
  settings,
} from "@/server/db/schema";
import { createAuthSession } from "@/server/auth/session";
import { DELETE, GET, POST } from "@/app/api/notifications/route";

describe("/api/notifications", () => {
  beforeEach(async () => {
    process.env.OMNIHARNESS_AUTH_PASSWORD = "swordfish";
    delete process.env.OMNIHARNESS_AUTH_PASSWORD_HASH;
    await db.delete(notificationSubscriptions);
    await db.delete(authEvents);
    await db.delete(authPairTokens);
    await db.delete(authSessions);
    await db.delete(settings);
  });

  async function makeAuthenticatedRequest(url: string, init: RequestInit = {}) {
    const session = await createAuthSession({
      label: "Notification test",
      userAgent: "Vitest",
      authMethod: "password_login",
    });
    const headers = new Headers(init.headers);
    headers.set("cookie", `omni_session=${session.tokenValue}`);
    if (init.method && init.method !== "GET") {
      headers.set("origin", "http://localhost");
    }
    const { signal, ...requestInit } = init;
    const nextRequestInit: ConstructorParameters<typeof NextRequest>[1] = { ...requestInit, headers };
    if (signal) {
      nextRequestInit.signal = signal;
    }
    return new NextRequest(url, nextRequestInit);
  }

  it("returns a stable VAPID public key for browser push subscription", async () => {
    const firstResponse = await GET(await makeAuthenticatedRequest("http://localhost/api/notifications"));
    const secondResponse = await GET(await makeAuthenticatedRequest("http://localhost/api/notifications"));

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);

    const firstPayload = await firstResponse.json();
    const secondPayload = await secondResponse.json();
    expect(firstPayload).toMatchObject({
      supported: true,
      publicKey: expect.any(String),
    });
    expect(firstPayload.publicKey).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(firstPayload.publicKey.length).toBeGreaterThan(80);
    expect(secondPayload.publicKey).toBe(firstPayload.publicKey);
  });

  it("stores and removes a push subscription for the authenticated device", async () => {
    const endpoint = "https://push.example.test/subscription/abc123";
    const subscription = {
      endpoint,
      expirationTime: null,
      keys: {
        p256dh: "p256dh-key",
        auth: "auth-secret",
      },
    };

    const saveResponse = await POST(await makeAuthenticatedRequest("http://localhost/api/notifications", {
      method: "POST",
      body: JSON.stringify({ subscription }),
    }));
    expect(saveResponse.status).toBe(200);

    const stored = await db
      .select()
      .from(notificationSubscriptions)
      .where(eq(notificationSubscriptions.endpoint, endpoint))
      .get();
    expect(stored).toMatchObject({
      endpoint,
      p256dh: "p256dh-key",
      auth: "auth-secret",
      revokedAt: null,
    });
    expect(stored?.sessionId).toEqual(expect.any(String));

    const deleteResponse = await DELETE(await makeAuthenticatedRequest("http://localhost/api/notifications", {
      method: "DELETE",
      body: JSON.stringify({ endpoint }),
    }));
    expect(deleteResponse.status).toBe(200);

    const removed = await db
      .select()
      .from(notificationSubscriptions)
      .where(eq(notificationSubscriptions.endpoint, endpoint))
      .get();
    expect(removed?.revokedAt).toBeInstanceOf(Date);
  });
});
