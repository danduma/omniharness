import { beforeEach, describe, expect, it, vi } from "vitest";

const service = vi.hoisted(() => ({
  connect: vi.fn(),
  signInLocal: vi.fn(),
  getOperation: vi.fn(),
  act: vi.fn(),
  logout: vi.fn(),
  purge: vi.fn(),
}));

vi.mock("@/server/accounts/claude-account-auth-service", () => ({
  getClaudeAccountAuthService: vi.fn(async () => service),
}));

import {
  handleAccountAuthOperationRequest,
  handleClaudeAccountConnectRequest,
  handleClaudeAccountLogoutRequest,
  handleClaudeAccountPurgeRequest,
} from "@/runtime/http/routes/account-auth";

const context = { surface: "test" as const };

function request(url: string, method: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: { origin: "http://localhost", "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("Claude account authentication routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    service.connect.mockResolvedValue({ account: { id: "account-1" }, operation: { id: "operation-1" } });
    service.signInLocal.mockResolvedValue({ account: { id: "local-session-claude" }, operation: { id: "operation-1" } });
    service.getOperation.mockResolvedValue({ account: { id: "account-1" }, operation: { id: "operation-1" } });
    service.act.mockResolvedValue({ account: { id: "account-1" }, operation: { id: "operation-1" } });
    service.logout.mockResolvedValue({ account: { id: "account-1" } });
    service.purge.mockResolvedValue({ ok: true, accountId: "account-1", profileDataPurged: true });
  });

  it("starts a Claude login operation for the authenticated session", async () => {
    const response = await handleClaudeAccountConnectRequest(request(
      "http://localhost/api/accounts/claude/connect",
      "POST",
      { label: "Personal Max", email: "person@example.com", sso: true },
    ), context);

    expect(response.status).toBe(200);
    expect(service.connect).toHaveBeenCalledWith({
      label: "Personal Max",
      email: "person@example.com",
      sso: true,
      ownerSessionId: expect.any(String),
    });
  });

  it("starts the normal local Claude login without an account setup payload", async () => {
    const response = await handleClaudeAccountConnectRequest(request(
      "http://localhost/api/accounts/claude/connect",
      "POST",
      { localSession: true },
    ), context);

    expect(response.status).toBe(200);
    expect(service.signInLocal).toHaveBeenCalledWith(expect.any(String));
  });

  it("gets, retries, and cancels the exact account operation", async () => {
    const getResponse = await handleAccountAuthOperationRequest(
      request("http://localhost/api/accounts/account-1/auth-operation", "GET"),
      { ...context, params: { id: "account-1" } },
    );
    expect(getResponse.status).toBe(200);
    expect(service.getOperation).toHaveBeenCalledWith("account-1", expect.any(String));

    const retryResponse = await handleAccountAuthOperationRequest(
      request("http://localhost/api/accounts/account-1/auth-operation", "POST", { action: "retry" }),
      { ...context, params: { id: "account-1" } },
    );
    expect(retryResponse.status).toBe(200);
    expect(service.act).toHaveBeenCalledWith("account-1", "retry", expect.any(String));

    const invalidResponse = await handleAccountAuthOperationRequest(
      request("http://localhost/api/accounts/account-1/auth-operation", "POST", { action: "explode" }),
      { ...context, params: { id: "account-1" } },
    );
    expect(invalidResponse.status).toBe(400);
  });

  it("routes logout and exact-confirmation purge through the account service", async () => {
    const logout = await handleClaudeAccountLogoutRequest(
      request("http://localhost/api/accounts/account-1/logout", "POST", {}),
      { ...context, params: { id: "account-1" } },
    );
    expect(logout.status).toBe(200);
    expect(service.logout).toHaveBeenCalledWith("account-1");

    const purge = await handleClaudeAccountPurgeRequest(
      request("http://localhost/api/accounts/account-1/purge", "POST", { purge: true, confirmAccountId: "account-1" }),
      { ...context, params: { id: "account-1" } },
    );
    expect(purge.status).toBe(200);
    expect(service.purge).toHaveBeenCalledWith("account-1", { purge: true, confirmAccountId: "account-1" });
  });
});
