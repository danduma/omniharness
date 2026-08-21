import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { runs, workers } from "@/server/db/schema";
import { assertRunNotHandoffFenced } from "./fence";

const workspaceMutationChains = new Map<string, Promise<void>>();

/**
 * Process-wide checkout mutex shared by handoff capture/launch and every
 * server-owned git mutation. The handoff's durable database fence protects
 * later requests; this mutex closes the check-then-act window while that fence
 * is being acquired or released.
 */
export async function withWorkspaceMutationLock<T>(projectPath: string, task: () => Promise<T>): Promise<T> {
  const key = path.resolve(projectPath);
  const previous = workspaceMutationChains.get(key) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const chain = previous.then(() => gate);
  workspaceMutationChains.set(key, chain);
  await previous;
  try {
    return await task();
  } finally {
    release();
    if (workspaceMutationChains.get(key) === chain) workspaceMutationChains.delete(key);
  }
}

async function resolveRunWorkspace(runId: string) {
  const run = await db.select({ projectPath: runs.projectPath }).from(runs).where(eq(runs.id, runId)).get();
  if (run?.projectPath) return run.projectPath;
  const worker = await db.select({ cwd: workers.cwd }).from(workers).where(eq(workers.runId, runId)).get();
  return worker?.cwd ?? process.cwd();
}

/** Atomically admits a source mutation against installation of a handoff fence. */
export async function withRunWorkspaceMutationAdmission(runId: string, admit: () => void): Promise<void> {
  const projectPath = await resolveRunWorkspace(runId);
  await withWorkspaceMutationLock(projectPath, async () => {
    await assertRunNotHandoffFenced(runId);
    admit();
  });
}

export async function withRunWorkspaceMutationLock<T>(runId: string, task: () => Promise<T>): Promise<T> {
  const projectPath = await resolveRunWorkspace(runId);
  return withWorkspaceMutationLock(projectPath, async () => {
    await assertRunNotHandoffFenced(runId);
    return task();
  });
}

export function __resetWorkspaceMutationLocksForTests() {
  workspaceMutationChains.clear();
}
