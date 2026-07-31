import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { authEvents, authPairTokens, authSessions } from "@/server/db/schema";
import { createAuthSession, revokeSession } from "@/server/auth/session";
import {
  StreamTicketManager,
  streamTicketManager,
} from "@/server/auth/stream-tickets";
import { createOmniRuntimeHttpRegistry } from "@/runtime/http/routes";
import { startOmniHttpServer, type OmniHttpServerHandle } from "@/runtime/http/server";

const browserOrigin = "https://interface.example";
const handles: OmniHttpServerHandle[] = [];

describe("stream tickets", () => {
  beforeEach(async () => {
    process.env.NODE_ENV = "test";
    process.env.OMNIHARNESS_AUTH_PASSWORD = "test-password";
    streamTicketManager.reset();
    await db.delete(authEvents);
    await db.delete(authPairTokens);
    await db.delete(authSessions);
  });

  afterEach(async () => {
    await Promise.all(handles.splice(0).map((handle) => handle.stop()));
  });

  it("enforces 60-second expiry, atomic use, and exact session/path/origin binding", async () => {
    let now = 1_000;
    const manager = new StreamTicketManager({
      now: () => now,
      randomBytes: () => Buffer.alloc(32, 9),
      loadSession: async (sessionId) => (
        sessionId === "session-1"
          ? {
            id: sessionId,
            transport: "bearer",
            clientKind: "browser",
            boundOrigin: browserOrigin,
          }
          : null
      ),
    });
    const issued = manager.issue({
      sessionId: "session-1",
      path: "/api/events",
      origin: browserOrigin,
    });
    await expect(manager.redeem({
      ticket: issued.ticket,
      path: "/api/terminals/terminal-1/stream",
      origin: browserOrigin,
    })).rejects.toThrow(/path/i);
    await expect(manager.redeem({
      ticket: issued.ticket,
      path: "/api/events",
      origin: browserOrigin,
    })).rejects.toThrow(/invalid or already used/i);

    const expired = manager.issue({
      sessionId: "session-1",
      path: "/api/events",
      origin: browserOrigin,
    });
    now += 60_001;
    await expect(manager.redeem({
      ticket: expired.ticket,
      path: "/api/events",
      origin: browserOrigin,
    })).rejects.toThrow(/expired/i);
  });

  it("revalidates the bound session when redeeming", async () => {
    const session = await createAuthSession({
      label: "Browser",
      authMethod: "password_login",
      transport: "bearer",
      clientKind: "browser",
      boundOrigin: browserOrigin,
    });
    const issued = streamTicketManager.issue({
      sessionId: session.sessionId,
      path: "/api/events",
      origin: browserOrigin,
    });
    await revokeSession(session.sessionId);

    await expect(streamTicketManager.redeem({
      ticket: issued.ticket,
      path: "/api/events",
      origin: browserOrigin,
    })).rejects.toThrow(/session/i);
  });

  it("issues a fresh secret for each reconnect without logging it", async () => {
    const session = await createAuthSession({
      label: "Browser",
      authMethod: "password_login",
      transport: "bearer",
      clientKind: "browser",
      boundOrigin: browserOrigin,
    });
    const first = streamTicketManager.issue({
      sessionId: session.sessionId,
      path: "/api/events",
      origin: browserOrigin,
    });
    const second = streamTicketManager.issue({
      sessionId: session.sessionId,
      path: "/api/events",
      origin: browserOrigin,
    });
    expect(first.ticket).not.toBe(second.ticket);
    expect(JSON.stringify(await db.select().from(authEvents))).not.toContain(first.ticket);
    expect(JSON.stringify(await db.select().from(authEvents))).not.toContain(second.ticket);
  });

  it("serves a real cross-origin event stream with exact CORS headers", async () => {
    const session = await createAuthSession({
      label: "Browser",
      authMethod: "password_login",
      transport: "bearer",
      clientKind: "browser",
      boundOrigin: browserOrigin,
    });
    const handle = await startOmniHttpServer({
      host: "127.0.0.1",
      port: 0,
      registry: createOmniRuntimeHttpRegistry(),
    });
    handles.push(handle);

    const ticketResponse = await fetch(`${handle.origin}/api/auth/stream-ticket`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${session.tokenValue}`,
        origin: browserOrigin,
        "content-type": "application/json",
      },
      body: JSON.stringify({ path: "/api/events" }),
    });
    expect(ticketResponse.status).toBe(200);
    const { ticket } = await ticketResponse.json() as { ticket: string };

    const abort = new AbortController();
    const stream = await fetch(
      `${handle.origin}/api/events?ticket=${encodeURIComponent(ticket)}`,
      {
        headers: { origin: browserOrigin },
        signal: abort.signal,
      },
    );
    expect(stream.status).toBe(200);
    expect(stream.headers.get("access-control-allow-origin")).toBe(browserOrigin);
    expect(stream.headers.get("vary")).toContain("Origin");
    expect(stream.headers.get("access-control-allow-credentials")).toBeNull();
    const reader = stream.body?.getReader();
    const firstFrame = await reader?.read();
    expect(firstFrame?.value?.byteLength).toBeGreaterThan(0);
    await revokeSession(session.sessionId);
    let closed = false;
    for (let index = 0; index < 20 && !closed; index += 1) {
      const next = await Promise.race([
        reader!.read(),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("revoked stream did not close")), 1_000);
        }),
      ]);
      closed = next.done;
    }
    expect(closed).toBe(true);
    abort.abort();
  });
});
