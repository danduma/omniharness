import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join, resolve } from "path";
import yaml from "js-yaml";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { accounts, settings } from "@/server/db/schema";
import { getAppRoot } from "@/server/app-root";
import { emitNamedEvent } from "@/server/events/named-events";

type AccountRow = typeof accounts.$inferSelect;

type LegacyAccountConfig = {
  id?: unknown;
  provider?: unknown;
  type?: unknown;
  auth_ref?: unknown;
  capacity?: unknown;
  reset_schedule?: unknown;
};

const WORKER_TYPES = ["codex", "claude", "gemini", "opencode"] as const;
type WorkerType = (typeof WORKER_TYPES)[number];

const PROVIDER_TO_WORKER: Record<string, WorkerType> = {
  anthropic: "claude",
  claude: "claude",
  "claude-code": "claude",
  openai: "codex",
  codex: "codex",
  google: "gemini",
  gemini: "gemini",
  opencode: "opencode",
};

const WORKER_TO_PROVIDER: Record<WorkerType, string> = {
  claude: "anthropic",
  codex: "openai",
  gemini: "google",
  opencode: "opencode",
};

const API_KEY_ACCOUNTS: Array<{ key: string; workerType: WorkerType; provider: string }> = [
  { key: "OPENAI_API_KEY", workerType: "codex", provider: "openai" },
  { key: "ANTHROPIC_API_KEY", workerType: "claude", provider: "anthropic" },
  { key: "ANTHROPIC_AUTH_TOKEN", workerType: "claude", provider: "anthropic" },
  { key: "GEMINI_API_KEY", workerType: "gemini", provider: "google" },
  { key: "GOOGLE_API_KEY", workerType: "gemini", provider: "google" },
];

export type AccountInventoryMigrationResult = {
  normalizedExisting: number;
  importedConfigAccounts: number;
  importedSettingAccounts: number;
  skippedInvalidConfigRows: number;
};

export type RunAccountInventoryMigrationOptions = {
  configPath?: string | null;
  now?: Date;
};

function normalizeWorkerType(value: string | null | undefined): WorkerType | null {
  const normalized = value?.trim().toLowerCase().replace(/[_\s]+/g, "-") ?? "";
  if (normalized === "claude-code") return "claude";
  return (WORKER_TYPES as readonly string[]).includes(normalized) ? normalized as WorkerType : null;
}

function inferWorkerType(provider: string | null | undefined, authRef: string | null | undefined): WorkerType | null {
  const providerKey = provider?.trim().toLowerCase() ?? "";
  const fromProvider = normalizeWorkerType(providerKey) ?? PROVIDER_TO_WORKER[providerKey] ?? null;
  if (fromProvider) return fromProvider;

  const ref = authRef?.trim().toUpperCase() ?? "";
  if (ref.includes("ANTHROPIC") || ref.includes("CLAUDE")) return "claude";
  if (ref.includes("OPENAI") || ref.includes("CODEX")) return "codex";
  if (ref.includes("GEMINI") || ref.includes("GOOGLE")) return "gemini";
  if (ref.includes("OPENCODE")) return "opencode";
  return null;
}

function normalizeAccountType(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (normalized === "subscription" || normalized === "api" || normalized === "external") return normalized;
  return "external";
}

function settingCommandKey(workerType: WorkerType) {
  return `OMNIHARNESS_CREDENTIAL_COMMAND_${workerType.toUpperCase()}`;
}

function getSettingValue(rows: Array<typeof settings.$inferSelect>, key: string) {
  return rows.find((row) => row.key === key)?.value?.trim() || "";
}

function defaultConfigPath() {
  return resolve(getAppRoot(), "config", "accounts.yml");
}

function parseLegacyConfig(configPath: string): { rows: LegacyAccountConfig[]; skipped: number } {
  if (!existsSync(configPath)) return { rows: [], skipped: 0 };
  const raw = readFileSync(configPath, "utf8");
  const parsed = yaml.load(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { rows: [], skipped: 1 };
  }
  const rows = (parsed as { accounts?: unknown }).accounts;
  if (!Array.isArray(rows)) return { rows: [], skipped: 0 };
  return {
    rows: rows.filter((row): row is LegacyAccountConfig => row !== null && typeof row === "object" && !Array.isArray(row)),
    skipped: rows.filter((row) => row === null || typeof row !== "object" || Array.isArray(row)).length,
  };
}

async function upsertAccount(input: {
  id: string;
  cliType: WorkerType | null;
  provider: string;
  type: "subscription" | "api" | "external";
  label: string;
  authMode: string;
  authRef: string;
  capacity?: number | null;
  resetSchedule?: string | null;
  priority: number;
  now: Date;
}): Promise<"inserted" | "updated" | "unchanged"> {
  const existing = await db.select().from(accounts).where(eq(accounts.id, input.id)).get();
  if (!existing) {
    await db.insert(accounts).values({
      id: input.id,
      cliType: input.cliType,
      provider: input.provider,
      type: input.type,
      label: input.label,
      authMode: input.authMode,
      authRef: input.authRef,
      enabled: true,
      priority: input.priority,
      capacity: input.capacity ?? null,
      resetSchedule: input.resetSchedule ?? null,
      createdAt: input.now,
      updatedAt: input.now,
    });
    emitNamedEvent({
      kind: "account.created",
      accountId: input.id,
      workerType: input.cliType,
      provider: input.provider,
      authMode: input.authMode,
    });
    return "inserted";
  }

  const patch: Partial<AccountRow> = {};
  if (!existing.cliType && input.cliType) patch.cliType = input.cliType;
  if (!existing.label && input.label) patch.label = input.label;
  if (!existing.authMode) patch.authMode = input.authMode;
  if (existing.updatedAt === null) patch.updatedAt = input.now;
  if (existing.priority === null || existing.priority === undefined) patch.priority = input.priority;

  const changedKeys = Object.keys(patch);
  if (changedKeys.length === 0) return "unchanged";
  await db.update(accounts).set(patch).where(eq(accounts.id, input.id));
  emitNamedEvent({
    kind: "account.updated",
    accountId: input.id,
    workerType: input.cliType,
    changedKeys,
  });
  return "updated";
}

