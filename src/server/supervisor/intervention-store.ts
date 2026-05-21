/**
 * Supervisor-intervention artifact adapter.
 *
 * Replaces direct `db.insert(supervisorInterventions).values({...})`
 * writes. Large prompt/summary bodies live in the per-run
 * `supervisor-interventions.jsonl` artifact stream; SQLite keeps id +
 * intervention_type + run_id + worker_id + created_at + artifact_seq
 * + prompt_hash + summary_preview.
 *
 * Dual-writes `prompt` and `summary` during the migration window so
 * unmigrated readers still get full bodies. Once every reader is on
 * the adapter, switch those back to null and the artifact stream is
 * the only durable copy.
 */
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { supervisorInterventions } from "@/server/db/schema";
import { emitNamedEvent } from "@/server/events/named-events";
import {
  appendArtifactLine,
  readAllArtifactEntries,
  resolveArtifactStreamLocation,
} from "@/server/artifacts/append-only-store";
import {
  buildArtifactPreview,
  commitArtifactAppend,
  ensureArtifactStreamRow,
  hashArtifactPayload,
  readArtifactStreamMetadata,
  reserveNextArtifactSeq,
} from "@/server/artifacts/stream-metadata";
import type { ArtifactRecordEnvelope } from "@/server/artifacts/stream-types";

export interface SupervisorInterventionInput {
  runId: string;
  workerId: string;
  prompt: string;
  summary?: string | null;
  interventionType: string;
  id?: string;
  createdAt?: Date;
}

export interface SupervisorInterventionRow {
  id: string;
  runId: string;
  workerId: string | null;
  interventionType: string;
  prompt: string | null;
  summary: string | null;
  artifactSeq: number | null;
  promptHash: string | null;
  summaryPreview: string | null;
  createdAt: Date;
}

interface InterventionPayload {
  prompt: string;
  summary: string | null;
}

export async function recordSupervisorInterventionArtifact(
  input: SupervisorInterventionInput,
): Promise<{ id: string; artifactSeq: number }> {
  const id = input.id ?? randomUUID();
  const createdAt = input.createdAt ?? new Date();
  const summary = input.summary?.trim() || null;
  const payload: InterventionPayload = { prompt: input.prompt, summary };
  const promptHash = hashArtifactPayload(input.prompt);
  const summaryPreview = summary ? buildArtifactPreview(summary) : null;

  const { location } = await ensureArtifactStreamRow({
    runId: input.runId,
    kind: "supervisor_interventions",
    ownerId: null,
  });
  const seq = await reserveNextArtifactSeq({
    runId: input.runId,
    kind: "supervisor_interventions",
    ownerId: null,
  });

  const envelope: ArtifactRecordEnvelope<InterventionPayload> = {
    id,
    seq,
    runId: input.runId,
    kind: "supervisor_interventions",
    createdAt: createdAt.toISOString(),
    payload,
  };
  try {
    await appendArtifactLine(location, JSON.stringify(envelope), { seq });
  } catch (error) {
    emitNamedEvent({
      kind: "artifact.append_failed",
      runId: input.runId,
      streamKind: "supervisor_interventions",
      ownerId: null,
      seq,
      reason: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  await db.insert(supervisorInterventions).values({
    id,
    runId: input.runId,
    workerId: input.workerId,
    interventionType: input.interventionType,
    // Dual-write the legacy body columns during migration. Readers
    // that haven't moved to this adapter keep working.
    prompt: input.prompt,
    summary,
    artifactSeq: seq,
    promptHash,
    summaryPreview,
    createdAt,
  });

  await commitArtifactAppend({
    streamId: { runId: input.runId, kind: "supervisor_interventions", ownerId: null },
    seq,
    recordId: id,
  });
  return { id, artifactSeq: seq };
}

// --- Read paths ----------------------------------------------------

export async function listSupervisorInterventionsForRun(runId: string): Promise<SupervisorInterventionRow[]> {
  const rows = await db
    .select()
    .from(supervisorInterventions)
    .where(eq(supervisorInterventions.runId, runId))
    .orderBy(asc(supervisorInterventions.createdAt), asc(supervisorInterventions.id));
  return hydrateInterventions(rows);
}

export async function listSupervisorInterventionsForSnapshot(
  runId: string,
  limit: number,
): Promise<SupervisorInterventionRow[]> {
  const rows = await db
    .select()
    .from(supervisorInterventions)
    .where(eq(supervisorInterventions.runId, runId))
    .orderBy(desc(supervisorInterventions.createdAt), desc(supervisorInterventions.id))
    .limit(limit);
  return hydrateInterventions(rows);
}

async function hydrateInterventions(rows: SupervisorInterventionRow[]): Promise<SupervisorInterventionRow[]> {
  const needs: Map<string, SupervisorInterventionRow[]> = new Map();
  for (const row of rows) {
    if (row.artifactSeq != null && (row.prompt === null || row.summary === null)) {
      const bucket = needs.get(row.runId) ?? [];
      bucket.push(row);
      needs.set(row.runId, bucket);
    }
  }
  if (needs.size === 0) return rows;

  const overrides = new Map<string, { prompt: string; summary: string | null }>();
  for (const [runId, bucket] of needs) {
    const meta = await readArtifactStreamMetadata({
      runId,
      kind: "supervisor_interventions",
      ownerId: null,
    });
    if (!meta) continue;
    const location = await resolveArtifactStreamLocation(
      { runId, kind: "supervisor_interventions", ownerId: null, projectPath: meta.projectPath },
      "read",
    );
    const envelopes = await readAllArtifactEntries<ArtifactRecordEnvelope<InterventionPayload>>(location);
    const byId = new Map(envelopes.map((env) => [env.id, env] as const));
    for (const row of bucket) {
      const env = byId.get(row.id);
      if (env) {
        overrides.set(row.id, {
          prompt: env.payload.prompt,
          summary: env.payload.summary ?? null,
        });
      } else {
        emitNamedEvent({
          kind: "artifact.payload_missing",
          runId,
          streamKind: "supervisor_interventions",
          ownerId: null,
          seq: row.artifactSeq,
          recordId: row.id,
        });
      }
    }
  }
  return rows.map((row) => (
    overrides.has(row.id)
      ? {
        ...row,
        prompt: row.prompt ?? overrides.get(row.id)!.prompt,
        summary: row.summary ?? overrides.get(row.id)!.summary,
      }
      : row
  ));
}

export async function countLegacySupervisorInterventions(): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(supervisorInterventions)
    .where(isNull(supervisorInterventions.artifactSeq));
  return Number(rows[0]?.count ?? 0);
}

export async function updateSupervisorInterventionSummary(args: {
  id: string;
  summary: string;
}): Promise<void> {
  // Summary updates currently only touch the SQLite preview/body
  // columns; we don't rewrite the artifact stream record because the
  // append-only invariant says payloads are immutable. The summary
  // displayed in the UI follows the SQLite row.
  await db.update(supervisorInterventions).set({
    summary: args.summary,
    summaryPreview: buildArtifactPreview(args.summary),
  }).where(eq(supervisorInterventions.id, args.id));
}
