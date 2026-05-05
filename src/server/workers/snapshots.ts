import { brotliCompressSync, brotliDecompressSync, constants as zlibConstants } from "node:zlib";
import { eq } from "drizzle-orm";
import type { AgentRecord } from "@/server/bridge-client";
import { db } from "@/server/db";
import { workers } from "@/server/db/schema";

type PersistableWorkerSnapshot = Pick<AgentRecord, "outputEntries" | "currentText" | "lastText">;

const COMPRESSED_OUTPUT_ENTRIES_PREFIX = "br:v1:";
const OUTPUT_ENTRIES_COMPRESSION_THRESHOLD_BYTES = 16_384;
const RAW_HISTORY_LINE_LIMIT = 8;
const RAW_HISTORY_HEAD_LINES = 4;
const RAW_HISTORY_TAIL_LINES = 4;
const RAW_HISTORY_CHAR_LIMIT = 4_000;

type WorkerOutputEntry = NonNullable<AgentRecord["outputEntries"]>[number];

function truncateHistoryStringByChars(value: string) {
  if (value.length <= RAW_HISTORY_CHAR_LIMIT) {
    return value;
  }

  const headLength = Math.floor(RAW_HISTORY_CHAR_LIMIT / 2);
  const tailLength = RAW_HISTORY_CHAR_LIMIT - headLength;
  return [
    value.slice(0, headLength),
    `[${value.length - RAW_HISTORY_CHAR_LIMIT} characters omitted from persisted command history]`,
    value.slice(-tailLength),
  ].join("\n");
}

function truncateHistoryString(value: string) {
  const lines = value.split(/\r?\n/);
  if (lines.length > RAW_HISTORY_LINE_LIMIT) {
    const omitted = lines.length - RAW_HISTORY_HEAD_LINES - RAW_HISTORY_TAIL_LINES;
    return truncateHistoryStringByChars([
      ...lines.slice(0, RAW_HISTORY_HEAD_LINES),
      `[${omitted} lines omitted from persisted command history]`,
      ...lines.slice(-RAW_HISTORY_TAIL_LINES),
    ].join("\n"));
  }

  return truncateHistoryStringByChars(value);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compactHistoryRawValue(value: unknown): unknown {
  if (typeof value === "string") {
    return truncateHistoryString(value);
  }

  if (Array.isArray(value)) {
    return value.map(compactHistoryRawValue);
  }

  if (!isPlainRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [
      key,
      compactHistoryRawValue(nestedValue),
    ]),
  );
}

function compactWorkerOutputEntryForHistory(entry: WorkerOutputEntry): WorkerOutputEntry {
  const text = entry.type === "tool_call" || entry.type === "tool_call_update"
    ? truncateHistoryString(entry.text)
    : entry.text;

  if (entry.raw === undefined && text === entry.text) {
    return entry;
  }

  return {
    ...entry,
    text,
    raw: entry.raw === undefined ? undefined : compactHistoryRawValue(entry.raw),
  };
}

function compactWorkerOutputEntriesForHistory(
  outputEntries: NonNullable<AgentRecord["outputEntries"]>,
) {
  return outputEntries.map(compactWorkerOutputEntryForHistory);
}

export function serializeWorkerOutputEntries(
  outputEntries: AgentRecord["outputEntries"],
) {
  if (!Array.isArray(outputEntries) || outputEntries.length === 0) {
    return "";
  }

  try {
    const serialized = JSON.stringify(compactWorkerOutputEntriesForHistory(outputEntries));
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
