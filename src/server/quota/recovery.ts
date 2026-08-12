import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { recoveryIncidents, runs, workerCredentialAllocations, workers } from "@/server/db/schema";
import { recordExecutionEvent } from "@/server/events/execution-event-store";
import { emitNamedEvent } from "@/server/events/named-events";
import { openRecoveryIncident, markRecoveryIncidentNeedsUser, markRecoveryIncidentResolved } from "@/server/runs/recovery-incidents";
import { getRecoveryPolicy } from "@/server/runs/recovery-policy";
import { isTerminalRunStatus, normalizeRunStatus } from "@/server/runs/status";
import { cancelDurableSupervisorWake, scheduleDurableSupervisorWakeAt } from "@/server/supervisor/wake-schedule";
import { runQuotaRecoveryMutation } from "@/server/quota/recovery-mutation";
import { extractQuotaResetInfo, normalizeQuotaResumeAt, parseQuotaResetText, type QuotaResetInfo } from "./reset-parser";

export type QuotaRecoveryResult =
  | { state: "quota_wait"; runId: string; incidentId: string; resumeAt: Date; quota: QuotaResetInfo }
  | { state: "needs_recovery"; runId: string; incidentId: string; quota: QuotaResetInfo }
  | {
      state: "ignored";
      runId: string;
      reason: "run_missing" | "run_terminal" | "worker_cancelled";
      runStatus: string | null;
    };

export type WorkerQuotaBlockResult = {
  incidentId: string;
  quota: QuotaResetInfo;
  resumeAt: Date | null;
  details: Record<string, unknown>;
};

export type RecordWorkerQuotaBlockResult =
  | WorkerQuotaBlockResult
  | Extract<QuotaRecoveryResult, { state: "ignored" }>;

function truncate(value: string, maxLength = 2_000) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function isCancelledWorkerStatus(status: string | null | undefined) {
  const normalized = normalizeRunStatus(status);
  return normalized === "cancelled" || normalized === "canceled";
}

function isTerminalRecoveryRunStatus(status: string | null | undefined) {
  return isTerminalRunStatus(status) || normalizeRunStatus(status) === "canceled";
}

export async function refuseLateQuotaRecovery(args: {
  runId: string;
  workerId?: string | null;
  incidentId?: string | null;
  now: Date;
}): Promise<Extract<QuotaRecoveryResult, { state: "ignored" }> | null> {
  const run = await db.select().from(runs).where(eq(runs.id, args.runId)).get();
  const worker = args.workerId
    ? await db.select().from(workers).where(eq(workers.id, args.workerId)).get()
    : null;
  const quotaIncident = run
    ? await db.select({ id: recoveryIncidents.id })
      .from(recoveryIncidents)
      .where(and(
        eq(recoveryIncidents.runId, args.runId),
        eq(recoveryIncidents.kind, "quota_exhausted"),
        inArray(recoveryIncidents.status, ["open", "recovering"]),
        ...(args.incidentId ? [eq(recoveryIncidents.id, args.incidentId)] : []),
      ))
      .limit(1)
      .get()
    : null;
  const staleFailedRunOwnedByQuota = normalizeRunStatus(run?.status) === "failed" && Boolean(quotaIncident);
  const reason = !run
    ? "run_missing" as const
    : isTerminalRecoveryRunStatus(run.status) && !staleFailedRunOwnedByQuota
      ? "run_terminal" as const
      : isCancelledWorkerStatus(worker?.status)
        ? "worker_cancelled" as const
        : null;
  if (!reason) {
    return null;
  }

  // Stop writes both the run and worker terminal barriers. If a quota callback
  // had already passed its first check and overwrote the worker afterward,
  // restore the worker side of that barrier before returning.
  if (
    run
    && reason === "run_terminal"
    && isCancelledWorkerStatus(run.status)
    && worker
    && !isCancelledWorkerStatus(worker.status)
  ) {
    const restored = await db.update(workers).set({
      status: "cancelled",
      updatedAt: args.now,
    }).where(and(
      eq(workers.id, worker.id),
      eq(workers.status, worker.status),
    )).returning({ id: workers.id });
    if (restored.length > 0) {
      emitNamedEvent({
        kind: "worker.status",
        runId: args.runId,
        workerId: worker.id,
        prev: worker.status,
        next: "cancelled",
      });
      emitNamedEvent({
        kind: "worker.terminal",
        runId: args.runId,
        workerId: worker.id,
        status: "cancelled",
      });
    }
  }

  if (run && args.incidentId) {
    await markRecoveryIncidentResolved({
      incidentId: args.incidentId,
      runId: args.runId,
      workerId: args.workerId ?? null,
      summary: "Ignored quota recovery because the user-owned terminal state is authoritative.",
      details: { reason, runStatus: run.status },
    });
  }

  if (run) {
    await insertQuotaEvent(args.runId, args.workerId ?? null, "quota_recovery_refused", {
      summary: "Ignored a late quota recovery callback after the conversation became terminal.",
      reason,
      runStatus: run.status,
      incidentId: args.incidentId ?? null,
    }, args.now);
  }
  emitNamedEvent({
    kind: "recovery.refused",
    runId: args.runId,
    workerId: args.workerId ?? null,
    reason,
    runStatus: run?.status ?? null,
  });
  return {
    state: "ignored",
    runId: args.runId,
    reason,
    runStatus: run?.status ?? null,
  };
}

