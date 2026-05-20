/**
 * Shared types for the append-only artifact storage layer.
 *
 * The artifact store is byte-level: it knows about JSONL lines and
 * gzipped JSONL, file locks, and append cursors. Domain semantics
 * (entry dedup, history truncation, legacy DB fallback, etc.) live in
 * per-domain adapters.
 */

export type ArtifactStreamKind =
  | "worker_entries"
  | "execution_events"
  | "supervisor_interventions"
  | "planning_review_findings";

/**
 * The envelope every non-worker artifact record uses on disk. The
 * worker stream pre-dates this contract and uses its own shape — the
 * worker adapter maps between them.
 */
export interface ArtifactRecordEnvelope<TPayload = unknown> {
  /** Stable domain id (e.g. an execution_events.id). */
  id: string;
  /** Monotonically-increasing append cursor. */
  seq: number;
  /** Run that owns the stream. */
  runId: string;
  kind: ArtifactStreamKind;
  /** ISO timestamp the record was created. */
  createdAt: string;
  /** Domain payload (full body, large details, etc.). */
  payload: TPayload;
}

/**
 * Stream identity. `ownerId` is `null` for run-level streams (one stream
 * per run) and the worker id for per-worker streams.
 */
export interface ArtifactStreamId {
  runId: string;
  kind: ArtifactStreamKind;
  ownerId: string | null;
}

/**
 * Normalized SQLite-safe owner key. SQLite UNIQUE treats NULLs as
 * distinct, so the schema uses this sentinel to make
 * `(run_id, kind, normalized_owner_id)` enforce one row per stream.
 */
export const ARTIFACT_STREAM_OWNER_NONE = "__none__";

export function normalizeArtifactOwnerId(ownerId: string | null): string {
  return ownerId?.trim() ? ownerId.trim() : ARTIFACT_STREAM_OWNER_NONE;
}
