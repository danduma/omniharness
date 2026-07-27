import { eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { workers } from "@/server/db/schema";

const workerTurnChains = new Map<string, Promise<void>>();
const conversationMutationChains = new Map<string, Promise<void>>();
const backgroundTasks = new Set<Promise<void>>();
const backgroundTasksByRunId = new Map<string, Set<Promise<void>>>();
const conversationDeletionRequests = new Set<string>();
const completedConversationDeletionRequests = new Set<string>();

export function isWorkerTurnSupersededError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /\bworker turn (?:was )?superseded by a newer worker turn\b/i.test(message);
}

function runOnChain<T>(
  chains: Map<string, Promise<void>>,
  key: string,
  task: () => Promise<T>,
): Promise<T> {
  const previous = chains.get(key) ?? Promise.resolve();
  const next = previous.then(() => task());
  const tracked = next.then(() => undefined, () => undefined);
  chains.set(key, tracked);
  return next.finally(() => {
    if (chains.get(key) === tracked) {
      chains.delete(key);
    }
  });
}

export function runWorkerTurn<T>(workerId: string, task: () => Promise<T>): Promise<T> {
  return runOnChain(workerTurnChains, workerId, task);
}

/**
 * Read the worker's current turn fence value. Returns 0 when the worker
 * row is missing (treated as the default generation).
 */
export async function readWorkerTurnGeneration(workerId: string): Promise<number> {
  const record = await db
    .select({ turnGeneration: workers.turnGeneration })
    .from(workers)
    .where(eq(workers.id, workerId))
    .get();
  return record?.turnGeneration ?? 0;
}

/**
 * Capture a worker turn generation when the worker exists. A null result means
 * the bridge request is not backed by a persisted conversation worker and
 * therefore cannot participate in the database turn fence.
 */
export async function captureWorkerTurnGeneration(workerId: string): Promise<number | null> {
  const record = await db
    .select({ turnGeneration: workers.turnGeneration })
    .from(workers)
    .where(eq(workers.id, workerId))
    .get();
  return record?.turnGeneration ?? null;
}

/**
 * Atomically advance the worker turn fence and (optionally) reset persisted
 * worker state into a delivery-safe shape in the SAME mutation, so an
 * immediate queued delivery cannot observe stale `working` state after a
 * successful cancel. Returns the new generation value.
 *
 * Callers capture the returned generation for the new delivery; any older
 * in-flight completion that captured a smaller value must refuse to persist
 * terminal updates (see `isWorkerTurnGenerationCurrent`).
 */
export async function advanceWorkerTurnGeneration(
  workerId: string,
  reset?: { status?: string; clearCurrentText?: boolean; updatedAt?: Date },
): Promise<number> {
  await db.update(workers).set({
    turnGeneration: sql`${workers.turnGeneration} + 1`,
    ...(reset?.status !== undefined ? { status: reset.status } : {}),
    ...(reset?.clearCurrentText ? { currentText: "" } : {}),
    ...(reset?.updatedAt ? { updatedAt: reset.updatedAt } : {}),
  }).where(eq(workers.id, workerId));
  return readWorkerTurnGeneration(workerId);
}

/**
 * True when `capturedGeneration` still matches the worker's persisted fence,
 * i.e. no newer interrupt delivery has superseded the captured turn. A missing
 * worker row reports `false` so stale callers stop persisting.
 */
export async function isWorkerTurnGenerationCurrent(
  workerId: string,
  capturedGeneration: number,
): Promise<boolean> {
  const record = await db
    .select({ turnGeneration: workers.turnGeneration })
    .from(workers)
    .where(eq(workers.id, workerId))
    .get();
  if (!record) {
    return false;
  }
  return record.turnGeneration === capturedGeneration;
}

export function runConversationMutation<T>(runId: string, task: () => Promise<T>): Promise<T> {
  return runOnChain(conversationMutationChains, runId, task);
}

export function trackConversationBackgroundTask<T>(
  task: Promise<T>,
  options: { runId?: string } = {},
): Promise<T> {
  const runId = options.runId?.trim() || null;
  const tracked = task.then(() => undefined, () => undefined);
  backgroundTasks.add(tracked);
  if (runId) {
    const runTasks = backgroundTasksByRunId.get(runId) ?? new Set<Promise<void>>();
    runTasks.add(tracked);
    backgroundTasksByRunId.set(runId, runTasks);
  }
  void tracked.finally(() => {
    backgroundTasks.delete(tracked);
    if (runId) {
      const runTasks = backgroundTasksByRunId.get(runId);
      runTasks?.delete(tracked);
      if (!runTasks || runTasks.size === 0) {
        backgroundTasksByRunId.delete(runId);
      }
      if (completedConversationDeletionRequests.has(runId) && !backgroundTasksByRunId.has(runId)) {
        completedConversationDeletionRequests.delete(runId);
        conversationDeletionRequests.delete(runId);
      }
    }
  });
  return task;
}

export function requestConversationDeletion(runId: string): void {
  completedConversationDeletionRequests.delete(runId);
  conversationDeletionRequests.add(runId);
}

export function isConversationDeletionRequested(runId: string): boolean {
  return conversationDeletionRequests.has(runId);
}

export function completeConversationDeletion(runId: string): void {
  if (!backgroundTasksByRunId.has(runId)) {
    conversationDeletionRequests.delete(runId);
    completedConversationDeletionRequests.delete(runId);
    return;
  }
  completedConversationDeletionRequests.add(runId);
}

export async function waitForConversationBackgroundTasks(
  runId: string,
  timeoutMs = 30_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while ((backgroundTasksByRunId.get(runId)?.size ?? 0) > 0) {
    const remaining = deadline - Date.now();
    const runTasks = Array.from(backgroundTasksByRunId.get(runId) ?? []);
    if (remaining <= 0) {
      throw new Error(
        `Timed out waiting for ${runTasks.length} background task(s) for conversation ${runId}`,
      );
    }
    await Promise.race([
      Promise.all(runTasks),
      new Promise((resolve) => setTimeout(resolve, Math.min(remaining, 25))),
    ]);
  }
}

export async function waitForConversationBackgroundTasksForTests(timeoutMs = 1_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (backgroundTasks.size > 0) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      throw new Error(`Timed out waiting for ${backgroundTasks.size} conversation background task(s)`);
    }
    await Promise.race([
      Promise.all(Array.from(backgroundTasks)),
      new Promise((resolve) => setTimeout(resolve, Math.min(remaining, 25))),
    ]);
  }
}

export function __resetWorkerTurnChainsForTests() {
  workerTurnChains.clear();
  conversationMutationChains.clear();
  backgroundTasks.clear();
  backgroundTasksByRunId.clear();
  conversationDeletionRequests.clear();
  completedConversationDeletionRequests.clear();
}