export async function transitionRunForQuotaRecovery(args: {
  runId: string;
  workerId?: string | null;
  incidentId: string;
  now: Date;
  updates: {
    status: string;
    failedAt?: Date | null;
    lastError?: string | null;
    updatedAt: Date;
  };
}): Promise<Extract<QuotaRecoveryResult, { state: "ignored" }> | null> {
  // Compare-and-swap the status that granted recovery ownership. If Stop wins
  // between the read and write, retrying observes the terminal state and emits
  // the refusal instead of overwriting it.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const refused = await refuseLateQuotaRecovery(args);
    if (refused) {
      return refused;
    }
    const currentRun = await db.select().from(runs).where(eq(runs.id, args.runId)).get();
    if (!currentRun) {
      continue;
    }
    const transitioned = await db.update(runs).set(args.updates).where(and(
      eq(runs.id, args.runId),
      eq(runs.status, currentRun.status),
    )).returning({ id: runs.id });
    if (transitioned.length > 0) {
      return null;
    }
  }

  const refused = await refuseLateQuotaRecovery(args);
  if (refused) {
    return refused;
  }
  throw new Error(`Could not claim quota recovery ownership for run ${args.runId}.`);
}

async function insertQuotaEvent(
  runId: string,
  workerId: string | null,
  eventType: string,
  details: Record<string, unknown>,
  now: Date,
) {
  await recordExecutionEvent({
    runId,
    workerId,
    planItemId: null,
    eventType,
    details,
    createdAt: now,
  });
}

function quotaIncidentDetails(args: {
  quota: QuotaResetInfo;
  resetAt: Date | null;
  resumeAt: Date | null;
  scheduledWakeAt?: Date | null;
  sourceType: "supervisor" | "worker";
  failoverPending?: boolean;
  accountId?: string | null;
}) {
  const details: Record<string, unknown> = {
    recoveryState: args.resumeAt ? "quota_waiting" : "needs_recovery",
    recommendedAction: args.resumeAt ? "wait_for_quota_reset" : "manual_resume",
    sourceType: args.sourceType,
    resetAt: args.resetAt?.toISOString() ?? null,
    resumeAt: args.resumeAt?.toISOString() ?? null,
    scheduledWakeAt: args.scheduledWakeAt?.toISOString() ?? args.resumeAt?.toISOString() ?? null,
    quotaResetSource: args.quota.source,
    quotaResetConfidence: args.quota.confidence,
    retryAfterMs: args.quota.retryAfterMs,
    provider: args.quota.provider ?? null,
    accountId: args.accountId ?? null,
    rawText: truncate(args.quota.rawText),
  };
  if (args.failoverPending) {
    details.failover_pending = true;
  }
  return details;
}

async function computeResumeAt(quota: QuotaResetInfo, now: Date) {
  const policy = await getRecoveryPolicy();
  return {
    policy,
    resumeAt: normalizeQuotaResumeAt(quota, {
      now,
      quotaResetGraceMs: policy.quotaResetGraceMs,
      maxQuotaWaitMs: policy.maxQuotaWaitMs,
      allowQuotaWaitWithoutParsedReset: policy.allowQuotaWaitWithoutParsedReset,
    }),
  };
}

/**
 * Step (a) of quota handling: mark the worker `cred-exhausted` and open
 * the recovery incident. Does NOT park the run. Used by the failover
 * path which wants to record the block before deciding whether to
 * actually transition the run.
 *
 * Optionally marks `details.failover_pending: true` on the incident so
 * the supervisor wake handler can detect that a failover attempt is
 * still owed for this incident.
 */
