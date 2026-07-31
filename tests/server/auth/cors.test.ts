import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { authEvents, authPairTokens, authSessions } from "@/server/db/schema";
import { createAuthSession } from "@/server/auth/session";
import { requireApiSession } from "@/server/auth/guards";
import { createOmniHttpRegistry } from "@/runtime/http/registry";

const browserOrigin = "https://interface.example";

function createRegistry() {
  return createOmniHttpRegistry()
    .route("GET", "/api/protected", async (request) => {
      const auth = await requireApiSession(request, { action: "Test CORS" });
      return auth.response ?? Response.json(
        { error: { code: "example", message: "Example failure." } },
        { status: 409 },
      );
    }, { auth: "session", responseKind: "json" })
    .route("POST", "/api/cookie-only", () => Response.json({ ok: true }), {
      auth: "same-origin-session",
      responseKind: "json",
    });
}

describe("bearer CORS", () => {
  beforeEach(async () => {
    process.env.NODE_ENV = "test";
    process.env.OMNIHARNESS_AUTH_PASSWORD = "test-password";
    await db.delete(authEvents);
    await db.delete(authPairTokens);
    await db.delete(authSessions);
  });

  it("builds registry-driven preflight only for an exact stored browser origin", async () => {
    await createAuthSession({
      label: "Browser profile",
      authMethod: "password_login",
      transport: "bearer",
      clientKind: "browser",
      boundOrigin: browserOrigin,
    });
    const registry = createRegistry();
    const response = await registry.handle(new Request(
      "https://runner.example/api/protected",
      {
        method: "OPTIONS",
        headers: {
          origin: browserOrigin,
          "access-control-request-method": "GET",
          "access-control-request-headers": "authorization, content-type",
        },
      },
    ), { surface: "test" });

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(browserOrigin);
    expect(response.headers.get("vary")).toContain("Origin");
    expect(response.headers.get("access-control-allow-methods")).toContain("GET");
    expect(response.headers.get("access-control-allow-headers")).toBe(
      "authorization, content-type",
    );
    expect(response.headers.get("access-control-allow-credentials")).toBeNull();

    const rejected = await registry.handle(new Request(
      "https://runner.example/api/protected",
      {
        method: "OPTIONS",
        headers: {
          origin: "https://other.example",
          "access-control-request-method": "GET",
        },
      },
    ), { surface: "test" });
    expect(rejected.status).toBe(403);
    expect(rejected.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("adds CORS headers to authenticated error responses", async () => {
    const session = await createAuthSession({
      label: "Browser profile",
      authMethod: "password_login",
      transport: "bearer",
      clientKind: "browser",
      boundOrigin: browserOrigin,
    });
    const registry = createRegistry();
    const response = await registry.handle(new Request(
      "https://runner.example/api/protected",
      {
        headers: {
          origin: browserOrigin,
          authorization: `Bearer ${session.tokenValue}`,
        },
      },
    ), { surface: "test" });

    expect(response.status).toBe(409);
    expect(response.headers.get("access-control-allow-origin")).toBe(browserOrigin);
    expect(response.headers.get("vary")).toContain("Origin");
    expect(response.headers.get("access-control-allow-credentials")).toBeNull();
  });

  it("never adds bearer CORS headers to cookie-only routes", async () => {
    await createAuthSession({
      label: "Browser profile",
      authMethod: "password_login",
      transport: "bearer",
      clientKind: "browser",
      boundOrigin: browserOrigin,
    });
    const response = await createRegistry().handle(new Request(
      "https://runner.example/api/cookie-only",
      {
        method: "OPTIONS",
        headers: {
          origin: browserOrigin,
          "access-control-request-method": "POST",
        },
      },
    ), { surface: "test" });

    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });
});
