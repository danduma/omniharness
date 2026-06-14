import { execFileSync } from "child_process";
import { existsSync } from "fs";
import { homedir } from "os";
import { dirname, join } from "path";
import { withManagedPath } from "@/server/agent-runtime/tool-env";
import { isCredentialProfileConfigured } from "@/server/agent-runtime/external-credentials";
import { SUPPORTED_WORKER_TYPES, type SupportedWorkerType, normalizeWorkerType } from "./worker-types";

type EnvLike = Record<string, string | undefined>;
export type WorkerCommandRunner = typeof execFileSync;
export type WorkerCommandResolver = (command: string, env: EnvLike) => string | null;

const WORKER_BINARY_COMMANDS: Record<SupportedWorkerType, string> = {
  codex: "codex-acp",
  claude: "claude-agent-acp",
  gemini: "gemini",
  opencode: "opencode",
};

export type WorkerAuthenticationStatus = "authenticated" | "not_authenticated" | "unknown" | "not_applicable";
export type WorkerAuthenticationMethod = "api_key" | "session_file" | "status_command" | "credential_profile" | "missing" | "unknown" | "not_applicable";
export type WorkerAuthenticationInfo = {
  status: WorkerAuthenticationStatus;
  method: WorkerAuthenticationMethod;
  message: string;
  setupCommand: string | null;
};
export type WorkerTokenQuotaStatus = "reported" | "usage_only" | "unavailable" | "unknown";
export type WorkerTokenQuotaInfo = {
  status: WorkerTokenQuotaStatus;
  source: string;
  message: string;
  remainingTokens: number | null;
  monthlyLimitTokens: number | null;
  usedTokens: number | null;
  resetAt: string | null;
};

type WorkerAuthenticationDetectionOptions = {
  env?: EnvLike;
  homeDir?: string;
  fileExists?: (filePath: string) => boolean;
  commandRunner?: WorkerCommandRunner;
  platform?: NodeJS.Platform;
};