export async function recordWorkerQuotaBlock(args: {
  runId: string;
  workerId: string;
  text: string;
  provider?: string | null;
  now?: Date;
  failoverPending?: boolean;
}): Promise<RecordWorkerQuotaBlockResult> {
  const now = args.now ?? new Date();
  const quota = parseQuotaResetText(args.text, {
    now,
    provider: args.provider,
  });
  const { resumeAt } = await computeResumeAt(quota, now);
  const allocation = await db.select()
    .from(workerCredentialAllocations)
    .where(eq(workerCredentialAllocations.workerId, args.workerId))
    .get();
  const details = quotaIncidentDetails({
    quota,
    resetAt: quota.resetAt,
    resumeAt,
    sourceType: "worker",
    failoverPending: args.failoverPending ?? false,
    accountId: allocation?.accountId ?? null,
  });

  return runQuotaRecoveryMutation(args.runId, async () => {

  const preMutationRefusal = await refuseLateQuotaRecovery({
    runId: args.runId,
    workerId: args.workerId,
    now,
  });
  if (preMutationRefusal) {
    return preMutationRefusal;
  }

  // CAS the worker status that granted this callback authority. A concurrent
  // Stop either changes it first (so this update loses) or runs afterward and
  // cancels it during Stop's worker sweep.
  let workerClaimed = false;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const currentWorker = await db.select().from(workers).where(eq(workers.id, args.workerId)).get();
    const refused = await refuseLateQuotaRecovery({
      runId: args.runId,
      workerId: args.workerId,
      now,
    });
    if (refused) {
      return refused;
    }
    if (!currentWorker) {
      throw new Error(`Cannot record quota block for missing worker ${args.workerId}.`);
    }
    const claimed = await db.update(workers).set({
      status: "cred-exhausted",
      updatedAt: now,
    }).where(and(
      eq(workers.id, args.workerId),
      eq(workers.status, currentWorker.status),
    )).returning({ id: workers.id });
    if (claimed.length > 0) {
      workerClaimed = true;
      break;
    }
  }
  if (!workerClaimed) {
    const refused = await refuseLateQuotaRecovery({ runId: args.runId, workerId: args.workerId, now });
    if (refused) {
      return refused;
    }
    throw new Error(`Could not claim quota recovery ownership for worker ${args.workerId}.`);
  }

  const postWorkerRefusal = await refuseLateQuotaRecovery({
    runId: args.runId,
    workerId: args.workerId,
    now,
  });
  if (postWorkerRefusal) {
    return postWorkerRefusal;
  }

  const incident = await openRecoveryIncident({
    runId: args.runId,
    workerId: args.workerId,
    kind: "quota_exhausted",
    lastError: truncate(quota.rawText),
    details,
  });

  const postIncidentRefusal = await refuseLateQuotaRecovery({
    runId: args.runId,
    workerId: args.workerId,
    incidentId: incident.id,
    now,
  });
  if (postIncidentRefusal) {
    return postIncidentRefusal;
  }

  await insertQuotaEvent(args.runId, args.workerId, "quota_block_recorded", {
    summary: "Recorded worker quota block.",
    incidentId: incident.id,
    ...details,
  }, now);

  return { incidentId: incident.id, quota, resumeAt, details };
  });
}

/**
 * Step (b) of quota handling: transition the run into `quota_waiting`
 * (or `needs_recovery` if the reset cannot be scheduled) and schedule
 * the durable supervisor wake. Used after `recordWorkerQuotaBlock` when
 * failover gave up, OR directly when there is no worker context.
 *
 * Clears `failover_pending` on the incident — by the time we park, we
 * are no longer deferring to failover.
 */
