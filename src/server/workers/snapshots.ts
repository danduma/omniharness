import { brotliCompressSync, brotliDecompressSync, constants as zlibConstants } from "node:zlib";
import { eq } from "drizzle-orm";
import type { AgentRecord } from "@/server/bridge-client";
import { db } from "@/server/db";
import { workers } from "@/server/db/schema";

type PersistableWorkerSnapshot = Pick<AgentRecord, "outputEntries" | "currentText" | "lastText">;

const COMPRESSED_OUTPUT_ENTRIES_PREFIX = "br:v1:";
const OUTPUT_ENTRIES_COMPRESSION_THRESHOLD_BYTES = 16_384;

export function serializeWorkerOutputEntries(
  outputEntries: AgentRecord["outputEntries"],
) {
  if (!Array.isArray(outputEntries) || outputEntries.length === 0) {
    return "";
  }

  try {
    const serialized = JSON.stringify(outputEntries);
    if (serialized.length < OUTPUT_ENTRIES_COMPRESSION_THRESHOLD_BYTES) {
      return serialized;
    }

    const compressed = brotliCompressSync(serialized, {
      params: {
        [zlibConstants.BROTLI_PARAM_QUALITY]: 4,
      },
    });
    return `${COMPRESSED_OUTPUT_ENTRIES_PREFIX}${compressed.toString("base64")}`;
  } catch {
    return "";
  }
}

function decodeWorkerOutputEntries(value: string) {
  if (!value.startsWith(COMPRESSED_OUTPUT_ENTRIES_PREFIX)) {
    return value;
  }

  const encoded = value.slice(COMPRESSED_OUTPUT_ENTRIES_PREFIX.length);
  return brotliDecompressSync(Buffer.from(encoded, "base64")).toString("utf8");
}

export function parseWorkerOutputEntries(value: string | null | undefined) {
  if (!value?.trim()) {
    return [] as NonNullable<AgentRecord["outputEntries"]>;
  }

  try {
    const parsed = JSON.parse(decodeWorkerOutputEntries(value.trim()));
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
