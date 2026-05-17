import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { 
  refreshCodexCredentialsDirectly, 
  ensureFreshCodexCredentials,
  CodexAuthRefreshFailedError,
  CodexAuthMissingError
} from "../../../src/server/supervisor/codex-auth";
import lockfile from "proper-lockfile";

vi.mock("node:fs");
vi.mock("proper-lockfile");

describe("codex-auth-refresh", () => {
  const mockHome = "/mock/home";
  const mockAuthPath = path.join(mockHome, ".codex", "auth.json");

  beforeEach(() => {
    vi.stubEnv("CODEX_HOME", mockHome);
    vi.mocked(fs.existsSync).mockReset();
    vi.mocked(fs.readFileSync).mockReset();
    vi.mocked(fs.writeFileSync).mockReset();
    vi.mocked(fs.mkdirSync).mockReset();
    vi.mocked(lockfile.lock).mockReset();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  function createJwt(payload: any) {
    const header = Buffer.from(JSON.stringify({ alg: "RS256" })).toString("base64url");
    const payloadStr = Buffer.from(JSON.stringify(payload)).toString("base64url");
    return `${header}.${payloadStr}.signature`;
  }

  const mockCreds = {
    accessToken: createJwt({ exp: Math.floor(Date.now() / 1000) - 100 }),
    refreshToken: "rt_mock",
    accountId: "acc_mock",
    idToken: "id_mock",
    planType: "pro",
    email: "test@example.com",
    expiresAt: Math.floor(Date.now() / 1000) - 100,
    subscriptionActiveUntil: null,
    lastRefresh: null
  };

  it("refreshCodexCredentialsDirectly success path", async () => {
    const nextExp = Math.floor(Date.now() / 1000) + 3600;
    const nextAccessToken = createJwt({ exp: nextExp, sub: "user_mock" });
    const nextRefreshToken = "rt_next";
    
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: nextAccessToken,
        refresh_token: nextRefreshToken,
        id_token: "id_next"
      })
    } as Response);

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValueOnce(JSON.stringify({
      auth_mode: "chatgpt",
      tokens: { access_token: "old", refresh_token: "old", account_id: "acc_mock", id_token: "old" }
    })).mockReturnValueOnce(JSON.stringify({
      auth_mode: "chatgpt",
      tokens: { access_token: nextAccessToken, refresh_token: nextRefreshToken, account_id: "acc_mock", id_token: "id_next" }
    }));
    vi.mocked(lockfile.lock).mockResolvedValue(async () => {});

    const result = await refreshCodexCredentialsDirectly(mockCreds);

    expect(result.accessToken).toBe(nextAccessToken);
    expect(result.refreshToken).toBe(nextRefreshToken);
    expect(fs.writeFileSync).toHaveBeenCalled();
    const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
    const savedData = JSON.parse(writeCall[1] as string);
    expect(savedData.tokens.access_token).toBe(nextAccessToken);
    expect(savedData.tokens.refresh_token).toBe(nextRefreshToken);
  });

  it("refreshCodexCredentialsDirectly failure path", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Unauthorized"
    } as Response);

    await expect(refreshCodexCredentialsDirectly(mockCreds)).rejects.toThrow(CodexAuthRefreshFailedError);
  });

  it("ensureFreshCodexCredentials throws if missing", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    await expect(ensureFreshCodexCredentials()).rejects.toThrow(CodexAuthMissingError);
  });

  it("ensureFreshCodexCredentials returns existing if not expired", async () => {
    const freshExp = Math.floor(Date.now() / 1000) + 3600;
    const access_token = createJwt({ exp: freshExp });
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
      auth_mode: "chatgpt",
      tokens: { access_token, refresh_token: "rt", account_id: "acc", id_token: "id" }
    }));

    const result = await ensureFreshCodexCredentials();
    expect(result.expiresAt).toBe(freshExp);
    expect(fetch).not.toHaveBeenCalled();
  });
});
