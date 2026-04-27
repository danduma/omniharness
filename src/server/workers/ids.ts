import { eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { workerCounters, workers } from "@/server/db/schema";

function parseWorkerNumberFromId(runId: string, workerId: string) {
  const prefix = `${runId}-worker-`;
  if (!workerId.startsWith(prefix)) {
    return null;
  }

  const value = Number(workerId.slice(prefix.length));
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

async function getExistingMaxWorkerNumber(runId: string) {
  const existingWorkers = await db.select({
    id: workers.id,
    workerNumber: workers.workerNumber,
  }).from(workers).where(eq(workers.runId, runId));

  return existingWorkers.reduce((max, worker) => {
    const workerNumber = worker.workerNumber ?? parseWorkerNumberFromId(runId, worker.id);
    return workerNumber && workerNumber > max ? workerNumber : max;
  }, 0);
}

export async function allocateWorkerIdentity(runId: string) {
  const now = new Date();
  const firstWorkerNumber = (await getExistingMaxWorkerNumber(runId)) + 1;
  const row = await db.insert(workerCounters)
    .values({ runId, nextNumber: firstWorkerNumber, updatedAt: now })
    .onConflictDoUpdate({
      target: workerCounters.runId,
      set: {
        nextNumber: sql`${workerCounters.nextNumber} + 1`,
        updatedAt: now,
      },
    })
    .returning({ workerNumber: workerCounters.nextNumber })
    .get();

  if (!row?.workerNumber) {
    throw new Error("Unable to allocate worker id.");
  }

  return {
    workerId: `${runId}-worker-${row.workerNumber}`,
    workerNumber: row.workerNumber,
  };
}
