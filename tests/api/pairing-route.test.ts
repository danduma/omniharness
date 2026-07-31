import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { authEvents, authPairTokens, authSessions } from "@/server/db/schema";
import { createAuthSession } from "@/server/auth/session";
import {
  authPairCreateRoute as pairCreateRoute,
  authPairRedeemRoute as pairRedeemRoute,
  authPairStatusRoute as pairStatusRoute,
} from "@/../tests/helpers/runtime-routes";

function makeCookie(tokenValue: string) {
  return `omni_session=${tokenValue}`;
}

describe("pairing routes", () => {
  beforeEach(async () => {
    process.env.OMNIHARNESS_AUTH_PASSWORD = "swordfish";
    delete process.env.OMNIHARNESS_AUTH_PASSWORD_HASH;
    delete process.env.OMNIHARNESS_PUBLIC_ORIGIN;
    delete process.env.OMNIHARNESS_TRUSTED_PROXIES;
    await db.delete(authEvents);
    await db.delete(authPairTokens);
    await db.delete(authSessions);
  });

  it("creates a pairing link and redeems it into a durable mobile session", async () => {
    const desktop = await createAuthSession({
      label: "Desktop",
      userAgent: "Desktop browser",
      authMethod: "password_login",
    });

    const createResponse = await pairCreateRoute(new Request("http://localhost/api/auth/pair", {
      method: "POST",
      headers: {
        cookie: makeCookie(desktop.tokenValue),
        origin: "http://localhost",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        targetRunId: "run-xyz",
        deviceLabel: "My phone",
      }),
    }));

    expect(createResponse.status).toBe(200);
    const createdPayload = await createResponse.json();
    const pairUrl = new URL(createdPayload.pairUrl);
    const pairToken = pairUrl.searchParams.get("pair");
    expect(pairToken).toBeTruthy();

    const redeemResponse = await pairRedeemRoute(new Request("http://localhost/api/auth/pair/redeem", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        pairToken,
      }),
    }));

    expect(redeemResponse.status).toBe(200);
    expect(redeemResponse.headers.get("set-cookie")).toContain("omni_session=");
    await expect(redeemResponse.json()).resolves.toEqual(expect.objectContaining({
      ok: true,
      targetPath: "/session/run-xyz",
    }));

    const statusResponse = await pairStatusRoute(new Request(`http://localhost/api/auth/pair?id=${encodeURIComponent(createdPayload.pairingId)}`, {
      headers: {
        cookie: makeCookie(desktop.tokenValue),
      },
    }));

    expect(statusResponse.status).toBe(200);
    await expect(statusResponse.json()).resolves.toEqual(expect.objectContaining({
      pairing: expect.objectContaining({
        status: "redeemed",
      }),
    }));
  });

  it("uses the forwarded public origin for pairing links behind ngrok", async () => {
    process.env.OMNIHARNESS_TRUSTED_PROXIES = "0.0.0.0";
    const desktop = await createAuthSession({
      label: "Desktop",
      userAgent: "Desktop browser",
      authMethod: "password_login",
    });

    const createResponse = await pairCreateRoute(new Request("http://0.0.0.0:3050/api/auth/pair", {
      method: "POST",
      headers: {
        cookie: makeCookie(desktop.tokenValue),
        host: "localhost:3050",
        origin: "https://unsuspecting-lauri-unproscribable.ngrok-free.dev",
        "x-forwarded-host": "unsuspecting-lauri-unproscribable.ngrok-free.dev",
        "x-forwarded-proto": "https",
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    }));

    expect(createResponse.status).toBe(200);
    const createdPayload = await createResponse.json();
    expect(new URL(createdPayload.pairUrl).origin).toBe("https://unsuspecting-lauri-unproscribable.ngrok-free.dev");
  });

  it("registers a browser-generated pairing token so the QR can render before the server round trip finishes", async () => {
    const desktop = await createAuthSession({
      label: "Desktop",
      userAgent: "Desktop browser",
      authMethod: "password_login",
    });
    const browserPairToken = "11111111-1111-4111-8111-111111111111.browser-generated-secret";

    const createResponse = await pairCreateRoute(new Request("http://localhost/api/auth/pair", {
      method: "POST",
      headers: {
        cookie: makeCookie(desktop.tokenValue),
        origin: "http://localhost",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        targetRunId: "run-browser",
        pairToken: browserPairToken,
      }),
    }));

    expect(createResponse.status).toBe(200);
    const createdPayload = await createResponse.json();
    expect(new URL(createdPayload.pairUrl).searchParams.get("pair")).toBe(browserPairToken);

    const redeemResponse = await pairRedeemRoute(new Request("http://localhost/api/auth/pair/redeem", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        pairToken: browserPairToken,
      }),
    }));

    expect(redeemResponse.status).toBe(200);
    await expect(redeemResponse.json()).resolves.toEqual(expect.objectContaining({
      ok: true,
      targetPath: "/session/run-browser",
      pairingId: "11111111-1111-4111-8111-111111111111",
    }));
  });

  it("rejects reusing the same pairing token twice", async () => {
    const desktop = await createAuthSession({
      label: "Desktop",
      userAgent: "Desktop browser",
      authMethod: "password_login",
    });

    const createResponse = await pairCreateRoute(new Request("http://localhost/api/auth/pair", {
      method: "POST",
      headers: {
        cookie: makeCookie(desktop.tokenValue),
        origin: "http://localhost",
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    }));
    const createdPayload = await createResponse.json();
    const pairToken = new URL(createdPayload.pairUrl).searchParams.get("pair");

    await pairRedeemRoute(new Request("http://localhost/api/auth/pair/redeem", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ pairToken }),
    }));

    const secondRedeem = await pairRedeemRoute(new Request("http://localhost/api/auth/pair/redeem", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ pairToken }),
    }));

    expect(secondRedeem.status).toBe(400);
    await expect(secondRedeem.json()).resolves.toEqual({
      error: expect.objectContaining({
        source: "Auth",
        action: "Redeem pairing token",
      }),
    });
  });
});
