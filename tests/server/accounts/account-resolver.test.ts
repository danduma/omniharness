import { mkdtempSync, mkdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { accounts } from "@/server/db/schema";
import { resolveAccountCredentials } from "@/server/accounts/account-resolver";

async function insertAccount(input: Partial<typeof accounts.$inferInsert> & { cliType: string; authMode: string; authRef: string }) {
  const now = new Date("2026-06-29T13:30:00.000Z");
  const id = `account-${randomUUID()}`;
  await db.insert(accounts).values({
    id,
    cliType: input.cliType,
    provider: input.provider ?? "openai",
    type: input.type ?? "subscription",
    label: input.label ?? id,
    authMode: input.authMode,
    authRef: input.authRef,
    enabled: input.enabled ?? true,
    priority: input.priority ?? 0,
    status: input.status ?? "healthy",
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  });
  return id;
}

describe("account resolver", () => {
  it("resolves Codex isolated CLI homes without allowing global credential bridging", async () => {
    const accountId = await insertAccount({
      cliType: "codex",
      authMode: "isolated_cli_home",
      authRef: "cli-home:test-codex",
    });

    const resolved = await resolveAccountCredentials({
      workerType: "codex",
      cwd: process.cwd(),
      env: { HOME: "/Users/tester" },
      accountId,
    });

    expect(resolved.account?.id).toBe(accountId);
    expect(resolved.env.CODEX_HOME).toContain(join("account-cli-homes", "codex", accountId, "home"));
    expect(resolved.env.CODEX_SQLITE_HOME).toContain(join("account-cli-homes", "codex", accountId, "sqlite"));
    expect(resolved.allowGlobalCredentialBridge).toBe(false);
  });

  it("resolves account-backed credential profiles through the existing profile loader", async () => {
    const temp = mkdtempSync(join(tmpdir(), "omni-account-profile-"));
    const profilesDir = join(temp, "profiles");
    const profileDir = join(profilesDir, "work");
    mkdirSync(join(profileDir, "env"), { recursive: true });
    writeFileSync(join(profileDir, "env", "OPENAI_API_KEY"), "profile-key\n");

    const accountId = await insertAccount({
      cliType: "codex",
      type: "external",
      authMode: "credential_profile",
      authRef: "profile:work",
    });

    const resolved = await resolveAccountCredentials({
      workerType: "codex",
      cwd: temp,
      env: {
        HOME: "/Users/tester",
        OMNIHARNESS_CREDENTIAL_PROFILES_DIR: profilesDir,
      },
      accountId,
    });

    expect(resolved.account?.id).toBe(accountId);
    expect(resolved.env.OPENAI_API_KEY).toBe("profile-key");
    expect(resolved.credentialProfile.status).toMatchObject({
      name: "work",
      source: "file",
      envKeys: ["OPENAI_API_KEY"],
    });
    expect(resolved.allowGlobalCredentialBridge).toBe(false);
  });

  it("resolves API-key accounts from hydrated runtime env settings", async () => {
    const accountId = await insertAccount({
      cliType: "gemini",
      provider: "google",
      type: "api",
      authMode: "api_key",
      authRef: "setting:GEMINI_API_KEY",
    });

    const resolved = await resolveAccountCredentials({
      workerType: "gemini",
      cwd: process.cwd(),
      env: {
        HOME: "/Users/tester",
        GEMINI_API_KEY: "runtime-gemini-key",
      },
      accountId,
    });

    expect(resolved.account?.id).toBe(accountId);
    expect(resolved.env.GEMINI_API_KEY).toBe("runtime-gemini-key");
    expect(resolved.allowGlobalCredentialBridge).toBe(false);
  });
});
