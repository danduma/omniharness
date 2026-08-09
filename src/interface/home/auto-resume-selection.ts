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

// Match how adapters actually word a dead credential, not just the tidy forms.
// "Failed to authenticate. API Error: 403 Account suspended" matched none of the
// original patterns ("auth failed" is the reverse word order), so opening a
// permanently-dead session re-fired auto-resume against an account that can
// never answer.
export function isPermanentAutoResumeFailure(failureKey: string | null | undefined) {
  return /\b(?:api key|authentication required|auth(?:entication)? failed|failed to auth(?:enticate)?|authentication_failed|account suspended|account (?:is )?(?:disabled|banned)|(?:access |refresh )?token (?:has been |was )?revoked|billing required|api billing|cap_exceeded|insufficient quota|resource exhausted|system resources are low|worker\.spawn\.resource_exhausted|ede_diagnostic)\b/i.test(failureKey ?? "");
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
