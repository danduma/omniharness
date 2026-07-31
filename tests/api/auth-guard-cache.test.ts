import { beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_SESSION_COOKIE } from "@/server/auth/config";
import { __resetApiSessionCacheForTests, requireApiSession } from "@/server/auth/guards";
import { announceAuthSessionRevocation } from "@/server/auth/session-revocation";

const { getSessionFromTokenValueMock } = vi.hoisted(() => ({
  getSessionFromTokenValueMock: vi.fn(),
}));

vi.mock("@/server/auth/session", () => ({
  getSessionFromTokenValue: getSessionFromTokenValueMock,
}));

function requestWithCookie(value: string) {
  return new Request("http://localhost/api/workers/run-worker-1/entries", {
    headers: {
      cookie: `${AUTH_SESSION_COOKIE}=${value}`,
    },
  });
}

describe("requireApiSession cache", () => {
  beforeEach(() => {
    process.env.OMNIHARNESS_TEST_BYPASS_AUTH = "false";
    process.env.OMNIHARNESS_AUTH_PASSWORD = "test-password";
    __resetApiSessionCacheForTests();
    getSessionFromTokenValueMock.mockReset();
    getSessionFromTokenValueMock.mockResolvedValue({
      id: "session-1",
      label: null,
      userAgent: null,
      authMethod: "password_login",
      transport: "cookie",
      boundOrigin: null,
      clientKind: "browser",
      createdBySessionId: null,
      lastSeenAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      absoluteExpiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it("reuses a recently validated API session without reloading database-backed session state", async () => {
    const options = {
      source: "Worker entries",
      action: "Load worker stream",
    };

    const first = await requireApiSession(requestWithCookie("token-1.secret"), options);
    const second = await requireApiSession(requestWithCookie("token-1.secret"), options);

    expect(first.response).toBeNull();
    expect(second.response).toBeNull();
    expect(first.session?.id).toBe("session-1");
    expect(second.session?.id).toBe("session-1");
    expect(getSessionFromTokenValueMock).toHaveBeenCalledTimes(1);
  });

  it("bounds the API session cache so changing cookies cannot grow it forever", async () => {
    const options = {
      source: "Worker entries",
      action: "Load worker stream",
    };

    for (let index = 0; index < 130; index += 1) {
      const result = await requireApiSession(requestWithCookie(`token-${index}.secret`), options);
      expect(result.response).toBeNull();
    }

    expect(getSessionFromTokenValueMock).toHaveBeenCalledTimes(130);

    const evicted = await requireApiSession(requestWithCookie("token-0.secret"), options);
    const retained = await requireApiSession(requestWithCookie("token-129.secret"), options);

    expect(evicted.response).toBeNull();
    expect(retained.response).toBeNull();
    expect(getSessionFromTokenValueMock).toHaveBeenCalledTimes(131);
  });

  it("invalidates a cached session immediately when it is revoked", async () => {
    const options = {
      source: "Worker entries",
      action: "Load worker stream",
    };
    await requireApiSession(requestWithCookie("token-1.secret"), options);
    getSessionFromTokenValueMock.mockResolvedValueOnce(null);

    announceAuthSessionRevocation({
      sessionIds: ["session-1"],
      reason: "revoked",
    });
    const result = await requireApiSession(requestWithCookie("token-1.secret"), options);

    expect(result.response?.status).toBe(401);
    expect(getSessionFromTokenValueMock).toHaveBeenCalledTimes(2);
  });
});
