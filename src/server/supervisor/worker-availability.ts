import { execFileSync } from "child_process";
import { existsSync } from "fs";
import { homedir } from "os";
import { dirname, join } from "path";
import { SUPPORTED_WORKER_TYPES, type SupportedWorkerType, normalizeWorkerType } from "./worker-types";

type EnvLike = Record<string, string | undefined>;
type CommandRunner = typeof execFileSync;

const FALLBACK_ORDER: SupportedWorkerType[] = ["codex", "claude", "gemini", "opencode"];

const WORKER_BINARY_COMMANDS: Record<SupportedWorkerType, string> = {
  codex: "codex-acp",
  claude: "claude-agent-acp",
  gemini: "gemini",
  opencode: "opencode",
};

export type WorkerAuthenticationStatus = "authenticated" | "not_authenticated" | "unknown" | "not_applicable";
export type WorkerAuthenticationMethod = "api_key" | "session_file" | "status_command" | "missing" | "unknown" | "not_applicable";
export type WorkerAuthenticationInfo = {
  status: WorkerAuthenticationStatus;
  method: WorkerAuthenticationMethod;
  message: string;
  setupCommand: string | null;
};

type WorkerAuthenticationDetectionOptions = {
  env?: EnvLike;
  homeDir?: string;
  fileExists?: (filePath: string) => boolean;
  commandRunner?: CommandRunner;
};

function resolveCommandPath(command: string) {
  try {
    return String(execFileSync("which", [command], {
      encoding: "utf8",
      timeout: 1_500,
      maxBuffer: 64 * 1024,
    })).trim() || null;
  } catch {
    return null;
  }
}

function workerBinaryAvailable(type: SupportedWorkerType) {
  return resolveCommandPath(WORKER_BINARY_COMMANDS[type]) !== null;
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

function runAuthStatusCommand(commandRunner: CommandRunner, command: string, args: string[]) {
  try {
    return String(commandRunner(command, args, {
      encoding: "utf8",
      timeout: 1_500,
      maxBuffer: 64 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    })).trim();
  } catch {
    return null;
  }
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

  if (!supportedType) {
    return {
      status: "not_applicable",
      method: "not_applicable",
      message: `Unsupported worker type "${type}".`,
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

    const status = runAuthStatusCommand(commandRunner, "codex", ["login", "status"]);
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

    const status = runAuthStatusCommand(commandRunner, "claude", ["auth", "status"]);
    if (parseClaudeAuthStatus(status)) {
      return {
        status: "authenticated",
        method: "status_command",
        message: "Claude Code reports an active login.",
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

export function isSpawnableWorkerType(type: string) {
  const normalized = normalizeWorkerType(type);
  if (!SUPPORTED_WORKER_TYPES.includes(normalized as SupportedWorkerType)) {
    return {
      ok: false,
      type: normalized,
      reason: `Unsupported worker type "${type}". Supported types: ${SUPPORTED_WORKER_TYPES.join(", ")}.`,
    };
  }

  const supportedType = normalized as SupportedWorkerType;

  if (!workerBinaryAvailable(supportedType)) {
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

  return {
    ok: true,
    type: supportedType,
  };
}

export function getWorkerInstallationInfo(type: string) {
  const normalized = normalizeWorkerType(type);
  const supportedType = SUPPORTED_WORKER_TYPES.includes(normalized as SupportedWorkerType)
    ? normalized as SupportedWorkerType
    : null;
  const command = supportedType ? WORKER_BINARY_COMMANDS[supportedType] : normalized;
  const path = resolveCommandPath(command);

  return {
    command,
    path,
    dir: path ? dirname(path) : null,
  };
}

export function selectSpawnableWorkerType(requestedType: string, env: EnvLike, allowedTypes: SupportedWorkerType[] = [...SUPPORTED_WORKER_TYPES]) {
  const normalizedRequestedType = normalizeWorkerType(requestedType);
  const normalizedAllowedTypes = Array.from(new Set(
    allowedTypes.filter((type): type is SupportedWorkerType => SUPPORTED_WORKER_TYPES.includes(type)),
  ));

  if (!normalizedAllowedTypes.includes(normalizedRequestedType as SupportedWorkerType)) {
    const firstAllowed = normalizedAllowedTypes[0];
    if (!firstAllowed) {
      throw new Error("No allowed worker types are configured for this run.");
    }
    const availability = isSpawnableWorkerType(firstAllowed);
    if (availability.ok) {
      return {
        type: availability.type,
        requestedType: normalizedRequestedType,
        fallbackReason: `requested worker "${normalizedRequestedType}" is not allowed for this run.`,
      };
    }
  }

  const requested = isSpawnableWorkerType(normalizedRequestedType);
  if (requested.ok && normalizedAllowedTypes.includes(requested.type)) {
    return {
      type: requested.type,
      requestedType: normalizedRequestedType,
      fallbackReason: null,
    };
  }

  for (const candidate of FALLBACK_ORDER) {
    if (candidate === normalizedRequestedType || !normalizedAllowedTypes.includes(candidate)) {
      continue;
    }
    const availability = isSpawnableWorkerType(candidate);
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
