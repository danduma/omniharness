import { homedir } from "os";
import { join } from "path";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { accounts, workerCredentialAllocations } from "@/server/db/schema";
import { resolveAccountCliHome, resolveClaudeConfigDir } from "@/server/accounts/cli-home";

/**
 * Where a worker's CLI kept the state a title can be read out of.
 *
 * The runtime picks one of several homes per worker — an account-isolated one,
 * whatever the launching environment already exported, or a project-scoped one
 * under `<cwd>/.omniharness/cli-home` — and the choice is not recorded on the
 * worker row. Rather than reconstruct that decision (which would then have to
 * be kept in step with `applyProjectScopedCliStorage` forever), each reader
 * gets every home the worker could plausibly have used and tries them in turn.
 * Provider session ids are uuids, so a hit in the wrong home is not a risk:
 * either the file is there or it is not.
 */

type WorkerLike = {
  id: string;
  cwd: string;
};

/**
 * A worker's credential allocation is decided once, at spawn, and this runs on
 * every snapshot persist — so the two queries behind it are worth doing once.
 */
const accountHomeCache = new Map<string, string | null>();

export function __resetAgentCliHomeCacheForTests() {
  accountHomeCache.clear();
}

async function isolatedAccountHome(workerId: string, cliType: string) {
  const cacheKey = `${cliType}:${workerId}`;
  const cached = accountHomeCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }
  const resolved = await resolveIsolatedAccountHome(workerId, cliType);
  accountHomeCache.set(cacheKey, resolved);
  return resolved;
}

async function resolveIsolatedAccountHome(workerId: string, cliType: string) {
  const allocation = await db
    .select({ accountId: workerCredentialAllocations.accountId })
    .from(workerCredentialAllocations)
    .where(eq(workerCredentialAllocations.workerId, workerId))
    .get();
  if (!allocation?.accountId) {
    return null;
  }

  const account = await db
    .select({ authMode: accounts.authMode, cliType: accounts.cliType })
    .from(accounts)
    .where(eq(accounts.id, allocation.accountId))
    .get();
  if (account?.authMode !== "isolated_cli_home" || account.cliType !== cliType) {
    return null;
  }

  try {
    return cliType === "claude"
      ? resolveClaudeConfigDir(allocation.accountId)
      : resolveAccountCliHome(cliType, allocation.accountId);
  } catch {
    // An account id that no longer passes the managed-path guard has no
    // readable home; the remaining candidates still apply.
    return null;
  }
}

function unique(paths: (string | null | undefined)[]) {
  return [...new Set(paths.map((path) => path?.trim()).filter((path): path is string => Boolean(path)))];
}

export async function claudeConfigDirCandidates(worker: WorkerLike) {
  return unique([
    await isolatedAccountHome(worker.id, "claude"),
    process.env.CLAUDE_CONFIG_DIR,
    worker.cwd ? join(worker.cwd, ".omniharness", "cli-home", "claude") : null,
    join(homedir(), ".claude"),
  ]);
}

/**
 * Codex splits its state: rollout transcripts live under `CODEX_HOME` while the
 * thread index that carries the title lives under `CODEX_SQLITE_HOME`. The
 * runtime points those at sibling directories, but an operator who exports only
 * `CODEX_HOME` gets the index inside it, so both shapes are offered.
 */
export async function codexStateDirCandidates(worker: WorkerLike) {
  const accountHome = await isolatedAccountHome(worker.id, "codex");
  const projectHome = worker.cwd ? join(worker.cwd, ".omniharness", "cli-home", "codex") : null;
  return unique([
    accountHome ? join(accountHome, "sqlite") : null,
    accountHome ? join(accountHome, "home") : null,
    process.env.CODEX_SQLITE_HOME,
    process.env.CODEX_HOME,
    projectHome ? join(projectHome, "sqlite") : null,
    projectHome ? join(projectHome, "home") : null,
    join(homedir(), ".codex", "sqlite"),
    join(homedir(), ".codex"),
  ]);
}
