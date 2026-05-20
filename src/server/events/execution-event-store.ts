/**
 * Execution event artifact adapter.
 *
 * Replaces direct `db.insert(executionEvents).values({...})` writes.
 *
 * Write flow (artifact-first, then SQLite row):
 *   1. Resolve / create the run's `execution_events` artifact stream row.
 *   2. Reserve the next seq and append the JSON envelope to the JSONL.
 *   3. INSERT the `execution_events` row with `artifact_seq` set,
 *      `details=NULL`, `details_hash` and a short `details_preview`.
 *   4. Commit the cursor in `artifact_streams`.
 *
 * If step 2 fails: nothing is written, caller surfaces the error.
 * If step 3 fails: the artifact record is orphaned and gets cleaned by
 *   the repair scan. We do NOT silently fall back to a legacy write —
 *   silent fallbacks make migrations untestable.
 *
 * Read flow:
 *   - Rows with `artifact_seq IS NOT NULL` resolve `details` from the
 *     artifact stream on demand (legacy `details` column ignored).
 *   - Rows with `artifact_seq IS NULL` keep using the legacy `details`
 *     column. This is the only supported fallback path.
 */
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { executionEvents } from "@/server/db/schema";
import { appendArtifactLine } from "@/server/artifacts/append-only-store";
import {
  buildArtifactPreview,
  commitArtifactAppend,
  ensureArtifactStreamRow,
  hashArtifactPayload,
  readArtifactStreamMetadata,
  reserveNextArtifactSeq,
} from "@/server/artifacts/stream-metadata";
import { readAllArtifactEntries } from "@/server/artifacts/append-only-store";
import type { ArtifactRecordEnvelope } from "@/server/artifacts/stream-types";

export interface RecordExecutionEventInput {
  runId: string;
  workerId?: string | null;
  planItemId?: string | null;
  eventType: string;
  /**
   * Domain-specific payload. Stored as the artifact record's `payload`
   * and (truncated) in `details_preview` for hot snapshots.
   *
   * Pre-existing call sites passed a serialized JSON string as
   * `details`. The adapter accepts either: a string is wrapped as
   * `{ legacy: string }` so canonical hashing/preview still works.
   */
  details?: unknown;
  /** Optional explicit id (otherwise generated). */
  id?: string;
  /** Optional createdAt override (otherwise now). */
  createdAt?: Date;
}

export interface ExecutionEventRecord {
  id: string;
  runId: string;
  workerId: string | null;
  planItemId: string | null;
  eventType: string;
  details: string | null;
  detailsHash: string | null;
  detailsPreview: string | null;
  artifactSeq: number | null;
  createdAt: Date;
}

function normalizePayload(input: unknown): unknown {
  if (input === undefined) return null;
  if (typeof input === "string") {
    // Try to parse a JSON string back into structured form so
    // downstream hashing/preview is stable across writers.
    try {
      return JSON.parse(input);
    } catch {
      return input;
    }
  }
  return input;
}

/**
 * Write an execution event. Returns the persisted record id and seq.
 */
export async function recordExecutionEvent(input: RecordExecutionEventInput): Promise<{ id: string; artifactSeq: number }> {
  const id = input.id ?? randomUUID();
  const createdAt = input.createdAt ?? new Date();
  const payload = normalizePayload(input.details);
  const detailsHash = payload === null ? null : hashArtifactPayload(payload);
  const detailsPreview = payload === null ? null : buildArtifactPreview(payload);

  const { location } = await ensureArtifactStreamRow({
    runId: input.runId,
    kind: "execution_events",
    ownerId: null,
  });
  const seq = await reserveNextArtifactSeq({
    runId: input.runId,
    kind: "execution_events",
    ownerId: null,
  });

  const envelope: ArtifactRecordEnvelope = {
    id,
    seq,
    runId: input.runId,
    kind: "execution_events",
    createdAt: createdAt.toISOString(),
    payload,
  };
  await appendArtifactLine(location, JSON.stringify(envelope));

  // Dual-write `details` for the migration window: artifact stream is
  // the new source of truth (artifact_seq + the JSONL payload) but the
  // legacy `details` column stays populated so any reader that hasn't
  // moved to the adapter yet still gets full bodies. Once every reader
  // is migrated, switch this back to `details: null` and the artifact
  // becomes the only durable copy.
  await db.insert(executionEvents).values({
    id,
    runId: input.runId,
    workerId: input.workerId ?? null,
    planItemId: input.planItemId ?? null,
    eventType: input.eventType,
    details: payload === null ? null : typeof payload === "string" ? payload : JSON.stringify(payload),
    artifactSeq: seq,
    detailsHash,
    detailsPreview,
    createdAt,
  });

  await commitArtifactAppend({
    streamId: { runId: input.runId, kind: "execution_events", ownerId: null },
    seq,
    recordId: id,
  });
  return { id, artifactSeq: seq };
}

// --- Read paths ----------------------------------------------------

interface ExecutionEventRow {
  id: string;
  runId: string;
  workerId: string | null;
  planItemId: string | null;
  eventType: string;
  details: string | null;
  detailsHash: string | null;
  detailsPreview: string | null;
  artifactSeq: number | null;
  createdAt: Date;
}

