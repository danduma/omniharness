import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { db } from "@/server/db";
import { accounts, authEvents, authPairTokens, authSessions, notificationSubscriptions, plans, settings } from "@/server/db/schema";
import { createAuthSession } from "@/server/auth/session";
import { resetLoginRateLimitsForTests } from "@/server/auth/rate-limit";
import { handleAuthSessionRequest } from "@/runtime/http/routes/auth-session";
import { handleAuthLoginRequest } from "@/runtime/http/routes/auth-login";
import { handleAuthLogoutRequest } from "@/runtime/http/routes/auth-logout";
import { handleAuthPairRequest } from "@/runtime/http/routes/auth-pair";
import { handleAuthPairRedeemRequest } from "@/runtime/http/routes/auth-pair-redeem";
import { handleNotificationsRequest } from "@/runtime/http/routes/notifications";
import { handlePlansRequest } from "@/runtime/http/routes/plans";
import { handleProjectMemoryRequest } from "@/runtime/http/routes/project-memory";
import { handleBrowseFilesystemRequest, handleProjectFilesRequest } from "@/runtime/http/routes/filesystem";
import { handleGitRequest } from "@/runtime/http/routes/git";
import { handleSettingsRequest } from "@/runtime/http/routes/settings";
import { handleAccountsRequest } from "@/runtime/http/routes/accounts";
import { handleAgentsRequest } from "@/runtime/http/routes/agents";
import { handleLlmModelsRequest } from "@/runtime/http/routes/llm-models";
import { handleCodexAuthStatusRequest } from "@/runtime/http/routes/codex-auth-status";
import { createOmniRuntimeHttpRegistry } from "@/runtime/http/routes";
import { __clearEventPayloadCachesForTests } from "@/runtime/http/routes/events";

const { mockReadCodexCredentialsSync } = vi.hoisted(() => ({
  mockReadCodexCredentialsSync: vi.fn(),
}));

vi.mock("@/server/supervisor/codex-auth", () => ({
  readCodexCredentialsSync: mockReadCodexCredentialsSync,
}));

vi.mock("@/server/settings/crypto", () => ({
  shouldEncryptSetting: (key: string) => key.endsWith("_API_KEY"),
  encryptSettingValue: (value: string) => `encmock:${Buffer.from(value, "utf8").toString("base64")}`,
  decryptSettingValue: (value: string) => {
    if (value === "enc:v1:invalid-payload") {
      throw new Error("Unable to decrypt stored setting value.");
    }
    return value.startsWith("encmock:")
      ? Buffer.from(value.slice("encmock:".length), "base64").toString("utf8")
      : value;
  },
}));

