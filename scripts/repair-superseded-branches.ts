/**
 * Backfill superseded seq ranges for conversations that were rewound before
 * OmniHarness recorded them.
 *
 * A retry/edit re-delivers a user message on a newer worker while the original
 * delivery — and everything the abandoned attempt produced after it — stays on
 * the older worker's append-only stream. Without a recorded range both copies
 * render, so the rewound message shows up twice and the discarded answers
 * interleave with the new ones. Recovery records the range itself now; this
 * script reconstructs it for runs that were already rewound, by finding user
 * input ids that appear on more than one of a run's workers.
 *
 * Nothing is deleted: only the `workers.superseded_seq_ranges` column is
 * written, and only for the older copy.
 *
 *   pnpm exec tsx scripts/repair-superseded-branches.ts            # report only
 *   pnpm exec tsx scripts/repair-superseded-branches.ts --apply    # write
 *   pnpm exec tsx scripts/repair-superseded-branches.ts --apply --run <runId>
 */
import { asc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { runs, workers } from "@/server/db/schema";
import { readWorkerLatestSeq, readWorkerOutputEntries } from "@/server/workers/output-store";
import { parseSupersededSeqRanges, serializeSupersededSeqRanges, type SupersededSeqRange } from "@/lib/superseded-entries";

type WorkerRow = {
  id: string;
  runId: string;
  supersededSeqRanges: string | null;
};

async function readUserInputSeqs(runId: string, workerId: string) {
  // Full canonical read: the paginated readers cap a forward page, and the
  // rewind point is usually far behind the tip.
  const entries = await readWorkerOutputEntries(runId, workerId);
  const seqByEntryId = new Map<string, number>();
  for (const entry of entries) {
    if (entry.type !== "user_input" || typeof entry.seq !== "number") {
      continue;
    }
    if (!seqByEntryId.has(entry.id)) {
      seqByEntryId.set(entry.id, entry.seq);
    }
  }
  return seqByEntryId;
}

async function repairRun(runId: string, runWorkers: WorkerRow[], apply: boolean) {
  const ordered = runWorkers;
  const seqsByWorker = new Map<string, Map<string, number>>();
  for (const worker of ordered) {
    seqsByWorker.set(worker.id, await readUserInputSeqs(runId, worker.id));
  }

  const repairs: Array<{ workerId: string; range: SupersededSeqRange; messageId: string }> = [];

  for (let index = 0; index < ordered.length; index += 1) {
    const worker = ordered[index];
    const ownSeqs = seqsByWorker.get(worker.id) ?? new Map();
    const laterIds = new Set(
      ordered.slice(index + 1).flatMap((later) => [...(seqsByWorker.get(later.id) ?? new Map()).keys()]),
    );

    // The earliest message this worker handled that a later worker delivered
    // again is where the rewind happened; everything from there on is the
    // branch the user discarded.
    let from: number | null = null;
    let messageId = "";
    for (const [entryId, seq] of ownSeqs) {
      if (laterIds.has(entryId) && (from === null || seq < from)) {
        from = seq;
        messageId = entryId;
      }
    }
    if (from === null) {
      continue;
    }

    const through = await readWorkerLatestSeq(runId, worker.id);
    if (through < from) {
      continue;
    }

    const existing = parseSupersededSeqRanges(worker.supersededSeqRanges);
    if (existing.some((range) => range.from <= from && range.through >= through)) {
      continue;
    }

    repairs.push({ workerId: worker.id, range: { from, through }, messageId });

    if (apply) {
      await db.update(workers).set({
        supersededSeqRanges: serializeSupersededSeqRanges([...existing, { from, through }]),
        updatedAt: new Date(),
      }).where(eq(workers.id, worker.id));
    }
  }

  return repairs;
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const runIndex = args.indexOf("--run");
  const onlyRunId = runIndex >= 0 ? args[runIndex + 1] : null;

  const runRows = onlyRunId
    ? await db.select({ id: runs.id }).from(runs).where(eq(runs.id, onlyRunId))
    : await db.select({ id: runs.id }).from(runs);

  let repairedRuns = 0;
  let repairedWorkers = 0;

  for (const run of runRows) {
    const runWorkers = await db
      .select({ id: workers.id, runId: workers.runId, supersededSeqRanges: workers.supersededSeqRanges })
      .from(workers)
      .where(eq(workers.runId, run.id))
      .orderBy(asc(workers.createdAt), asc(workers.id));

    if (runWorkers.length < 2) {
      continue;
    }

    const repairs = await repairRun(run.id, runWorkers, apply);
    if (repairs.length === 0) {
      continue;
    }

    repairedRuns += 1;
    repairedWorkers += repairs.length;
    for (const repair of repairs) {
      process.stdout.write(
        `${apply ? "repaired" : "would repair"} ${repair.workerId}: seq ${repair.range.from}-${repair.range.through} (rewound at message ${repair.messageId})\n`,
      );
    }
  }

  process.stdout.write(
    `${apply ? "Repaired" : "Found"} ${repairedWorkers} superseded branch(es) across ${repairedRuns} run(s).${apply ? "" : " Re-run with --apply to write."}\n`,
  );
}

void main();
