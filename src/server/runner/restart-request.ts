import fs from "fs/promises";
import path from "path";
import { resolveRestartControlConfig } from "@/server/restart-control";

/**
 * A runner cannot restart itself: the process serving the request is the one
 * that has to die, so it could never send a response or bring itself back. The
 * restart-control server (a separate process, port 3099 by default) owns the
 * lifecycle for exactly that reason.
 *
 * So "Restart server" in the UI proxies to that control server. The browser
 * cannot call it directly — it is a different origin and its bearer token lives
 * in a 0600 file on disk — so the runner reads the token and forwards the call.
 */
export type RunnerRestartOutcome =
  | { ok: true; pid: number | null; mode: string | null; startedAt: number | null }
  | { ok: false; code: "control_unavailable" | "control_unauthorized" | "control_failed"; message: string };

const CONTROL_REQUEST_TIMEOUT_MS = 30_000;

async function readRestartToken(repoRoot: string, configuredToken: string | null) {
  if (configuredToken?.trim()) {
    return configuredToken.trim();
  }
  try {
    const raw = await fs.readFile(path.join(repoRoot, ".omniharness", "remote-restart-token"), "utf8");
    return raw.trim() || null;
  } catch {
    return null;
  }
}

function isConnectionRefused(error: unknown) {
  const chain: unknown[] = [error, (error as { cause?: unknown } | null)?.cause];
  return chain.some((entry) => {
    const code = (entry as { code?: unknown } | null)?.code;
    const message = entry instanceof Error ? entry.message : "";
    return code === "ECONNREFUSED" || /\bECONNREFUSED\b|\bfetch failed\b/i.test(message);
  });
}

export async function requestRunnerRestart(options: {
  repoRoot?: string;
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
} = {}): Promise<RunnerRestartOutcome> {
  const repoRoot = options.repoRoot ?? process.cwd();
  const env = options.env ?? process.env;
  const doFetch = options.fetchImpl ?? fetch;
  const config = resolveRestartControlConfig(repoRoot, env);
  const token = await readRestartToken(repoRoot, config.token ?? null);

  if (!token) {
    return {
      ok: false,
      code: "control_unavailable",
      message: "The restart control service has no token on this machine. Start it with `pnpm restart:control`.",
    };
  }

  try {
    const response = await doFetch(`http://127.0.0.1:${config.port}/restart-current`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(CONTROL_REQUEST_TIMEOUT_MS),
    });

    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        code: "control_unauthorized",
        message: "The restart control service rejected this runner's token.",
      };
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return {
        ok: false,
        code: "control_failed",
        message: `The restart control service returned ${response.status}${detail ? `: ${detail.slice(0, 200)}` : "."}`,
      };
    }

    const payload = await response.json().catch(() => ({})) as {
      pid?: unknown;
      mode?: unknown;
      startedAt?: unknown;
    };
    return {
      ok: true,
      pid: typeof payload.pid === "number" ? payload.pid : null,
      mode: typeof payload.mode === "string" ? payload.mode : null,
      startedAt: typeof payload.startedAt === "number" ? payload.startedAt : null,
    };
  } catch (error) {
    if (isConnectionRefused(error)) {
      return {
        ok: false,
        code: "control_unavailable",
        message: `No restart control service is listening on port ${config.port}. Start it with \`pnpm restart:control\`.`,
      };
    }
    return {
      ok: false,
      code: "control_failed",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
