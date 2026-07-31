import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { authEvents, authPairTokens, authSessions } from "@/server/db/schema";
import {
  BrowserAuthorizationCodeManager,
  createS256Challenge,
  validateBrowserAuthorizationRequest,
} from "@/server/auth/browser-authorization";
import {
  handleBrowserAuthorizationApproveRequest,
  handleBrowserAuthorizationExchangeRequest,
} from "@/runtime/http/routes/auth-browser-authorization";

const verifier = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_abc";
const state = "state_abcdefghijklmnopqrstuvwxyz_0123456789_ABCDEF";
const origin = "https://interface.example";

describe("browser authorization PKCE", () => {
  beforeEach(async () => {
    process.env.NODE_ENV = "test";
    process.env.OMNIHARNESS_AUTH_PASSWORD = "swordfish";
    await db.delete(authEvents);
    await db.delete(authPairTokens);
    await db.delete(authSessions);
  });

  it("accepts only exact HTTPS or loopback HTTP origins and S256-safe inputs", () => {
    const challenge = createS256Challenge(verifier);
    expect(validateBrowserAuthorizationRequest({
      origin,
      state,
      challenge,
      method: "S256",
    })).toEqual({
      origin,
      state,
      challenge,
      method: "S256",
    });
    expect(() => validateBrowserAuthorizationRequest({
      origin: "http://interface.example",
      state,
      challenge,
      method: "S256",
    })).toThrow(/origin/i);
    expect(() => validateBrowserAuthorizationRequest({
      origin: "http://127.0.0.1:5173",
      state,
      challenge,
      method: "plain",
    })).toThrow(/S256/);
    expect(() => validateBrowserAuthorizationRequest({
      origin: "https://interface.example/path",
      state,
      challenge,
      method: "S256",
    })).toThrow(/exact origin/i);
  });

  it("binds codes to state, origin, verifier, expiry, and atomic single use", () => {
    let now = 1_000;
    const manager = new BrowserAuthorizationCodeManager({
      now: () => now,
      randomBytes: () => Buffer.alloc(32, 7),
    });
    const challenge = createS256Challenge(verifier);
    const approved = manager.approve({
      origin,
      state,
      challenge,
      method: "S256",
    });

    expect(() => manager.consume({
      code: approved.code,
      verifier,
      state: `${state}x`,
      origin,
    })).toThrow(/state/i);
    expect(() => manager.consume({
      code: approved.code,
      verifier,
      state,
      origin,
    })).toThrow(/invalid or already used/i);

    const second = manager.approve({
      origin,
      state,
      challenge,
      method: "S256",
    });
    now += 60_001;
    expect(() => manager.consume({
      code: second.code,
      verifier,
      state,
      origin,
    })).toThrow(/expired/i);
  });

  it("approves with the shared password and exchanges once for an origin-bound browser bearer", async () => {
    const challenge = createS256Challenge(verifier);
    const approval = await handleBrowserAuthorizationApproveRequest(
      new Request("http://127.0.0.1:3050/api/auth/browser-authorization/approve", {
        method: "POST",
        headers: {
          origin: "http://127.0.0.1:3050",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          password: "swordfish",
          approved: true,
          origin,
          state,
          challenge,
          method: "S256",
        }),
      }),
      { surface: "test" },
    );
    expect(approval.status).toBe(200);
    const approvalPayload = await approval.json() as { code: string; state: string };
    expect(approvalPayload.code).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    expect(approvalPayload.state).toBe(state);

    const exchangeRequest = () => new Request(
      "http://127.0.0.1:3050/api/auth/browser-authorization/exchange",
      {
        method: "POST",
        headers: {
          origin,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          code: approvalPayload.code,
          verifier,
          state,
          origin,
          clientLabel: "Web profile",
        }),
      },
    );
    const exchange = await handleBrowserAuthorizationExchangeRequest(
      exchangeRequest(),
      { surface: "test" },
    );
    expect(exchange.status).toBe(200);
    expect(exchange.headers.get("access-control-allow-origin")).toBe(origin);
    expect(exchange.headers.get("vary")).toContain("Origin");
    expect(exchange.headers.get("access-control-allow-credentials")).toBeNull();
    const exchangePayload = await exchange.json() as Record<string, unknown>;
    expect(exchangePayload.token).toEqual(expect.any(String));
    expect(exchangePayload).not.toHaveProperty("password");
    expect(exchangePayload).not.toHaveProperty("verifier");

    const sessionRows = await db.select().from(authSessions);
    expect(sessionRows).toContainEqual(expect.objectContaining({
      transport: "bearer",
      clientKind: "browser",
      boundOrigin: origin,
      label: "Web profile",
    }));

    const replay = await handleBrowserAuthorizationExchangeRequest(
      exchangeRequest(),
      { surface: "test" },
    );
    expect(replay.status).toBe(400);
    expect(JSON.stringify(await db.select().from(authEvents))).not.toContain(
      approvalPayload.code,
    );
  });

  it("supports preflight only while that origin has an approved code", async () => {
    const manager = new BrowserAuthorizationCodeManager();
    const challenge = createS256Challenge(verifier);
    manager.approve({ origin, state, challenge, method: "S256" });

    expect(manager.hasPendingOrigin(origin)).toBe(true);
    expect(manager.hasPendingOrigin("https://other.example")).toBe(false);
  });
});
