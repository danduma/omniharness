import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_SESSION_COOKIE } from "@/server/auth/config";
import { __resetApiSessionCacheForTests, requireApiSession } from "@/server/auth/guards";

const { getSessionFromRequestMock } = vi.hoisted(() => ({
  getSessionFromRequestMock: vi.fn(),
}));

vi.mock("@/server/auth/session", () => ({
  getSessionFromRequest: getSessionFromRequestMock,
}));

function requestWithCookie(value: string) {
  return new NextRequest("http://localhost/api/workers/run-worker-1/entries", {
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
    getSessionFromRequestMock.mockReset();
    getSessionFromRequestMock.mockResolvedValue({
      id: "session-1",
      label: null,
      userAgent: null,
      authMethod: "password_login",
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
    expect(getSessionFromRequestMock).toHaveBeenCalledTimes(1);
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

    expect(getSessionFromRequestMock).toHaveBeenCalledTimes(130);

    const evicted = await requireApiSession(requestWithCookie("token-0.secret"), options);
    const retained = await requireApiSession(requestWithCookie("token-129.secret"), options);

    expect(evicted.response).toBeNull();
    expect(retained.response).toBeNull();
    expect(getSessionFromRequestMock).toHaveBeenCalledTimes(131);
  });
});
