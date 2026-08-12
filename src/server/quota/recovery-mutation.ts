const recoveryMutationChains = new Map<string, Promise<void>>();

/**
 * Serialize only the short persisted mutations shared by quota recovery and
 * user Stop. This must never wrap bridge spawn/ask work: Stop needs to acquire
 * the fence immediately so it can terminalize the run and abort that work.
 *
 * This deliberately does not reuse the broader conversation mutation chain:
 * quota errors can surface while that chain is awaiting an external turn.
 * Recovery helpers must keep this fence non-nested and short-lived.
 */
export function runQuotaRecoveryMutation<T>(runId: string, task: () => Promise<T>): Promise<T> {
  const previous = recoveryMutationChains.get(runId) ?? Promise.resolve();
  const next = previous.then(() => task());
  const tracked = next.then(() => undefined, () => undefined);
  recoveryMutationChains.set(runId, tracked);
  return next.finally(() => {
    if (recoveryMutationChains.get(runId) === tracked) {
      recoveryMutationChains.delete(runId);
    }
  });
}

export function resetQuotaRecoveryMutationsForTests() {
  recoveryMutationChains.clear();
}
