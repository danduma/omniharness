/**
 * Diagnose and (optionally) repair artifact_streams metadata drift.
 *
 * Checks every artifact_streams row against its underlying JSONL/.gz file:
 *
 *   - file present?
 *   - last envelope's `seq` matches `artifact_streams.latest_seq`?
 *   - last envelope's `id` matches `artifact_streams.latest_record_id`?
 *   - sparse index file is consistent (rebuildable if stale)?
 *
 * Modes:
 *
 *   pnpm exec tsx scripts/artifact-repair.ts                # verify all streams, exit 1 on drift
 *   pnpm exec tsx scripts/artifact-repair.ts --rebuild-index    # rebuild .idx for any stream with missing/stale index
 *   pnpm exec tsx scripts/artifact-repair.ts --fix-metadata     # update artifact_streams.latest_seq/latest_record_id to match file tail
 *   pnpm exec tsx scripts/artifact-repair.ts --runId <id>       # restrict to a single run
 *
 * The script never deletes data — at worst it rewrites the SQLite cursor.
 * Repair is opt-in. Verification is the default.
 */
import { promises as fs, existsSync } from "node:fs";
import path from "node:path";
import { db } from "@/server/db";
import { artifactStreams, runs } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import {
  parseJsonlLines,
  resolveArtifactStreamLocation,
  readAllArtifactEntries,
} from "@/server/artifacts/append-only-store";
import { rebuildIndex, readIndex } from "@/server/artifacts/stream-index";
import type { ArtifactRecordEnvelope, ArtifactStreamKind } from "@/server/artifacts/stream-types";

interface CliOptions {
  rebuildIndex: boolean;
  fixMetadata: boolean;
  runIdFilter: string | null;
  verbose: boolean;
}

function parseArgs(): CliOptions {
  const argv = process.argv.slice(2);
  const runIdIdx = argv.indexOf("--runId");
  return {
    rebuildIndex: argv.includes("--rebuild-index"),
    fixMetadata: argv.includes("--fix-metadata"),
    runIdFilter: runIdIdx >= 0 && argv[runIdIdx + 1] ? argv[runIdIdx + 1] : null,
    verbose: argv.includes("--verbose") || argv.includes("-v"),
  };
}

interface Drift {
  reason: string;
  fixable: boolean;
}

async function diagnoseStream(row: typeof artifactStreams.$inferSelect, projectPath: string | null): Promise<{
  drifts: Drift[];
  fileTailEnvelope: ArtifactRecordEnvelope | null;
}> {
  const drifts: Drift[] = [];
  const location = await resolveArtifactStreamLocation(
    {
      runId: row.runId,
      kind: row.kind as ArtifactStreamKind,
      ownerId: row.ownerId === "__none__" ? null : row.ownerId,
      projectPath,
    },
    "read",
  );

  const exists = existsSync(location.filePath) || existsSync(location.compressedFilePath);
  if (!exists) {
    drifts.push({ reason: "neither plaintext nor .gz file exists on disk", fixable: false });
    return { drifts, fileTailEnvelope: null };
  }

  // Read the entire stream to inspect its tail. For very large streams
  // this is wasteful, but the repair tool is offline / operator-run, so
  // simplicity beats cleverness here.
  let envelopes: ArtifactRecordEnvelope[] = [];
  try {
    envelopes = await readAllArtifactEntries<ArtifactRecordEnvelope>(location);
  } catch (error) {
    drifts.push({
      reason: `parse error: ${error instanceof Error ? error.message : String(error)}`,
      fixable: false,
    });
    return { drifts, fileTailEnvelope: null };
  }
  const tail = envelopes[envelopes.length - 1] ?? null;
  if (tail) {
    if (tail.seq !== row.latestSeq) {
      drifts.push({
        reason: `metadata latestSeq=${row.latestSeq} but file tail seq=${tail.seq}`,
        fixable: true,
      });
    }
    if (row.latestRecordId !== null && tail.id !== row.latestRecordId) {
      drifts.push({
        reason: `metadata latestRecordId=${row.latestRecordId} but file tail id=${tail.id}`,
        fixable: true,
      });
    }
  } else if (row.latestSeq > 0) {
    drifts.push({
      reason: `metadata latestSeq=${row.latestSeq} but file has no envelopes`,
      fixable: false,
    });
  }

  // Index consistency: does every (seq, offset) pair point at a line
  // whose JSON parses to that seq? A missing index is fine — readers
  // tolerate that — but a stale index hurts tail-N performance.
  if (existsSync(location.filePath)) {
    try {
      const index = await readIndex(location);
      if (index && index.length > 0) {
        const body = await fs.readFile(location.filePath, "utf8");
        for (const point of index) {
          if (point.offset > body.length) {
            drifts.push({
              reason: `index points at offset ${point.offset} past EOF (${body.length}) for seq ${point.seq}`,
              fixable: true,
            });
            break;
          }
          const newlineIdx = body.indexOf("\n", point.offset);
          const lineEnd = newlineIdx === -1 ? body.length : newlineIdx;
          const line = body.slice(point.offset, lineEnd);
          if (!line) continue;
          const parsed = parseJsonlLines<ArtifactRecordEnvelope>(line + "\n")[0] ?? null;
          if (parsed && parsed.seq !== point.seq) {
            drifts.push({
              reason: `index says seq ${point.seq}@${point.offset} but line parses to seq ${parsed.seq}`,
              fixable: true,
            });
            break;
          }
        }
      }
    } catch (error) {
      drifts.push({
        reason: `index read error: ${error instanceof Error ? error.message : String(error)}`,
        fixable: true,
      });
    }
  }

  return { drifts, fileTailEnvelope: tail };
}

