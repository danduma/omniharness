import { eq } from "drizzle-orm";
import type { AgentRecord } from "@/server/bridge-client";
import { db } from "@/server/db";
import { workers } from "@/server/db/schema";

type PersistableWorkerSnapshot = Pick<AgentRecord, "outputEntries" | "currentText" | "lastText">;

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

export function parseWorkerOutputEntries(value: string | null | undefined) {
  if (!value?.trim()) {
    return [] as NonNullable<AgentRecord["outputEntries"]>;
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as NonNullable<AgentRecord["outputEntries"]> : [];
  } catch {
    return [];
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

  const serializedOutputEntries = serializeWorkerOutputEntries(snapshot.outputEntries);
  await db.update(workers).set({
    outputEntriesJson: serializedOutputEntries || worker.outputEntriesJson,
    currentText: snapshot.currentText,
    lastText: snapshot.lastText || worker.lastText,
    updatedAt: new Date(),
  }).where(eq(workers.id, workerId));
}
