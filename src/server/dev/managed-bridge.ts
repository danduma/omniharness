import path from "path";

export const DEFAULT_BRIDGE_URL = "http://127.0.0.1:7800";

type EnvLike = Record<string, string | undefined>;

export function resolveBridgeUrl(env: EnvLike) {
  return env.OMNIHARNESS_BRIDGE_URL?.trim() || DEFAULT_BRIDGE_URL;
}

export function resolveBridgeDir(repoRoot: string, env: EnvLike) {
  return path.resolve(env.OMNIHARNESS_BRIDGE_DIR?.trim() || path.join(repoRoot, "..", "acp-bridge"));
}

export function shouldAutoStartBridge(env: EnvLike, bridgeUrl: string) {
  if (env.OMNIHARNESS_MANAGE_BRIDGE?.trim().toLowerCase() === "false") {
    return false;
  }

  try {
    const parsed = new URL(bridgeUrl);
    return parsed.protocol === "http:" && (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost");
  } catch {
    return false;
  }
}
