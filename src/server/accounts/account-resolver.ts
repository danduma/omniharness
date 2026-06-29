import { join } from "path";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { accounts } from "@/server/db/schema";
import { getAppDataPath } from "@/server/app-root";
import {
  applyCredentialProfileEnv,
  resolveCredentialProfile,
  type CredentialProfileResolution,
} from "@/server/agent-runtime/external-credentials";
import { RuntimeHttpError } from "@/server/agent-runtime/types";

type EnvLike = Record<string, string | undefined>;
type AccountRow = typeof accounts.$inferSelect;

export type ResolvedAccountCredentials = {
  account: AccountRow | null;
  env: Record<string, string>;
  unset: string[];
  credentialProfile: CredentialProfileResolution;
  allowGlobalCredentialBridge: boolean;
};

function accountHome(account: AccountRow) {
  const cliType = account.cliType?.trim() || "unknown";
  return getAppDataPath("account-cli-homes", cliType, account.id);
}

function isolatedHomeEnv(account: AccountRow): Record<string, string> {
  const root = accountHome(account);
  switch (account.cliType) {
    case "codex":
      return {
        CODEX_HOME: join(root, "home"),
        CODEX_SQLITE_HOME: join(root, "sqlite"),
      };
    case "claude":
      return { CLAUDE_CONFIG_DIR: join(root, "config") };
    case "gemini":
      return { GEMINI_CLI_HOME: join(root, "home") };
    case "opencode":
      return {
        OPENCODE_CONFIG_DIR: join(root, "config"),
        XDG_DATA_HOME: join(root, "data"),
        XDG_STATE_HOME: join(root, "state"),
        XDG_CACHE_HOME: join(root, "cache"),
      };
    default:
      return {};
  }
}

function profileNameFromAuthRef(authRef: string) {
  const trimmed = authRef.trim();
  if (trimmed.startsWith("profile:")) return trimmed.slice("profile:".length);
  return trimmed;
}

function envKeyFromAuthRef(authRef: string) {
  const trimmed = authRef.trim();
  if (trimmed.startsWith("setting:")) return trimmed.slice("setting:".length).trim();
  return trimmed;
}

function emptyCredentialProfile(): CredentialProfileResolution {
  return { env: {}, unset: [], status: null };
}

export async function resolveAccountCredentials(input: {
  workerType: string;
  cwd: string;
  env: EnvLike;
  accountId?: string | null;
  account?: AccountRow | null;
  configuredCredentialProfile?: string | null;
  requestedCredentialProfile?: string | null;
}): Promise<ResolvedAccountCredentials> {
  const account = input.account ?? (
    input.accountId
      ? await db.select().from(accounts).where(eq(accounts.id, input.accountId)).get()
      : null
  );

  if (!account) {
    const credentialProfile = await resolveCredentialProfile({
      type: input.workerType,
      cwd: input.cwd,
      env: input.env,
      requestedProfile: input.requestedCredentialProfile,
      configuredProfile: input.configuredCredentialProfile,
    });
    return {
      account: null,
      env: credentialProfile.env,
      unset: credentialProfile.unset,
      credentialProfile,
      allowGlobalCredentialBridge: true,
    };
  }

  if (account.cliType && account.cliType !== input.workerType) {
    throw new RuntimeHttpError(400, `Account "${account.id}" cannot be used for ${input.workerType} workers.`);
  }

  if (!account.enabled) {
    throw new RuntimeHttpError(400, `Account "${account.id}" is disabled.`);
  }

  if (account.authMode === "isolated_cli_home") {
    const env = isolatedHomeEnv(account);
    return {
      account,
      env,
      unset: [],
      credentialProfile: emptyCredentialProfile(),
      allowGlobalCredentialBridge: false,
    };
  }

  if (account.authMode === "credential_profile") {
    const credentialProfile = await resolveCredentialProfile({
      type: input.workerType,
      cwd: input.cwd,
      env: input.env,
      requestedProfile: profileNameFromAuthRef(account.authRef),
      configuredProfile: null,
    });
    return {
      account,
      env: credentialProfile.env,
      unset: credentialProfile.unset,
      credentialProfile,
      allowGlobalCredentialBridge: false,
    };
  }

  if (account.authMode === "api_key") {
    const envKey = envKeyFromAuthRef(account.authRef);
    const value = envKey ? input.env[envKey]?.trim() : "";
    if (!envKey || !value) {
      throw new RuntimeHttpError(400, `Account "${account.id}" API key setting is not configured.`);
    }
    return {
      account,
      env: { [envKey]: value },
      unset: [],
      credentialProfile: emptyCredentialProfile(),
      allowGlobalCredentialBridge: false,
    };
  }

  if (account.authMode === "local_session" || account.authMode === "legacy_ref") {
    const credentialProfile = emptyCredentialProfile();
    return {
      account,
      env: credentialProfile.env,
      unset: credentialProfile.unset,
      credentialProfile,
      allowGlobalCredentialBridge: true,
    };
  }

  throw new RuntimeHttpError(400, `Account auth mode "${account.authMode}" is not supported yet.`);
}

export function applyAccountCredentialEnv<T extends EnvLike>(env: T, resolved: ResolvedAccountCredentials): T {
  for (const key of resolved.unset) {
    delete env[key];
  }
  Object.assign(env, resolved.env);
  applyCredentialProfileEnv(env, resolved.credentialProfile);
  return env;
}
