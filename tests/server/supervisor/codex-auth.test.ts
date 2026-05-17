import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { 
  readCodexCredentialsSync, 
  getCodexAuthPath, 
  isCodexCredentialsExpired 
} from "../../../src/server/supervisor/codex-auth";

vi.mock("node:fs");

describe("codex-auth", () => {
  const mockHome = "/mock/home";
  const mockAuthPath = path.join(mockHome, ".codex", "auth.json");

  beforeEach(() => {
    vi.stubEnv("CODEX_HOME", mockHome);
    vi.mocked(fs.existsSync).mockReset();
    vi.mocked(fs.readFileSync).mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function createJwt(payload: any) {
    const header = Buffer.from(JSON.stringify({ alg: "RS256" })).toString("base64url");
    const payloadStr = Buffer.from(JSON.stringify(payload)).toString("base64url");
    return `${header}.${payloadStr}.signature`;
  }

  it("returns null if auth.json does not exist", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    expect(readCodexCredentialsSync()).toBeNull();
  });

  it("returns null if auth_mode is not chatgpt", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ auth_mode: "apikey" }));
    expect(readCodexCredentialsSync()).toBeNull();
  });

  it("returns null if tokens are missing", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ auth_mode: "chatgpt" }));
    expect(readCodexCredentialsSync()).toBeNull();
  });

  it("parses happy path credentials correctly", () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const access_token = createJwt({
      exp,
      "https://api.openai.com/profile": { email: "test@example.com" },
      "https://api.openai.com/auth": { chatgpt_plan_type: "pro" }
    });
    const id_token = createJwt({
      "https://api.openai.com/auth": { chatgpt_subscription_active_until: "2026-12-31T00:00:00Z" }
    });

    const mockAuthData = {
      auth_mode: "chatgpt",
      tokens: {
        access_token,
        refresh_token: "rt_mock",
        account_id: "acc_mock",
        id_token
      },
      last_refresh: "2026-05-17T10:00:00Z"
    };

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockAuthData));

    const creds = readCodexCredentialsSync();
    expect(creds).not.toBeNull();
    expect(creds?.email).toBe("test@example.com");
    expect(creds?.planType).toBe("pro");
    expect(creds?.accountId).toBe("acc_mock");
    expect(creds?.expiresAt).toBe(exp);
    expect(creds?.subscriptionActiveUntil).toBe("2026-12-31T00:00:00Z");
  });

  it("detects expired credentials", () => {
    const expiredExp = Math.floor(Date.now() / 1000) - 10;
    const creds = {
      accessToken: "...",
      refreshToken: "...",
      accountId: "...",
      idToken: "...",
      planType: "...",
      email: "...",
      expiresAt: expiredExp,
      subscriptionActiveUntil: null,
      lastRefresh: null
    };

    expect(isCodexCredentialsExpired(creds)).toBe(true);
  });

  it("detects non-expired credentials with skew", () => {
    const freshExp = Math.floor(Date.now() / 1000) + 120;
    const creds = {
      accessToken: "...",
      refreshToken: "...",
      accountId: "...",
      idToken: "...",
      planType: "...",
      email: "...",
      expiresAt: freshExp,
      subscriptionActiveUntil: null,
      lastRefresh: null
    };

    expect(isCodexCredentialsExpired(creds, 60)).toBe(false);
    expect(isCodexCredentialsExpired(creds, 180)).toBe(true);
  });
});
