import { execFile } from "child_process";
import { isAuthShapedProviderFailure } from "@/lib/provider-account-failures";
import { withManagedPath } from "@/server/agent-runtime/tool-env";
import { applyAccountCredentialEnv, resolveAccountCredentials } from "@/server/accounts/account-resolver";
import type { EnvLike } from "@/server/agent-runtime/tool-env";

// Providers lie. Anthropic answers a single prompt with "403 Account suspended"
// or "401 OAuth access token has been revoked" while the credential is fine and
// the next request succeeds. Reading the error text cannot tell those apart
// from a real dead credential, so we ask the provider directly with the
// cheapest possible real request against the exact credential the worker uses.
//
// Presence checks (does ~/.claude/.credentials.json exist?) are deliberately
// NOT enough here: a genuinely suspended account still has a credentials file,
// and trusting presence would spin recovery forever against a dead account.

export type CredentialLiveness = "live" | "dead" | "unknown";

export type CredentialVerificationResult = {
  liveness: CredentialLiveness;
  detail: string;
};

const PROBE_TIMEOUT_MS = 45_000;
// Long enough that a burst of retries across several workers probes once, short
// enough that a real suspension is noticed within a couple of minutes.
const CACHE_TTL_MS = 90_000;

type CacheEntry = {
  expiresAt: number;
  result: CredentialVerificationResult;
};

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<CredentialVerificationResult>>();

// Smallest turn that still exercises the credential end to end.
const PROBE_COMMANDS: Record<string, { command: string; args: string[] }> = {
  claude: { command: "claude", args: ["-p", "ok"] },
};

export function supportsCredentialLivenessProbe(workerType: string) {
  return Boolean(PROBE_COMMANDS[workerType.trim().toLowerCase()]);
}

export function resetCredentialVerificationCacheForTests() {
  cache.clear();
  inFlight.clear();
}

function runProbe(command: string, args: string[], env: EnvLike) {
  return new Promise<CredentialVerificationResult>((resolve) => {
    execFile(command, args, {
      encoding: "utf8",
      env: withManagedPath(env, undefined, { loginShellPathMode: "cached" }) as NodeJS.ProcessEnv,
      timeout: PROBE_TIMEOUT_MS,
      maxBuffer: 256 * 1024,
    }, (error, stdout, stderr) => {
      const output = `${stdout ?? ""}\n${stderr ?? ""}\n${error?.message ?? ""}`.trim();

      if (!error) {
        resolve({ liveness: "live", detail: "Probe request succeeded." });
        return;
      }

      // The provider answered, and it blamed the credential again. Two
      // independent requests agreeing is the closest we get to proof.
      if (isAuthShapedProviderFailure(output)) {
        resolve({ liveness: "dead", detail: `Probe request was rejected: ${output.slice(0, 300)}` });
        return;
      }

      // Timeout, missing binary, network trouble — tells us nothing about the
      // credential. "unknown" is treated as permanent by callers, so an
      // ambiguous probe can never spin recovery.
      resolve({ liveness: "unknown", detail: `Probe was inconclusive: ${output.slice(0, 300) || "no output"}` });
    });
  });
}

/**
 * Probe whether `accountId`'s credential can actually talk to the provider.
 *
 * Returns "unknown" when the probe itself could not run — callers must treat
 * that as "not proven live" so an inconclusive probe never converts a real
 * outage into an infinite retry loop.
 */
export async function verifyAccountCredentialLiveness(input: {
  workerType: string;
  accountId?: string | null;
  cwd: string;
  env?: EnvLike;
}): Promise<CredentialVerificationResult> {
  const workerType = input.workerType.trim().toLowerCase();
  const probe = PROBE_COMMANDS[workerType];
  if (!probe) {
    return { liveness: "unknown", detail: `No credential probe is defined for ${workerType} workers.` };
  }

  const cacheKey = `${workerType}::${input.accountId ?? "default"}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  const running = inFlight.get(cacheKey);
  if (running) {
    return running;
  }

  const pending = (async () => {
    const baseEnv: EnvLike = { ...process.env, ...(input.env ?? {}) };
    try {
      const resolved = await resolveAccountCredentials({
        workerType,
        cwd: input.cwd,
        env: baseEnv,
        accountId: input.accountId ?? null,
      });
      applyAccountCredentialEnv(baseEnv, resolved);
    } catch (error) {
      // Could not even assemble the credential (disabled account, missing key).
      // That is a real configuration failure, not a provider blip.
      return {
        liveness: "dead" as const,
        detail: `Credential could not be resolved: ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    return runProbe(probe.command, probe.args, baseEnv);
  })();

  inFlight.set(cacheKey, pending);
  try {
    const result = await pending;
    cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, result });
    return result;
  } finally {
    inFlight.delete(cacheKey);
  }
}
