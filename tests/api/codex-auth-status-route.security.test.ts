import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../../src/app/api/codex-auth/status/route";
import * as codexAuth from "../../src/server/supervisor/codex-auth";

vi.mock("../../src/server/supervisor/codex-auth");

describe("codex-auth-status-route security", () => {
  beforeEach(() => {
    vi.mocked(codexAuth.readCodexCredentialsSync).mockReset();
  });

  it("exposes only non-sensitive fields", async () => {
    const sensitiveTokens = {
      accessToken: "eyJ_access_token",
      refreshToken: "rt_refresh_token",
      idToken: "eyJ_id_token",
      accountId: "acc_id_sensitive",
    };

    vi.mocked(codexAuth.readCodexCredentialsSync).mockReturnValue({
      ...sensitiveTokens,
      email: "test@example.com",
      planType: "pro",
      expiresAt: 1234567890,
      subscriptionActiveUntil: "2026-05-20",
      lastRefresh: "2026-05-17T10:00:00Z",
    });

    const response = await GET();
    const data = await response.json();

    expect(data.available).toBe(true);
    expect(data.email).toBe("test@example.com");
    
    // Negative assertions - ensure no sensitive data is leaked
    const jsonString = JSON.stringify(data);
    expect(jsonString).not.toContain("eyJ_access_token");
    expect(jsonString).not.toContain("rt_refresh_token");
    expect(jsonString).not.toContain("eyJ_id_token");
    expect(jsonString).not.toContain("acc_id_sensitive");
    
    expect(data.accessToken).toBeUndefined();
    expect(data.refreshToken).toBeUndefined();
    expect(data.idToken).toBeUndefined();
    expect(data.accountId).toBeUndefined();
  });

  it("returns available: false if no credentials", async () => {
    vi.mocked(codexAuth.readCodexCredentialsSync).mockReturnValue(null);
    const response = await GET();
    const data = await response.json();
    expect(data.available).toBe(false);
  });
});
