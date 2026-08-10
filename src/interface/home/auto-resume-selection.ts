import { isPermanentAccountFailure, isPoisonedSessionFailure } from "@/lib/provider-account-failures";

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

// Delegates to the shared gate in @/lib/provider-account-failures. Widening a
// local regex here is what made this bug recur: each round added more dead-
// credential wording, which only made a *live* account latch harder when the
// provider returned a spurious "403 Account suspended". Permanence for auth
// wording is now decided by probing the credential server-side, and the verdict
// travels in the failure text.
export function isPermanentAutoResumeFailure(failureKey: string | null | undefined) {
  // A poisoned session is not an account problem, but re-asking it on a timer
  // just replays the broken state, so auto-resume must stay off for it too.
  return isPermanentAccountFailure(failureKey) || isPoisonedSessionFailure(failureKey);
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
    && !isPermanentAutoResumeFailure(args.failureKey)
    && !args.hasWorkerFailureDetail
    && !args.recoverRunIsPending;
}
