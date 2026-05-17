const workerTurnChains = new Map<string, Promise<void>>();
const conversationMutationChains = new Map<string, Promise<void>>();

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

export function __resetWorkerTurnChainsForTests() {
  workerTurnChains.clear();
  conversationMutationChains.clear();
}
