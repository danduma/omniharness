const workerTurnChains = new Map<string, Promise<void>>();
const conversationMutationChains = new Map<string, Promise<void>>();
const backgroundTasks = new Set<Promise<void>>();

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

export function runConversationMutation<T>(runId: string, task: () => Promise<T>): Promise<T> {
  return runOnChain(conversationMutationChains, runId, task);
}

export function trackConversationBackgroundTask<T>(task: Promise<T>): Promise<T> {
  const tracked = task.then(() => undefined, () => undefined);
  backgroundTasks.add(tracked);
  void tracked.finally(() => {
    backgroundTasks.delete(tracked);
  });
  return task;
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
}
