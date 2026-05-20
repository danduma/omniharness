import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { runs, workers } from "@/server/db/schema";
import { recordExecutionEvent } from "@/server/events/execution-event-store";
import { openRecoveryIncident, markRecoveryIncidentNeedsUser } from "@/server/runs/recovery-incidents";
import { getRecoveryPolicy } from "@/server/runs/recovery-policy";
import { scheduleDurableSupervisorWakeAt } from "@/server/supervisor/wake-schedule";
import { extractQuotaResetInfo, normalizeQuotaResumeAt, parseQuotaResetText, type QuotaResetInfo } from "./reset-parser";

export type QuotaRecoveryResult =
  | { state: "quota_wait"; runId: string; incidentId: string; resumeAt: Date; quota: QuotaResetInfo }
  | { state: "needs_recovery"; runId: string; incidentId: string; quota: QuotaResetInfo };

export type WorkerQuotaBlockResult = {
  incidentId: string;
  quota: QuotaResetInfo;
  resumeAt: Date | null;
  details: Record<string, unknown>;
};

function truncate(value: string, maxLength = 2_000) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
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
}): Promise<WorkerQuotaBlockResult> {
  const now = args.now ?? new Date();
  const quota = parseQuotaResetText(args.text, {
    now,
    provider: args.provider,
  });
  const { resumeAt } = await computeResumeAt(quota, now);
  const details = quotaIncidentDetails({
    quota,
    resetAt: quota.resetAt,
    resumeAt,
    sourceType: "worker",
    failoverPending: args.failoverPending ?? false,
  });

  await db.update(workers).set({
    status: "cred-exhausted",
    updatedAt: now,
  }).where(eq(workers.id, args.workerId));

  const incident = await openRecoveryIncident({
    runId: args.runId,
    workerId: args.workerId,
    kind: "quota_exhausted",
    lastError: truncate(quota.rawText),
    details,
  });

  await insertQuotaEvent(args.runId, args.workerId, "quota_block_recorded", {
    summary: "Recorded worker quota block.",
    incidentId: incident.id,
    ...details,
  }, now);

  return { incidentId: incident.id, quota, resumeAt, details };
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

  if (!resumeAt || !policy.autoResumeAfterQuotaReset) {
    await db.update(runs).set({
      status: "needs_recovery",
      lastError: truncate(args.quota.rawText),
      updatedAt: now,
    }).where(eq(runs.id, args.runId));
    await markRecoveryIncidentNeedsUser({
      incidentId: args.incidentId,
      runId: args.runId,
      workerId: args.workerId ?? null,
      reason: "Quota reset time could not be scheduled automatically.",
      details,
    });
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

  await db.update(runs).set({
    status: "quota_waiting",
    failedAt: null,
    lastError: null,
    updatedAt: now,
  }).where(eq(runs.id, args.runId));

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
  const incident = await openRecoveryIncident({
    runId: args.runId,
    workerId: null,
    kind: "quota_exhausted",
    lastError: truncate(args.quota.rawText),
    details,
  });
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
  const block = await recordWorkerQuotaBlock({
    runId: args.runId,
    workerId: args.workerId,
    text: args.text,
    provider: args.provider,
    now: args.now,
  });
  return parkRunForQuotaWait({
    runId: args.runId,
    workerId: args.workerId,
    incidentId: block.incidentId,
    quota: block.quota,
    now: args.now,
  });
}