export async function parkRunForQuotaWait(args: {
  runId: string;
  workerId?: string | null;
  incidentId: string;
  quota: QuotaResetInfo;
  now?: Date;
}): Promise<QuotaRecoveryResult> {
  const now = args.now ?? new Date();
  const policy = await getRecoveryPolicy();
  const resumeAt = normalizeQuotaResumeAt(args.quota, {
    now,
    quotaResetGraceMs: policy.quotaResetGraceMs,
    maxQuotaWaitMs: policy.maxQuotaWaitMs,
    allowQuotaWaitWithoutParsedReset: policy.allowQuotaWaitWithoutParsedReset,
  });
  const details = quotaIncidentDetails({
    quota: args.quota,
    resetAt: args.quota.resetAt,
    resumeAt,
    sourceType: args.workerId ? "worker" : "supervisor",
  });

  return runQuotaRecoveryMutation(args.runId, async () => {

  if (!resumeAt || !policy.autoResumeAfterQuotaReset) {
    const refused = await transitionRunForQuotaRecovery({
      runId: args.runId,
      workerId: args.workerId,
      incidentId: args.incidentId,
      now,
      updates: {
        status: "needs_recovery",
        lastError: truncate(args.quota.rawText),
        updatedAt: now,
      },
    });
    if (refused) {
      return refused;
    }
    await markRecoveryIncidentNeedsUser({
      incidentId: args.incidentId,
      runId: args.runId,
      workerId: args.workerId ?? null,
      reason: "Quota reset time could not be scheduled automatically.",
      details,
    });
    const postIncidentRefusal = await refuseLateQuotaRecovery({
      runId: args.runId,
      workerId: args.workerId,
      incidentId: args.incidentId,
      now,
    });
    if (postIncidentRefusal) {
      return postIncidentRefusal;
    }
    await insertQuotaEvent(args.runId, args.workerId ?? null, "quota_wait_unschedulable", {
      summary: "Quota exhaustion requires manual recovery.",
      incidentId: args.incidentId,
      ...details,
    }, now);
    return {
      state: "needs_recovery",
      runId: args.runId,
      incidentId: args.incidentId,
      quota: args.quota,
    };
  }

  const refused = await transitionRunForQuotaRecovery({
    runId: args.runId,
    workerId: args.workerId,
    incidentId: args.incidentId,
    now,
    updates: {
      status: "quota_waiting",
      failedAt: null,
      lastError: null,
      updatedAt: now,
    },
  });
  if (refused) {
    return refused;
  }

  await scheduleDurableSupervisorWakeAt({
    runId: args.runId,
    wakeAt: resumeAt,
    reason: "quota_wait",
    source: args.quota.source,
    incidentId: args.incidentId,
    details: {
      ...details,
      incidentId: args.incidentId,
    },
  });

  // Scheduling and Stop are separate storage operations. If Stop lands after
  // the run transition but before the wake insert completes, remove the wake
  // here; if it lands after this check, Stop's own cleanup removes it.
  const postScheduleRefusal = await refuseLateQuotaRecovery({
    runId: args.runId,
    workerId: args.workerId,
    incidentId: args.incidentId,
    now,
  });
  if (postScheduleRefusal) {
    await cancelDurableSupervisorWake(args.runId, "quota_wait");
    return postScheduleRefusal;
  }

  await insertQuotaEvent(args.runId, args.workerId ?? null, "quota_wait_scheduled", {
    summary: "Scheduled supervisor resume after quota reset.",
    incidentId: args.incidentId,
    ...details,
    scheduledWakeAt: resumeAt.toISOString(),
  }, now);

  return {
    state: "quota_wait",
    runId: args.runId,
    incidentId: args.incidentId,
    resumeAt,
    quota: args.quota,
  };
  });
}

async function handleSupervisorOnlyQuotaExhaustion(args: {
  runId: string;
  quota: QuotaResetInfo;
  now?: Date;
}) {
  const now = args.now ?? new Date();
  const { resumeAt } = await computeResumeAt(args.quota, now);
  const details = quotaIncidentDetails({
    quota: args.quota,
    resetAt: args.quota.resetAt,
    resumeAt,
    sourceType: "supervisor",
  });
  const incident = await runQuotaRecoveryMutation(args.runId, async () => {
    const refused = await refuseLateQuotaRecovery({ runId: args.runId, now });
    if (refused) {
      return refused;
    }
    return openRecoveryIncident({
      runId: args.runId,
      workerId: null,
      kind: "quota_exhausted",
      lastError: truncate(args.quota.rawText),
      details,
    });
  });
  if ("state" in incident) {
    return incident;
  }
  return parkRunForQuotaWait({
    runId: args.runId,
    workerId: null,
    incidentId: incident.id,
    quota: args.quota,
    now,
  });
}

export async function handleSupervisorQuotaExhaustion(args: {
  runId: string;
  error: unknown;
  provider?: string | null;
  now?: Date;
}) {
  const quota = extractQuotaResetInfo(args.error, {
    now: args.now,
    provider: args.provider,
  });
  return handleSupervisorOnlyQuotaExhaustion({
    runId: args.runId,
    quota,
    now: args.now,
  });
}

/**
 * Backward-compatible wrapper: record the block and park the run. New
 * callers that want to attempt failover before parking should call
 * `recordWorkerQuotaBlock` then `parkRunForQuotaWait` themselves.
 */
export async function handleWorkerQuotaExhaustion(args: {
  runId: string;
  workerId: string;
  text: string;
  provider?: string | null;
  now?: Date;
}): Promise<QuotaRecoveryResult> {
  const now = args.now ?? new Date();
  const refused = await refuseLateQuotaRecovery({
    runId: args.runId,
    workerId: args.workerId,
    now,
  });
  if (refused) {
    return refused;
  }
  const block = await recordWorkerQuotaBlock({
    runId: args.runId,
    workerId: args.workerId,
    text: args.text,
    provider: args.provider,
    now,
  });
  if ("state" in block) {
    return block;
  }
  return parkRunForQuotaWait({
    runId: args.runId,
    workerId: args.workerId,
    incidentId: block.incidentId,
    quota: block.quota,
    now,
  });
}
