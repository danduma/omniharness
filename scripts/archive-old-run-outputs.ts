#!/usr/bin/env tsx
import { existsSync } from "node:fs";
import { isNotNull } from "drizzle-orm";
import { db } from "@/server/db";
import { runs } from "@/server/db/schema";
import { compactRunOutputs } from "@/server/workers/output-store";
import { getAppDataPath } from "@/server/app-root";
import path from "node:path";

const RUN_DATA_DIR = getAppDataPath("run-data");

async function main() {
  const archivedRuns = await db.select({ id: runs.id }).from(runs).where(isNotNull(runs.archivedAt));
  console.log(`Found ${archivedRuns.length} archived runs.`);
  let compactedRuns = 0;
  let compactedWorkers = 0;
  let skipped = 0;

  for (const run of archivedRuns) {
    const dir = path.join(RUN_DATA_DIR, run.id);
    if (!existsSync(dir)) {
      skipped += 1;
      continue;
    }
    try {
      const result = await compactRunOutputs(run.id);
      if (result.compactedWorkerIds.length > 0) {
        compactedRuns += 1;
        compactedWorkers += result.compactedWorkerIds.length;
      }
    } catch (error) {
      console.warn(`Failed to compact run ${run.id}:`, error);
    }
  }

  console.log(`Compacted ${compactedWorkers} worker files across ${compactedRuns} runs (${skipped} skipped — no live dir).`);
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
