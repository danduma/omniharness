export function resolveCodexUpstreamBaseUrl(env: Record<string, string | undefined>) {
  const configured = env.OPENAI_BASE_URL?.trim();
  return configured && configured.length > 0 ? configured : "https://api.openai.com/v1";
}

export function shouldEnableCodexModelRewriteProxy(env: Record<string, string | undefined>) {
  const configured = env.ACP_BRIDGE_ENABLE_CODEX_MODEL_REWRITE_PROXY?.trim().toLowerCase();
  return configured === "1" || configured === "true" || configured === "yes" || configured === "on";
}

export function shouldSetRequestedMode(requestedMode: string | null | undefined, currentModeId: string | null | undefined) {
  const normalizedRequested = requestedMode?.trim();
  if (!normalizedRequested) {
    return false;
  }
  const normalizedCurrent = currentModeId?.trim();
  return !normalizedCurrent || normalizedRequested !== normalizedCurrent;
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
