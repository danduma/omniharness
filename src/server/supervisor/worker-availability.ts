import { execFileSync } from "child_process";
import { SUPPORTED_WORKER_TYPES, type SupportedWorkerType, normalizeWorkerType } from "./worker-types";

type EnvLike = Record<string, string | undefined>;

const FALLBACK_ORDER: SupportedWorkerType[] = ["codex", "claude", "gemini", "opencode"];

function commandExists(command: string) {
  try {
    execFileSync("which", [command], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function workerBinaryAvailable(type: SupportedWorkerType) {
  switch (type) {
    case "codex":
      return commandExists("codex") || commandExists("codex-acp");
    case "claude":
      return commandExists("claude-agent-acp");
    case "gemini":
      return commandExists("gemini");
    case "opencode":
      return commandExists("opencode");
  }
}

function workerHasApiKey(type: SupportedWorkerType, env: EnvLike) {
  switch (type) {
    case "codex":
      // Codex can use credentials established via `codex --login`, so
      // OmniHarness should not require a duplicate OPENAI_API_KEY.
      return true;
    case "claude":
      return Boolean(env.ANTHROPIC_API_KEY?.trim() || env.ANTHROPIC_AUTH_TOKEN?.trim());
    case "gemini":
      return Boolean(env.GEMINI_API_KEY?.trim());
    case "opencode":
      return true;
  }
}

export function isSpawnableWorkerType(type: string, env: EnvLike) {
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
    return {
      ok: false,
      type: supportedType,
      reason: `${supportedType} worker binary is not installed.`,
    };
  }

  if (!workerHasApiKey(supportedType, env)) {
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
    const availability = isSpawnableWorkerType(firstAllowed, env);
    if (availability.ok) {
      return {
        type: availability.type,
        requestedType: normalizedRequestedType,
        fallbackReason: `requested worker "${normalizedRequestedType}" is not allowed for this run.`,
      };
    }
  }

  const requested = isSpawnableWorkerType(normalizedRequestedType, env);
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
    const availability = isSpawnableWorkerType(candidate, env);
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
