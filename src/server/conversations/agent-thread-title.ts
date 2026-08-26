import { readdir } from "fs/promises";
import { join } from "path";
import Database from "better-sqlite3";
import { codexStateDirCandidates } from "@/server/conversations/agent-cli-homes";

/**
 * The name Codex gave its own thread.
 *
 * Codex keeps a thread index in `state_<n>.sqlite` under its state home, one
 * row per session, and `threads.title` is the display name the CLI shows for
 * it. Most of the time that column just holds the first prompt — Codex seeds it
 * that way and only replaces it when it renames the thread — so the caller has
 * to decide whether what comes back is a real name or the prompt coming home.
 * `first_user_message` is returned alongside precisely so that decision can be
 * made without guessing.
 *
 * Codex reports no title over ACP that is worth trusting (the adapter's
 * `publishFallbackSessionTitle` synthesises one from the prompt when the thread
 * has no name), so this index is the only Codex-side source there is.
 */

const STATE_DB_PATTERN = /^state_(\d+)\.sqlite$/;

export type CodexThreadTitle = {
  title: string;
  firstUserMessage: string;
};

type CacheEntry = { path: string | null; result: CodexThreadTitle | null };

const threadTitleCache = new Map<string, CacheEntry>();

export function __resetCodexThreadTitleCacheForTests() {
  threadTitleCache.clear();
}

/**
 * Codex bumps the filename when the index schema changes and leaves the older
 * file in place, so the highest version is the live one.
 */
async function stateDatabasePaths(dir: string) {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }

  return names
    .map((name) => ({ name, version: Number(STATE_DB_PATTERN.exec(name)?.[1] ?? NaN) }))
    .filter((candidate) => Number.isFinite(candidate.version))
    .sort((left, right) => right.version - left.version)
    .map((candidate) => join(dir, candidate.name));
}

function readThreadRow(dbPath: string, sessionId: string): CodexThreadTitle | null {
  // Read-only: this is another process's database, and Codex may well have it
  // open. A writable handle would try to recover the WAL on open.
  let database: Database.Database;
  try {
    database = new Database(dbPath, { readonly: true, fileMustExist: true });
  } catch {
    return null;
  }

  try {
    const row = database
      .prepare("select title, first_user_message as firstUserMessage from threads where id = ?")
      .get(sessionId) as { title?: unknown; firstUserMessage?: unknown } | undefined;
    const title = typeof row?.title === "string" ? row.title.trim() : "";
    if (!title) {
      return null;
    }
    return {
      title,
      firstUserMessage: typeof row?.firstUserMessage === "string" ? row.firstUserMessage : "",
    };
  } catch {
    // A Codex build whose index predates the `threads` table, or a half-written
    // file. Either way there is no title here.
    return null;
  } finally {
    database.close();
  }
}

export async function readCodexThreadTitle(args: {
  sessionId: string;
  worker: { id: string; cwd: string };
}): Promise<CodexThreadTitle | null> {
  const cached = threadTitleCache.get(args.sessionId);
  if (cached?.path) {
    const fresh = readThreadRow(cached.path, args.sessionId);
    if (fresh) {
      threadTitleCache.set(args.sessionId, { path: cached.path, result: fresh });
      return fresh;
    }
  }

  for (const dir of await codexStateDirCandidates(args.worker)) {
    for (const dbPath of await stateDatabasePaths(dir)) {
      const result = readThreadRow(dbPath, args.sessionId);
      if (result) {
        threadTitleCache.set(args.sessionId, { path: dbPath, result });
        return result;
      }
    }
  }

  threadTitleCache.set(args.sessionId, { path: null, result: null });
  return null;
}