async function normalizeExistingAccounts(now: Date) {
  const rows = await db.select().from(accounts);
  let changed = 0;
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const patch: Partial<AccountRow> = {};
    const cliType = inferWorkerType(row.provider, row.authRef);
    if (!row.cliType && cliType) patch.cliType = cliType;
    if (!row.authMode) patch.authMode = "legacy_ref";
    if (row.updatedAt === null) patch.updatedAt = now;
    if (row.priority === null || row.priority === undefined) patch.priority = index;
    const changedKeys = Object.keys(patch);
    if (changedKeys.length === 0) continue;
    await db.update(accounts).set(patch).where(eq(accounts.id, row.id));
    emitNamedEvent({
      kind: "account.updated",
      accountId: row.id,
      workerType: cliType,
      changedKeys,
    });
    changed += 1;
  }
  return changed;
}

async function importConfigAccounts(configPath: string, now: Date) {
  let imported = 0;
  let skippedInvalidConfigRows = 0;
  let parsed: { rows: LegacyAccountConfig[]; skipped: number };
  try {
    parsed = parseLegacyConfig(configPath);
  } catch (error) {
    emitNamedEvent({
      kind: "error.surfaced",
      code: "account.migration_failed",
      message: `Failed to import account config: ${error instanceof Error ? error.message : String(error)}`,
      surface: "log",
      cause: error instanceof Error ? { name: error.name, message: error.message } : null,
    });
    return { imported, skippedInvalidConfigRows: 1 };
  }
  skippedInvalidConfigRows += parsed.skipped;

  for (const [index, row] of parsed.rows.entries()) {
    const id = typeof row.id === "string" ? row.id.trim() : "";
    const provider = typeof row.provider === "string" ? row.provider.trim() : "";
    const authRef = typeof row.auth_ref === "string" ? row.auth_ref.trim() : "";
    if (!id || !provider || !authRef) {
      skippedInvalidConfigRows += 1;
      continue;
    }
    const result = await upsertAccount({
      id,
      cliType: inferWorkerType(provider, authRef),
      provider,
      type: normalizeAccountType(typeof row.type === "string" ? row.type : null),
      label: id,
      authMode: "legacy_ref",
      authRef,
      capacity: typeof row.capacity === "number" ? row.capacity : null,
      resetSchedule: typeof row.reset_schedule === "string" ? row.reset_schedule : null,
      priority: index,
      now,
    });
    if (result === "inserted") imported += 1;
  }
  return { imported, skippedInvalidConfigRows };
}

function profileDirectories(profilesDir: string) {
  if (!profilesDir || !existsSync(profilesDir)) return [];
  return readdirSync(profilesDir)
    .filter((entry) => {
      try {
        return statSync(join(profilesDir, entry)).isDirectory();
      } catch {
        return false;
      }
    });
}

async function importSettingsAccounts(now: Date) {
  const rows = await db.select().from(settings);
  let imported = 0;

  for (const workerType of WORKER_TYPES) {
    const commandKey = settingCommandKey(workerType);
    if (getSettingValue(rows, commandKey)) {
      const result = await upsertAccount({
        id: `credential-command-${workerType}`,
        cliType: workerType,
        provider: WORKER_TO_PROVIDER[workerType],
        type: "external",
        label: `${workerType} credential command`,
        authMode: "credential_command",
        authRef: `setting:${commandKey}`,
        priority: 0,
        now,
      });
      if (result === "inserted") imported += 1;
    }
  }

  const profilesDir = getSettingValue(rows, "OMNIHARNESS_CREDENTIAL_PROFILES_DIR");
  for (const profileName of profileDirectories(profilesDir)) {
    const workerType = normalizeWorkerType(profileName);
    if (!workerType) continue;
    const result = await upsertAccount({
      id: `credential-profile-${workerType}`,
      cliType: workerType,
      provider: WORKER_TO_PROVIDER[workerType],
      type: "external",
      label: `${workerType} credential profile`,
      authMode: "credential_profile",
      authRef: `profile:${profileName}`,
      priority: 0,
      now,
    });
    if (result === "inserted") imported += 1;
  }

  for (const apiKey of API_KEY_ACCOUNTS) {
    if (!getSettingValue(rows, apiKey.key)) continue;
    const result = await upsertAccount({
      id: `api-key-${apiKey.workerType}-${apiKey.key.toLowerCase().replace(/_/g, "-")}`,
      cliType: apiKey.workerType,
      provider: apiKey.provider,
      type: "api",
      label: `${apiKey.workerType} API key`,
      authMode: "api_key",
      authRef: `setting:${apiKey.key}`,
      priority: 0,
      now,
    });
    if (result === "inserted") imported += 1;
  }

  return imported;
}

export async function runAccountInventoryMigration(
  options: RunAccountInventoryMigrationOptions = {},
): Promise<AccountInventoryMigrationResult> {
  const now = options.now ?? new Date();
  const normalizedExisting = await normalizeExistingAccounts(now);
  const config = await importConfigAccounts(options.configPath ?? defaultConfigPath(), now);
  const importedSettingAccounts = await importSettingsAccounts(now);
  return {
    normalizedExisting,
    importedConfigAccounts: config.imported,
    importedSettingAccounts,
    skippedInvalidConfigRows: config.skippedInvalidConfigRows,
  };
}
