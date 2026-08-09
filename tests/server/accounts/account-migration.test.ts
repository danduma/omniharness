import { mkdirSync, writeFileSync } from "fs";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { accounts, plans, runs, settings } from "@/server/db/schema";
import { runAccountInventoryMigration } from "@/server/accounts/migration";
import { toAccountDto } from "@/server/accounts/dto";

const now = new Date("2026-06-29T15:00:00.000Z");
const DELETED_ACCOUNT_SETTING_PREFIX = "OMNIHARNESS_DELETED_ACCOUNT:";

async function setting(key: string, value: string) {
  await db.insert(settings).values({
    key,
    value,
    updatedAt: now,
  });
}

async function deletedAccountSetting(accountId: string) {
  await setting(`${DELETED_ACCOUNT_SETTING_PREFIX}${encodeURIComponent(accountId)}`, accountId);
}

describe("account inventory migration", () => {
  const originalPath = process.env.PATH;
  const originalHome = process.env.HOME;

  beforeEach(async () => {
    await db.delete(accounts);
    await db.delete(settings);
  });

  afterEach(() => {
    process.env.PATH = originalPath;
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
  });

  it("normalizes existing thin account rows without exposing auth refs through DTOs", async () => {
    await db.insert(accounts).values({
      id: `legacy-${randomUUID()}`,
      provider: "anthropic",
      type: "subscription",
      authRef: "CLAUDE_CODE_TOKEN_1",
      createdAt: now,
    });

    await runAccountInventoryMigration({ now });

    const row = await db.select().from(accounts).get();
    expect(row).toMatchObject({
      cliType: "claude",
      authMode: "local_session",
      authRef: "local-session:claude",
      enabled: true,
      priority: 0,
      updatedAt: now,
    });
    expect(JSON.stringify(toAccountDto(row!))).not.toContain("CLAUDE_CODE_TOKEN_1");
  });

  it("normalizes legacy Claude subscription rows to local session auth", async () => {
    await db.insert(accounts).values({
      id: "claude-sub-1",
      cliType: "claude",
      provider: "anthropic",
      type: "subscription",
      label: "claude-sub-1",
      authMode: "legacy_ref",
      authRef: "CLAUDE_CODE_TOKEN_1",
      enabled: true,
      createdAt: now,
    });

    await runAccountInventoryMigration({ now });

    const row = await db.select().from(accounts).where(eq(accounts.id, "claude-sub-1")).get();
    expect(row).toMatchObject({
      authMode: "local_session",
      authRef: "local-session:claude",
      updatedAt: now,
    });
  });

  it("renames the existing Codex local session account as a subscription", async () => {
    await db.insert(accounts).values({
      id: "local-session-codex",
      cliType: "codex",
      provider: "openai",
      type: "external",
      label: "Codex local session",
      authMode: "local_session",
      authRef: "local:codex",
      enabled: true,
      createdAt: now,
    });

    await runAccountInventoryMigration({ now });

    const row = await db.select().from(accounts).where(eq(accounts.id, "local-session-codex")).get();
    expect(row?.label).toBe("Codex subscription");
  });

  it("stores Claude local session email metadata when auth status is available", async () => {
    const dir = mkdtempSync(join(tmpdir(), "omni-claude-auth-status-"));
    const binDir = join(dir, "bin");
    mkdirSync(binDir, { recursive: true });
    writeFileSync(join(binDir, "claude"), [
      "#!/bin/sh",
      "if [ \"$1\" = \"auth\" ] && [ \"$2\" = \"status\" ]; then",
      "  printf '%s\\n' '{\"loggedIn\":true,\"authMethod\":\"claude.ai\",\"apiProvider\":\"firstParty\",\"email\":\"person@example.test\",\"subscriptionType\":\"pro\"}'",
      "  exit 0",
      "fi",
      "exit 42",
      "",
    ].join("\n"), { mode: 0o700 });
    process.env.PATH = `${binDir}:${originalPath ?? ""}`;
    process.env.HOME = join(dir, "home");
    await db.insert(accounts).values({
      id: "claude-sub-1",
      cliType: "claude",
      provider: "anthropic",
      type: "subscription",
      label: "claude-sub-1",
      authMode: "local_session",
      authRef: "local-session:claude",
      enabled: true,
      createdAt: now,
    });

    await runAccountInventoryMigration({ now });

    const row = await db.select().from(accounts).where(eq(accounts.id, "claude-sub-1")).get();
    expect(row?.metadataJson ? JSON.parse(row.metadataJson) : null).toMatchObject({
      identity: {
        email: "person@example.test",
        authMethod: "claude.ai",
        apiProvider: "firstParty",
        subscriptionType: "pro",
      },
    });
  });

  it("imports config/accounts.yml idempotently without rewriting secret pointers", async () => {
    const dir = mkdtempSync(join(tmpdir(), "omni-accounts-yml-"));
    const configPath = join(dir, "accounts.yml");
    writeFileSync(configPath, [
      "accounts:",
      "  - id: codex-api",
      "    provider: openai",
      "    type: api",
      "    auth_ref: OPENAI_API_KEY",
      "  - id: claude-sub",
      "    provider: anthropic",
      "    type: subscription",
      "    auth_ref: CLAUDE_CODE_TOKEN_1",
      "    capacity: 50",
      "    reset_schedule: '0 0 * * *'",
      "",
    ].join("\n"));

    await runAccountInventoryMigration({ configPath, now });
    await runAccountInventoryMigration({ configPath, now });

    const rows = await db.select().from(accounts);
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.id === "codex-api")).toMatchObject({
      cliType: "codex",
      provider: "openai",
      type: "api",
      authMode: "legacy_ref",
      authRef: "OPENAI_API_KEY",
    });
    expect(rows.find((row) => row.id === "claude-sub")).toMatchObject({
      cliType: "claude",
      capacity: 50,
      resetSchedule: "0 0 * * *",
    });
  });

  it("creates command, profile, and API-key accounts from existing settings", async () => {
    const dir = mkdtempSync(join(tmpdir(), "omni-credential-profiles-"));
    mkdirSync(join(dir, "claude"), { recursive: true });
    await setting("OMNIHARNESS_CREDENTIAL_PROFILES_DIR", dir);
    await setting("OMNIHARNESS_CREDENTIAL_COMMAND_CODEX", "/usr/local/bin/codex-creds");
    await setting("OPENAI_API_KEY", "enc:v1:not-the-real-key");

    await runAccountInventoryMigration({ now });

    const commandAccount = await db.select().from(accounts).where(eq(accounts.id, "credential-command-codex")).get();
    const profileAccount = await db.select().from(accounts).where(eq(accounts.id, "credential-profile-claude")).get();
    const apiAccount = await db.select().from(accounts).where(eq(accounts.id, "api-key-codex-openai-api-key")).get();

    expect(commandAccount).toMatchObject({
      cliType: "codex",
      type: "external",
      authMode: "credential_command",
      authRef: "setting:OMNIHARNESS_CREDENTIAL_COMMAND_CODEX",
    });
    expect(profileAccount).toMatchObject({
      cliType: "claude",
      type: "external",
      authMode: "credential_profile",
      authRef: "profile:claude",
    });
    expect(apiAccount).toMatchObject({
      cliType: "codex",
      type: "api",
      authMode: "api_key",
      authRef: "setting:OPENAI_API_KEY",
    });
    expect(JSON.stringify([toAccountDto(commandAccount!), toAccountDto(apiAccount!)])).not.toContain("enc:v1:not-the-real-key");
  });

  it("does not recreate accounts that were explicitly deleted", async () => {
    const dir = mkdtempSync(join(tmpdir(), "omni-deleted-accounts-"));
    const configPath = join(dir, "accounts.yml");
    writeFileSync(configPath, [
      "accounts:",
      "  - id: codex-api",
      "    provider: openai",
      "    type: api",
      "    auth_ref: OPENAI_API_KEY",
      "",
    ].join("\n"));
    await setting("OMNIHARNESS_CREDENTIAL_COMMAND_CODEX", "/usr/local/bin/codex-creds");
    await setting("OPENAI_API_KEY", "enc:v1:not-the-real-key");
    await deletedAccountSetting("codex-api");
    await deletedAccountSetting("credential-command-codex");
    await deletedAccountSetting("api-key-codex-openai-api-key");

    await runAccountInventoryMigration({ configPath, now });

    expect(await db.select().from(accounts)).toHaveLength(0);
  });

  it("removes an account recreated while a deletion marker still exists", async () => {
    const accountId = "recreated-during-refresh";
    await db.insert(accounts).values({
      id: accountId,
      cliType: "codex",
      provider: "openai",
      type: "api",
      label: accountId,
      authMode: "legacy_ref",
      authRef: "OPENAI_API_KEY",
      enabled: true,
      createdAt: now,
    });
    await deletedAccountSetting(accountId);

    await runAccountInventoryMigration({ configPath: null, now });

    expect(await db.select().from(accounts).where(eq(accounts.id, accountId)).get()).toBeUndefined();
  });

  it("clears a run preference saved after its account was deleted", async () => {
    const accountId = "deleted-account-with-late-run-reference";
    const planId = `plan-${randomUUID()}`;
    const runId = `run-${randomUUID()}`;
    await db.insert(plans).values({
      id: planId,
      path: "vibes/deleted-account-late-reference.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      preferredWorkerAccountId: accountId,
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await deletedAccountSetting(accountId);

    try {
      await runAccountInventoryMigration({ configPath: null, now });

      expect(await db.select().from(runs).where(eq(runs.id, runId)).get()).toMatchObject({
        preferredWorkerAccountId: null,
      });
    } finally {
      await db.delete(runs).where(eq(runs.id, runId));
      await db.delete(plans).where(eq(plans.id, planId));
    }
  });
});
