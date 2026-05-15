import { promises as fs, existsSync } from "node:fs";
import path from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
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

const TERMINAL_WORKER_STATUSES = new Set([
  "completed",
  "failed",
  "cancelled",
  "canceled",
  "error",
  "stopped",
  "done",
]);

export const WORKER_COMPACTION_MIN_AGE_MS = 5 * 60 * 1000;

function runDataDir() {
  return getAppDataPath(RUN_DATA_SUBDIR);
}

function runDir(runId: string) {
  return path.join(runDataDir(), runId);
}

function workerFilePath(runId: string, workerId: string) {
  return path.join(runDir(runId), `${workerId}.jsonl`);
}

function workerCompressedFilePath(runId: string, workerId: string) {
  return `${workerFilePath(runId, workerId)}.gz`;
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
  // Worker is producing output again — expand a previously compacted file so
  // we don't strand history when we overwrite with the new snapshot.
  await expandWorkerOutputFile(runId, workerId);
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

async function readFromCompressedFile(runId: string, workerId: string): Promise<OutputEntry[]> {
  const compressed = workerCompressedFilePath(runId, workerId);
  try {
    const buf = await fs.readFile(compressed);
    return parseLines(gunzipSync(buf).toString("utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
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
  const compressed = await readFromCompressedFile(runId, workerId);
  if (compressed.length > 0) {
    return compressed;
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

async function compactWorkerOutputFile(runId: string, workerId: string): Promise<boolean> {
  const source = workerFilePath(runId, workerId);
  let body: Buffer;
  try {
    body = await fs.readFile(source);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
  const target = workerCompressedFilePath(runId, workerId);
  tmpCounter = (tmpCounter + 1) >>> 0;
  const tmp = `${target}.tmp-${process.pid}-${Date.now()}-${tmpCounter}`;
  const compressed = gzipSync(body);
  try {
    await fs.writeFile(tmp, compressed);
    await fs.rename(tmp, target);
  } catch (error) {
    fs.unlink(tmp).catch(() => undefined);
    throw error;
  }
  await fs.unlink(source).catch(() => undefined);
  return true;
}

async function expandWorkerOutputFile(runId: string, workerId: string): Promise<boolean> {
  const source = workerCompressedFilePath(runId, workerId);
  let body: Buffer;
  try {
    body = await fs.readFile(source);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
  const decompressed = gunzipSync(body);
  const target = workerFilePath(runId, workerId);
  tmpCounter = (tmpCounter + 1) >>> 0;
  const tmp = `${target}.tmp-${process.pid}-${Date.now()}-${tmpCounter}`;
  try {
    await fs.writeFile(tmp, decompressed);
    await fs.rename(tmp, target);
  } catch (error) {
    fs.unlink(tmp).catch(() => undefined);
    throw error;
  }
  await fs.unlink(source).catch(() => undefined);
  return true;
}

export async function compactRunOutputs(runId: string): Promise<{ compactedWorkerIds: string[] }> {
  const dir = runDir(runId);
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { compactedWorkerIds: [] };
    }
    throw error;
  }
  const compactedWorkerIds: string[] = [];
  for (const entry of entries) {
    if (!entry.endsWith(".jsonl")) continue;
    const workerId = entry.slice(0, -".jsonl".length);
    const ok = await compactWorkerOutputFile(runId, workerId);
    if (ok) compactedWorkerIds.push(workerId);
  }
  return { compactedWorkerIds };
}

/**
 * Per-worker gzip sweep. Compacts any plaintext `.jsonl` whose worker is in a
 * terminal status and whose file hasn't been touched for at least
 * `minAgeMs`. Idempotent — safe to call repeatedly.
 */
export async function compactStaleWorkerOutputs(options: {
  minAgeMs?: number;
  now?: number;
} = {}): Promise<{ compacted: Array<{ runId: string; workerId: string }> }> {
  const minAgeMs = options.minAgeMs ?? WORKER_COMPACTION_MIN_AGE_MS;
  const now = options.now ?? Date.now();
  const root = runDataDir();
  let runDirs: string[];
  try {
    runDirs = await fs.readdir(root);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { compacted: [] };
    }
    throw error;
  }

  const { db } = await import("@/server/db");
  const { workers } = await import("@/server/db/schema");
  const { inArray } = await import("drizzle-orm");

  // Collect candidate (runId, workerId) pairs from disk before hitting the DB.
  const candidates: Array<{ runId: string; workerId: string; filePath: string }> = [];
  for (const entry of runDirs) {
    const runPath = path.join(root, entry);
    let stat;
    try {
      stat = await fs.stat(runPath);
    } catch {
      continue;
    }
    if (!stat.isDirectory()) continue;
    let workerFiles: string[];
    try {
      workerFiles = await fs.readdir(runPath);
    } catch {
      continue;
    }
    for (const file of workerFiles) {
      if (!file.endsWith(".jsonl")) continue;
      const filePath = path.join(runPath, file);
      let fileStat;
      try {
        fileStat = await fs.stat(filePath);
      } catch {
        continue;
      }
      if (now - fileStat.mtimeMs < minAgeMs) continue;
      candidates.push({
        runId: entry,
        workerId: file.slice(0, -".jsonl".length),
        filePath,
      });
    }
  }

  if (candidates.length === 0) {
    return { compacted: [] };
  }

  const workerIds = candidates.map((c) => c.workerId);
  const rows = workerIds.length > 0
    ? await db.select({ id: workers.id, status: workers.status })
        .from(workers)
        .where(inArray(workers.id, workerIds))
    : [];
  const statusByWorker = new Map(rows.map((r) => [r.id, (r.status ?? "").toLowerCase()]));

  const compacted: Array<{ runId: string; workerId: string }> = [];
  for (const candidate of candidates) {
    const status = (statusByWorker.get(candidate.workerId) ?? "").split(":")[0]?.trim() ?? "";
    if (!TERMINAL_WORKER_STATUSES.has(status)) continue;
    try {
      const ok = await compactWorkerOutputFile(candidate.runId, candidate.workerId);
      if (ok) compacted.push({ runId: candidate.runId, workerId: candidate.workerId });
    } catch (error) {
      console.warn(
        `Failed to compact worker output ${candidate.runId}/${candidate.workerId}:`,
        error,
      );
    }
  }
  return { compacted };
}

export async function deleteWorkerOutputFile(runId: string, workerId: string) {
  for (const target of [workerFilePath(runId, workerId), workerCompressedFilePath(runId, workerId)]) {
    try {
      await fs.unlink(target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }
}

export function workerOutputFilePathFor(runId: string, workerId: string) {
  return workerFilePath(runId, workerId);
}
