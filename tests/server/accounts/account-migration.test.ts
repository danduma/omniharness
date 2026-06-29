import { mkdirSync, writeFileSync } from "fs";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { accounts, settings } from "@/server/db/schema";
import { runAccountInventoryMigration } from "@/server/accounts/migration";
import { toAccountDto } from "@/server/accounts/dto";

const now = new Date("2026-06-29T15:00:00.000Z");

async function setting(key: string, value: string) {
  await db.insert(settings).values({
    key,
    value,
    updatedAt: now,
  });
}

describe("account inventory migration", () => {
  beforeEach(async () => {
    await db.delete(accounts);
    await db.delete(settings);
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
      authMode: "legacy_ref",
      enabled: true,
      priority: 0,
      updatedAt: now,
    });
    expect(JSON.stringify(toAccountDto(row!))).not.toContain("CLAUDE_CODE_TOKEN_1");
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
});
