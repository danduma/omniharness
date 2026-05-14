import { promises as fs, existsSync } from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import type { AgentRecord } from "@/server/bridge-client";
import { getAppDataPath } from "@/server/app-root";

type OutputEntry = NonNullable<AgentRecord["outputEntries"]>[number];

const RUN_DATA_SUBDIR = "run-data";
const COMPRESSED_LEGACY_PREFIX = "br:v1:";
const RAW_HISTORY_LINE_LIMIT = 8;
const RAW_HISTORY_HEAD_LINES = 4;
const RAW_HISTORY_TAIL_LINES = 4;
const RAW_HISTORY_CHAR_LIMIT = 4_000;

function runDataDir() {
  return getAppDataPath(RUN_DATA_SUBDIR);
}

function runDir(runId: string) {
  return path.join(runDataDir(), runId);
}

function workerFilePath(runId: string, workerId: string) {
  return path.join(runDir(runId), `${workerId}.jsonl`);
}

function runArchivePath(runId: string) {
  return path.join(runDataDir(), `${runId}.zip`);
}

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
    Object.entries(value).map(([key, nested]) => [key, compactHistoryRawValue(nested)]),
  );
}

function compactEntryForHistory(entry: OutputEntry): OutputEntry {
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

const writeChainByKey = new Map<string, Promise<void>>();
let tmpCounter = 0;

export async function writeWorkerOutputEntries(
  runId: string,
  workerId: string,
  entries: AgentRecord["outputEntries"],
) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return;
  }
  const key = `${runId}/${workerId}`;
  const previous = writeChainByKey.get(key) ?? Promise.resolve();
  const next = previous.then(() => performWrite(runId, workerId, entries)).catch((error) => {
    throw error;
  });
  // Keep the chain alive even if this write rejects, so callers stay serialized.
  const tracked = next.catch(() => undefined);
  writeChainByKey.set(key, tracked);
  try {
    await next;
  } finally {
    if (writeChainByKey.get(key) === tracked) {
      writeChainByKey.delete(key);
    }
  }
}

async function performWrite(
  runId: string,
  workerId: string,
  entries: NonNullable<AgentRecord["outputEntries"]>,
) {
  const dir = runDir(runId);
  await fs.mkdir(dir, { recursive: true });
  const target = workerFilePath(runId, workerId);
  tmpCounter = (tmpCounter + 1) >>> 0;
  const tmp = `${target}.tmp-${process.pid}-${Date.now()}-${tmpCounter}`;
  const body = entries.map((entry) => JSON.stringify(compactEntryForHistory(entry))).join("\n") + "\n";
  try {
    await fs.writeFile(tmp, body, "utf8");
    await fs.rename(tmp, target);
  } catch (error) {
    fs.unlink(tmp).catch(() => undefined);
    throw error;
  }
}

function parseLines(body: string): OutputEntry[] {
  const out: OutputEntry[] = [];
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object") {
        out.push(parsed as OutputEntry);
      }
    } catch {
      // skip malformed line
    }
  }
  return out;
}

async function readFromArchive(runId: string, workerId: string): Promise<OutputEntry[]> {
  const archive = runArchivePath(runId);
  if (!existsSync(archive)) {
    return [];
  }
  try {
    const zip = new AdmZip(archive);
    const entry = zip.getEntry(`${runId}/${workerId}.jsonl`);
    if (!entry) {
      return [];
    }
    return parseLines(entry.getData().toString("utf8"));
  } catch {
    return [];
  }
}

async function readLegacyDbEntries(workerId: string): Promise<OutputEntry[]> {
  // Lazy import to avoid a circular dependency through @/server/db.
  const { db } = await import("@/server/db");
  const { workers } = await import("@/server/db/schema");
  const { eq } = await import("drizzle-orm");
  const row = await db
    .select({ outputEntriesJson: workers.outputEntriesJson })
    .from(workers)
    .where(eq(workers.id, workerId))
    .get();
  return parseLegacyOutputEntriesJson(row?.outputEntriesJson);
}

export async function readWorkerOutputEntries(
  runId: string,
  workerId: string,
): Promise<OutputEntry[]> {
  const filePath = workerFilePath(runId, workerId);
  try {
    const body = await fs.readFile(filePath, "utf8");
    return parseLines(body);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
  const archived = await readFromArchive(runId, workerId);
  if (archived.length > 0) {
    return archived;
  }
  return readLegacyDbEntries(workerId);
}

export function parseLegacyOutputEntriesJson(value: string | null | undefined): OutputEntry[] {
  if (!value?.trim()) {
    return [];
  }
  const trimmed = value.trim();
  try {
    if (trimmed.startsWith(COMPRESSED_LEGACY_PREFIX)) {
      // Decompress synchronously using zlib for the one-shot migration path.
      // We require this lazily to keep the hot path free of zlib import cost.
      const { brotliDecompressSync } = require("node:zlib") as typeof import("node:zlib");
      const decoded = brotliDecompressSync(Buffer.from(trimmed.slice(COMPRESSED_LEGACY_PREFIX.length), "base64")).toString("utf8");
      const parsed = JSON.parse(decoded);
      return Array.isArray(parsed) ? parsed as OutputEntry[] : [];
    }
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed as OutputEntry[] : [];
  } catch {
    return [];
  }
}

export async function archiveRunOutputs(runId: string): Promise<{ archived: boolean; archivePath?: string }> {
  const dir = runDir(runId);
  if (!existsSync(dir)) {
    return { archived: false };
  }
  const archive = runArchivePath(runId);
  const zip = new AdmZip();
  zip.addLocalFolder(dir, runId);
  await new Promise<void>((resolve, reject) => {
    zip.writeZip(archive, (error) => (error ? reject(error) : resolve()));
  });
  await fs.rm(dir, { recursive: true, force: true });
  return { archived: true, archivePath: archive };
}

export async function deleteWorkerOutputFile(runId: string, workerId: string) {
  try {
    await fs.unlink(workerFilePath(runId, workerId));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

export function workerOutputFilePathFor(runId: string, workerId: string) {
  return workerFilePath(runId, workerId);
}
