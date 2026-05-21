/**
 * Compaction sweep for non-worker artifact streams.
 *
 * Run-level streams (execution_events / supervisor_interventions /
 * planning_review_findings) gzip to `<stream>.jsonl.gz` once the
 * owning run is in a terminal state AND the file hasn't been touched
 * for `minAgeMs`. The shared bytes layer in `append-only-store.ts`
 * already handles the chain+lock and atomic rename — this module just
 * picks candidates and calls into it.
 *
 * Worker streams keep their own sweep in `output-store.ts` until the
 * worker output-store relocation lands; the two will share this code
 * after that.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { artifactStreams, runs } from "@/server/db/schema";
import {
  compactArtifactStream,
  resolveArtifactStreamLocation,
} from "./append-only-store";
import { recordStreamCompaction } from "./stream-metadata";
import { resolveArtifactRoot } from "./project-root";
import {
  normalizeArtifactOwnerId,
  type ArtifactStreamKind,
} from "./stream-types";
import { isTerminalRunStatus } from "@/lib/run-status";
import { emitNamedEvent } from "@/server/events/named-events";

const DEFAULT_MIN_AGE_MS = 5 * 60 * 1000;

export async function compactStaleArtifactStreams(options: {
  minAgeMs?: number;
  now?: number;
  kinds?: ArtifactStreamKind[];
} = {}): Promise<{
  compacted: Array<{ runId: string; kind: ArtifactStreamKind; ownerId: string }>;
  errors: Array<{ runId: string; kind: ArtifactStreamKind; error: string }>;
}> {
  const minAgeMs = options.minAgeMs ?? DEFAULT_MIN_AGE_MS;
  const now = options.now ?? Date.now();
  const kinds: ArtifactStreamKind[] = options.kinds ?? [
    "execution_events",
    "supervisor_interventions",
    "planning_review_findings",
  ];

  const candidates = await db
    .select()
    .from(artifactStreams)
    .where(inArray(artifactStreams.kind, kinds));
  if (candidates.length === 0) return { compacted: [], errors: [] };

  const runIds: string[] = Array.from(new Set(candidates.map((c) => c.runId)));
  if (runIds.length === 0) return { compacted: [], errors: [] };
  const runRows = await db
    .select({ id: runs.id, status: runs.status, projectPath: runs.projectPath })
    .from(runs)
    .where(inArray(runs.id, runIds));
  type RunRow = { id: string; status: string; projectPath: string | null };
  const runById = new Map<string, RunRow>(runRows.map((r) => [r.id, r as RunRow] as const));

  const compacted: Array<{ runId: string; kind: ArtifactStreamKind; ownerId: string }> = [];
  const errors: Array<{ runId: string; kind: ArtifactStreamKind; error: string }> = [];

  for (const row of candidates) {
    const run = runById.get(row.runId);
    if (!run) continue;
    if (!isTerminalRunStatus(run.status)) continue;
    try {
      // Stat the plaintext to make sure it exists and is old enough.
      const root = await resolveArtifactRoot({ runId: row.runId, projectPath: run.projectPath ?? null }, "read");
      const filePath = path.join(root.absolutePath, row.relativePath);
      let stat;
      try {
        stat = await fs.stat(filePath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
        throw error;
      }
      if (now - stat.mtimeMs < minAgeMs) continue;

      const location = await resolveArtifactStreamLocation(
        {
          runId: row.runId,
          kind: row.kind as ArtifactStreamKind,
          ownerId: row.ownerId === "__none__" ? null : row.ownerId,
          projectPath: run.projectPath ?? null,
        },
        "read",
      );
      const ok = await compactArtifactStream(location);
      await recordStreamCompaction(
        {
          runId: row.runId,
          kind: row.kind as ArtifactStreamKind,
          ownerId: row.ownerId === "__none__" ? null : row.ownerId,
        },
        ok,
        ok ? undefined : "compactArtifactStream returned false",
      );
      if (ok) {
        compacted.push({
          runId: row.runId,
          kind: row.kind as ArtifactStreamKind,
          ownerId: normalizeArtifactOwnerId(row.ownerId === "__none__" ? null : row.ownerId),
        });
        emitNamedEvent({
          kind: "artifact.compaction_completed",
          runId: row.runId,
          streamKind: row.kind as ArtifactStreamKind,
          ownerId: row.ownerId === "__none__" ? null : row.ownerId,
        });
      } else {
        emitNamedEvent({
          kind: "artifact.compaction_failed",
          runId: row.runId,
          streamKind: row.kind as ArtifactStreamKind,
          ownerId: row.ownerId === "__none__" ? null : row.ownerId,
          reason: "compactArtifactStream returned false",
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ runId: row.runId, kind: row.kind as ArtifactStreamKind, error: message });
      await recordStreamCompaction(
        {
          runId: row.runId,
          kind: row.kind as ArtifactStreamKind,
          ownerId: row.ownerId === "__none__" ? null : row.ownerId,
        },
        false,
        message,
      );
      emitNamedEvent({
        kind: "artifact.compaction_failed",
        runId: row.runId,
        streamKind: row.kind as ArtifactStreamKind,
        ownerId: row.ownerId === "__none__" ? null : row.ownerId,
        reason: message,
      });
    }
  }
  return { compacted, errors };
}
