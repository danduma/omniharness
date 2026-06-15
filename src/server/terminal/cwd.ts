import { eq } from "drizzle-orm";
import { existsSync, statSync } from "node:fs";
import { db } from "@/server/db";
import { processSessions, runs, workers } from "@/server/db/schema";

/**
 * Resolve the working directory for a UI terminal.
 *
 * A conversation id is a run id (see session-records.ts). Prefer the directory
 * the session is actually operating in — the process session cwd, else the
 * primary worker cwd — then fall back to the run's project path, then the
 * server process cwd. Resolution is server-side only; the client never supplies
 * a raw path.
 */
export async function resolveConversationCwd(conversationId: string | null | undefined): Promise<string> {
  const fallback = process.cwd();
  if (!conversationId) {
    return fallback;
  }

  try {
    const processSession = await db
      .select({ cwd: processSessions.cwd })
      .from(processSessions)
      .where(eq(processSessions.runId, conversationId))
      .get();
    if (processSession && isUsableDir(processSession.cwd)) {
      return processSession.cwd;
    }

    const worker = await db
      .select({ cwd: workers.cwd })
      .from(workers)
      .where(eq(workers.runId, conversationId))
      .get();
    if (worker && isUsableDir(worker.cwd)) {
      return worker.cwd;
    }

    const run = await db
      .select({ projectPath: runs.projectPath })
      .from(runs)
      .where(eq(runs.id, conversationId))
      .get();
    if (run?.projectPath && isUsableDir(run.projectPath)) {
      return run.projectPath;
    }
  } catch {
    // Fall through to the process cwd on any lookup failure.
  }

  return fallback;
}

function isUsableDir(candidate: string): boolean {
  try {
    return existsSync(candidate) && statSync(candidate).isDirectory();
  } catch {
    return false;
  }
}
