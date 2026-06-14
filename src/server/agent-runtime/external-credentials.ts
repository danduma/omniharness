import { execFile } from "child_process";
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
} from "fs";
import { homedir } from "os";
import { isAbsolute, join, resolve } from "path";
import { RuntimeHttpError } from "./types";

type EnvLike = Record<string, string | undefined>;

type CredentialProfileConfig = {
  command?: string;
  args?: string[];
  timeoutMs?: number;
  env?: Record<string, string>;
  unset?: string[];
  expiresAt?: string;
};

type CredentialProviderResult = {
  env?: Record<string, string>;
  unset?: string[];
  expiresAt?: string;
};

export type CredentialProfileStatus = {
  name: string;
  status: "loaded";
  source: "file" | "command";
  envKeys: string[];
  unsetKeys: string[];
  expiresAt: string | null;
};

export type CredentialProfileResolution = {
  env: Record<string, string>;
  unset: string[];
  status: CredentialProfileStatus | null;
};

type ResolveCredentialProfileInput = {
  type: string;
  cwd: string;
  env: EnvLike;
  requestedProfile?: string | null;
  configuredProfile?: string | null;
};

const ENV_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const PROFILE_NAME_PATTERN = /^[A-Za-z0-9._-]+$/;
const DEFAULT_PROVIDER_TIMEOUT_MS = 5_000;
const MAX_PROVIDER_BUFFER_BYTES = 1024 * 1024;

function expandHome(input: string, env: EnvLike) {
  if (input === "~") {
    return env.HOME || homedir();
  }
  if (input.startsWith("~/")) {
    return join(env.HOME || homedir(), input.slice(2));
  }
  return input;
}

function normalizeProfileName(input: string) {
  const name = input.trim();
  if (!PROFILE_NAME_PATTERN.test(name)) {
    throw new RuntimeHttpError(400, `Invalid credential profile name "${input}".`);
  }
  return name;
}

function normalizeEnvName(input: string) {
  const name = input.trim();
  if (!ENV_NAME_PATTERN.test(name)) {
    throw new RuntimeHttpError(400, `Invalid credential environment variable name "${input}".`);
  }
  return name;
}

