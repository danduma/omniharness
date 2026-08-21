import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq, like } from "drizzle-orm";
import { db } from "@/server/db";
import {
  accountSecrets,
  accountUsageSnapshots,
  accounts,
  creditEvents,
  plans,
  runs,
  settings,
  workerCredentialAllocations,
  workers,
  workerTokenUsage,
} from "@/server/db/schema";
import { __resetNamedEventsForTests, getNamedEventsSince } from "@/server/events/named-events";
import {
  handleAccountDetailRequest,
  handleAccountStatusRequest,
  handleAccountsRequest,
} from "@/runtime/http/routes/accounts";

vi.mock("@/server/bridge-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/bridge-client")>();
  return {
    ...actual,
    quiesceAccount: vi.fn(async (accountId: string) => ({
      ok: true,
      accountId,
      fenced: true,
      prewarmedEvicted: 0,
      startingCount: 0,
      startingAgents: [],
      liveAgents: [],
    })),
    resumeAccount: vi.fn(async (accountId: string) => ({ ok: true, accountId, fenced: false })),
  };
});

const DELETED_ACCOUNT_SETTING_PREFIX = "OMNIHARNESS_DELETED_ACCOUNT:";

function deletedAccountSettingKey(accountId: string) {
  return `${DELETED_ACCOUNT_SETTING_PREFIX}${encodeURIComponent(accountId)}`;
}

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
    await db.delete(settings).where(like(settings.key, `${DELETED_ACCOUNT_SETTING_PREFIX}%`));
    __resetNamedEventsForTests();
  });

  it("creates an account without returning its credential reference", async () => {
    await db.insert(settings).values({
      key: deletedAccountSettingKey("codex-work"),
      value: "codex-work",
      updatedAt: new Date("2026-07-14T09:00:00.000Z"),
    });
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
    expect(await db.select().from(settings).where(eq(settings.key, deletedAccountSettingKey("codex-work"))).get())
      .toBeUndefined();
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

  it("rejects client-supplied account status instead of treating it as provider truth", async () => {
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

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error.code).toBe("account.status_client_forbidden");
    expect(JSON.stringify(payload)).not.toContain("secret-local-session");
  });

  it("deletes an account and its dependent records without deleting run history", async () => {
    const now = new Date("2026-07-14T10:00:00.000Z");
    const accountId = "test-account-delete-route";
    const planId = "plan-account-delete-route";
    const runId = "run-account-delete-route";
    const workerId = "worker-account-delete-route";

    await db.insert(plans).values({
      id: planId,
      path: "vibes/test-account-delete-route.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(accounts).values({
      id: accountId,
      cliType: "claude",
      provider: "anthropic",
      type: "api",
      label: "Disposable account",
      authMode: "api_key",
      authRef: "setting:DISPOSABLE_ACCOUNT",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      preferredWorkerType: "claude",
      preferredWorkerAccountId: accountId,
      status: "completed",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "claude",
      status: "completed",
      cwd: process.cwd(),
      outputLog: "",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(accountSecrets).values({
      id: "secret-account-delete-route",
      accountId,
      secretKind: "api_key",
      encryptedValue: "enc:v1:redacted",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(workerCredentialAllocations).values({
      id: "allocation-account-delete-route",
      runId,
      workerId,
      workerType: "claude",
      accountId,
      strategy: "manual",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(workerTokenUsage).values({
      id: "usage-account-delete-route",
      runId,
      workerId,
      workerType: "claude",
      accountId,
      inputTokens: 1,
      outputTokens: 2,
      occurredAt: now,
      createdAt: now,
    });
    await db.insert(accountUsageSnapshots).values({
      id: "snapshot-account-delete-route",
      accountId,
      workerType: "claude",
      windowKey: "2026-07",
      source: "test",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(creditEvents).values({
      id: "credit-account-delete-route",
      accountId,
      workerId,
      eventType: "exhausted",
      createdAt: now,
    });

    try {
      const response = await handleAccountDetailRequest(jsonRequest(
        `http://localhost/api/accounts/${accountId}`,
        "DELETE",
        {},
      ), { surface: "test", params: { id: accountId } });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ ok: true, accountId, profileDataPreserved: true });
      expect(await db.select().from(accounts).where(eq(accounts.id, accountId))).toHaveLength(0);
      expect(await db.select().from(accountSecrets).where(eq(accountSecrets.accountId, accountId))).toHaveLength(0);
      expect(await db.select().from(workerCredentialAllocations).where(eq(workerCredentialAllocations.accountId, accountId))).toHaveLength(0);
      expect(await db.select().from(workerTokenUsage).where(eq(workerTokenUsage.accountId, accountId))).toHaveLength(0);
      expect(await db.select().from(accountUsageSnapshots).where(eq(accountUsageSnapshots.accountId, accountId))).toHaveLength(0);
      expect(await db.select().from(creditEvents).where(eq(creditEvents.accountId, accountId))).toHaveLength(0);
      expect(await db.select().from(runs).where(eq(runs.id, runId)).get()).toMatchObject({
        preferredWorkerAccountId: null,
      });
      expect(await db.select().from(workers).where(eq(workers.id, workerId))).toHaveLength(1);
      expect(await db.select().from(settings).where(eq(settings.key, deletedAccountSettingKey(accountId))).get())
        .toMatchObject({ value: accountId });
      expect(getNamedEventsSince(0).events.map((entry) => entry.event)).toContainEqual(expect.objectContaining({
        kind: "account.remove_completed",
        accountId,
        workerType: "claude",
        profileDataPreserved: true,
      }));
    } finally {
      await db.delete(creditEvents).where(eq(creditEvents.accountId, accountId));
      await db.delete(workerCredentialAllocations).where(eq(workerCredentialAllocations.accountId, accountId));
      await db.delete(workerTokenUsage).where(eq(workerTokenUsage.accountId, accountId));
      await db.delete(accountUsageSnapshots).where(eq(accountUsageSnapshots.accountId, accountId));
      await db.delete(accountSecrets).where(eq(accountSecrets.accountId, accountId));
      await db.delete(workers).where(eq(workers.id, workerId));
      await db.delete(runs).where(eq(runs.id, runId));
      await db.delete(accounts).where(eq(accounts.id, accountId));
      await db.delete(plans).where(eq(plans.id, planId));
      await db.delete(settings).where(eq(settings.key, deletedAccountSettingKey(accountId)));
    }
  });

  it("records a rejected deletion when the account does not exist", async () => {
    const accountId = "missing-account-delete-route";
    const response = await handleAccountDetailRequest(jsonRequest(
      `http://localhost/api/accounts/${accountId}`,
      "DELETE",
      {},
    ), { surface: "test", params: { id: accountId } });

    expect(response.status).toBe(404);
    expect(getNamedEventsSince(0).events.map((entry) => entry.event)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "account.delete_failed",
        accountId,
        reason: "not_found",
      }),
      expect.objectContaining({
        kind: "error.surfaced",
        code: "account.delete.failed",
        accountId,
      }),
    ]));
  });

  it("records a rejected deletion when authentication fails", async () => {
    const originalBypass = process.env.OMNIHARNESS_TEST_BYPASS_AUTH;
    delete process.env.OMNIHARNESS_TEST_BYPASS_AUTH;
    const accountId = "unauthorized-account-delete-route";

    try {
      const response = await handleAccountDetailRequest(jsonRequest(
        `http://localhost/api/accounts/${accountId}`,
        "DELETE",
        {},
      ), { surface: "test", params: { id: accountId } });

      expect(response.status).toBe(401);
      expect(getNamedEventsSince(0).events.map((entry) => entry.event)).toEqual(expect.arrayContaining([
        expect.objectContaining({
          kind: "account.delete_failed",
          accountId,
          reason: "authentication_refused",
        }),
        expect.objectContaining({
          kind: "error.surfaced",
          code: "account.delete.failed",
          accountId,
        }),
      ]));
    } finally {
      if (originalBypass === undefined) delete process.env.OMNIHARNESS_TEST_BYPASS_AUTH;
      else process.env.OMNIHARNESS_TEST_BYPASS_AUTH = originalBypass;
    }
  });
});
