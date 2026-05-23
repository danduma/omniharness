/**
 * One-shot: rebuild the sparse seq→offset index for every worker_entries
 * artifact stream. Used after the legacy-runtime-output backfill so the
 * old transcripts get fast tail reads too.
 *
 * Usage: pnpm exec tsx scripts/rebuild-worker-indices.ts [--verbose]
 */
import path from "node:path";
import { existsSync } from "node:fs";
import { db } from "@/server/db";
import { artifactStreams, runs } from "@/server/db/schema";
import { resolveArtifactStreamLocation } from "@/server/artifacts/append-only-store";
import type { ArtifactStreamKind } from "@/server/artifacts/stream-types";
import { rebuildIndex } from "@/server/artifacts/stream-index";

async function main() {
  const verbose = process.argv.includes("--verbose") || process.argv.includes("-v");
  const rows = await db.select().from(artifactStreams);
  const projectByRun = new Map<string, string | null>(
    (await db.select({ id: runs.id, projectPath: runs.projectPath }).from(runs))
      .map((r) => [r.id, r.projectPath ?? null]),
  );

  let scanned = 0;
  let rebuilt = 0;
  let missing = 0;
  let failed = 0;
  for (const row of rows) {
    if (row.kind !== "worker_entries") continue;
    scanned += 1;
    const projectPath = projectByRun.get(row.runId) ?? null;
    let location;
    try {
      location = await resolveArtifactStreamLocation(
        {
          runId: row.runId,
          kind: row.kind as ArtifactStreamKind,
          ownerId: row.ownerId === "__none__" ? null : row.ownerId,
          projectPath,
        },
        "read",
      );
    } catch (error) {
      failed += 1;
      console.error(`[rebuild] ${row.runId}/${row.ownerId}: resolve failed: ${error instanceof Error ? error.message : error}`);
      continue;
    }
    if (!existsSync(location.filePath)) {
      missing += 1;
      if (verbose) console.log(`[skip] ${row.runId}/${row.ownerId}: file missing`);
      continue;
    }
    try {
      const count = await rebuildIndex(location);
      rebuilt += 1;
      if (verbose) {
        console.log(`[rebuilt] ${row.runId}/${row.ownerId}: ${count} index entries at ${path.basename(location.filePath)}.idx`);
      }
    } catch (error) {
      failed += 1;
      console.error(`[rebuild] ${row.runId}/${row.ownerId}: failed: ${error instanceof Error ? error.message : error}`);
    }
  }
  console.log(`[summary] scanned=${scanned} rebuilt=${rebuilt} missing=${missing} failed=${failed}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