function profileEnvKey(type: string) {
  return `OMNIHARNESS_CREDENTIAL_PROFILE_${type.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
}

function credentialCommandEnvKey(type: string) {
  return `OMNIHARNESS_CREDENTIAL_COMMAND_${type.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
}

function credentialCommandArgsEnvKey(type: string) {
  return `OMNIHARNESS_CREDENTIAL_COMMAND_ARGS_${type.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
}

function credentialCommandTimeoutEnvKey(type: string) {
  return `OMNIHARNESS_CREDENTIAL_COMMAND_TIMEOUT_MS_${type.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
}

function resolveProfilesDir(env: EnvLike, cwd: string) {
  const configured = env.OMNIHARNESS_CREDENTIAL_PROFILES_DIR?.trim();
  if (configured) {
    const expanded = expandHome(configured, env);
    return isAbsolute(expanded) ? expanded : resolve(cwd, expanded);
  }

  const root = env.OMNIHARNESS_ROOT?.trim() || process.cwd();
  return join(root, ".omniharness", "credential-profiles");
}

function readTextFileIfPresent(filePath: string) {
  try {
    return readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function parseStringArray(value: unknown, field: string) {
  if (value == null) {
    return [];
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new RuntimeHttpError(400, `Credential profile ${field} must be an array of strings.`);
  }
  return value;
}

function parseCommandArgsEnv(value: string | undefined, field: string) {
  const raw = value?.trim();
  if (!raw) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new RuntimeHttpError(400, `Credential ${field} must be a JSON array of strings.`);
  }

  return parseStringArray(parsed, field);
}

function parseCommandTimeoutEnv(value: string | undefined) {
  const raw = value?.trim();
  if (!raw) {
    return DEFAULT_PROVIDER_TIMEOUT_MS;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new RuntimeHttpError(400, "Credential command timeout must be a number of milliseconds.");
  }

  return Math.max(1, Math.min(Math.round(parsed), 60_000));
}

function parseEnvRecord(value: unknown) {
  if (value == null) {
    return {};
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new RuntimeHttpError(400, "Credential profile env must be an object.");
  }

  const env: Record<string, string> = {};
  for (const [key, rawValue] of Object.entries(value)) {
    env[normalizeEnvName(key)] = String(rawValue);
  }
  return env;
}

function parseCredentialPayload(value: unknown): CredentialProviderResult {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new RuntimeHttpError(400, "Credential provider output must be a JSON object.");
  }
  const record = value as Record<string, unknown>;
  const expiresAt = record.expiresAt == null ? undefined : String(record.expiresAt);
  return {
    env: parseEnvRecord(record.env),
    unset: parseStringArray(record.unset, "unset").map(normalizeEnvName),
    ...(expiresAt ? { expiresAt } : {}),
  };
}

function readProfileConfig(profileDir: string): CredentialProfileConfig {
  const raw = readTextFileIfPresent(join(profileDir, "profile.json"));
  if (!raw) {
    return {};
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new RuntimeHttpError(400, `Credential profile file is not valid JSON: ${join(profileDir, "profile.json")}`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new RuntimeHttpError(400, "Credential profile file must contain a JSON object.");
  }

  const record = parsed as Record<string, unknown>;
  return {
    ...(typeof record.command === "string" && record.command.trim() ? { command: record.command.trim() } : {}),
    args: parseStringArray(record.args, "args"),
    timeoutMs: typeof record.timeoutMs === "number" && Number.isFinite(record.timeoutMs)
      ? Math.max(1, Math.min(record.timeoutMs, 60_000))
      : undefined,
    env: parseEnvRecord(record.env),
    unset: parseStringArray(record.unset, "unset").map(normalizeEnvName),
    ...(typeof record.expiresAt === "string" && record.expiresAt.trim() ? { expiresAt: record.expiresAt.trim() } : {}),
  };
}

function readEnvDir(profileDir: string) {
  const envDir = join(profileDir, "env");
  if (!existsSync(envDir)) {
    return {};
  }
  if (!statSync(envDir).isDirectory()) {
    throw new RuntimeHttpError(400, `Credential profile env path is not a directory: ${envDir}`);
  }

  const env: Record<string, string> = {};
  for (const entry of readdirSync(envDir)) {
    const name = normalizeEnvName(entry);
    const filePath = join(envDir, entry);
    if (!statSync(filePath).isFile()) {
      continue;
    }
    env[name] = readFileSync(filePath, "utf8").replace(/\r?\n$/, "");
  }
  return env;
}

function readUnsetFile(profileDir: string) {
  const raw = readTextFileIfPresent(join(profileDir, "unset"));
  if (!raw) {
    return [];
  }
  return raw
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(normalizeEnvName);
}

function readExpiresAtFile(profileDir: string) {
  return readTextFileIfPresent(join(profileDir, "expires_at"))?.trim() || undefined;
}

function runProviderCommand(command: string, args: string[], input: ResolveCredentialProfileInput, profileDir: string, timeoutMs: number, profileName?: string) {
  const expanded = expandHome(command, input.env);
  return new Promise<CredentialProviderResult>((resolveProvider, rejectProvider) => {
    execFile(expanded, args, {
      cwd: profileDir,
      env: input.env as NodeJS.ProcessEnv,
      timeout: timeoutMs,
      maxBuffer: MAX_PROVIDER_BUFFER_BYTES,
    }, (error, stdout) => {
      if (error) {
        rejectProvider(new RuntimeHttpError(
          400,
          `Credential profile "${profileName || input.requestedProfile || input.configuredProfile || input.type}" provider command failed.`,
        ));
        return;
      }

      try {
        resolveProvider(parseCredentialPayload(JSON.parse(stdout)));
      } catch (parseError) {
        rejectProvider(parseError);
      }
    });
  });
}

async function resolveCommandBackedProfile(input: ResolveCredentialProfileInput) {
  const command = input.env[credentialCommandEnvKey(input.type)]?.trim();
  if (!command) {
    return null;
  }

  const providerResult = await runProviderCommand(
    command,
    parseCommandArgsEnv(input.env[credentialCommandArgsEnvKey(input.type)], "command args"),
    input,
    input.cwd,
    parseCommandTimeoutEnv(input.env[credentialCommandTimeoutEnvKey(input.type)]),
    input.type,
  );
  const env = providerResult.env || {};
  const unset = [...new Set(providerResult.unset || [])].sort();

  return {
    env,
    unset,
    status: {
      name: input.type,
      status: "loaded" as const,
      source: "command" as const,
      envKeys: Object.keys(env).sort(),
      unsetKeys: unset,
      expiresAt: providerResult.expiresAt || null,
    },
  };
}

function chooseProfile(input: ResolveCredentialProfileInput, profilesDir: string) {
  const explicit = input.requestedProfile || input.configuredProfile || input.env[profileEnvKey(input.type)]?.trim();
  if (explicit) {
    return { name: normalizeProfileName(explicit), explicit: true };
  }

  const byType = normalizeProfileName(input.type);
  if (existsSync(join(profilesDir, byType))) {
    return { name: byType, explicit: false };
  }

  return null;
}

export async function resolveCredentialProfile(input: ResolveCredentialProfileInput): Promise<CredentialProfileResolution> {
  if (input.env.OMNIHARNESS_CREDENTIAL_PROFILES === "0") {
    return { env: {}, unset: [], status: null };
  }

  const profilesDir = resolveProfilesDir(input.env, input.cwd);
  const commandBacked = await resolveCommandBackedProfile(input);
  if (commandBacked) {
    return commandBacked;
  }

  const selected = chooseProfile(input, profilesDir);
  if (!selected) {
    return { env: {}, unset: [], status: null };
  }

  const profileDir = join(profilesDir, selected.name);
  if (!existsSync(profileDir)) {
    if (selected.explicit) {
      throw new RuntimeHttpError(400, `Credential profile "${selected.name}" was not found in ${profilesDir}.`);
    }
    return { env: {}, unset: [], status: null };
  }
  if (!statSync(profileDir).isDirectory()) {
    throw new RuntimeHttpError(400, `Credential profile path is not a directory: ${profileDir}`);
  }

  const config = readProfileConfig(profileDir);
  const fileEnv = {
    ...readEnvDir(profileDir),
    ...(config.env || {}),
  };
  const fileUnset = [...readUnsetFile(profileDir), ...(config.unset || [])];
  const fileExpiresAt = config.expiresAt || readExpiresAtFile(profileDir);

  let source: CredentialProfileStatus["source"] = "file";
  let providerResult: CredentialProviderResult = {};
  if (config.command) {
    source = "command";
    providerResult = await runProviderCommand(
      config.command,
      config.args || [],
      input,
      profileDir,
      config.timeoutMs || DEFAULT_PROVIDER_TIMEOUT_MS,
      selected.name,
    );
  }

  const env = {
    ...fileEnv,
    ...(providerResult.env || {}),
  };
  const unset = [...new Set([...fileUnset, ...(providerResult.unset || [])])].sort();
  const envKeys = Object.keys(env).sort();

  return {
    env,
    unset,
    status: {
      name: selected.name,
      status: "loaded",
      source,
      envKeys,
      unsetKeys: unset,
      expiresAt: providerResult.expiresAt || fileExpiresAt || null,
    },
  };
}

/**
 * Cheap, side-effect-free check for whether a credential profile is configured
 * for a worker type. Unlike `resolveCredentialProfile`, this never runs the
 * provider command — it only inspects configuration so callers (e.g. the agent
 * catalog / onboarding wizard) can report "uses custom credentials" without
 * paying the cost or risk of executing the provider.
 */
export function isCredentialProfileConfigured(input: {
  type: string;
  env: EnvLike;
  cwd?: string;
  fileExists?: (filePath: string) => boolean;
}): boolean {
  const env = input.env;
  if (env.OMNIHARNESS_CREDENTIAL_PROFILES === "0") {
    return false;
  }

  // Command-backed profile (Settings → Credentials → provider script).
  if (env[credentialCommandEnvKey(input.type)]?.trim()) {
    return true;
  }

  // Explicitly named profile selected via env.
  if (env[profileEnvKey(input.type)]?.trim()) {
    return true;
  }

  // Convention: a profile directory named after the worker type.
  const name = input.type.trim();
  if (PROFILE_NAME_PATTERN.test(name)) {
    const fileExists = input.fileExists ?? existsSync;
    const profilesDir = resolveProfilesDir(env, input.cwd ?? process.cwd());
    if (fileExists(join(profilesDir, name))) {
      return true;
    }
  }

  return false;
}

export function applyCredentialProfileEnv<T extends EnvLike>(env: T, resolved: CredentialProfileResolution): T {
  for (const key of resolved.unset) {
    delete env[key];
  }
  Object.assign(env, resolved.env);
  return env;
}
