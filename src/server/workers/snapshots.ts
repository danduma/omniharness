import { eq } from "drizzle-orm";
import type { AgentRecord } from "@/server/bridge-client";
import { db } from "@/server/db";
import { workers } from "@/server/db/schema";
import {
  parseLegacyOutputEntriesJson,
  readWorkerOutputEntries,
  writeWorkerOutputEntries,
} from "@/server/workers/output-store";

type PersistableWorkerSnapshot = Pick<AgentRecord, "outputEntries" | "currentText" | "lastText">;

/**
 * Backward-compatible synchronous parser for legacy DB-stored JSON.
 * New code should call readWorkerOutputEntries(runId, workerId) instead.
 */
export function parseWorkerOutputEntries(value: string | null | undefined) {
  return parseLegacyOutputEntriesJson(value);
}

/**
 * Serializes for legacy callers that still need a single string blob (tests, exports).
 * The live persistence path no longer writes this to the DB.
 */
export function serializeWorkerOutputEntries(
  outputEntries: AgentRecord["outputEntries"],
) {
  if (!Array.isArray(outputEntries) || outputEntries.length === 0) {
    return "";
  }
  try {
    return JSON.stringify(outputEntries);
  } catch {
    return "";
  }
}

export async function persistWorkerSnapshot(
  workerId: string,
  snapshot: PersistableWorkerSnapshot,
) {
  const worker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
  if (!worker) {
    return;
  }

  if (Array.isArray(snapshot.outputEntries) && snapshot.outputEntries.length > 0) {
    await writeWorkerOutputEntries(worker.runId, workerId, snapshot.outputEntries);
  }
  await db.update(workers).set({
    currentText: snapshot.currentText,
    lastText: snapshot.lastText || worker.lastText,
    updatedAt: new Date(),
  }).where(eq(workers.id, workerId));
}

export { readWorkerOutputEntries };
