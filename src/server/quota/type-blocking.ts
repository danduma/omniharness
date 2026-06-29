import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { accounts, workers, recoveryIncidents, workerCredentialAllocations } from "@/server/db/schema";
import { markRecoveryIncidentResolved } from "@/server/runs/recovery-incidents";
import {
  SUPPORTED_WORKER_TYPES,
  type SupportedWorkerType,
  normalizeWorkerType,
} from "@/server/supervisor/worker-types";

type RecoveryIncidentRecord = typeof recoveryIncidents.$inferSelect;

export type QuotaBlockReason = {
  reason: string;
  resumeAt: Date | null;
};

const OPEN_QUOTA_INCIDENT_STATUSES = ["open", "waiting", "quota_waiting", "recovering", "needs_user"] as const;

function parseDetails(details: string | null | undefined): Record<string, unknown> {
  if (!details) return {};
  try {
    const parsed: unknown = JSON.parse(details);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function readResumeAt(details: Record<string, unknown>): Date | null {
  const value = details.resumeAt;
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function readAccountId(details: Record<string, unknown>): string | null {
  return typeof details.accountId === "string" && details.accountId.trim()
    ? details.accountId.trim()
    : null;
}

async function usableAccountIdsForType(type: SupportedWorkerType): Promise<Set<string>> {
  const rows = await db.select().from(accounts).where(eq(accounts.cliType, type));
  return new Set(rows
    .filter((account) => {
      if (!account.enabled) return false;
      const status = account.status?.trim().toLowerCase();
      return status !== "quota_exhausted" && status !== "login_required" && status !== "disabled";
    })
    .map((account) => account.id));
}

async function allocatedAccountIdForWorker(workerId: string): Promise<string | null> {
  const allocation = await db.select()
    .from(workerCredentialAllocations)
    .where(eq(workerCredentialAllocations.workerId, workerId))
    .get();
  return allocation?.accountId ?? null;
}

function shouldBlockTypeForAccounts(usableAccountIds: Set<string>, blockedAccountIds: Set<string>, legacyBlocked: boolean) {
  if (usableAccountIds.size === 0) return legacyBlocked;
  if (blockedAccountIds.size === 0) return false;
  for (const accountId of usableAccountIds) {
    if (!blockedAccountIds.has(accountId)) return false;
  }
  return true;
}

function newestRecoveryIncident(incidents: RecoveryIncidentRecord[]) {
  return [...incidents].sort((a, b) => {
    const updatedDelta = b.updatedAt.getTime() - a.updatedAt.getTime();
    return updatedDelta !== 0 ? updatedDelta : b.id.localeCompare(a.id);
  })[0] ?? null;
}

function isResumeAtPast(resumeAt: Date | null, now: Date): boolean {
  return resumeAt !== null && resumeAt.getTime() <= now.getTime();
}

/**
 * Returns true if the given worker type is currently blocked by quota.
 *
 * Considers two signals (both maintained by handleWorkerQuotaExhaustion):
 *   1. Any `workers` row of this type with status = "cred-exhausted"
 *   2. Any open `recoveryIncidents` row of kind "quota_exhausted" tied to a worker of this type
 *
 * Incidents (and their associated worker rows) whose stored `details.resumeAt`
 * is in the past are ignored — the parsed reset has already happened, so the
 * type is eligible again even if the durable-wake handler has not yet swept
 * the row.
 */
export async function isWorkerTypeQuotaBlocked(
  type: SupportedWorkerType,
  options: { now?: Date } = {},
): Promise<boolean> {
  const now = options.now ?? new Date();
  const usableAccountIds = await usableAccountIdsForType(type);
  const blockedAccountIds = new Set<string>();
  let legacyBlocked = false;

  const exhaustedWorkers = await db.select()
    .from(workers)
    .where(and(
      eq(workers.type, type),
      eq(workers.status, "cred-exhausted"),
    ));

  if (exhaustedWorkers.length > 0) {
    const workerIds = exhaustedWorkers.map((w) => w.id);
    const recentIncidents = await db.select()
      .from(recoveryIncidents)
      .where(and(
        eq(recoveryIncidents.kind, "quota_exhausted"),
        inArray(recoveryIncidents.workerId, workerIds),
      ));

    for (const worker of exhaustedWorkers) {
      const incidentForWorker = newestRecoveryIncident(
        recentIncidents.filter((incident) => incident.workerId === worker.id),
      );
      if (!incidentForWorker) {
        legacyBlocked = true;
        const accountId = await allocatedAccountIdForWorker(worker.id);
        if (accountId) blockedAccountIds.add(accountId);
        continue;
      }
      const details = parseDetails(incidentForWorker.details);
      const resumeAt = readResumeAt(details);
      if (!isResumeAtPast(resumeAt, now)) {
        legacyBlocked = true;
        const accountId = readAccountId(details) ?? await allocatedAccountIdForWorker(worker.id);
        if (accountId) blockedAccountIds.add(accountId);
      }
    }
  }

  const quotaIncidents = await db.select({
    incident: recoveryIncidents,
    worker: workers,
  })
    .from(recoveryIncidents)
    .innerJoin(workers, eq(recoveryIncidents.workerId, workers.id))
    .where(and(
      eq(workers.type, type),
      eq(recoveryIncidents.kind, "quota_exhausted"),
      inArray(recoveryIncidents.status, [...OPEN_QUOTA_INCIDENT_STATUSES]),
    ));

  for (const row of quotaIncidents) {
    const details = parseDetails(row.incident.details);
    const resumeAt = readResumeAt(details);
    if (!isResumeAtPast(resumeAt, now)) {
      legacyBlocked = true;
      const accountId = readAccountId(details) ?? await allocatedAccountIdForWorker(row.worker.id);
      if (accountId) blockedAccountIds.add(accountId);
    }
  }

  return shouldBlockTypeForAccounts(usableAccountIds, blockedAccountIds, legacyBlocked);
}

/**
 * Returns a Map of worker types currently blocked by quota, keyed by type.
 * Value carries the human-readable reason and the earliest `resumeAt` from
 * the open quota incidents for that type.
 *
 * Types whose blocks have all expired (resumeAt in the past) are omitted.
 */
export async function quotaBlockedTypes(
  allowedTypes: readonly SupportedWorkerType[],
  options: { now?: Date } = {},
): Promise<Map<SupportedWorkerType, QuotaBlockReason>> {
  const now = options.now ?? new Date();
  const result = new Map<SupportedWorkerType, QuotaBlockReason>();
  const normalizedAllowed = Array.from(new Set(
    allowedTypes
      .map((t) => normalizeWorkerType(t) as SupportedWorkerType)
      .filter((t) => SUPPORTED_WORKER_TYPES.includes(t)),
  ));

  if (normalizedAllowed.length === 0) {
    return result;
  }

  const credExhaustedRows = await db.select()
    .from(workers)
    .where(and(
      inArray(workers.type, normalizedAllowed),
      eq(workers.status, "cred-exhausted"),
    ));

  const credWorkerIds = credExhaustedRows.map((row) => row.id);
  const credIncidents = credWorkerIds.length > 0
    ? await db.select()
        .from(recoveryIncidents)
        .where(and(
          eq(recoveryIncidents.kind, "quota_exhausted"),
          inArray(recoveryIncidents.workerId, credWorkerIds),
        ))
    : [];
  const accountAwareCandidates = new Map<SupportedWorkerType, {
    usableAccountIds: Set<string>;
    blockedAccountIds: Set<string>;
    reason: string;
    resumeAt: Date | null;
  }>();

  async function addBlockedCandidate(workerType: SupportedWorkerType, accountId: string | null, candidate: QuotaBlockReason) {
    const usableAccountIds = await usableAccountIdsForType(workerType);
    if (usableAccountIds.size === 0) {
      const existing = result.get(workerType);
      if (!existing || (candidate.resumeAt && (!existing.resumeAt || candidate.resumeAt < existing.resumeAt))) {
        result.set(workerType, candidate);
      }
      return;
    }

    const current = accountAwareCandidates.get(workerType) ?? {
      usableAccountIds,
      blockedAccountIds: new Set<string>(),
      reason: candidate.reason,
      resumeAt: candidate.resumeAt,
    };
    if (accountId) current.blockedAccountIds.add(accountId);
    if (candidate.resumeAt && (!current.resumeAt || candidate.resumeAt < current.resumeAt)) {
      current.resumeAt = candidate.resumeAt;
      current.reason = candidate.reason;
    }
    accountAwareCandidates.set(workerType, current);
  }

  for (const worker of credExhaustedRows) {
    const incidentForWorker = newestRecoveryIncident(
      credIncidents.filter((incident) => incident.workerId === worker.id),
    );
    const details = parseDetails(incidentForWorker?.details);
    const resumeAt = readResumeAt(details);
    if (isResumeAtPast(resumeAt, now)) {
      continue;
    }
    const accountId = readAccountId(details) ?? await allocatedAccountIdForWorker(worker.id);
    const workerType = worker.type as SupportedWorkerType;
    await addBlockedCandidate(workerType, accountId, {
      reason: "cred-exhausted",
      resumeAt,
    });
  }

  const incidentRows = await db.select({
    incident: recoveryIncidents,
    worker: workers,
  })
    .from(recoveryIncidents)
    .innerJoin(workers, eq(recoveryIncidents.workerId, workers.id))
    .where(and(
      inArray(workers.type, normalizedAllowed),
      eq(recoveryIncidents.kind, "quota_exhausted"),
      inArray(recoveryIncidents.status, [...OPEN_QUOTA_INCIDENT_STATUSES]),
    ));

  for (const row of incidentRows) {
    const details = parseDetails(row.incident.details);
    const resumeAt = readResumeAt(details);
    if (isResumeAtPast(resumeAt, now)) continue;
    const accountId = readAccountId(details) ?? await allocatedAccountIdForWorker(row.worker.id);
    const workerType = row.worker.type as SupportedWorkerType;
    await addBlockedCandidate(workerType, accountId, {
      reason: "active quota incident",
      resumeAt,
    });
  }

  for (const [workerType, candidate] of accountAwareCandidates) {
    if (shouldBlockTypeForAccounts(candidate.usableAccountIds, candidate.blockedAccountIds, true)) {
      result.set(workerType, {
        reason: candidate.reason,
        resumeAt: candidate.resumeAt,
      });
    }
  }

  return result;
}

/**
 * Close any open `quota_exhausted` incidents for a run whose stored
 * `details.resumeAt` is in the past, and flip any `cred-exhausted`
 * worker rows on the same run to `stopped`. Called from the durable
 * quota-wake handler regardless of `runs.status`, so failover-success
 * runs (which never parked) still have their stale rows cleaned up.
 */
export async function clearResolvedQuotaIncidents(runId: string, options: { now?: Date } = {}) {
  const now = options.now ?? new Date();
  const incidents = await db.select()
    .from(recoveryIncidents)
    .where(and(
      eq(recoveryIncidents.runId, runId),
      eq(recoveryIncidents.kind, "quota_exhausted"),
      inArray(recoveryIncidents.status, [...OPEN_QUOTA_INCIDENT_STATUSES]),
    ));

  let resolvedCount = 0;
  for (const incident of incidents) {
    const details = parseDetails(incident.details);
    const resumeAt = readResumeAt(details);
    if (!isResumeAtPast(resumeAt, now)) continue;
    await markRecoveryIncidentResolved({
      incidentId: incident.id,
      runId,
      workerId: incident.workerId ?? null,
      summary: "Quota reset window elapsed; incident auto-resolved.",
      details: {
        ...details,
        recoveryState: "quota_resolved",
        recommendedAction: "none",
        autoResolvedAt: now.toISOString(),
      },
    });
    resolvedCount += 1;
  }

  if (resolvedCount > 0) {
    const credRows = await db.select()
      .from(workers)
      .where(and(
        eq(workers.runId, runId),
        eq(workers.status, "cred-exhausted"),
      ));
    for (const row of credRows) {
      await db.update(workers).set({
        status: "stopped",
        updatedAt: now,
      }).where(eq(workers.id, row.id));
    }
  }

  return { resolvedCount };
}