function claudeKeychainCredentialsExist(env: EnvLike) {
  // Always use the real execFileSync here: the keychain lookup is a fast
  // native OS call, not a CLI agent probe, so it is safe even when a caller
  // (such as the frontend catalog route) injects a runner that refuses to
  // execute slower CLI probes.
  try {
    execFileSync("security", ["find-generic-password", "-s", "Claude Code-credentials"], {
      encoding: "utf8",
      env: withManagedPath(env, undefined, { loginShellPathMode: "cached" }) as NodeJS.ProcessEnv,
      timeout: 1_500,
      maxBuffer: 64 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return true;
  } catch {
    return false;
  }
}

type WorkerDetectionOptions = {
  env?: EnvLike;
  commandResolver?: WorkerCommandResolver;
};

function resolveCommandPath(command: string, env: EnvLike = process.env, commandResolver?: WorkerCommandResolver) {
  if (commandResolver) {
    return commandResolver(command, env);
  }

  try {
    return String(execFileSync("which", [command], {
      encoding: "utf8",
      env: withManagedPath(env, undefined, { loginShellPathMode: "cached" }) as NodeJS.ProcessEnv,
      timeout: 1_500,
      maxBuffer: 64 * 1024,
    })).trim() || null;
  } catch {
    return null;
  }
}

function workerBinaryAvailable(type: SupportedWorkerType, env: EnvLike = process.env, commandResolver?: WorkerCommandResolver) {
  return resolveCommandPath(WORKER_BINARY_COMMANDS[type], env, commandResolver) !== null;
}

function workerHasApiKey(type: SupportedWorkerType) {
  switch (type) {
    case "codex":
      // Codex can use credentials established via `codex --login`, so
      // OmniHarness should not require a duplicate OPENAI_API_KEY.
      return true;
    case "claude":
      // Claude Code may already be authenticated locally, so avoid
      // blocking worker startup on duplicated env vars.
      return true;
    case "gemini":
      // Gemini CLI may already be authenticated locally, so avoid
      // blocking worker startup on duplicated env vars.
      return true;
    case "opencode":
      return true;
  }
}

function hasEnvValue(env: EnvLike, keys: string[]) {
  return keys.some((key) => Boolean(env[key]?.trim()));
}

function anyFileExists(paths: string[], fileExists: (filePath: string) => boolean) {
  return paths.some((filePath) => {
    try {
      return fileExists(filePath);
    } catch {
      return false;
    }
  });
}

function runAuthStatusCommand(commandRunner: WorkerCommandRunner, command: string, args: string[], env: EnvLike) {
  try {
    return String(commandRunner(command, args, {
      encoding: "utf8",
      env: withManagedPath(env, undefined, { loginShellPathMode: "cached" }) as NodeJS.ProcessEnv,
      timeout: 1_500,
      maxBuffer: 64 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    })).trim();
  } catch {
    return null;
  }
}

function parseTokenCount(value: string | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/,/g, "").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function firstNumberAfter(pattern: RegExp, output: string) {
  const match = output.match(pattern);
  return parseTokenCount(match?.[1]);
}

function sumNamedTokenRows(output: string) {
  const rowNames = ["Input", "Output", "Cache Read", "Cache Write"];
  let total = 0;
  let found = false;

  for (const name of rowNames) {
    const escapedName = name.replace(/\s+/g, "\\s+");
    const value = firstNumberAfter(new RegExp(`^\\s*${escapedName}\\s+([\\d,]+)\\s*$`, "im"), output);
    if (value !== null) {
      total += value;
      found = true;
    }
  }

  return found ? total : null;
}

export function parseWorkerTokenQuotaOutput(output: string | null | undefined, source: string): WorkerTokenQuotaInfo {
  const text = output?.replace(/\u001b\[[0-9;]*m/g, "").trim() ?? "";
  const remainingTokens =
    firstNumberAfter(/\b(?:remaining|left|available)\b[^\d]{0,60}([\d,]+)\s*(?:tokens?)?/i, text)
    ?? firstNumberAfter(/([\d,]+)\s*(?:tokens?)?\s*(?:remaining|left|available)\b/i, text);
  const monthlyLimitTokens =
    firstNumberAfter(/\b(?:of|out of|limit|monthly limit)\b[^\d]{0,40}([\d,]+)\s*(?:tokens?)?/i, text)
    ?? firstNumberAfter(/\bmonthly\b[^\n\d]{0,80}([\d,]+)\s*(?:tokens?)?\s*(?:limit|quota)/i, text);
  const resetMatch = text.match(/\b(?:reset|resets|renews)\b[^\n]{0,40}\b(\d{4}-\d{2}-\d{2}(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?)\b/i);
  const usedTokens =
    firstNumberAfter(/\b(?:used|usage|consumed)\b[^\d]{0,60}([\d,]+)\s*(?:tokens?)?/i, text)
    ?? sumNamedTokenRows(text);

  if (remainingTokens !== null) {
    return {
      status: "reported",
      source,
      message: "Monthly token quota reported by CLI.",
      remainingTokens,
      monthlyLimitTokens,
      usedTokens,
      resetAt: resetMatch?.[1] ?? null,
    };
  }

  if (usedTokens !== null) {
    return {
      status: "usage_only",
      source,
      message: "CLI reports token usage, but not remaining monthly quota.",
      remainingTokens: null,
      monthlyLimitTokens,
      usedTokens,
      resetAt: resetMatch?.[1] ?? null,
    };
  }

  return {
    status: "unknown",
    source,
    message: text ? "CLI output did not include monthly token quota." : "Monthly token quota is not reported by this CLI.",
    remainingTokens: null,
    monthlyLimitTokens: null,
    usedTokens: null,
    resetAt: null,
  };
}

function runQuotaCommand(commandRunner: WorkerCommandRunner, command: string, args: string[], env: EnvLike) {
  try {
    return String(commandRunner(command, args, {
      encoding: "utf8",
      env: withManagedPath(env, undefined, { loginShellPathMode: "cached" }) as NodeJS.ProcessEnv,
      timeout: 2_500,
      maxBuffer: 256 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    }));
  } catch {
    return null;
  }
}

export function getWorkerTokenQuotaInfo(type: string, options: { commandRunner?: WorkerCommandRunner; env?: EnvLike } = {}): WorkerTokenQuotaInfo {
  const normalized = normalizeWorkerType(type);
  const supportedType = SUPPORTED_WORKER_TYPES.includes(normalized as SupportedWorkerType)
    ? normalized as SupportedWorkerType
    : null;
  const commandRunner = options.commandRunner ?? execFileSync;
  const env = options.env ?? process.env;

  if (!supportedType) {
    return {
      status: "unavailable",
      source: "unsupported worker",
      message: `Unsupported worker type "${type}".`,
      remainingTokens: null,
      monthlyLimitTokens: null,
      usedTokens: null,
      resetAt: null,
    };
  }

  if (supportedType === "opencode") {
    return parseWorkerTokenQuotaOutput(
      runQuotaCommand(commandRunner, "opencode", ["stats", "--days", "31"], env),
      "opencode stats --days 31",
    );
  }

  if (supportedType === "claude") {
    return parseWorkerTokenQuotaOutput(
      runQuotaCommand(commandRunner, "claude", ["auth", "status"], env),
      "claude auth status",
    );
  }

  if (supportedType === "codex") {
    return parseWorkerTokenQuotaOutput(
      runQuotaCommand(commandRunner, "codex", ["login", "status"], env),
      "codex login status",
    );
  }

  return {
    status: "unknown",
    source: `${supportedType} CLI`,
    message: "Monthly token quota is not reported by this CLI.",
    remainingTokens: null,
    monthlyLimitTokens: null,
    usedTokens: null,
    resetAt: null,
  };
}

function parseClaudeAuthStatus(output: string | null) {
  if (!output) {
    return false;
  }
  try {
    const parsed = JSON.parse(output) as { loggedIn?: unknown };
    return parsed.loggedIn === true;
  } catch {
    return /\blogged\s*in\b/i.test(output) && !/\bnot\s+logged\s*in\b/i.test(output);
  }
}

export function getWorkerAuthenticationInfo(type: string, options: WorkerAuthenticationDetectionOptions = {}): WorkerAuthenticationInfo {
  const normalized = normalizeWorkerType(type);
  const supportedType = SUPPORTED_WORKER_TYPES.includes(normalized as SupportedWorkerType)
    ? normalized as SupportedWorkerType
    : null;
  const env = options.env ?? process.env;
  const homeDir = options.homeDir ?? env.HOME ?? homedir();
  const fileExists = options.fileExists ?? existsSync;
  const commandRunner = options.commandRunner ?? execFileSync;
  const platform = options.platform ?? process.platform;

  if (!supportedType) {
    return {
      status: "not_applicable",
      method: "not_applicable",
      message: `Unsupported worker type "${type}".`,
      setupCommand: null,
    };
  }

  // A configured custom credential profile (provider script or named profile)
  // supplies this agent's credentials at spawn time, so the user does not need
  // to log in interactively. Treat it as authenticated regardless of CLI login
  // state — this is the authoritative, explicit configuration.
  if (isCredentialProfileConfigured({ type: supportedType, env, fileExists })) {
    return {
      status: "authenticated",
      method: "credential_profile",
      message: "Using the custom credentials configured for this agent.",
      setupCommand: null,
    };
  }

  if (supportedType === "codex") {
    if (hasEnvValue(env, ["OPENAI_API_KEY"])) {
      return {
        status: "authenticated",
        method: "api_key",
        message: "Codex can use OPENAI_API_KEY from the OmniHarness runtime environment.",
        setupCommand: "codex login",
      };
    }

    if (anyFileExists([join(homeDir, ".codex", "auth.json")], fileExists)) {
      return {
        status: "authenticated",
        method: "session_file",
        message: "Codex login state was detected.",
        setupCommand: "codex login",
      };
    }

    const status = runAuthStatusCommand(commandRunner, "codex", ["login", "status"], env);
    if (status && /\blogged\s*in\b/i.test(status) && !/\bnot\s+logged\s*in\b/i.test(status)) {
      return {
        status: "authenticated",
        method: "status_command",
        message: "Codex reports an active login.",
        setupCommand: "codex login",
      };
    }

    return {
      status: "not_authenticated",
      method: "missing",
      message: "Codex CLI is not logged in. Run `codex login`.",
      setupCommand: "codex login",
    };
  }

  if (supportedType === "claude") {
    if (hasEnvValue(env, ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN"])) {
      return {
        status: "authenticated",
        method: "api_key",
        message: "Claude can use Anthropic credentials from the OmniHarness runtime environment.",
        setupCommand: "claude auth login",
      };
    }

    const status = runAuthStatusCommand(commandRunner, "claude", ["auth", "status"], env);
    if (parseClaudeAuthStatus(status)) {
      return {
        status: "authenticated",
        method: "status_command",
        message: "Claude Code reports an active login.",
        setupCommand: "claude auth login",
      };
    }

    // `claude auth status` can report loggedIn:false even when valid credentials
    // exist on disk or in the macOS Keychain (Claude Code 2.x stores tokens
    // there but the status command does not always read them back).
    if (anyFileExists([join(homeDir, ".claude", ".credentials.json")], fileExists)) {
      return {
        status: "authenticated",
        method: "session_file",
        message: "Claude Code credentials file was detected.",
        setupCommand: "claude auth login",
      };
    }

    if (platform === "darwin" && claudeKeychainCredentialsExist(env)) {
      return {
        status: "authenticated",
        method: "session_file",
        message: "Claude Code credentials were found in the macOS Keychain.",
        setupCommand: "claude auth login",
      };
    }

    return {
      status: "not_authenticated",
      method: "missing",
      message: "Claude Code is not logged in. Run `claude auth login`.",
      setupCommand: "claude auth login",
    };
  }

  if (supportedType === "gemini") {
    if (hasEnvValue(env, ["GEMINI_API_KEY", "GOOGLE_API_KEY"])) {
      return {
        status: "authenticated",
        method: "api_key",
        message: "Gemini can use API credentials from the OmniHarness runtime environment.",
        setupCommand: "gemini",
      };
    }

    if (anyFileExists([
      join(homeDir, ".gemini", "oauth_creds.json"),
      join(homeDir, ".gemini", "google_account_id"),
      join(homeDir, ".gemini", "google_accounts.json"),
    ], fileExists)) {
      return {
        status: "authenticated",
        method: "session_file",
        message: "Gemini login state was detected.",
        setupCommand: "gemini",
      };
    }

    return {
      status: "not_authenticated",
      method: "missing",
      message: "Gemini CLI is not logged in. Run `gemini` and complete sign-in.",
      setupCommand: "gemini",
    };
  }

  if (supportedType === "opencode") {
    if (hasEnvValue(env, ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY"])) {
      return {
        status: "authenticated",
        method: "api_key",
        message: "OpenCode can use provider credentials from the OmniHarness runtime environment.",
        setupCommand: "opencode providers login",
      };
    }

    if (anyFileExists([
      join(homeDir, ".local", "share", "opencode", "auth.json"),
      join(homeDir, ".config", "opencode", "auth.json"),
    ], fileExists)) {
      return {
        status: "authenticated",
        method: "session_file",
        message: "OpenCode provider credentials were detected.",
        setupCommand: "opencode providers login",
      };
    }

    return {
      status: "unknown",
      method: "unknown",
      message: "OpenCode authentication could not be verified automatically. Check providers with `opencode providers list`.",
      setupCommand: "opencode providers login",
    };
  }

  return {
    status: "unknown",
    method: "unknown",
    message: "Authentication could not be verified automatically.",
    setupCommand: null,
  };
}

type SpawnabilityOptions = WorkerDetectionOptions & {
  quotaBlocked?: ReadonlySet<SupportedWorkerType>;
};

export function isSpawnableWorkerType(type: string, options: SpawnabilityOptions = {}) {
  const normalized = normalizeWorkerType(type);
  if (!SUPPORTED_WORKER_TYPES.includes(normalized as SupportedWorkerType)) {
    return {
      ok: false,
      type: normalized,
      reason: `Unsupported worker type "${type}". Supported types: ${SUPPORTED_WORKER_TYPES.join(", ")}.`,
    };
  }

  const supportedType = normalized as SupportedWorkerType;
  const env = options.env ?? process.env;

  if (!workerBinaryAvailable(supportedType, env, options.commandResolver)) {
    const reason =
      supportedType === "codex"
        ? "codex ACP adapter is not installed."
        : `${supportedType} worker binary is not installed.`;
    return {
      ok: false,
      type: supportedType,
      reason,
    };
  }

  if (!workerHasApiKey(supportedType)) {
    return {
      ok: false,
      type: supportedType,
      reason: `${supportedType} worker is missing its API key.`,
    };
  }

  if (options.quotaBlocked?.has(supportedType)) {
    return {
      ok: false,
      type: supportedType,
      reason: `${supportedType} worker is blocked by an active quota incident.`,
    };
  }

  return {
    ok: true,
    type: supportedType,
  };
}

export function getWorkerInstallationInfo(type: string, options: WorkerDetectionOptions = {}) {
  const normalized = normalizeWorkerType(type);
  const supportedType = SUPPORTED_WORKER_TYPES.includes(normalized as SupportedWorkerType)
    ? normalized as SupportedWorkerType
    : null;
  const command = supportedType ? WORKER_BINARY_COMMANDS[supportedType] : normalized;
  const path = resolveCommandPath(command, options.env ?? process.env, options.commandResolver);

  return {
    command,
    path,
    dir: path ? dirname(path) : null,
  };
}

export function selectSpawnableWorkerType(
  requestedType: string,
  env: EnvLike,
  allowedTypes: SupportedWorkerType[] = [...SUPPORTED_WORKER_TYPES],
  options: { quotaBlocked?: ReadonlySet<SupportedWorkerType> } = {},
) {
  const normalizedRequestedType = normalizeWorkerType(requestedType);
  const normalizedAllowedTypes = Array.from(new Set(
    allowedTypes.filter((type): type is SupportedWorkerType => SUPPORTED_WORKER_TYPES.includes(type)),
  ));
  const quotaBlocked = options.quotaBlocked;

  if (!normalizedAllowedTypes.includes(normalizedRequestedType as SupportedWorkerType)) {
    const firstAllowed = normalizedAllowedTypes[0];
    if (!firstAllowed) {
      throw new Error("No allowed worker types are configured for this run.");
    }
    const availability = isSpawnableWorkerType(firstAllowed, { env, quotaBlocked });
    if (availability.ok) {
      return {
        type: availability.type,
        requestedType: normalizedRequestedType,
        fallbackReason: `requested worker "${normalizedRequestedType}" is not allowed for this run.`,
      };
    }
  }

  const requested = isSpawnableWorkerType(normalizedRequestedType, { env, quotaBlocked });
  if (requested.ok && normalizedAllowedTypes.includes(requested.type)) {
    return {
      type: requested.type,
      requestedType: normalizedRequestedType,
      fallbackReason: null,
    };
  }

  for (const candidate of normalizedAllowedTypes) {
    if (candidate === normalizedRequestedType || !normalizedAllowedTypes.includes(candidate)) {
      continue;
    }
    const availability = isSpawnableWorkerType(candidate, { env, quotaBlocked });
    if (availability.ok) {
      return {
        type: availability.type,
        requestedType: normalizedRequestedType,
        fallbackReason: requested.reason,
      };
    }
  }

  throw new Error(
    `No spawnable worker is available. Requested "${requestedType}" failed because ${requested.reason} ` +
    `Checked allowed workers: ${normalizedAllowedTypes.join(", ")}.`,
  );
}

/**
 * Async wrapper around selectSpawnableWorkerType that loads the current
 * quota-blocked type set from the database before selecting. Used by
 * failover and any "select a fresh worker" call site that wants to
 * automatically skip types whose quota has not yet reset.
 */
export async function selectSpawnableWorkerTypeAsync(
  requestedType: string,
  env: EnvLike,
  allowedTypes: SupportedWorkerType[] = [...SUPPORTED_WORKER_TYPES],
  options: { now?: Date } = {},
) {
  const { quotaBlockedTypes } = await import("@/server/quota/type-blocking");
  const blocked = await quotaBlockedTypes(allowedTypes, { now: options.now });
  const blockedSet = new Set<SupportedWorkerType>(blocked.keys());
  return selectSpawnableWorkerType(requestedType, env, allowedTypes, { quotaBlocked: blockedSet });
}
