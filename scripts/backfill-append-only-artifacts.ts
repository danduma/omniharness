/**
 * Idempotent backfill: move legacy SQLite body columns into the
 * append-only artifact streams introduced in DB_SCHEMA_VERSION 2.
 *
 *   - execution_events.details                 → execution-events.jsonl
 *   - supervisor_interventions.prompt/summary  → supervisor-interventions.jsonl
 *   - planning_review_findings.details +
 *     planning_review_findings.recommendation  → planning-review-findings.jsonl
 *
 * The script never deletes legacy SQLite data — operators run with an
 * explicit `--cleanup` flag once they've verified backfill succeeded.
 *
 * Usage:
 *   pnpm exec tsx scripts/backfill-append-only-artifacts.ts          # default backfill, idempotent
 *   pnpm exec tsx scripts/backfill-append-only-artifacts.ts --dry-run    # report only
 *   pnpm exec tsx scripts/backfill-append-only-artifacts.ts --verify     # check counts only
 *   pnpm exec tsx scripts/backfill-append-only-artifacts.ts --cleanup    # null out legacy body columns (after backfill verified)
 *
 * Re-running with no flags is safe — rows already pointing at an
 * artifact (artifact_seq IS NOT NULL) are skipped.
 */
import { eq, isNull, isNotNull, and, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { executionEvents, supervisorInterventions, planningReviewFindings } from "@/server/db/schema";
import {
  appendArtifactLine,
} from "@/server/artifacts/append-only-store";
import {
  buildArtifactPreview,
  commitArtifactAppend,
  ensureArtifactStreamRow,
  hashArtifactPayload,
  reserveNextArtifactSeq,
} from "@/server/artifacts/stream-metadata";
import type { ArtifactRecordEnvelope, ArtifactStreamKind } from "@/server/artifacts/stream-types";

interface BackfillOptions {
  dryRun: boolean;
  verify: boolean;
  cleanup: boolean;
  verbose: boolean;
}

interface BackfillCounters {
  scanned: number;
  written: number;
  skippedAlreadyMigrated: number;
  skippedNoBody: number;
  failed: number;
  cleanedLegacyColumns: number;
}

function parseArgs(): BackfillOptions {
  const argv = process.argv.slice(2);
  return {
    dryRun: argv.includes("--dry-run"),
    verify: argv.includes("--verify"),
    cleanup: argv.includes("--cleanup"),
    verbose: argv.includes("--verbose") || argv.includes("-v"),
  };
}

function parseLegacyDetails(raw: string | null): unknown {
  if (raw === null || raw === undefined) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

async function backfillExecutionEvents(options: BackfillOptions): Promise<BackfillCounters> {
  const counters: BackfillCounters = {
    scanned: 0,
    written: 0,
    skippedAlreadyMigrated: 0,
    skippedNoBody: 0,
    failed: 0,
    cleanedLegacyColumns: 0,
  };

  const rows = await db
    .select()
    .from(executionEvents)
    .where(isNull(executionEvents.artifactSeq));
  for (const row of rows) {
    counters.scanned += 1;
    if (row.artifactSeq != null) {
      counters.skippedAlreadyMigrated += 1;
      continue;
    }
    const payload = parseLegacyDetails(row.details);
    if (payload === null) {
      counters.skippedNoBody += 1;
      continue;
    }
    if (options.dryRun) {
      counters.written += 1;
      continue;
    }
    try {
      await writeBackfilledRecord({
        kind: "execution_events",
        runId: row.runId,
        recordId: row.id,
        createdAt: row.createdAt,
        payload,
        commitRow: async (seq, hash, preview) => {
          await db.update(executionEvents).set({
            artifactSeq: seq,
            detailsHash: hash,
            detailsPreview: preview,
          }).where(eq(executionEvents.id, row.id));
        },
      });
      counters.written += 1;
    } catch (error) {
      counters.failed += 1;
      console.error(`[backfill] execution_events ${row.id}: ${error instanceof Error ? error.message : error}`);
    }
  }

  if (options.cleanup && !options.dryRun) {
    // Null out the legacy `details` column on rows that already have
    // an artifact pointer. Idempotent — only touches rows where the
    // body is duplicated in the artifact stream.
    const cleaned = await db.update(executionEvents)
      .set({ details: null })
      .where(and(
        isNotNull(executionEvents.artifactSeq),
        isNotNull(executionEvents.details),
      ));
    counters.cleanedLegacyColumns = (cleaned as unknown as { rowsAffected?: number }).rowsAffected ?? 0;
  }

  return counters;
}

async function backfillSupervisorInterventions(options: BackfillOptions): Promise<BackfillCounters> {
  const counters: BackfillCounters = {
    scanned: 0, written: 0, skippedAlreadyMigrated: 0, skippedNoBody: 0, failed: 0, cleanedLegacyColumns: 0,
  };
  const rows = await db
    .select()
    .from(supervisorInterventions)
    .where(isNull(supervisorInterventions.artifactSeq));
  for (const row of rows) {
    counters.scanned += 1;
    if (row.artifactSeq != null) {
      counters.skippedAlreadyMigrated += 1;
      continue;
    }
    if (!row.prompt) {
      counters.skippedNoBody += 1;
      continue;
    }
    if (options.dryRun) {
      counters.written += 1;
      continue;
    }
    try {
      await writeBackfilledRecord({
        kind: "supervisor_interventions",
        runId: row.runId,
        recordId: row.id,
        createdAt: row.createdAt,
        payload: { prompt: row.prompt, summary: row.summary ?? null },
        commitRow: async (seq, hash, preview) => {
          await db.update(supervisorInterventions).set({
            artifactSeq: seq,
            promptHash: hash,
            summaryPreview: preview,
          }).where(eq(supervisorInterventions.id, row.id));
        },
        previewSource: row.summary || row.prompt,
      });
      counters.written += 1;
    } catch (error) {
      counters.failed += 1;
      console.error(`[backfill] supervisor_interventions ${row.id}: ${error instanceof Error ? error.message : error}`);
    }
  }
  return counters;
}

async function backfillPlanningReviewFindings(options: BackfillOptions): Promise<BackfillCounters> {
  const counters: BackfillCounters = {
    scanned: 0, written: 0, skippedAlreadyMigrated: 0, skippedNoBody: 0, failed: 0, cleanedLegacyColumns: 0,
  };
  const rows = await db
    .select()
    .from(planningReviewFindings)
    .where(isNull(planningReviewFindings.artifactSeq));
  for (const row of rows) {
    counters.scanned += 1;
    if (row.artifactSeq != null) {
      counters.skippedAlreadyMigrated += 1;
      continue;
    }
    if (!row.details && !row.recommendation) {
      counters.skippedNoBody += 1;
      continue;
    }
    if (options.dryRun) {
      counters.written += 1;
      continue;
    }
    try {
      await writeBackfilledRecord({
        kind: "planning_review_findings",
        runId: row.runId,
        recordId: row.id,
        createdAt: row.createdAt,
        payload: { details: row.details ?? "", recommendation: row.recommendation ?? "" },
        commitRow: async (seq, hash, preview) => {
          await db.update(planningReviewFindings).set({
            artifactSeq: seq,
            detailsHash: hash,
            recommendationPreview: preview,
          }).where(eq(planningReviewFindings.id, row.id));
        },
        previewSource: row.recommendation ?? row.details ?? "",
      });
      counters.written += 1;
    } catch (error) {
      counters.failed += 1;
      console.error(`[backfill] planning_review_findings ${row.id}: ${error instanceof Error ? error.message : error}`);
    }
  }
  return counters;
}

async function writeBackfilledRecord(args: {
  kind: ArtifactStreamKind;
  runId: string;
  recordId: string;
  createdAt: Date;
  payload: unknown;
  previewSource?: unknown;
  commitRow: (seq: number, hash: string, preview: string) => Promise<void>;
}): Promise<void> {
  const hash = hashArtifactPayload(args.payload);
  const preview = buildArtifactPreview(args.previewSource ?? args.payload);
  const { location } = await ensureArtifactStreamRow({
    runId: args.runId,
    kind: args.kind,
    ownerId: null,
  });
  const seq = await reserveNextArtifactSeq({
    runId: args.runId,
    kind: args.kind,
    ownerId: null,
  });
  const envelope: ArtifactRecordEnvelope = {
    id: args.recordId,
    seq,
    runId: args.runId,
    kind: args.kind,
    createdAt: args.createdAt.toISOString(),
    payload: args.payload,
  };
  await appendArtifactLine(location, JSON.stringify(envelope), { seq });
  await args.commitRow(seq, hash, preview);
  await commitArtifactAppend({
    streamId: { runId: args.runId, kind: args.kind, ownerId: null },
    seq,
    recordId: args.recordId,
  });
}

function formatCounters(label: string, c: BackfillCounters) {
  return [
    `[${label}]`,
    `scanned=${c.scanned}`,
    `written=${c.written}`,
    `skippedAlreadyMigrated=${c.skippedAlreadyMigrated}`,
    `skippedNoBody=${c.skippedNoBody}`,
    `failed=${c.failed}`,
    c.cleanedLegacyColumns > 0 ? `cleanedLegacyColumns=${c.cleanedLegacyColumns}` : null,
  ].filter(Boolean).join(" ");
}

async function main() {
  const options = parseArgs();
  if (options.verify) {
    const exe = (await db.select().from(executionEvents).where(isNull(executionEvents.artifactSeq))).length;
    const sup = (await db.select().from(supervisorInterventions).where(isNull(supervisorInterventions.artifactSeq))).length;
    const pln = (await db.select().from(planningReviewFindings).where(isNull(planningReviewFindings.artifactSeq))).length;
    console.log(`[verify] execution_events.artifactSeq IS NULL: ${exe}`);
    console.log(`[verify] supervisor_interventions.artifactSeq IS NULL: ${sup}`);
    console.log(`[verify] planning_review_findings.artifactSeq IS NULL: ${pln}`);
    process.exit(exe === 0 && sup === 0 && pln === 0 ? 0 : 1);
  }

  console.log(`[backfill] mode=${options.dryRun ? "dry-run" : options.cleanup ? "cleanup" : "default"}`);
  const exe = await backfillExecutionEvents(options);
  console.log(formatCounters("execution_events", exe));
  const sup = await backfillSupervisorInterventions(options);
  console.log(formatCounters("supervisor_interventions", sup));
  const pln = await backfillPlanningReviewFindings(options);
  console.log(formatCounters("planning_review_findings", pln));

  const totalFailed = exe.failed + sup.failed + pln.failed;
  process.exit(totalFailed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("[backfill] fatal:", error);
  process.exit(1);
});
