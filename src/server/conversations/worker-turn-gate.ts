const workerTurnChains = new Map<string, Promise<void>>();

export function runWorkerTurn<T>(workerId: string, task: () => Promise<T>): Promise<T> {
  const previous = workerTurnChains.get(workerId) ?? Promise.resolve();
  const next = previous.then(() => task());
  const tracked = next.then(() => undefined, () => undefined);
  workerTurnChains.set(workerId, tracked);
  return next.finally(() => {
    if (workerTurnChains.get(workerId) === tracked) {
      workerTurnChains.delete(workerId);
    }
  });
}

export function __resetWorkerTurnChainsForTests() {
  workerTurnChains.clear();
}
