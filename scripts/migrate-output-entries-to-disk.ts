#!/usr/bin/env tsx
import { db } from "@/server/db";
import { workers } from "@/server/db/schema";
import { and, eq, ne } from "drizzle-orm";
import {
  parseLegacyOutputEntriesJson,
  writeWorkerOutputEntries,
} from "@/server/workers/output-store";

async function main() {
  const rows = await db
    .select({
      id: workers.id,
      runId: workers.runId,
      outputEntriesJson: workers.outputEntriesJson,
    })
    .from(workers)
    .where(and(ne(workers.outputEntriesJson, ""), ne(workers.outputEntriesJson, "[]")));

  console.log(`Found ${rows.length} workers with persisted output entries.`);
  let migrated = 0;
  let skipped = 0;

  for (const row of rows) {
    const entries = parseLegacyOutputEntriesJson(row.outputEntriesJson);
    if (entries.length === 0) {
      skipped += 1;
      continue;
    }
    await writeWorkerOutputEntries(row.runId, row.id, entries);
    await db.update(workers).set({ outputEntriesJson: "" }).where(eq(workers.id, row.id));
    migrated += 1;
  }

  console.log(`Migrated ${migrated} workers (skipped ${skipped}).`);
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
