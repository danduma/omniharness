import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { executionEvents, runs, workers } from "@/server/db/schema";
import { openRecoveryIncident, markRecoveryIncidentNeedsUser } from "@/server/runs/recovery-incidents";
import { getRecoveryPolicy } from "@/server/runs/recovery-policy";
import { scheduleDurableSupervisorWakeAt } from "@/server/supervisor/wake-schedule";
import { extractQuotaResetInfo, normalizeQuotaResumeAt, parseQuotaResetText, type QuotaResetInfo } from "./reset-parser";

export type QuotaRecoveryResult =
  | { state: "quota_wait"; runId: string; incidentId: string; resumeAt: Date; quota: QuotaResetInfo }
  | { state: "needs_recovery"; runId: string; incidentId: string; quota: QuotaResetInfo };

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
  await db.insert(executionEvents).values({
    id: randomUUID(),
    runId,
    workerId,
    planItemId: null,
    eventType,
    details: JSON.stringify(details),
    createdAt: now,
  });
}

function quotaIncidentDetails(args: {
  quota: QuotaResetInfo;
  resetAt: Date | null;
  resumeAt: Date | null;
  scheduledWakeAt?: Date | null;
  sourceType: "supervisor" | "worker";
}) {
  return {
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
}

async function handleQuotaExhaustion(args: {
  runId: string;
  workerId?: string | null;
  quota: QuotaResetInfo;
  sourceType: "supervisor" | "worker";
  now?: Date;
}) {
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
    sourceType: args.sourceType,
  });
  const incident = await openRecoveryIncident({
    runId: args.runId,
    workerId: args.workerId ?? null,
    kind: "quota_exhausted",
    lastError: truncate(args.quota.rawText),
    details,
  });

  if (!resumeAt || !policy.autoResumeAfterQuotaReset) {
    await db.update(runs).set({
      status: "needs_recovery",
      lastError: truncate(args.quota.rawText),
      updatedAt: now,
    }).where(eq(runs.id, args.runId));
    await markRecoveryIncidentNeedsUser({
      incidentId: incident.id,
      runId: args.runId,
      workerId: args.workerId ?? null,
      reason: "Quota reset time could not be scheduled automatically.",
      details,
    });
    await insertQuotaEvent(args.runId, args.workerId ?? null, "quota_wait_unschedulable", {
      summary: "Quota exhaustion requires manual recovery.",
      incidentId: incident.id,
      ...details,
    }, now);
    return {
      state: "needs_recovery" as const,
      runId: args.runId,
      incidentId: incident.id,
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
    incidentId: incident.id,
    details: {
      ...details,
      incidentId: incident.id,
    },
  });

  await insertQuotaEvent(args.runId, args.workerId ?? null, "quota_wait_scheduled", {
    summary: "Scheduled supervisor resume after quota reset.",
    incidentId: incident.id,
    ...details,
    scheduledWakeAt: resumeAt.toISOString(),
  }, now);

  return {
    state: "quota_wait" as const,
    runId: args.runId,
    incidentId: incident.id,
    resumeAt,
    quota: args.quota,
  };
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
  return handleQuotaExhaustion({
    runId: args.runId,
    quota,
    sourceType: "supervisor",
    now: args.now,
  });
}

export async function handleWorkerQuotaExhaustion(args: {
  runId: string;
  workerId: string;
  text: string;
  provider?: string | null;
  now?: Date;
}) {
  const quota = parseQuotaResetText(args.text, {
    now: args.now,
    provider: args.provider,
  });
  await db.update(workers).set({
    status: "cred-exhausted",
    updatedAt: args.now ?? new Date(),
  }).where(eq(workers.id, args.workerId));
  return handleQuotaExhaustion({
    runId: args.runId,
    workerId: args.workerId,
    quota,
    sourceType: "worker",
    now: args.now,
  });
}
