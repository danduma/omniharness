import { AsyncLocalStorage } from "node:async_hooks";
import { eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { workers } from "@/server/db/schema";
import { assertRunNotHandoffFenced } from "@/server/handoff/fence";
import { withRunWorkspaceMutationAdmission } from "@/server/handoff/workspace-lock";

const workerTurnChains = new Map<string, Promise<void>>();
const conversationMutationChains = new Map<string, Promise<void>>();
const conversationRecoveryEpochs = new Map<string, number>();
const conversationRecoveryWorkers = new Map<string, Set<string>>();
const activeConversationMutation = new AsyncLocalStorage<string>();
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

/**
 * Stop and steer must be instant. Before this existed, neither could actually
 * end a running turn: `askAgent` read its SSE stream to completion with no
 * abort path, so a cancel only *asked* the adapter to stop and then waited for
 * it, and the next turn sat behind the dead one on the FIFO chain.
 *
 * Every turn now runs with an AbortSignal published on this async-local store,
 * so anything the turn calls — however deeply nested — can pick it up without
 * threading a parameter through every call site. `abortWorkerTurn` trips it
 * synchronously, which tears down the in-flight fetch locally rather than
 * negotiating with an agent that may be wedged.
 */
const workerTurnSignals = new AsyncLocalStorage<AbortSignal>();
const workerTurnAborts = new Map<string, AbortController>();

export class WorkerTurnAbortedError extends Error {
  readonly workerId: string;

  constructor(workerId: string, reason?: string) {
    super(`Worker turn aborted for ${workerId}${reason ? `: ${reason}` : ""}`);
    this.name = "WorkerTurnAbortedError";
    this.workerId = workerId;
  }
}

export function isWorkerTurnAbortedError(error: unknown): boolean {
  if (error instanceof WorkerTurnAbortedError) {
    return true;
  }
  const name = (error as { name?: unknown } | null)?.name;
  if (name === "AbortError" || name === "WorkerTurnAbortedError") {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /\bworker turn aborted\b|\bthis operation was aborted\b/i.test(message);
}

/** The AbortSignal of the turn running on this async context, if any. */
export function currentWorkerTurnSignal(): AbortSignal | undefined {
  return workerTurnSignals.getStore();
}

export function runWorkerTurn<T>(workerId: string, task: (signal: AbortSignal) => Promise<T>): Promise<T> {
  return runOnChain(workerTurnChains, workerId, async () => {
    const controller = new AbortController();
    workerTurnAborts.set(workerId, controller);
    try {
      return await workerTurnSignals.run(controller.signal, () => task(controller.signal));
    } finally {
      if (workerTurnAborts.get(workerId) === controller) {
        workerTurnAborts.delete(workerId);
      }
    }
  });
}

/**
 * Start a new recovery admission generation before waiting for the conversation
 * mutex. Registered recovery turns are aborted synchronously, while turns that
 * have not reached `runConversationRecoveryWorkerTurn` yet fail its epoch check.
 * Together those two sides close the worker-snapshot race between overlapping
 * edits/retries.
 */
export function beginConversationRecoveryPreemption(runId: string, reason?: string): number {
  const nextEpoch = (conversationRecoveryEpochs.get(runId) ?? 0) + 1;
  conversationRecoveryEpochs.set(runId, nextEpoch);
  for (const workerId of conversationRecoveryWorkers.get(runId) ?? []) {
    abortWorkerTurn(workerId, reason ?? "newer conversation recovery");
  }
  return nextEpoch;
}

export function finishConversationRecoveryPreemption(runId: string, expectedEpoch: number): void {
  if (
    conversationRecoveryEpochs.get(runId) === expectedEpoch
    && !conversationRecoveryWorkers.has(runId)
  ) {
    conversationRecoveryEpochs.delete(runId);
  }
}

export function isConversationRecoveryPreemptionCurrent(runId: string, expectedEpoch: number): boolean {
  return conversationRecoveryEpochs.get(runId) === expectedEpoch;
}

export function runConversationRecoveryWorkerTurn<T>(
  runId: string,
  expectedEpoch: number,
  workerId: string,
  task: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  if (conversationRecoveryEpochs.get(runId) !== expectedEpoch) {
    return Promise.reject(new Error(`Worker turn superseded by a newer worker turn: ${workerId}`));
  }

  const registeredWorkers = conversationRecoveryWorkers.get(runId) ?? new Set<string>();
  registeredWorkers.add(workerId);
  conversationRecoveryWorkers.set(runId, registeredWorkers);

  const turn = runWorkerTurn(workerId, async (signal) => {
    if (conversationRecoveryEpochs.get(runId) !== expectedEpoch) {
      throw new Error(`Worker turn superseded by a newer worker turn: ${workerId}`);
    }
    return task(signal);
  });
  return turn.finally(() => {
    registeredWorkers.delete(workerId);
    if (registeredWorkers.size === 0 && conversationRecoveryWorkers.get(runId) === registeredWorkers) {
      conversationRecoveryWorkers.delete(runId);
    }
  });
}

/**
 * Trip the running turn's signal for `workerId`. Synchronous and local: it does
 * not talk to the agent runtime, so a wedged adapter cannot delay it. Returns
 * false when there was no live turn to abort.
 */
export function abortWorkerTurn(workerId: string, reason?: string): boolean {
  const controller = workerTurnAborts.get(workerId);
  if (!controller || controller.signal.aborted) {
    return false;
  }
  controller.abort(new WorkerTurnAbortedError(workerId, reason));
  return true;
}

export function hasLiveWorkerTurn(workerId: string): boolean {
  const controller = workerTurnAborts.get(workerId);
  return Boolean(controller && !controller.signal.aborted);
}

export function __resetWorkerTurnAbortsForTests() {
  workerTurnAborts.clear();
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

export async function runConversationMutation<T>(runId: string, task: () => Promise<T>): Promise<T> {
  if (activeConversationMutation.getStore() === runId) {
    await assertRunNotHandoffFenced(runId);
    return task();
  }
  let operation!: Promise<T>;
  await withRunWorkspaceMutationAdmission(runId, () => {
    operation = runOnChain(conversationMutationChains, runId, async () => {
      await assertRunNotHandoffFenced(runId);
      return activeConversationMutation.run(runId, task);
    });
  });
  return operation;
}

/**
 * Runs `task` with the ambient conversation-mutation marker cleared, so a
 * `runConversationMutation` inside it takes the mutex instead of the reentrant
 * fast path above. Needed when a mutation dispatches background work that must
 * wait its turn rather than inherit the caller's lock: the marker propagates
 * into promises and timers, so simply not awaiting the work is not enough.
 */
export function runDetachedFromConversationMutation<T>(task: () => T): T {
  return activeConversationMutation.exit(task);
}

export async function waitForConversationMutations(runId: string, timeoutMs = 30_000): Promise<void> {
  const operation = conversationMutationChains.get(runId);
  if (!operation) return;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`Timed out waiting for conversation mutation ${runId}`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
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
  conversationRecoveryEpochs.clear();
  conversationRecoveryWorkers.clear();
  backgroundTasks.clear();
  backgroundTasksByRunId.clear();
  conversationDeletionRequests.clear();
  completedConversationDeletionRequests.clear();
}
