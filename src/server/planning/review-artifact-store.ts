/**
 * Planning review finding artifact adapter.
 *
 * Replaces direct `db.insert(planningReviewFindings).values({...})`
 * writes. Large `details` and `recommendation` bodies live in the
 * per-run `planning-review-findings.jsonl` artifact stream. SQLite
 * keeps id + severity + category + title + source_path + created_at
 * + artifact_seq + details_hash + recommendation_preview, all small
 * fields list views need.
 *
 * Dual-writes the legacy body columns during the migration window so
 * unmigrated readers keep working.
 */
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { planningReviewFindings } from "@/server/db/schema";
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

export interface PlanningReviewFindingInput {
  reviewRunId: string;
  roundId: string;
  runId: string;
  severity: string;
  category: string;
  title: string;
  details: string;
  recommendation: string;
  sourcePath?: string | null;
  id?: string;
  createdAt?: Date;
}

export interface PlanningReviewFindingRow {
  id: string;
  reviewRunId: string;
  roundId: string;
  runId: string;
  severity: string;
  category: string;
  title: string;
  details: string | null;
  recommendation: string | null;
  artifactSeq: number | null;
  detailsHash: string | null;
  recommendationPreview: string | null;
  sourcePath: string | null;
  createdAt: Date;
}

interface FindingPayload {
  details: string;
  recommendation: string;
}

export async function recordPlanningReviewFinding(
  input: PlanningReviewFindingInput,
): Promise<{ id: string; artifactSeq: number }> {
  const id = input.id ?? randomUUID();
  const createdAt = input.createdAt ?? new Date();
  const payload: FindingPayload = {
    details: input.details,
    recommendation: input.recommendation,
  };
  const detailsHash = hashArtifactPayload(payload);
  const recommendationPreview = buildArtifactPreview(input.recommendation);

  const { location } = await ensureArtifactStreamRow({
    runId: input.runId,
    kind: "planning_review_findings",
    ownerId: null,
  });
  const seq = await reserveNextArtifactSeq({
    runId: input.runId,
    kind: "planning_review_findings",
    ownerId: null,
  });

  const envelope: ArtifactRecordEnvelope<FindingPayload> = {
    id,
    seq,
    runId: input.runId,
    kind: "planning_review_findings",
    createdAt: createdAt.toISOString(),
    payload,
  };
  try {
    await appendArtifactLine(location, JSON.stringify(envelope), { seq });
  } catch (error) {
    emitNamedEvent({
      kind: "artifact.append_failed",
      runId: input.runId,
      streamKind: "planning_review_findings",
      ownerId: null,
      seq,
      reason: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  await db.insert(planningReviewFindings).values({
    id,
    reviewRunId: input.reviewRunId,
    roundId: input.roundId,
    runId: input.runId,
    severity: input.severity,
    category: input.category,
    title: input.title,
    details: input.details,
    recommendation: input.recommendation,
    artifactSeq: seq,
    detailsHash,
    recommendationPreview,
    sourcePath: input.sourcePath ?? null,
    createdAt,
  });

  await commitArtifactAppend({
    streamId: { runId: input.runId, kind: "planning_review_findings", ownerId: null },
    seq,
    recordId: id,
  });
  return { id, artifactSeq: seq };
}

// --- Read paths ----------------------------------------------------

export async function listPlanningReviewFindingsForRun(runId: string): Promise<PlanningReviewFindingRow[]> {
  const rows = await db
    .select()
    .from(planningReviewFindings)
    .where(eq(planningReviewFindings.runId, runId))
    .orderBy(asc(planningReviewFindings.createdAt), asc(planningReviewFindings.id));
  return hydratePlanningFindings(rows);
}

export async function listPlanningReviewFindingsForSnapshot(
  runId: string,
  limit: number,
): Promise<PlanningReviewFindingRow[]> {
  const rows = await db
    .select()
    .from(planningReviewFindings)
    .where(eq(planningReviewFindings.runId, runId))
    .orderBy(desc(planningReviewFindings.createdAt), desc(planningReviewFindings.id))
    .limit(limit);
  return hydratePlanningFindings(rows);
}

export async function listPlanningReviewFindingsForReviewRun(reviewRunId: string): Promise<PlanningReviewFindingRow[]> {
  const rows = await db
    .select()
    .from(planningReviewFindings)
    .where(eq(planningReviewFindings.reviewRunId, reviewRunId))
    .orderBy(asc(planningReviewFindings.createdAt), asc(planningReviewFindings.id));
  return hydratePlanningFindings(rows);
}

async function hydratePlanningFindings(rows: PlanningReviewFindingRow[]): Promise<PlanningReviewFindingRow[]> {
  const needs: Map<string, PlanningReviewFindingRow[]> = new Map();
  for (const row of rows) {
    if (row.artifactSeq != null && (row.details === null || row.recommendation === null)) {
      const bucket = needs.get(row.runId) ?? [];
      bucket.push(row);
      needs.set(row.runId, bucket);
    }
  }
  if (needs.size === 0) return rows;

  const overrides = new Map<string, { details: string; recommendation: string }>();
  for (const [runId, bucket] of needs) {
    const meta = await readArtifactStreamMetadata({
      runId,
      kind: "planning_review_findings",
      ownerId: null,
    });
    if (!meta) continue;
    const location = await resolveArtifactStreamLocation(
      { runId, kind: "planning_review_findings", ownerId: null, projectPath: meta.projectPath },
      "read",
    );
    const envelopes = await readAllArtifactEntries<ArtifactRecordEnvelope<FindingPayload>>(location);
    const byId = new Map(envelopes.map((env) => [env.id, env] as const));
    for (const row of bucket) {
      const env = byId.get(row.id);
      if (env) {
        overrides.set(row.id, {
          details: env.payload.details,
          recommendation: env.payload.recommendation,
        });
      } else {
        emitNamedEvent({
          kind: "artifact.payload_missing",
          runId,
          streamKind: "planning_review_findings",
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
        details: row.details ?? overrides.get(row.id)!.details,
        recommendation: row.recommendation ?? overrides.get(row.id)!.recommendation,
      }
      : row
  ));
}

export async function countLegacyPlanningReviewFindings(): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(planningReviewFindings)
    .where(isNull(planningReviewFindings.artifactSeq));
  return Number(rows[0]?.count ?? 0);
}
