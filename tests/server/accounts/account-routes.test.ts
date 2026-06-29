import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { accounts } from "@/server/db/schema";
import {
  handleAccountDetailRequest,
  handleAccountStatusRequest,
  handleAccountsRequest,
} from "@/runtime/http/routes/accounts";

function jsonRequest(url: string, method: string, body: unknown) {
  return new Request(url, {
    method,
    headers: {
      origin: "http://localhost",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("account management routes", () => {
  beforeEach(async () => {
    await db.delete(accounts);
  });

  it("creates an account without returning its credential reference", async () => {
    const response = await handleAccountsRequest(jsonRequest("http://localhost/api/accounts", "POST", {
      id: "codex-work",
      cliType: "codex",
      provider: "openai",
      type: "api",
      label: "Codex Work",
      authMode: "api_key",
      authRef: "setting:OPENAI_API_KEY",
      priority: 7,
    }), { surface: "test" });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual(expect.objectContaining({
      id: "codex-work",
      cliType: "codex",
      provider: "openai",
      type: "api",
      label: "Codex Work",
      authMode: "api_key",
      priority: 7,
    }));
    expect(JSON.stringify(payload)).not.toContain("setting:OPENAI_API_KEY");
    expect(await db.select().from(accounts).where(eq(accounts.id, "codex-work")).get()).toMatchObject({
      authRef: "setting:OPENAI_API_KEY",
    });
  });

  it("updates mutable account fields and preserves the secret pointer by default", async () => {
    await db.insert(accounts).values({
      id: "claude-sub",
      cliType: "claude",
      provider: "anthropic",
      type: "subscription",
      label: "Claude",
      authMode: "legacy_ref",
      authRef: "CLAUDE_CODE_TOKEN_1",
      enabled: true,
      priority: 1,
      createdAt: new Date("2026-06-29T15:00:00.000Z"),
    });

    const response = await handleAccountDetailRequest(jsonRequest("http://localhost/api/accounts/claude-sub", "PATCH", {
      label: "Claude Backup",
      enabled: false,
      priority: 3,
      status: "login_required",
      metadata: { note: "needs login" },
    }), { surface: "test", params: { id: "claude-sub" } });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual(expect.objectContaining({
      id: "claude-sub",
      label: "Claude Backup",
      enabled: false,
      priority: 3,
      status: "login_required",
      metadata: { note: "needs login" },
    }));
    expect(JSON.stringify(payload)).not.toContain("CLAUDE_CODE_TOKEN_1");
    expect(await db.select().from(accounts).where(eq(accounts.id, "claude-sub")).get()).toMatchObject({
      authRef: "CLAUDE_CODE_TOKEN_1",
    });
  });

  it("refreshes stored account status without exposing auth material", async () => {
    await db.insert(accounts).values({
      id: "codex-local",
      cliType: "codex",
      provider: "openai",
      type: "external",
      authMode: "local_session",
      authRef: "secret-local-session",
      createdAt: new Date("2026-06-29T15:00:00.000Z"),
    });

    const response = await handleAccountStatusRequest(jsonRequest("http://localhost/api/accounts/codex-local/status", "POST", {
      status: "available",
    }), { surface: "test", params: { id: "codex-local" } });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.status).toBe("available");
    expect(payload.statusCheckedAt).toEqual(expect.any(String));
    expect(JSON.stringify(payload)).not.toContain("secret-local-session");
  });
});
