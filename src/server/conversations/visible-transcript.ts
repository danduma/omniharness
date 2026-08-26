import { eq } from "drizzle-orm";
import { parseSupersededSeqRanges, withoutSupersededEntries } from "@/lib/superseded-entries";
import { db } from "@/server/db";
import { workers } from "@/server/db/schema";
import type { WorkerEntry } from "@/server/workers/entries-types";
import { readWorkerOutputEntries } from "@/server/workers/output-store";
import { coalesceWorkerEntriesById } from "@/shared/worker-entries";

export interface ConversationTranscriptEntry extends WorkerEntry {
  workerId: string;
}

function entryTimestampMs(entry: WorkerEntry): number {
  if (!entry.timestamp) return 0;
  const ms = Date.parse(entry.timestamp);
  return Number.isFinite(ms) ? ms : 0;
}

export function compareConversationTranscriptEntries(
  left: ConversationTranscriptEntry,
  right: ConversationTranscriptEntry,
  workerCreationOrder: Map<string, number>,
): number {
  const leftTime = entryTimestampMs(left);
  const rightTime = entryTimestampMs(right);
  if (leftTime !== rightTime) return leftTime - rightTime;
  const leftOrder = workerCreationOrder.get(left.workerId) ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = workerCreationOrder.get(right.workerId) ?? Number.MAX_SAFE_INTEGER;
  if (leftOrder !== rightOrder) return leftOrder - rightOrder;
  return (left.seq ?? 0) - (right.seq ?? 0);
}

export function excludeDiagnosticTranscriptEntries(entries: WorkerEntry[]) {
  return entries.filter((entry) => !entry.diagnosticOnly);
}

export function sortConversationTranscriptEntries(
  entries: ConversationTranscriptEntry[],
  workerCreationOrder: Map<string, number>,
) {
  entries.sort((left, right) => compareConversationTranscriptEntries(left, right, workerCreationOrder));
  return entries;
}

export async function readVisibleConversationTranscript(runId: string) {
  const runWorkers = await db
    .select({ id: workers.id, createdAt: workers.createdAt, supersededSeqRanges: workers.supersededSeqRanges })
    .from(workers)
    .where(eq(workers.runId, runId));
  const sortedWorkers = [...runWorkers].sort((left, right) => {
    const timeDelta = left.createdAt.getTime() - right.createdAt.getTime();
    return timeDelta !== 0 ? timeDelta : left.id.localeCompare(right.id);
  });
  const workerCreationOrder = new Map(sortedWorkers.map((worker, index) => [worker.id, index]));
  const perWorkerEntries = await Promise.all(sortedWorkers.map(async (worker) => ({
    worker,
    entries: await readWorkerOutputEntries(runId, worker.id),
  })));
  const entries: ConversationTranscriptEntry[] = [];

  for (const { worker, entries: workerEntries } of perWorkerEntries) {
    const visibleEntries = excludeDiagnosticTranscriptEntries(withoutSupersededEntries(
      workerEntries as WorkerEntry[],
      parseSupersededSeqRanges(worker.supersededSeqRanges),
    ));
    entries.push(...visibleEntries.map((entry) => ({ ...entry, workerId: worker.id })));
  }

  const workerIds = sortedWorkers.map((worker) => worker.id);
  const sortedEntries = sortConversationTranscriptEntries(entries, workerCreationOrder);
  const coalescedEntries = coalesceWorkerEntriesById(sortedEntries, workerIds) as ConversationTranscriptEntry[];
  return {
    entries: coalescedEntries,
    workerIds,
    workerCreationOrder,
  };
}
