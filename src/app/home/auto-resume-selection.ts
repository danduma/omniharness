export type RecoverRunAction = "retry" | "edit" | "fork";

export function shouldSelectRecoveredRunAfterSuccess({
  action,
  currentSelectedRunId,
  requestedRunId,
  recoveredRunId,
}: {
  action: RecoverRunAction;
  currentSelectedRunId: string | null;
  requestedRunId: string;
  recoveredRunId: string | null | undefined;
}) {
  if (!recoveredRunId) {
    return false;
  }

  if (action === "fork") {
    return true;
  }

  return currentSelectedRunId === requestedRunId;
}

export function cancelInactiveAutoResumeTimers<TEntry extends { timerId: ReturnType<typeof setTimeout> | null }>(
  entries: Map<string, TEntry>,
  activeRunId: string | null,
  clearTimer: (timerId: ReturnType<typeof setTimeout>) => void = clearTimeout,
) {
  let cancelled = 0;

  for (const [runId, entry] of entries.entries()) {
    if (runId === activeRunId) {
      continue;
    }

    if (entry.timerId) {
      clearTimer(entry.timerId);
      cancelled += 1;
    }
    entries.delete(runId);
  }

  return cancelled;
}

export function shouldFireAutoResumeTimer<TEntry extends {
  failureKey: string;
  targetMessageId: string;
  timerId: ReturnType<typeof setTimeout> | null;
}>(args: {
  entries: Map<string, TEntry>;
  runId: string;
  failureKey: string;
  targetMessageId: string;
  activeRunId: string | null;
  isAutoResumableConversation: boolean;
  selectedRunStatus: string | null;
  failedWorkerAvailabilityStatus: string | null;
  hasWorkerFailureDetail: boolean;
  recoverRunIsPending: boolean;
}) {
  const current = args.entries.get(args.runId);
  return Boolean(current)
    && current?.failureKey === args.failureKey
    && current?.targetMessageId === args.targetMessageId
    && args.activeRunId === args.runId
    && args.isAutoResumableConversation
    && args.selectedRunStatus === "failed"
    && args.failedWorkerAvailabilityStatus === "ok"
    && !args.hasWorkerFailureDetail
    && !args.recoverRunIsPending;
}
