import { execFileSync } from "child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { homedir } from "os";
import { join, resolve } from "path";
import yaml from "js-yaml";
import { and, eq, exists } from "drizzle-orm";
import { db } from "@/server/db";
import {
  accountSecrets,
  accountUsageSnapshots,
  accounts,
  creditEvents,
  runs,
  settings,
  workerCredentialAllocations,
  workerTokenUsage,
} from "@/server/db/schema";
import { getAppRoot } from "@/server/app-root";
import { resolveCredentialProfilesDir } from "@/server/agent-runtime/external-credentials";
import { emitNamedEvent } from "@/server/events/named-events";
import { repairAccountsFromCredentialVerificationHistory } from "@/server/accounts/login-required";

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

const CLAUDE_IDENTITY_REFRESH_MS = 6 * 60 * 60 * 1000;
export const DELETED_ACCOUNT_SETTING_PREFIX = "OMNIHARNESS_DELETED_ACCOUNT:";

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

function isClaudeLocalSessionAccount(input: {
  cliType?: string | null;
  provider?: string | null;
  type?: string | null;
  authRef?: string | null;
}) {
  const cliType = normalizeWorkerType(input.cliType ?? undefined);
  const provider = input.provider?.trim().toLowerCase() ?? "";
  const accountType = input.type?.trim().toLowerCase() ?? "";
  const authRef = input.authRef?.trim().toUpperCase() ?? "";
  return (
    (cliType === "claude" || provider === "anthropic" || provider === "claude" || provider === "claude-code")
    && accountType === "subscription"
    && (authRef === "" || authRef.startsWith("CLAUDE_CODE_TOKEN") || authRef.startsWith("LOCAL"))
  );
}

function authForImportedAccount(input: {
  cliType: WorkerType | null;
  provider: string;
  type: "subscription" | "api" | "external";
  authRef: string;
}) {
  if (isClaudeLocalSessionAccount(input)) {
    return { authMode: "local_session", authRef: "local-session:claude" };
  }
  return { authMode: "legacy_ref", authRef: input.authRef };
}

function settingCommandKey(workerType: WorkerType) {
  return `OMNIHARNESS_CREDENTIAL_COMMAND_${workerType.toUpperCase()}`;
}

function getSettingValue(rows: Array<typeof settings.$inferSelect>, key: string) {
  return rows.find((row) => row.key === key)?.value?.trim() || "";
}

export function deletedAccountSettingKey(accountId: string) {
  return `${DELETED_ACCOUNT_SETTING_PREFIX}${encodeURIComponent(accountId)}`;
}

function deletedAccountIdsFromSettings(rows: Array<typeof settings.$inferSelect>) {
  return new Set(rows
    .filter((row) => row.key.startsWith(DELETED_ACCOUNT_SETTING_PREFIX))
    .map((row) => row.value.trim())
    .filter(Boolean));
}

