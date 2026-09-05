export function resolveCodexUpstreamBaseUrl(env: Record<string, string | undefined>) {
  const configured = env.OPENAI_BASE_URL?.trim();
  return configured && configured.length > 0 ? configured : "https://api.openai.com/v1";
}

export function shouldEnableCodexModelRewriteProxy(env: Record<string, string | undefined>) {
  const configured = env.OMNIHARNESS_RUNTIME_ENABLE_CODEX_MODEL_REWRITE_PROXY?.trim().toLowerCase();
  return configured === "1" || configured === "true" || configured === "yes" || configured === "on";
}

function modeIdFromUnknown(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }
  const mode = value as { id?: unknown };
  return typeof mode.id === "string" && mode.id.trim() ? mode.id.trim() : null;
}

export function resolveCodexSessionMode(requestedMode: string | null | undefined, availableModes?: unknown) {
  const normalizedRequested = requestedMode?.trim();
  if (!normalizedRequested) {
    return normalizedRequested;
  }

  if (normalizedRequested !== "full-access" && normalizedRequested !== "danger-full-access") {
    return normalizedRequested;
  }

  const availableModeIds = Array.isArray(availableModes)
    ? new Set(availableModes.map(modeIdFromUnknown).filter((id): id is string => id !== null))
    : null;

  // OmniHarness uses the cross-agent "full-access" name. Codex ACP exposes
  // the same mode as "agent-full-access"; leaving the public name unchanged
  // would make the adapter silently retain its network-disabled default.
  if (!availableModeIds || availableModeIds.has("agent-full-access")) {
    return "agent-full-access";
  }
  return normalizedRequested;
}

export function shouldSetRequestedMode(
  requestedMode: string | null | undefined,
  currentModeId: string | null | undefined,
  availableModes?: unknown,
) {
  const normalizedRequested = requestedMode?.trim();
  if (!normalizedRequested) {
    return false;
  }
  if (Array.isArray(availableModes)) {
    const availableModeIds = new Set(availableModes.map(modeIdFromUnknown).filter((id): id is string => id !== null));
    if (availableModeIds.size > 0 && !availableModeIds.has(normalizedRequested)) {
      return false;
    }
  }
  const normalizedCurrent = currentModeId?.trim();
  return !normalizedCurrent || normalizedRequested !== normalizedCurrent;
}

function tomlString(value: string) {
  return JSON.stringify(value);
}

export function buildCodexConfigArgs(input: {
  model?: string | null;
  effort?: string | null;
}) {
  const args: string[] = [];
  const model = input.model?.trim();
  const effort = input.effort?.trim().toLowerCase();

  if (model) {
    args.push("-c", `model=${tomlString(model)}`);
  }
  if (effort) {
    args.push("-c", `model_reasoning_effort=${tomlString(effort)}`);
  }

  return args;
}

export function buildCodexAcpConfig(input: {
  existingConfig?: string | null;
  model?: string | null;
  effort?: string | null;
}) {
  const existingConfig = input.existingConfig?.trim();
  let config: Record<string, unknown> = {};
  if (existingConfig) {
    const parsed = JSON.parse(existingConfig) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("CODEX_CONFIG must be a JSON object.");
    }
    config = parsed as Record<string, unknown>;
  }

  const model = input.model?.trim();
  const effort = input.effort?.trim().toLowerCase();
  return JSON.stringify({
    ...config,
    ...(model ? { model } : {}),
    ...(effort ? { model_reasoning_effort: effort } : {}),
  });
}

export function applyCodexBridgeEnv(
  env: Record<string, string | undefined>,
  modelRewriteProxyPort: number | null = null,
): Record<string, string | undefined> {
  const nextEnv: Record<string, string | undefined> = {
    ...env,
    CODEX_LOG_STDERR: env.CODEX_LOG_STDERR?.trim() ? env.CODEX_LOG_STDERR : "0",
  };

  if (modelRewriteProxyPort == null) {
    return nextEnv;
  }

  return {
    ...nextEnv,
    OPENAI_BASE_URL: `http://127.0.0.1:${modelRewriteProxyPort}`,
    HTTP_PROXY: "",
    HTTPS_PROXY: "",
    http_proxy: "",
    https_proxy: "",
    NO_PROXY: "*",
    no_proxy: "*",
  };
}