describe("portable runtime HTTP routes", () => {
  beforeEach(async () => {
    process.env.OMNIHARNESS_AUTH_PASSWORD = "swordfish";
    delete process.env.OMNIHARNESS_AUTH_PASSWORD_HASH;
    await db.delete(notificationSubscriptions);
    await db.delete(authEvents);
    await db.delete(authPairTokens);
    await db.delete(authSessions);
    await db.delete(accounts);
    await db.delete(plans);
    await db.delete(settings);
    __clearEventPayloadCachesForTests();
    resetLoginRateLimitsForTests();
  });

  it("serves auth session state from a Fetch-compatible handler", async () => {
    const session = await createAuthSession({
      label: "Portable route",
      userAgent: "Vitest",
      authMethod: "password_login",
    });

    const response = await handleAuthSessionRequest(new Request("http://localhost/api/auth/session", {
      headers: {
        cookie: `omni_session=${session.tokenValue}`,
      },
    }), { surface: "test" });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({
      enabled: true,
      authenticated: true,
      currentSession: expect.objectContaining({
        id: session.sessionId,
      }),
    }));
  });

  it("logs in through a Fetch-compatible handler and sets the auth cookie", async () => {
    const response = await handleAuthLoginRequest(new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: {
        origin: "http://localhost",
        "content-type": "application/json",
        "user-agent": "Vitest Runtime Route",
      },
      body: JSON.stringify({ password: "swordfish", label: "Runtime route" }),
    }), { surface: "test" });

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("omni_session=");
    await expect(response.json()).resolves.toEqual(expect.objectContaining({
      ok: true,
      sessionId: expect.any(String),
    }));
  });

  it("logs out through a Fetch-compatible handler and clears the auth cookie", async () => {
    const session = await createAuthSession({
      label: "Logout portable route",
      userAgent: "Vitest",
      authMethod: "password_login",
    });

    const response = await handleAuthLogoutRequest(new Request("http://localhost/api/auth/logout", {
      method: "POST",
      headers: {
        cookie: `omni_session=${session.tokenValue}`,
        origin: "http://localhost",
      },
    }), { surface: "test" });

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("omni_session=");
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("saves and loads settings through Fetch-compatible handlers", async () => {
    const session = await createAuthSession({
      label: "Portable settings route",
      userAgent: "Vitest",
      authMethod: "password_login",
    });
    const cookie = `omni_session=${session.tokenValue}`;

    const saveResponse = await handleSettingsRequest(new Request("http://localhost/api/settings", {
      method: "POST",
      headers: {
        cookie,
        origin: "http://localhost",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        TEST_SUPERVISOR_API_KEY: "top-secret-key",
        TEST_SUPERVISOR_MODEL: "gemini-3.5-flash",
      }),
    }), { surface: "test" });

    expect(saveResponse.status).toBe(200);

    const loadResponse = await handleSettingsRequest(new Request("http://localhost/api/settings", {
      headers: { cookie },
    }), { surface: "test" });

    expect(loadResponse.status).toBe(200);
    const payload = await loadResponse.json();
    expect(payload.values.TEST_SUPERVISOR_MODEL).toBe("gemini-3.5-flash");
    expect(payload.values.TEST_SUPERVISOR_API_KEY).toBeUndefined();
    expect(payload.secrets.TEST_SUPERVISOR_API_KEY).toEqual({
      configured: true,
      updatedAt: expect.any(String),
    });
  });

  it("mounts migrated routes in the shared runtime route registry", async () => {
    const session = await createAuthSession({
      label: "Mounted runtime registry",
      userAgent: "Vitest",
      authMethod: "password_login",
    });
    const registry = createOmniRuntimeHttpRegistry();

    const authResponse = await registry.handle(new Request("http://localhost/api/auth/session", {
      headers: {
        cookie: `omni_session=${session.tokenValue}`,
      },
    }), { surface: "test" });
    const settingsResponse = await registry.handle(new Request("http://localhost/api/settings", {
      headers: {
        cookie: `omni_session=${session.tokenValue}`,
      },
    }), { surface: "test" });

    expect(authResponse.status).toBe(200);
    expect(settingsResponse.status).toBe(200);
  });

  it("mounts migrated model and Codex auth routes in the shared runtime route registry", async () => {
    const registry = createOmniRuntimeHttpRegistry();

    const modelsResponse = await registry.handle(new Request("http://localhost/api/llm-models", {
      method: "POST",
      headers: {
        origin: "http://localhost",
        "content-type": "application/json",
      },
      body: JSON.stringify({ provider: "gemini" }),
    }), { surface: "test" });
    const codexStatusResponse = await registry.handle(new Request("http://localhost/api/codex-auth/status"), {
      surface: "test",
    });

    expect(modelsResponse.status).toBe(200);
    expect(codexStatusResponse.status).toBe(200);
  });

  it("mounts pairing and notification routes in the shared runtime route registry", async () => {
    const session = await createAuthSession({
      label: "Mounted pairing route",
      userAgent: "Vitest",
      authMethod: "password_login",
    });
    const cookie = `omni_session=${session.tokenValue}`;
    const registry = createOmniRuntimeHttpRegistry();

    const pairResponse = await registry.handle(new Request("http://localhost/api/auth/pair", {
      method: "POST",
      headers: {
        cookie,
        origin: "http://localhost",
        "content-type": "application/json",
      },
      body: JSON.stringify({ targetRunId: "run-runtime" }),
    }), { surface: "test" });
    const notificationsResponse = await registry.handle(new Request("http://localhost/api/notifications", {
      headers: { cookie },
    }), { surface: "test" });

    expect(pairResponse.status).toBe(200);
    expect(notificationsResponse.status).toBe(200);
    await expect(pairResponse.json()).resolves.toEqual(expect.objectContaining({
      pairingId: expect.any(String),
      pairUrl: expect.stringContaining("/session/run-runtime?pair="),
    }));
    await expect(notificationsResponse.json()).resolves.toEqual(expect.objectContaining({
      supported: true,
      publicKey: expect.any(String),
    }));
  });

  it("serves plans through a Fetch-compatible handler", async () => {
    const session = await createAuthSession({
      label: "Portable plans route",
      userAgent: "Vitest",
      authMethod: "password_login",
    });
    await db.insert(plans).values([
      {
        id: "old-plan",
        path: "vibes/ad-hoc/old.md",
        status: "done",
        createdAt: new Date("2026-05-12T09:00:00Z"),
        updatedAt: new Date("2026-05-12T09:00:00Z"),
      },
      {
        id: "new-plan",
        path: "vibes/ad-hoc/new.md",
        status: "running",
        createdAt: new Date("2026-05-12T10:00:00Z"),
        updatedAt: new Date("2026-05-12T10:00:00Z"),
      },
    ]);

    const response = await handlePlansRequest(new Request("http://localhost/api/plans", {
      headers: { cookie: `omni_session=${session.tokenValue}` },
    }), { surface: "test" });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.map((plan: { id: string }) => plan.id)).toEqual(["new-plan", "old-plan"]);
  });

  it("updates and reads project memory through Fetch-compatible handlers", async () => {
    const session = await createAuthSession({
      label: "Portable memory route",
      userAgent: "Vitest",
      authMethod: "password_login",
    });
    const cookie = `omni_session=${session.tokenValue}`;
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), "omni-runtime-memory-"));
    try {
      const saveResponse = await handleProjectMemoryRequest(new Request("http://localhost/api/projects/memory", {
        method: "POST",
        headers: {
          cookie,
          origin: "http://localhost",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          projectPath,
          path: "notes/session.md",
          content: "Remember the runtime route.\n",
        }),
      }), { surface: "test" });
      const readResponse = await handleProjectMemoryRequest(new Request(
        `http://localhost/api/projects/memory?projectPath=${encodeURIComponent(projectPath)}&path=${encodeURIComponent("notes/session.md")}`,
        { headers: { cookie } },
      ), { surface: "test" });

      expect(saveResponse.status).toBe(200);
      expect(readResponse.status).toBe(200);
      await expect(readResponse.json()).resolves.toMatchObject({
        enabled: true,
        file: {
          path: "notes/session.md",
          content: "Remember the runtime route.\n",
          truncated: false,
        },
      });
    } finally {
      fs.rmSync(projectPath, { recursive: true, force: true });
    }
  });

  it("browses directories and clamps filesystem roots through Fetch-compatible handlers", async () => {
    const allowedRoot = path.resolve(process.cwd(), "..");
    const response = await handleBrowseFilesystemRequest(new Request("http://localhost/api/fs?path=/"), {
      surface: "test",
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.current).toBe(allowedRoot);
    expect(payload.parent).toBe(allowedRoot);
  });

  it("lists and reads project files through Fetch-compatible handlers", async () => {
    const allowedRoot = path.resolve(process.cwd(), "..");
    const root = fs.mkdtempSync(path.join(allowedRoot, "omni-runtime-files-"));
    try {
      fs.writeFileSync(path.join(root, "README.md"), "# Runtime route\n", "utf8");

      const listResponse = await handleProjectFilesRequest(new Request(
        `http://localhost/api/fs/files?root=${encodeURIComponent(root)}`,
      ), { surface: "test" });
      const readResponse = await handleProjectFilesRequest(new Request(
        `http://localhost/api/fs/files?root=${encodeURIComponent(root)}&file=${encodeURIComponent("README.md")}`,
      ), { surface: "test" });

      expect(listResponse.status).toBe(200);
      await expect(listResponse.json()).resolves.toMatchObject({
        root,
        files: ["README.md"],
      });
      expect(readResponse.status).toBe(200);
      await expect(readResponse.json()).resolves.toMatchObject({
        root,
        path: "README.md",
        content: "# Runtime route\n",
        truncated: false,
      });
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("returns structured git route errors through a Fetch-compatible handler", async () => {
    const response = await handleGitRequest(new Request("http://localhost/api/git", {
      method: "POST",
      headers: {
        origin: "http://localhost",
        "content-type": "application/json",
      },
      body: JSON.stringify({ operation: "unsupported" }),
    }), { surface: "test" });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: expect.objectContaining({
        source: "Git workspace",
        action: "Refresh git status",
        details: ["code: invalid_operation"],
      }),
    });
  });

  it("mounts dynamic conversation message routes in the shared runtime route registry", async () => {
    const registry = createOmniRuntimeHttpRegistry();
    const response = await registry.handle(new Request("http://localhost/api/conversations/run-1/messages", {
      method: "POST",
      headers: {
        origin: "http://localhost",
        "content-type": "application/json",
      },
      body: JSON.stringify({ content: "" }),
    }), { surface: "test" });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: expect.objectContaining({
        source: "Conversations",
        action: "Send a conversation message",
      }),
    });
  });

  it("mounts dynamic run clarification routes in the shared runtime route registry", async () => {
    const registry = createOmniRuntimeHttpRegistry();
    const response = await registry.handle(new Request("http://localhost/api/runs/run-1/answer", {
      method: "POST",
      headers: {
        origin: "http://localhost",
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    }), { surface: "test" });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: expect.objectContaining({
        source: "Clarifications",
        action: "Answer clarification",
      }),
    });
  });

  it("mounts dynamic run lifecycle routes in the shared runtime route registry", async () => {
    const session = await createAuthSession({
      label: "Mounted run lifecycle route",
      userAgent: "Vitest",
      authMethod: "password_login",
    });
    const registry = createOmniRuntimeHttpRegistry();
    const response = await registry.handle(new Request("http://localhost/api/runs/run-1", {
      method: "PATCH",
      headers: {
        cookie: `omni_session=${session.tokenValue}`,
        origin: "http://localhost",
        "content-type": "application/json",
      },
      body: JSON.stringify({ title: " " }),
    }), { surface: "test" });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: expect.objectContaining({
        source: "Runs",
        action: "Rename",
      }),
    });
  });

  it("mounts events snapshot routes in the shared runtime route registry", async () => {
    const session = await createAuthSession({
      label: "Mounted events route",
      userAgent: "Vitest",
      authMethod: "password_login",
    });
    const registry = createOmniRuntimeHttpRegistry();
    const response = await registry.handle(new Request("http://localhost/api/events?snapshot=1&persisted=1", {
      headers: {
        cookie: `omni_session=${session.tokenValue}`,
      },
    }), { surface: "test" });

    expect(response.status).toBe(200);
    expect(response.headers.get("x-omni-last-event-id")).toEqual(expect.any(String));
    await expect(response.json()).resolves.toEqual(expect.objectContaining({
      messages: [],
      runs: [],
    }));
  });

  it("redacts account credential references from portable event snapshots", async () => {
    const session = await createAuthSession({
      label: "Portable events account redaction",
      userAgent: "Vitest",
      authMethod: "password_login",
    });
    await db.insert(accounts).values({
      id: "portable-snapshot-account",
      provider: "anthropic",
      type: "api",
      authRef: "secret-portable-ref",
      capacity: 50,
      resetSchedule: "weekly",
      createdAt: new Date("2026-06-29T10:00:00.000Z"),
    });

    const registry = createOmniRuntimeHttpRegistry();
    const response = await registry.handle(new Request("http://localhost/api/events?snapshot=1&persisted=1", {
      headers: {
        cookie: `omni_session=${session.tokenValue}`,
      },
    }), { surface: "test" });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.accounts).toEqual([expect.objectContaining({
      id: "portable-snapshot-account",
      provider: "anthropic",
      type: "api",
      capacity: 50,
      resetSchedule: "weekly",
      createdAt: expect.any(String),
    })]);
    expect(JSON.stringify(payload.accounts)).not.toContain("secret-portable-ref");
    expect(payload.accounts[0]).not.toHaveProperty("authRef");
    expect(payload.accounts[0]).not.toHaveProperty("auth_ref");
  });

  it("mounts dynamic planning routes in the shared runtime route registry", async () => {
    const session = await createAuthSession({
      label: "Mounted planning route",
      userAgent: "Vitest",
      authMethod: "password_login",
    });
    const cookie = `omni_session=${session.tokenValue}`;
    const registry = createOmniRuntimeHttpRegistry();

    const reviewResponse = await registry.handle(new Request("http://localhost/api/planning/missing-run/review", {
      method: "POST",
      headers: {
        cookie,
        origin: "http://localhost",
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    }), { surface: "test" });
    const promoteResponse = await registry.handle(new Request("http://localhost/api/planning/missing-run/promote", {
      method: "POST",
      headers: {
        cookie,
        origin: "http://localhost",
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    }), { surface: "test" });

    expect(reviewResponse.status).toBe(500);
    await expect(reviewResponse.json()).resolves.toEqual({
      error: expect.objectContaining({
        source: "Planning",
        action: "Review planning conversation",
      }),
    });
    expect(promoteResponse.status).toBe(404);
    await expect(promoteResponse.json()).resolves.toEqual({
      error: expect.objectContaining({
        source: "Planning",
        action: "Promote planning conversation",
      }),
    });
  });

  it("serves redacted accounts through a Fetch-compatible handler", async () => {
    await db.insert(accounts).values({
      id: "account-1",
      provider: "openai",
      type: "api",
      authRef: "secret-ref",
      capacity: 100,
      resetSchedule: "daily",
      createdAt: new Date("2026-05-12T10:00:00Z"),
    });

    const response = await handleAccountsRequest(new Request("http://localhost/api/accounts"), { surface: "test" });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual([expect.objectContaining({
      id: "account-1",
      provider: "openai",
      type: "api",
      capacity: 100,
      resetSchedule: "daily",
      createdAt: expect.any(String),
    })]);
    expect(JSON.stringify(payload)).not.toContain("secret-ref");
    expect(payload[0]).not.toHaveProperty("authRef");
    expect(payload[0]).not.toHaveProperty("auth_ref");
  });

  it("serves normalized runtime agents through a Fetch-compatible handler", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => Response.json([
      {
        name: "worker-1",
        type: "codex",
        cwd: "/tmp/app",
        state: "working",
        output: "hello",
      },
    ])) as typeof fetch;

    try {
      const response = await handleAgentsRequest(new Request("http://localhost/api/agents"), { surface: "test" });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual([expect.objectContaining({
        name: "worker-1",
        type: "codex",
        state: "working",
      })]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("serves local LLM model discovery through a Fetch-compatible handler", async () => {
    const response = await handleLlmModelsRequest(new Request("http://localhost/api/llm-models", {
      method: "POST",
      headers: {
        origin: "http://localhost",
        "content-type": "application/json",
      },
      body: JSON.stringify({ provider: "gemini" }),
    }), { surface: "test" });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      models: [{ id: "gemini-3.5-flash", label: "Gemini 3.5 Flash" }],
    });
  });

  it("serves non-sensitive Codex auth status through a Fetch-compatible handler", async () => {
    mockReadCodexCredentialsSync.mockReturnValue({
      accessToken: "secret-access-token",
      refreshToken: "secret-refresh-token",
      email: "test@example.com",
      planType: "pro",
      expiresAt: 123,
      subscriptionActiveUntil: "2026-05-20",
      lastRefresh: "2026-05-17T10:00:00Z",
    });

    const response = await handleCodexAuthStatusRequest(new Request("http://localhost/api/codex-auth/status"), {
      surface: "test",
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({
      available: true,
      email: "test@example.com",
      planType: "pro",
      expiresAt: 123,
      subscriptionActiveUntil: "2026-05-20",
      lastRefresh: "2026-05-17T10:00:00Z",
    });
    expect(JSON.stringify(payload)).not.toContain("secret");
  });

  it("creates, checks, and redeems pairing tokens through Fetch-compatible handlers", async () => {
    const session = await createAuthSession({
      label: "Portable pairing route",
      userAgent: "Vitest",
      authMethod: "password_login",
    });
    const cookie = `omni_session=${session.tokenValue}`;

    const createResponse = await handleAuthPairRequest(new Request("http://localhost/api/auth/pair", {
      method: "POST",
      headers: {
        cookie,
        origin: "http://localhost",
        "content-type": "application/json",
      },
      body: JSON.stringify({ targetRunId: "run-portable" }),
    }), { surface: "test" });

    expect(createResponse.status).toBe(200);
    const created = await createResponse.json();
    const pairToken = new URL(created.pairUrl).searchParams.get("pair");
    expect(pairToken).toEqual(expect.any(String));

    const redeemResponse = await handleAuthPairRedeemRequest(new Request("http://localhost/api/auth/pair/redeem", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pairToken }),
    }), { surface: "test" });

    expect(redeemResponse.status).toBe(200);
    expect(redeemResponse.headers.get("set-cookie")).toContain("omni_session=");

    const statusResponse = await handleAuthPairRequest(new Request(`http://localhost/api/auth/pair?id=${encodeURIComponent(created.pairingId)}`, {
      headers: { cookie },
    }), { surface: "test" });

    expect(statusResponse.status).toBe(200);
    await expect(statusResponse.json()).resolves.toEqual(expect.objectContaining({
      pairing: expect.objectContaining({ status: "redeemed" }),
    }));
  });

  it("stores and removes notification subscriptions through a Fetch-compatible handler", async () => {
    const session = await createAuthSession({
      label: "Portable notifications route",
      userAgent: "Vitest",
      authMethod: "password_login",
    });
    const cookie = `omni_session=${session.tokenValue}`;
    const subscription = {
      endpoint: "https://push.example.test/runtime-route",
      expirationTime: null,
      keys: {
        p256dh: "p256dh-key",
        auth: "auth-secret",
      },
    };

    const saveResponse = await handleNotificationsRequest(new Request("http://localhost/api/notifications", {
      method: "POST",
      headers: {
        cookie,
        origin: "http://localhost",
        "content-type": "application/json",
      },
      body: JSON.stringify({ subscription }),
    }), { surface: "test" });
    const deleteResponse = await handleNotificationsRequest(new Request("http://localhost/api/notifications", {
      method: "DELETE",
      headers: {
        cookie,
        origin: "http://localhost",
        "content-type": "application/json",
      },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    }), { surface: "test" });

    expect(saveResponse.status).toBe(200);
    expect(deleteResponse.status).toBe(200);
  });
});
