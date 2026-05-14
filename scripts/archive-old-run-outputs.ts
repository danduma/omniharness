#!/usr/bin/env tsx
import { existsSync } from "node:fs";
import { isNotNull } from "drizzle-orm";
import { db } from "@/server/db";
import { runs } from "@/server/db/schema";
import { archiveRunOutputs } from "@/server/workers/output-store";
import { getAppDataPath } from "@/server/app-root";
import path from "node:path";

const RUN_DATA_DIR = getAppDataPath("run-data");

async function main() {
  const archivedRuns = await db.select({ id: runs.id }).from(runs).where(isNotNull(runs.archivedAt));
  console.log(`Found ${archivedRuns.length} archived runs.`);
  let zipped = 0;
  let skipped = 0;

  for (const run of archivedRuns) {
    const dir = path.join(RUN_DATA_DIR, run.id);
    const zip = path.join(RUN_DATA_DIR, `${run.id}.zip`);
    if (!existsSync(dir)) {
      skipped += 1;
      continue;
    }
    if (existsSync(zip)) {
      // Already zipped — let archiveRunOutputs replace it (zip -rqm consumes the dir).
    }
    try {
      await archiveRunOutputs(run.id);
      zipped += 1;
    } catch (error) {
      console.warn(`Failed to zip run ${run.id}:`, error);
    }
  }

  console.log(`Zipped ${zipped} runs (${skipped} skipped — no live dir).`);
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
