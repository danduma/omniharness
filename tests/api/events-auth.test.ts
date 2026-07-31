import { afterEach, describe, expect, it } from "vitest";
import { eventsRoute as GET } from "@/../tests/helpers/runtime-routes";
import { createAuthSession } from "@/server/auth/session";
import { announceAuthSessionRevocation } from "@/server/auth/session-revocation";
import { streamTicketManager } from "@/server/auth/stream-tickets";

describe("GET /api/events auth", () => {
  afterEach(() => {
    delete process.env.OMNIHARNESS_AUTH_PASSWORD;
    delete process.env.OMNIHARNESS_AUTH_PASSWORD_HASH;
  });

  it("rejects unauthenticated event streams when auth is enabled", async () => {
    process.env.OMNIHARNESS_AUTH_PASSWORD = "swordfish";
    delete process.env.OMNIHARNESS_TEST_BYPASS_AUTH;

    const response = await GET(new Request("http://localhost/api/events"));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: expect.objectContaining({
        source: "Events",
        action: "Stream live updates",
        message: "Authentication required.",
      }),
    });
  });

  it("sends a typed final frame when the stream's browser session is revoked", async () => {
    process.env.OMNIHARNESS_AUTH_PASSWORD = "swordfish";
    process.env.OMNIHARNESS_TEST_BYPASS_AUTH = "false";
    const origin = "http://127.0.0.1:3050";
    const session = await createAuthSession({
      authMethod: "password_login",
      transport: "bearer",
      clientKind: "browser",
      boundOrigin: origin,
    });
    const issued = streamTicketManager.issue({
      sessionId: session.sessionId,
      path: "/api/events",
      origin,
    });
    const response = await GET(new Request(
      `http://127.0.0.1:4011/api/events?ticket=${encodeURIComponent(issued.ticket)}`,
      { headers: { origin } },
    ));
    expect(response.status).toBe(200);

    announceAuthSessionRevocation({
      sessionIds: [session.sessionId],
      reason: "revoked",
    });

    const reader = response.body!.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      chunks.push(next.value);
    }
    const body = chunks.map((chunk) => new TextDecoder().decode(chunk)).join("");
    expect(body).toContain("event: auth.session_revoked");
    expect(body).toContain('"kind":"auth.session_revoked"');
  });
});