function parseMetadata(metadataJson: string | null | undefined): Record<string, unknown> {
  if (!metadataJson) return {};
  try {
    const parsed = JSON.parse(metadataJson) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function metadataIdentity(metadata: Record<string, unknown>) {
  const identity = metadata.identity;
  return identity && typeof identity === "object" && !Array.isArray(identity)
    ? identity as Record<string, unknown>
    : {};
}

function shouldRefreshClaudeIdentity(row: AccountRow, now: Date) {
  const metadata = parseMetadata(row.metadataJson);
  const identity = metadataIdentity(metadata);
  if (!asString(identity.email)) return true;
  const checkedAt = asString(identity.checkedAt);
  if (!checkedAt) return true;
  const checkedTime = new Date(checkedAt).getTime();
  return !Number.isFinite(checkedTime) || now.getTime() - checkedTime > CLAUDE_IDENTITY_REFRESH_MS;
}

function readClaudeLocalSessionIdentity(now: Date) {
  try {
    const env = {
      ...process.env,
      CLAUDE_CONFIG_DIR: join(process.env.HOME?.trim() || homedir(), ".claude"),
      ANTHROPIC_API_KEY: "",
      ANTHROPIC_AUTH_TOKEN: "",
      ANTHROPIC_BASE_URL: "",
      CLAUDE_CODE_OAUTH_TOKEN: "",
    };
    const raw = execFileSync("claude", ["auth", "status"], {
      env,
      encoding: "utf8",
      timeout: 2_000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      email: asString(parsed.email),
      authMethod: asString(parsed.authMethod),
      apiProvider: asString(parsed.apiProvider),
      subscriptionType: asString(parsed.subscriptionType),
      checkedAt: now.toISOString(),
    };
  } catch {
    return null;
  }
}

function mergeIdentityMetadata(row: AccountRow, now: Date) {
  if (row.cliType !== "claude" || row.authMode !== "local_session" || !shouldRefreshClaudeIdentity(row, now)) {
    return null;
  }
  const identity = readClaudeLocalSessionIdentity(now);
  if (!identity) return null;
  return JSON.stringify({
    ...parseMetadata(row.metadataJson),
    identity,
  });
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
    if (row.authMode === "legacy_ref" && isClaudeLocalSessionAccount({
      cliType: row.cliType ?? cliType,
      provider: row.provider,
      type: row.type,
      authRef: row.authRef,
    })) {
      patch.authMode = "local_session";
      patch.authRef = "local-session:claude";
    }
    if (
      row.id === "local-session-codex"
      && row.cliType === "codex"
      && row.authMode === "local_session"
      && row.label === "Codex local session"
    ) {
      patch.label = "Codex subscription";
    }
    const rowAfterAuthPatch = {
      ...row,
      ...patch,
    };
    const metadataJson = mergeIdentityMetadata(rowAfterAuthPatch, now);
    if (metadataJson && metadataJson !== row.metadataJson) {
      patch.metadataJson = metadataJson;
    }
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

async function importConfigAccounts(configPath: string, now: Date, deletedAccountIds: Set<string>) {
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
    if (deletedAccountIds.has(id)) continue;
    if (!id || !provider || !authRef) {
      skippedInvalidConfigRows += 1;
      continue;
    }
    const cliType = inferWorkerType(provider, authRef);
    const type = normalizeAccountType(typeof row.type === "string" ? row.type : null);
    const auth = authForImportedAccount({ cliType, provider, type, authRef });
    const result = await upsertAccount({
      id,
      cliType,
      provider,
      type,
      label: id,
      authMode: auth.authMode,
      authRef: auth.authRef,
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

async function importSettingsAccounts(
  now: Date,
  rows: Array<typeof settings.$inferSelect>,
  deletedAccountIds: Set<string>,
) {
  let imported = 0;

  for (const workerType of WORKER_TYPES) {
    const commandKey = settingCommandKey(workerType);
    if (getSettingValue(rows, commandKey)) {
      const accountId = `credential-command-${workerType}`;
      if (deletedAccountIds.has(accountId)) continue;
      const result = await upsertAccount({
        id: accountId,
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

  const profilesDir = resolveCredentialProfilesDir({
    ...process.env,
    OMNIHARNESS_CREDENTIAL_PROFILES_DIR: getSettingValue(rows, "OMNIHARNESS_CREDENTIAL_PROFILES_DIR"),
  }, process.cwd());
  for (const profileName of profileDirectories(profilesDir)) {
    const workerType = normalizeWorkerType(profileName);
    if (!workerType) continue;
    const accountId = `credential-profile-${workerType}`;
    if (deletedAccountIds.has(accountId)) continue;
    const result = await upsertAccount({
      id: accountId,
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
    const accountId = `api-key-${apiKey.workerType}-${apiKey.key.toLowerCase().replace(/_/g, "-")}`;
    if (deletedAccountIds.has(accountId)) continue;
    const result = await upsertAccount({
      id: accountId,
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

async function removeAccountsDeletedDuringMigration() {
  const latestSettingRows = await db.select().from(settings);
  const deletedAccountIds = deletedAccountIdsFromSettings(latestSettingRows);
  if (deletedAccountIds.size === 0) return;

  for (const accountId of deletedAccountIds) {
    const existingAccount = await db.select({ cliType: accounts.cliType })
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .get();
    try {
      const markerStillExists = () => exists(
        db.select({ key: settings.key })
          .from(settings)
          .where(eq(settings.key, deletedAccountSettingKey(accountId))),
      );
      const cleanupResults = await db.batch([
        db.update(runs)
          .set({ preferredWorkerAccountId: null })
          .where(and(eq(runs.preferredWorkerAccountId, accountId), markerStillExists())),
        db.delete(creditEvents)
          .where(and(eq(creditEvents.accountId, accountId), markerStillExists())),
        db.delete(workerCredentialAllocations)
          .where(and(eq(workerCredentialAllocations.accountId, accountId), markerStillExists())),
        db.delete(workerTokenUsage)
          .where(and(eq(workerTokenUsage.accountId, accountId), markerStillExists())),
        db.delete(accountUsageSnapshots)
          .where(and(eq(accountUsageSnapshots.accountId, accountId), markerStillExists())),
        db.delete(accountSecrets)
          .where(and(eq(accountSecrets.accountId, accountId), markerStillExists())),
        db.delete(accounts)
          .where(and(eq(accounts.id, accountId), markerStillExists())),
      ]);
      if (cleanupResults.every((result) => result.rowsAffected === 0)) continue;
      emitNamedEvent({
        kind: "account.deleted",
        accountId,
        workerType: existingAccount?.cliType ?? null,
      });
    } catch (error) {
      const cause = error instanceof Error ? error : new Error(String(error));
      emitNamedEvent({
        kind: "account.delete_failed",
        accountId,
        workerType: existingAccount?.cliType ?? null,
        reason: "migration_tombstone_cleanup_failed",
      });
      emitNamedEvent({
        kind: "error.surfaced",
        code: "account.delete.failed",
        message: `Could not keep deleted account ${accountId} removed during account refresh: ${cause.message}`,
        surface: "log",
        accountId,
        cause: { name: cause.name, message: cause.message },
      });
    }
  }
}

export async function runAccountInventoryMigration(
  options: RunAccountInventoryMigrationOptions = {},
): Promise<AccountInventoryMigrationResult> {
  const now = options.now ?? new Date();
  const settingRows = await db.select().from(settings);
  const deletedAccountIds = deletedAccountIdsFromSettings(settingRows);
  const normalizedExisting = await normalizeExistingAccounts(now);
  const config = await importConfigAccounts(options.configPath ?? defaultConfigPath(), now, deletedAccountIds);
  const importedSettingAccounts = await importSettingsAccounts(now, settingRows, deletedAccountIds);
  await removeAccountsDeletedDuringMigration();
  await repairAccountsFromCredentialVerificationHistory(now);
  return {
    normalizedExisting,
    importedConfigAccounts: config.imported,
    importedSettingAccounts,
    skippedInvalidConfigRows: config.skippedInvalidConfigRows,
  };
}