async function main() {
  const options = parseArgs();
  console.log(`[repair] mode=${options.fixMetadata ? "fix-metadata" : options.rebuildIndex ? "rebuild-index" : "verify"}`);

  const streamRows = await db.select().from(artifactStreams);
  const runIds = Array.from(new Set(streamRows.map((r) => r.runId)));
  const runRows = runIds.length > 0
    ? await db.select({ id: runs.id, projectPath: runs.projectPath }).from(runs)
    : [];
  const projectPathByRun = new Map<string, string | null>(
    runRows.map((r) => [r.id, r.projectPath ?? null]),
  );

  let totalDrift = 0;
  let totalFixed = 0;
  for (const row of streamRows) {
    if (options.runIdFilter && row.runId !== options.runIdFilter) continue;
    const projectPath = projectPathByRun.get(row.runId) ?? null;
    let report;
    try {
      report = await diagnoseStream(row, projectPath);
    } catch (error) {
      console.error(`[repair] ${row.runId}/${row.kind}/${row.ownerId}: diagnose failed: ${error instanceof Error ? error.message : error}`);
      continue;
    }
    if (report.drifts.length === 0) {
      if (options.verbose) {
        console.log(`[ok] ${row.runId}/${row.kind}/${row.ownerId}: latestSeq=${row.latestSeq}`);
      }
      continue;
    }
    totalDrift += report.drifts.length;
    for (const drift of report.drifts) {
      console.warn(`[drift] ${row.runId}/${row.kind}/${row.ownerId}: ${drift.reason}${drift.fixable ? " (fixable)" : ""}`);
    }

    const tail = report.fileTailEnvelope;
    if (options.fixMetadata && tail) {
      await db.update(artifactStreams).set({
        latestSeq: tail.seq,
        latestRecordId: tail.id,
        updatedAt: new Date(),
      }).where(eq(artifactStreams.id, row.id));
      totalFixed += 1;
      console.log(`[fixed] ${row.runId}/${row.kind}: latestSeq -> ${tail.seq}, latestRecordId -> ${tail.id}`);
    }

    if (options.rebuildIndex) {
      const location = await resolveArtifactStreamLocation(
        {
          runId: row.runId,
          kind: row.kind as ArtifactStreamKind,
          ownerId: row.ownerId === "__none__" ? null : row.ownerId,
          projectPath,
        },
        "read",
      );
      if (existsSync(location.filePath)) {
        try {
          await rebuildIndex(location);
          console.log(`[fixed] ${row.runId}/${row.kind}: rebuilt index at ${path.basename(location.filePath)}.idx`);
          totalFixed += 1;
        } catch (error) {
          console.error(`[repair] ${row.runId}/${row.kind}: rebuildIndex failed: ${error instanceof Error ? error.message : error}`);
        }
      }
    }
  }

  console.log(`[summary] streamsScanned=${streamRows.length} drifts=${totalDrift} fixes=${totalFixed}`);
  process.exit(totalDrift > 0 && !options.fixMetadata && !options.rebuildIndex ? 1 : 0);
}

main().catch((error) => {
  console.error("[repair] fatal:", error);
  process.exit(1);
});
