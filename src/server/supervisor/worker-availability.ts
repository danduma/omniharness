import { execFileSync } from "child_process";
import { dirname } from "path";
import { SUPPORTED_WORKER_TYPES, type SupportedWorkerType, normalizeWorkerType } from "./worker-types";

type EnvLike = Record<string, string | undefined>;

const FALLBACK_ORDER: SupportedWorkerType[] = ["codex", "claude", "gemini", "opencode"];

const WORKER_BINARY_COMMANDS: Record<SupportedWorkerType, string> = {
  codex: "codex-acp",
  claude: "claude-agent-acp",
  gemini: "gemini",
  opencode: "opencode",
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

function readCommandVersion(commandPath: string) {
  try {
    const output = String(execFileSync(commandPath, ["--version"], {
      encoding: "utf8",
      timeout: 2_000,
      maxBuffer: 128 * 1024,
    })).trim();

    return output.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? null;
  } catch {
    return null;
  }
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
    version: path ? readCommandVersion(path) : null,
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
