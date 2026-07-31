import { describe, expect, it } from "vitest";
import * as accountLabels from "@/interface/home/account-labels";
import type { AccountRecord } from "@/interface/home/types";

function account(input: Partial<AccountRecord>): AccountRecord {
  return {
    id: input.id ?? "account-1",
    cliType: input.cliType ?? "claude",
    provider: input.provider ?? "anthropic",
    type: input.type ?? "subscription",
    label: input.label ?? null,
    authMode: input.authMode ?? "local_session",
    enabled: input.enabled ?? true,
    priority: input.priority ?? 0,
    capacity: input.capacity ?? null,
    resetSchedule: input.resetSchedule ?? null,
    status: input.status ?? null,
    statusCheckedAt: input.statusCheckedAt ?? null,
    metadata: input.metadata ?? null,
    createdAt: input.createdAt ?? "2026-07-04T00:00:00.000Z",
    updatedAt: input.updatedAt ?? null,
  };
}

describe("account option labels", () => {
  it("shows source and email for Claude subscription accounts", () => {
    expect(accountLabels.formatAccountOptionLabel(account({
      label: "claude-sub-1",
      metadata: {
        identity: {
          email: "person@example.test",
          subscriptionType: "pro",
        },
      },
    }))).toBe("Subscription · person@example.test");
  });

  it("shows source and display name when no email is known", () => {
    expect(accountLabels.formatAccountOptionLabel(account({
      id: "claude-api-1",
      type: "api",
      label: "claude-api-1",
      authMode: "api_key",
      metadata: null,
    }))).toBe("API key · claude-api-1");
  });
});

describe("composer account compatibility", () => {
  const resolveCompatibleComposerAccountId = (
    accountLabels as unknown as {
      resolveCompatibleComposerAccountId?: (args: {
        accounts: AccountRecord[];
        workerType: string | null;
        selectedAccountId: string;
      }) => string;
    }
  ).resolveCompatibleComposerAccountId;

  it("drops a Claude account when the worker changes to OpenCode", () => {
    expect(resolveCompatibleComposerAccountId).toBeTypeOf("function");
    if (!resolveCompatibleComposerAccountId) return;

    expect(resolveCompatibleComposerAccountId({
      accounts: [account({ id: "claude-sub-1", cliType: "claude" })],
      workerType: "opencode",
      selectedAccountId: "claude-sub-1",
    })).toBe("auto");
  });

  it("keeps an enabled account that belongs to the selected worker", () => {
    expect(resolveCompatibleComposerAccountId).toBeTypeOf("function");
    if (!resolveCompatibleComposerAccountId) return;

    expect(resolveCompatibleComposerAccountId({
      accounts: [account({ id: "claude-sub-1", cliType: "claude" })],
      workerType: "claude",
      selectedAccountId: "claude-sub-1",
    })).toBe("claude-sub-1");
  });

  it("drops disabled accounts even when their worker type matches", () => {
    expect(resolveCompatibleComposerAccountId).toBeTypeOf("function");
    if (!resolveCompatibleComposerAccountId) return;

    expect(resolveCompatibleComposerAccountId({
      accounts: [account({ id: "claude-sub-1", cliType: "claude", enabled: false })],
      workerType: "claude",
      selectedAccountId: "claude-sub-1",
    })).toBe("auto");
  });
});
