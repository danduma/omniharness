import { randomUUID } from "crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { executionEvents, recoveryIncidents } from "@/server/db/schema";

export type RecoveryIncidentKind = "worker_lost" | "session_missing" | "queue_blocked" | "stale_running";
export type RecoveryIncidentStatus = "open" | "recovering" | "resolved" | "needs_user" | "failed";

const OPEN_INCIDENT_STATUSES: RecoveryIncidentStatus[] = ["open", "recovering", "needs_user"];

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
  await db.insert(executionEvents).values({
    id: randomUUID(),
    runId,
    workerId: workerId ?? null,
    planItemId: null,
    eventType,
    details: JSON.stringify(details),
    createdAt: new Date(),
  });
}

async function findOpenIncident(args: {
  runId: string;
  workerId?: string | null;
  queuedMessageId?: string | null;
  kind: RecoveryIncidentKind;
}) {
  const records = await db
    .select()
    .from(recoveryIncidents)
    .where(and(
      eq(recoveryIncidents.runId, args.runId),
      eq(recoveryIncidents.kind, args.kind),
      inArray(recoveryIncidents.status, OPEN_INCIDENT_STATUSES),
    ));

  return records.find((record) => (
    (record.workerId ?? null) === (args.workerId ?? null)
    && (record.queuedMessageId ?? null) === (args.queuedMessageId ?? null)
  )) ?? null;
}

export async function openRecoveryIncident(args: {
  runId: string;
  workerId?: string | null;
  queuedMessageId?: string | null;
  kind: RecoveryIncidentKind;
  details?: Record<string, unknown>;
  lastError?: string | null;
}) {
  const existing = await findOpenIncident(args);
  const now = new Date();
  if (existing) {
    const details = { ...parseDetails(existing.details), ...(args.details ?? {}) };
    await db.update(recoveryIncidents).set({
      details: serializeDetails(details),
      lastError: args.lastError ?? existing.lastError,
      updatedAt: now,
    }).where(eq(recoveryIncidents.id, existing.id));
    return { ...existing, details: serializeDetails(details), updatedAt: now };
  }

  const record = {
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

  await db.insert(recoveryIncidents).values(record);
  await insertRecoveryEvent(args.runId, args.workerId, "recovery_incident_opened", {
    summary: `Opened ${args.kind} recovery incident.`,
    incidentId: record.id,
    kind: args.kind,
    queuedMessageId: args.queuedMessageId ?? null,
    ...(args.details ?? {}),
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
}

export async function markRecoveryIncidentNeedsUser(args: {
  incidentId: string;
  runId: string;
  workerId?: string | null;
  reason: string;
  details?: Record<string, unknown>;
}) {
  const now = new Date();
  await db.update(recoveryIncidents).set({
    status: "needs_user",
    lastError: args.reason,
    details: serializeDetails(args.details),
    updatedAt: now,
  }).where(eq(recoveryIncidents.id, args.incidentId));
  await insertRecoveryEvent(args.runId, args.workerId, "recovery_needs_user", {
    summary: args.reason,
    incidentId: args.incidentId,
    ...(args.details ?? {}),
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
}

export async function listRecoveryIncidentsForRun(runId: string) {
  return db.select().from(recoveryIncidents).where(eq(recoveryIncidents.runId, runId));
}
