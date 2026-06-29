/**
 * SQLite metadata layer for append-only artifact streams.
 *
 * Each `(run_id, kind, owner_id)` stream has exactly one `artifact_streams`
 * row that tracks its on-disk location and append cursor. This module
 * handles ensuring that row exists, allocating monotonic seqs, and
 * updating the cursor after a successful append. It does NOT touch the
 * filesystem — that's `append-only-store.ts`.
 */
import { randomUUID, createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { withSqliteBusyRetry } from "@/server/db/retry";
import { artifactStreams, runs } from "@/server/db/schema";
import {
  ARTIFACT_STREAM_OWNER_NONE,
  normalizeArtifactOwnerId,
  type ArtifactStreamId,
  type ArtifactStreamKind,
} from "./stream-types";
import {
  resolveArtifactStreamLocation,
  type ArtifactStreamLocation,
} from "./append-only-store";

// In-process latest-seq cursor, keyed by the same identity SQLite uses.
// Populated lazily on first use from `artifact_streams.latest_seq`, then
// kept current by every successful append in this process. Writes to
// artifact streams live in the web process (see inventory), so this
// cache cannot diverge from disk under normal operation.
const latestSeqByStreamRow = new Map<string, number>();

function streamRowKey(streamId: ArtifactStreamId) {
  const ownerKey = normalizeArtifactOwnerId(streamId.ownerId);
  return `${streamId.runId}::${streamId.kind}::${ownerKey}`;
}

export function __resetArtifactStreamCachesForTests() {
  latestSeqByStreamRow.clear();
}

/**
 * Ensure an `artifact_streams` row exists for the given identity and
 * return its current metadata. Creates the row on first use using the
 * resolved file location.
 */
export async function ensureArtifactStreamRow(
  args: {
    runId: string;
    kind: ArtifactStreamKind;
    ownerId: string | null;
  },
): Promise<{
  rowId: string;
  location: ArtifactStreamLocation;
  latestSeq: number;
  latestRecordId: string | null;
}> {
  const ownerKey = normalizeArtifactOwnerId(args.ownerId);

  // Look up the run's projectPath; it pins where artifacts live.
  const run = await db
    .select({ id: runs.id, projectPath: runs.projectPath })
    .from(runs)
    .where(eq(runs.id, args.runId))
    .get();
  if (!run) {
    throw new Error(`Cannot resolve artifact stream for missing run ${args.runId}.`);
  }

  const location = await resolveArtifactStreamLocation(
    {
      runId: args.runId,
      kind: args.kind,
      ownerId: args.ownerId,
      projectPath: run.projectPath ?? null,
    },
    "write",
  );

  const existing = await db
    .select()
    .from(artifactStreams)
    .where(
      and(
        eq(artifactStreams.runId, args.runId),
        eq(artifactStreams.kind, args.kind),
        eq(artifactStreams.ownerId, ownerKey),
      ),
    )
    .get();

  if (existing) {
    return {
      rowId: existing.id,
      location,
      latestSeq: existing.latestSeq,
      latestRecordId: existing.latestRecordId,
    };
  }

  const now = new Date();
  const rowId = randomUUID();
  await db.insert(artifactStreams).values({
    id: rowId,
    runId: args.runId,
    projectPath: location.root.projectPath,
    kind: args.kind,
    ownerId: ownerKey,
    relativePath: location.relativeStreamPath,
    latestSeq: 0,
    latestRecordId: null,
    status: "active",
    createdAt: now,
    updatedAt: now,
  });
  return { rowId, location, latestSeq: 0, latestRecordId: null };
}

/**
 * Compute the next monotonic seq for this stream. Falls back to a
 * SQLite read on cold start; subsequent calls use the in-process
 * cursor. Caller must invoke `commitArtifactAppend` after a successful
 * bytes append so the cursor stays in sync.
 */
export async function reserveNextArtifactSeq(streamId: ArtifactStreamId): Promise<number> {
  const cacheKey = streamRowKey(streamId);
  const cached = latestSeqByStreamRow.get(cacheKey);
  if (cached !== undefined) {
    return cached + 1;
  }
  const row = await db
    .select({ latestSeq: artifactStreams.latestSeq })
    .from(artifactStreams)
    .where(
      and(
        eq(artifactStreams.runId, streamId.runId),
        eq(artifactStreams.kind, streamId.kind),
        eq(artifactStreams.ownerId, normalizeArtifactOwnerId(streamId.ownerId)),
      ),
    )
    .get();
  const seq = row?.latestSeq ?? 0;
  latestSeqByStreamRow.set(cacheKey, seq);
  return seq + 1;
}

/**
 * Atomically record that an append succeeded: bump the cursor,
 * remember the record id, and update `updated_at`. Idempotent — if
 * called with a seq lower than what's already persisted, leaves the
 * cursor alone (defensive against retry).
 */
export async function commitArtifactAppend(args: {
  streamId: ArtifactStreamId;
  seq: number;
  recordId: string;
}): Promise<void> {
  const cacheKey = streamRowKey(args.streamId);
  const cached = latestSeqByStreamRow.get(cacheKey) ?? 0;
  if (args.seq <= cached) {
    return;
  }
  const now = new Date();
  await withSqliteBusyRetry(() => db
    .update(artifactStreams)
    .set({
      latestSeq: args.seq,
      latestRecordId: args.recordId,
      updatedAt: now,
    })
    .where(
      and(
        eq(artifactStreams.runId, args.streamId.runId),
        eq(artifactStreams.kind, args.streamId.kind),
        eq(artifactStreams.ownerId, normalizeArtifactOwnerId(args.streamId.ownerId)),
      ),
    ));
  latestSeqByStreamRow.set(cacheKey, args.seq);
}

export async function readArtifactStreamMetadata(streamId: ArtifactStreamId) {
  const row = await db
    .select()
    .from(artifactStreams)
    .where(
      and(
        eq(artifactStreams.runId, streamId.runId),
        eq(artifactStreams.kind, streamId.kind),
        eq(artifactStreams.ownerId, normalizeArtifactOwnerId(streamId.ownerId)),
      ),
    )
    .get();
  return row ?? null;
}

export async function recordStreamCompaction(streamId: ArtifactStreamId, ok: boolean, lastError?: string): Promise<void> {
  const now = new Date();
  await db
    .update(artifactStreams)
    .set({
      compactedAt: ok ? now : undefined,
      lastError: ok ? null : (lastError ?? "compaction failed"),
      updatedAt: now,
    })
    .where(
      and(
        eq(artifactStreams.runId, streamId.runId),
        eq(artifactStreams.kind, streamId.kind),
        eq(artifactStreams.ownerId, normalizeArtifactOwnerId(streamId.ownerId)),
      ),
    );
}

// --- Hash + preview helpers ----------------------------------------

/**
 * Stable canonical hash of a payload, used for `*_hash` columns. Stable
 * across reorderings of JSON object keys.
 */
export function hashArtifactPayload(payload: unknown): string {
  const canonical = canonicalJsonString(payload);
  return createHash("sha256").update(canonical).digest("hex");
}

function canonicalJsonString(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalJsonString(v)).join(",")}]`;
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJsonString((value as Record<string, unknown>)[k])}`).join(",")}}`;
}

const DEFAULT_PREVIEW_LIMIT = 256;

/**
 * Build a short text preview suitable for inlining in hot snapshot
 * lists. Strings get a head+tail truncation; objects get a JSON
 * stringification with the same treatment.
 */
export function buildArtifactPreview(value: unknown, limit = DEFAULT_PREVIEW_LIMIT): string {
  const raw = typeof value === "string" ? value : JSON.stringify(value ?? "");
  if (!raw) return "";
  if (raw.length <= limit) return raw;
  const headLength = Math.floor(limit * 0.6);
  const tailLength = limit - headLength - 6;
  return `${raw.slice(0, headLength)} … ${raw.slice(-tailLength)}`;
}

export { ARTIFACT_STREAM_OWNER_NONE };
