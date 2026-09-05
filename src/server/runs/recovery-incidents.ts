import { randomUUID } from "crypto";
import { recordExecutionEvent } from "@/server/events/execution-event-store";
import { and, eq, inArray, lte, or, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { recoveryIncidents, runs } from "@/server/db/schema";
import { withSqliteBusyRetry } from "@/server/db/retry";
import { emitNamedEvent } from "@/server/events/named-events";

export type RecoveryIncidentKind = "worker_lost" | "session_missing" | "queue_blocked" | "stale_running" | "quota_exhausted";
export type RecoveryIncidentStatus = "open" | "recovering" | "resolved" | "needs_user" | "failed";

const OPEN_INCIDENT_STATUSES: RecoveryIncidentStatus[] = ["open", "recovering", "needs_user"];
// `failed` belongs here even though it carries a `resolvedAt` stamp: the recovery
// banner treats it as active, so a gave-up incident is just as visible as an open
// one and needs the same sweep to disappear.
const UNSETTLED_INCIDENT_STATUSES: RecoveryIncidentStatus[] = ["open", "recovering", "needs_user", "failed"];

export function isUnsettledRecoveryIncidentStatus(status: string | null | undefined) {
  return UNSETTLED_INCIDENT_STATUSES.includes((status ?? "") as RecoveryIncidentStatus);
}

function serializeDetails(details: Record<string, unknown> | null | undefined) {
  return details ? JSON.stringify(details) : null;
}

function parseDetails(details: string | null | undefined): Record<string, unknown> {
  if (!details) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(details);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

async function insertRecoveryEvent(
  runId: string,
  workerId: string | null | undefined,
  eventType: string,
  details: Record<string, unknown>,
) {
  await recordExecutionEvent({
    runId,
    workerId: workerId ?? null,
    planItemId: null,
    eventType,
    details,
  });
}

export async function openRecoveryIncident(args: {
  runId: string;
  workerId?: string | null;
  queuedMessageId?: string | null;
  kind: RecoveryIncidentKind;
  details?: Record<string, unknown>;
  lastError?: string | null;
}) {
  // Acquire SQLite's write lock before the read that decides whether to
  // insert. This makes the identity check atomic across concurrent sync,
  // queue, manual-recovery, and even separate runner processes without a
  // schema migration or lossy cleanup of pre-existing incident history.
  const result = await withSqliteBusyRetry(() => db.transaction(async (tx) => {
    await tx.update(runs)
      .set({ updatedAt: sql`${runs.updatedAt}` })
      .where(eq(runs.id, args.runId));

    const records = await tx
      .select()
      .from(recoveryIncidents)
      .where(and(
        eq(recoveryIncidents.runId, args.runId),
        eq(recoveryIncidents.kind, args.kind),
        inArray(recoveryIncidents.status, OPEN_INCIDENT_STATUSES),
      ));
    const existing = records.find((record) => (
      (record.workerId ?? null) === (args.workerId ?? null)
      && (record.queuedMessageId ?? null) === (args.queuedMessageId ?? null)
    )) ?? null;
    const now = new Date();
    if (existing) {
      const details = { ...parseDetails(existing.details), ...(args.details ?? {}) };
      const serializedDetails = serializeDetails(details);
      await tx.update(recoveryIncidents).set({
        details: serializedDetails,
        lastError: args.lastError ?? existing.lastError,
        updatedAt: now,
      }).where(eq(recoveryIncidents.id, existing.id));
      return {
        incident: {
          ...existing,
          details: serializedDetails,
          lastError: args.lastError ?? existing.lastError,
          updatedAt: now,
        },
        opened: false,
      };
    }

    const incident = {
      id: randomUUID(),
      runId: args.runId,
      workerId: args.workerId ?? null,
      queuedMessageId: args.queuedMessageId ?? null,
      kind: args.kind,
      status: "open" as const,
      autoAttemptCount: 0,
      lastError: args.lastError ?? null,
      details: serializeDetails(args.details),
      detectedAt: now,
      updatedAt: now,
      resolvedAt: null,
    };
    await tx.insert(recoveryIncidents).values(incident);
    return { incident, opened: true };
  }));

  const record = result.incident;
  if (!result.opened) {
    return record;
  }
  await insertRecoveryEvent(args.runId, args.workerId, "recovery_incident_opened", {
    summary: `Opened ${args.kind} recovery incident.`,
    incidentId: record.id,
    kind: args.kind,
    queuedMessageId: args.queuedMessageId ?? null,
    ...(args.details ?? {}),
  });
  emitNamedEvent({
    kind: "recovery.opened",
    runId: args.runId,
    incidentId: record.id,
    recoveryKind: args.kind,
  });
  return record;
}

export async function markRecoveryIncidentRecovering(args: {
  incidentId: string;
  runId: string;
  workerId?: string | null;
  decision: string;
  details?: Record<string, unknown>;
}) {
  const now = new Date();
  const incident = await db.select().from(recoveryIncidents).where(eq(recoveryIncidents.id, args.incidentId)).get();
  const nextAttempts = (incident?.autoAttemptCount ?? 0) + 1;
  await db.update(recoveryIncidents).set({
    status: "recovering",
    autoAttemptCount: nextAttempts,
    details: serializeDetails({
      ...parseDetails(incident?.details),
      decision: args.decision,
      ...(args.details ?? {}),
    }),
    updatedAt: now,
  }).where(eq(recoveryIncidents.id, args.incidentId));
  await insertRecoveryEvent(args.runId, args.workerId, "recovery_policy_decision", {
    summary: `Recovery policy chose ${args.decision}.`,
    incidentId: args.incidentId,
    decision: args.decision,
    autoAttemptCount: nextAttempts,
    ...(args.details ?? {}),
  });
  emitNamedEvent({
    kind: "recovery.attempt",
    runId: args.runId,
    incidentId: args.incidentId,
    attempt: nextAttempts,
  });
}

/**
 * Atomically claim a recovery incident before starting an external resume.
 * Multiple wake sources can observe the same open incident; only one may
 * reattach the provider session. A stale recovering claim can be reclaimed
 * after a runner crash, but a live claim is left alone.
 */
export async function claimRecoveryIncident(args: {
  incidentId: string;
  runId: string;
  workerId?: string | null;
  decision: string;
  details?: Record<string, unknown>;
  staleAfterMs?: number;
}) {
  const now = new Date();
  const staleAfterMs = Math.max(0, args.staleAfterMs ?? 60_000);
  const staleBefore = new Date(now.getTime() - staleAfterMs);
  const claimed = await db.update(recoveryIncidents).set({
    status: "recovering",
    autoAttemptCount: sql`${recoveryIncidents.autoAttemptCount} + 1`,
    details: serializeDetails(args.details),
    updatedAt: now,
  }).where(and(
    eq(recoveryIncidents.id, args.incidentId),
    or(
      eq(recoveryIncidents.status, "open"),
      and(
        eq(recoveryIncidents.status, "recovering"),
        lte(recoveryIncidents.updatedAt, staleBefore),
      ),
    ),
  )).returning().get();

  if (!claimed) {
    return null;
  }

  await insertRecoveryEvent(args.runId, args.workerId, "recovery_policy_decision", {
    summary: `Recovery policy chose ${args.decision}.`,
    incidentId: args.incidentId,
    decision: args.decision,
    autoAttemptCount: claimed.autoAttemptCount,
    ...(args.details ?? {}),
  });
  emitNamedEvent({
    kind: "recovery.attempt",
    runId: args.runId,
    incidentId: args.incidentId,
    attempt: claimed.autoAttemptCount,
  });
  return claimed;
}

export async function markRecoveryIncidentResolved(args: {
  incidentId: string;
  runId: string;
  workerId?: string | null;
  summary: string;
  details?: Record<string, unknown>;
}) {
  const now = new Date();
  await db.update(recoveryIncidents).set({
    status: "resolved",
    lastError: null,
    details: serializeDetails(args.details),
    updatedAt: now,
    resolvedAt: now,
  }).where(eq(recoveryIncidents.id, args.incidentId));
  await insertRecoveryEvent(args.runId, args.workerId, "recovery_resolved", {
    summary: args.summary,
    incidentId: args.incidentId,
    ...(args.details ?? {}),
  });
  emitNamedEvent({
    kind: "recovery.resolved",
    runId: args.runId,
    incidentId: args.incidentId,
  });
}

export async function markRecoveryIncidentNeedsUser(args: {
  incidentId: string;
  runId: string;
  workerId?: string | null;
  reason: string;
  details?: Record<string, unknown>;
}) {
  const now = new Date();
  const existing = await db.select().from(recoveryIncidents).where(eq(recoveryIncidents.id, args.incidentId)).get();
  const alreadyNeedsUser = existing?.status === "needs_user";
  await db.update(recoveryIncidents).set({
    status: "needs_user",
    lastError: args.reason,
    details: serializeDetails(args.details),
    updatedAt: now,
    // A resumed session can still fail later — during the continuation turn that
    // follows recovery, for instance. Clear the resolution stamp so a reopened
    // incident does not read as both resolved and blocked on the user.
    resolvedAt: null,
  }).where(eq(recoveryIncidents.id, args.incidentId));
  if (alreadyNeedsUser && existing?.lastError === args.reason) {
    return;
  }
  await insertRecoveryEvent(args.runId, args.workerId, "recovery_needs_user", {
    summary: args.reason,
    incidentId: args.incidentId,
    ...(args.details ?? {}),
  });
  emitNamedEvent({
    kind: "error.surfaced",
    code: "recovery.needs_user",
    message: args.reason,
    surface: "banner",
    runId: args.runId,
    ...(args.workerId ? { workerId: args.workerId } : {}),
  });
}

export async function markRecoveryIncidentFailed(args: {
  incidentId: string;
  runId: string;
  workerId?: string | null;
  reason: string;
  details?: Record<string, unknown>;
}) {
  const now = new Date();
  const existing = await db.select().from(recoveryIncidents).where(eq(recoveryIncidents.id, args.incidentId)).get();
  await db.update(recoveryIncidents).set({
    status: "failed",
    lastError: args.reason,
    details: serializeDetails(args.details),
    updatedAt: now,
    resolvedAt: now,
  }).where(eq(recoveryIncidents.id, args.incidentId));
  await insertRecoveryEvent(args.runId, args.workerId, "recovery_exhausted", {
    summary: args.reason,
    incidentId: args.incidentId,
    ...(args.details ?? {}),
  });
  emitNamedEvent({
    kind: "recovery.gave_up",
    runId: args.runId,
    incidentId: args.incidentId,
    attempts: existing?.autoAttemptCount ?? 0,
  });
  emitNamedEvent({
    kind: "error.surfaced",
    code: "recovery.gave_up",
    message: args.reason,
    surface: "banner",
    runId: args.runId,
    ...(args.workerId ? { workerId: args.workerId } : {}),
  });
}

/**
 * A worker turn that completes normally is proof the run recovered: the session
 * exists, the runtime answers, the credentials work, quota is not exhausted.
 * Nothing used to act on that proof — `markRecoveryIncidentResolved` was only
 * reachable from an automatic recovery attempt, a quota resume, or the user
 * stopping the conversation — so a `needs_user` incident survived the very turn
 * that disproved it and the recovery banner stayed up forever. Anything still
 * genuinely broken is reopened by the next `openRecoveryIncident` call.
 */
export async function resolveRecoveryIncidentsAfterHealthyTurn(args: {
  runId: string;
  workerId?: string | null;
  summary: string;
  reason: string;
}) {
  const records = await db
    .select()
    .from(recoveryIncidents)
    .where(and(
      eq(recoveryIncidents.runId, args.runId),
      inArray(recoveryIncidents.status, UNSETTLED_INCIDENT_STATUSES),
    ));

  // Scope to the worker that just proved itself, plus run-level incidents that
  // name no worker. A healthy worker in a multi-worker implementation run says
  // nothing about a sibling that is still lost.
  const stale = records.filter((record) => (
    !record.workerId || !args.workerId || record.workerId === args.workerId
  ));

  for (const incident of stale) {
    await markRecoveryIncidentResolved({
      incidentId: incident.id,
      runId: args.runId,
      workerId: incident.workerId,
      summary: args.summary,
      details: {
        reason: args.reason,
        resolvedByHealthyTurn: true,
        previousStatus: incident.status,
      },
    });
  }

  return stale.length;
}

/**
 * A worker that has *begun a new working period* since an incident was recorded
 * has disproved it just as conclusively as a completed turn: the session
 * exists, the runtime answers, the credentials work, quota is not exhausted.
 *
 * `resolveRecoveryIncidentsAfterHealthyTurn` only fires when a turn *finishes*,
 * which is too late whenever the code that opens an incident then awaits a full
 * turn before clearing it — a quota resume awaiting its own resume prompt, a
 * turn that parks on an elicitation and never returns. The banner then outlives
 * the condition by the length of the turn, or forever. This sweep closes that
 * gap at the moment work restarts, without waiting for it to end.
 *
 * The `since` fence is the worker's `active_work_started_at` (maintained by the
 * workers work-timer triggers). Only incidents recorded *before* the current
 * working period are cleared, so anything opened during this turn survives and
 * the sweep cannot flap against a genuinely broken worker. Anything still
 * broken is reopened by the next `openRecoveryIncident` call.
 */
export async function resolveRecoveryIncidentsDisprovedByActiveWork(args: {
  runId: string;
  workerId: string;
  since: Date;
}) {
  const records = await db
    .select()
    .from(recoveryIncidents)
    .where(and(
      eq(recoveryIncidents.runId, args.runId),
      inArray(recoveryIncidents.status, UNSETTLED_INCIDENT_STATUSES),
    ));

  const stale = records.filter((record) => (
    (!record.workerId || record.workerId === args.workerId)
    && record.detectedAt.getTime() < args.since.getTime()
  ));

  for (const incident of stale) {
    await markRecoveryIncidentResolved({
      incidentId: incident.id,
      runId: args.runId,
      workerId: incident.workerId,
      summary: `Worker ${args.workerId} started working again; clearing stale recovery state.`,
      details: {
        reason: "worker_resumed_active_work",
        resolvedByActiveWork: true,
        previousStatus: incident.status,
        activeWorkStartedAt: args.since.toISOString(),
      },
    });
  }

  return stale.length;
}

export async function listRecoveryIncidentsForRun(runId: string) {
  return db.select().from(recoveryIncidents).where(eq(recoveryIncidents.runId, runId));
}