/**
 * Hot-path snapshot list: returns up to `limit` most-recent events for
 * a run, with the SHORT preview only (no artifact body read). Use this
 * for diagnostics or list views that don't need full bodies.
 */
export async function listExecutionEventSummariesForSnapshot(
  runId: string,
  limit: number,
): Promise<ExecutionEventRow[]> {
  return db
    .select()
    .from(executionEvents)
    .where(eq(executionEvents.runId, runId))
    .orderBy(desc(executionEvents.createdAt), desc(executionEvents.id))
    .limit(limit);
}

/**
 * Selected-run snapshot read used by `/api/events?snapshot=1`. Returns
 * up to `limit` most-recent events with full `details` hydrated from
 * the artifact stream. One forward stream read per snapshot — the
 * `readEntriesByKey`-style cache in the bytes layer keeps repeat polls
 * cheap when the file hasn't moved.
 */
export async function listExecutionEventsForSnapshot(
  runId: string,
  limit: number,
): Promise<ExecutionEventRow[]> {
  const rows = await db
    .select()
    .from(executionEvents)
    .where(eq(executionEvents.runId, runId))
    .orderBy(desc(executionEvents.createdAt), desc(executionEvents.id))
    .limit(limit);
  return hydrateExecutionEventDetails(rows);
}

/**
 * Full-body read: returns all events for a run with `details` resolved
 * (artifact payload re-serialized as a JSON string for callers that
 * still expect the column shape). Used by readers that need the
 * complete history (CLI runner, etc.).
 */
export async function listExecutionEventsForRun(runId: string): Promise<ExecutionEventRow[]> {
  const rows = await db
    .select()
    .from(executionEvents)
    .where(eq(executionEvents.runId, runId))
    .orderBy(asc(executionEvents.createdAt), asc(executionEvents.id));
  return hydrateExecutionEventDetails(rows);
}

/**
 * Backward-compatible reader that returns events filtered by worker.
 * Used by handoff/request and similar surfaces.
 */
export async function listExecutionEventsForWorker(
  workerId: string,
  limit?: number,
): Promise<ExecutionEventRow[]> {
  const query = db
    .select()
    .from(executionEvents)
    .where(eq(executionEvents.workerId, workerId))
    .orderBy(desc(executionEvents.createdAt), desc(executionEvents.id));
  const rows = limit ? await query.limit(limit) : await query;
  return hydrateExecutionEventDetails(rows);
}

async function hydrateExecutionEventDetails(rows: ExecutionEventRow[]): Promise<ExecutionEventRow[]> {
  if (rows.length === 0) return rows;

  // Group rows that need artifact hydration by runId so we read each
  // stream at most once.
  const needsHydration: Map<string, ExecutionEventRow[]> = new Map();
  for (const row of rows) {
    if (row.artifactSeq != null && row.details === null) {
      const bucket = needsHydration.get(row.runId) ?? [];
      bucket.push(row);
      needsHydration.set(row.runId, bucket);
    }
  }
  if (needsHydration.size === 0) return rows;

  const detailsById = new Map<string, string>();
  for (const [runId, bucket] of needsHydration) {
    const meta = await readArtifactStreamMetadata({
      runId,
      kind: "execution_events",
      ownerId: null,
    });
    if (!meta) {
      // No artifact stream yet — these rows must be backfill-pending.
      // Leave details null; callers can render from preview/hash.
      continue;
    }
    const { resolveArtifactStreamLocation } = await import("@/server/artifacts/append-only-store");
    const location = await resolveArtifactStreamLocation(
      {
        runId,
        kind: "execution_events",
        ownerId: null,
        projectPath: meta.projectPath,
      },
      "read",
    );
    const envelopes = await readAllArtifactEntries<ArtifactRecordEnvelope>(location);
    const byId = new Map(envelopes.map((env) => [env.id, env] as const));
    for (const row of bucket) {
      const env = byId.get(row.id);
      if (env) {
        detailsById.set(row.id, typeof env.payload === "string" ? env.payload : JSON.stringify(env.payload));
      }
    }
  }
  return rows.map((row) => (
    detailsById.has(row.id)
      ? { ...row, details: detailsById.get(row.id) ?? null }
      : row
  ));
}

/**
 * Delete every execution event row for a run. The associated artifact
 * stream files are cleaned by the shared artifact cleanup helper, not
 * here, so this is symmetric with the existing SQL-only delete path.
 */
export async function deleteExecutionEventsForRun(runId: string): Promise<void> {
  await db.delete(executionEvents).where(eq(executionEvents.runId, runId));
}

export async function deleteExecutionEventsForPlanItem(planItemId: string): Promise<void> {
  await db.delete(executionEvents).where(eq(executionEvents.planItemId, planItemId));
}

/**
 * Lookup support: load events by id (used by repair tooling and tests).
 */
export async function findExecutionEventsByIds(ids: string[]): Promise<ExecutionEventRow[]> {
  if (ids.length === 0) return [];
  return db.select().from(executionEvents).where(inArray(executionEvents.id, ids));
}

/**
 * Count of rows still on the legacy `details` column (no artifact_seq).
 * Used by backfill verification.
 */
export async function countLegacyExecutionEvents(): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(executionEvents)
    .where(isNull(executionEvents.artifactSeq));
  return Number(result[0]?.count ?? 0);
}
