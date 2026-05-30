/**
 * One-time cleanup for stale sidebar state:
 *
 * Part A: Runs stuck in 'awaiting_user' that should be done.
 *   A1: A user message exists with createdAt > run.updatedAt — user responded, run got stuck.
 *   A2: run.updatedAt is older than 1 day — clearly stale, user has moved on.
 *
 * Part B: Old terminal runs with no read marker show as unread forever.
 *   Backfill conversationReadMarkers for terminal runs (done/failed/cancelled) that
 *   are older than 7 days and have no read marker entry.
 *
 * Usage:
 *   pnpm tsx scripts/cleanup-stale-sidebar-state.ts [--dry-run] [--verbose]
 */
import { and, eq, gt, lt, inArray, notInArray, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { runs, messages, conversationReadMarkers } from "@/server/db/schema";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const verbose = process.argv.includes("--verbose");
  if (dryRun) console.log("(dry-run — no rows will be written)\n");

  // ── Part A: stale awaiting_user runs ──────────────────────────────────────

  const AWAITING_STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 1 day
  const awaitingStaleThreshold = new Date(Date.now() - AWAITING_STALE_THRESHOLD_MS);

  const awaitingRuns = await db.select({
    id: runs.id,
    updatedAt: runs.updatedAt,
  }).from(runs).where(eq(runs.status, "awaiting_user"));

  console.log(`Found ${awaitingRuns.length} awaiting_user run(s). Checking for stale ones…`);

  let awaitingFixed = 0;
  const alreadyFixed = new Set<string>();
  for (const run of awaitingRuns) {
    // A1: user responded after the awaiting_user was set
    const laterMsg = await db.select({ id: messages.id })
      .from(messages)
      .where(and(
        eq(messages.runId, run.id),
        eq(messages.role, "user"),
        gt(messages.createdAt, run.updatedAt),
      ))
      .limit(1)
      .get();

    if (laterMsg) {
      awaitingFixed++;
      alreadyFixed.add(run.id);
      if (verbose) console.log(`  [A1] ${run.id} — user message after awaiting_user → marking done`);
      if (!dryRun) {
        await db.update(runs).set({ status: "done", updatedAt: new Date() }).where(eq(runs.id, run.id));
      }
      continue;
    }

    // A2: older than 1 day with no user response — clearly abandoned
    if (run.updatedAt < awaitingStaleThreshold) {
      awaitingFixed++;
      if (verbose) console.log(`  [A2] ${run.id} — awaiting_user for >1 day with no response → marking done`);
      if (!dryRun) {
        await db.update(runs).set({ status: "done", updatedAt: new Date() }).where(eq(runs.id, run.id));
      }
    }
  }

  console.log(`Part A: ${awaitingFixed} stale awaiting_user run(s) ${dryRun ? "would be" : "were"} transitioned to done.\n`);

  // ── Part B: backfill read markers for old terminal runs ───────────────────

  const STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
  const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MS);
  const TERMINAL_STATUSES = ["done", "failed", "cancelled", "canceled", "promoted"];

  const oldTerminalRuns = await db.select({
    id: runs.id,
    updatedAt: runs.updatedAt,
  }).from(runs).where(and(
    inArray(runs.status, TERMINAL_STATUSES),
    lt(runs.updatedAt, staleThreshold),
  ));

  console.log(`Found ${oldTerminalRuns.length} old terminal run(s) (>7 days). Checking for missing read markers…`);

  // Fetch existing read markers in one query
  const existingRunIds = oldTerminalRuns.length > 0
    ? new Set(
        (await db.select({ runId: conversationReadMarkers.runId })
          .from(conversationReadMarkers)
          .where(inArray(conversationReadMarkers.runId, oldTerminalRuns.map(r => r.id)))
        ).map(r => r.runId),
      )
    : new Set<string>();

  const missing = oldTerminalRuns.filter(r => !existingRunIds.has(r.id));
  console.log(`  ${missing.length} run(s) have no read marker.`);

  let markersInserted = 0;
  const now = new Date();
  for (const run of missing) {
    markersInserted++;
    if (verbose) console.log(`  [B] ${run.id} — inserting read marker at ${run.updatedAt.toISOString()}`);
    if (!dryRun) {
      await db.insert(conversationReadMarkers)
        .values({
          runId: run.id,
          lastReadAt: run.updatedAt,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: conversationReadMarkers.runId,
          set: {
            lastReadAt: run.updatedAt,
            updatedAt: now,
          },
        });
    }
  }

  console.log(`Part B: ${markersInserted} read marker(s) ${dryRun ? "would be" : "were"} inserted.\n`);

  if (dryRun) console.log("(dry-run complete — re-run without --dry-run to apply)");
}

main().then(() => process.exit(0), (error) => {
  console.error(error);
  process.exit(1);
});
