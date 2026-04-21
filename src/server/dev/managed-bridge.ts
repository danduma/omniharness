import fs from "fs";
import path from "path";

export const DEFAULT_BRIDGE_URL = "http://127.0.0.1:7800";

type EnvLike = Record<string, string | undefined>;

export function resolveBridgeUrl(env: EnvLike) {
  return env.OMNIHARNESS_BRIDGE_URL?.trim() || DEFAULT_BRIDGE_URL;
}

export function resolveBridgeDir(repoRoot: string, env: EnvLike) {
  return path.resolve(env.OMNIHARNESS_BRIDGE_DIR?.trim() || path.join(repoRoot, "..", "acp-bridge"));
}

function newestMtimeMs(root: string): number {
  if (!fs.existsSync(root)) {
    return 0;
  }

  let newest = 0;
  const stack = [root];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    let stat: fs.Stats;
    try {
      stat = fs.statSync(current);
    } catch {
      continue;
    }

    if (!stat.isDirectory()) {
      newest = Math.max(newest, stat.mtimeMs);
      continue;
    }

    for (const entry of fs.readdirSync(current)) {
      stack.push(path.join(current, entry));
    }
  }

  return newest;
}

export function bridgeNeedsBuild(bridgeDir: string) {
  const distDaemonPath = path.join(bridgeDir, "dist", "daemon.js");
  if (!fs.existsSync(distDaemonPath)) {
    return true;
  }

  const srcNewest = newestMtimeMs(path.join(bridgeDir, "src"));
  if (srcNewest === 0) {
    return false;
  }

  return srcNewest > fs.statSync(distDaemonPath).mtimeMs;
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
