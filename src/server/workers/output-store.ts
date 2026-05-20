import { randomUUID } from "node:crypto";
import { promises as fs, existsSync } from "node:fs";
import path from "node:path";
import { brotliDecompressSync, gzipSync, gunzipSync } from "node:zlib";
import AdmZip from "adm-zip";
import type { AgentOutputEntry } from "@/lib/agent-output";
import type { AgentRecord } from "@/server/bridge-client";
import { getAppDataPath } from "@/server/app-root";
import { emitNamedEvent } from "@/server/events/named-events";
import type {
  WorkerEntry,
} from "@/server/workers/entries-types";

type OutputEntry = WorkerEntry;

const RUN_DATA_SUBDIR = "run-data";
const COMPRESSED_LEGACY_PREFIX = "br:v1:";
const RAW_HISTORY_LINE_LIMIT = 8;
const RAW_HISTORY_HEAD_LINES = 4;
const RAW_HISTORY_TAIL_LINES = 4;
const RAW_HISTORY_CHAR_LIMIT = 4_000;
const WORKER_FILE_LOCK_STALE_MS = 30_000;
const WORKER_FILE_LOCK_UPDATE_MS = 5_000;
const WORKER_FILE_LOCK_RETRIES = 20;
const WORKER_FILE_LOCK_MIN_TIMEOUT_MS = 25;
const WORKER_FILE_LOCK_MAX_TIMEOUT_MS = 250;
const WORKER_FILE_LOCK_FACTOR = 1.2;

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

function workerFileLockPath(runId: string, workerId: string) {
  return `${workerFilePath(runId, workerId)}.lock`;
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

const DIFF_CONTEXT_LINES = 3;
const DIFF_SIDE_CHAR_LIMIT = 4_000;

// Edit tool payloads arrive as { type: "diff", oldText, newText, path }
// where oldText/newText are typically the full pre/post file contents. The
// generic head+tail truncation in truncateHistoryString collapses both sides
// to byte-identical strings when the divergence sits in the middle of a
// large file — so the frontend then sees oldText === newText and renders no
// diff pane at all. Strip the common leading and trailing lines before
// truncation so the persisted oldText/newText retain their actual
// divergence, with a few lines of context on each side.
function compressDiffContentPair(record: Record<string, unknown>): Record<string, unknown> | null {
  const type = typeof record.type === "string" ? record.type : null;
  if (type !== "diff" && type !== "modify") {
    return null;
  }
  const oldText = typeof record.oldText === "string" ? record.oldText : null;
  const newText = typeof record.newText === "string" ? record.newText : null;
  if (oldText == null || newText == null || oldText === newText) {
    return null;
  }

  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const maxPrefix = Math.min(oldLines.length, newLines.length);
  let prefix = 0;
  while (prefix < maxPrefix && oldLines[prefix] === newLines[prefix]) {
    prefix += 1;
  }
  const remainingOld = oldLines.length - prefix;
  const remainingNew = newLines.length - prefix;
  let suffix = 0;
  const maxSuffix = Math.min(remainingOld, remainingNew);
  while (
    suffix < maxSuffix
    && oldLines[oldLines.length - 1 - suffix] === newLines[newLines.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  // Always take this path when oldText !== newText. The previous shortcut
  // that returned null for short prefix/suffix sent us into the generic
  // truncateHistoryString fallback, which is a line-count head+tail
  // truncator — when the divergent region sits in the middle of a long
  // file it gets dropped and both sides collapse to byte-identical
  // strings, erasing the diff signal.

  const droppedPrefix = Math.max(0, prefix - DIFF_CONTEXT_LINES);
  const droppedSuffix = Math.max(0, suffix - DIFF_CONTEXT_LINES);
  const keptPrefix = prefix - droppedPrefix;
  const keptSuffix = suffix - droppedSuffix;

  const headLines = oldLines.slice(prefix - keptPrefix, prefix);
  const tailLines = oldLines.slice(oldLines.length - suffix, oldLines.length - suffix + keptSuffix);
  const oldMiddleLines = oldLines.slice(prefix, oldLines.length - suffix);
  const newMiddleLines = newLines.slice(prefix, newLines.length - suffix);

  const headPrefixMarker = droppedPrefix > 0 ? `[${droppedPrefix} unchanged lines omitted]` : null;
  const tailSuffixMarker = droppedSuffix > 0 ? `[${droppedSuffix} unchanged lines omitted]` : null;
  const before = [
    ...(headPrefixMarker ? [headPrefixMarker] : []),
    ...headLines,
  ].join("\n");
  const after = [
    ...tailLines,
    ...(tailSuffixMarker ? [tailSuffixMarker] : []),
  ].join("\n");

  const oldMiddle = oldMiddleLines.join("\n");
  const newMiddle = newMiddleLines.join("\n");

  const fixedOverhead = before.length + (before ? 1 : 0) + (after ? 1 : 0) + after.length;

  // Character-level common prefix/suffix between the two middles. After
  // line-level prefix/suffix have been stripped, the divergent region
  // still often sits inside one long line (think: minified JS, JSON
  // dumps, single-line edits). Treating the middle as opaque text and
  // truncating its head+tail can chop the divergent slice out entirely
  // and leave both sides byte-identical. Pin the truncation around the
  // divergent slice itself.
  const middleCommonLimit = Math.min(oldMiddle.length, newMiddle.length);
  let middleCommonPrefix = 0;
  while (
    middleCommonPrefix < middleCommonLimit
    && oldMiddle.charCodeAt(middleCommonPrefix) === newMiddle.charCodeAt(middleCommonPrefix)
  ) {
    middleCommonPrefix += 1;
  }
  let middleCommonSuffix = 0;
  const maxMiddleSuffix = middleCommonLimit - middleCommonPrefix;
  while (
    middleCommonSuffix < maxMiddleSuffix
    && oldMiddle.charCodeAt(oldMiddle.length - 1 - middleCommonSuffix)
      === newMiddle.charCodeAt(newMiddle.length - 1 - middleCommonSuffix)
  ) {
    middleCommonSuffix += 1;
  }

  function shrink(middle: string) {
    const middleBudget = Math.max(0, DIFF_SIDE_CHAR_LIMIT - fixedOverhead);
    if (middle.length <= middleBudget) {
      return joinParts([before, middle, after]);
    }

    const divergentStart = Math.max(0, middleCommonPrefix - 32);
    const divergentEnd = Math.min(middle.length, middle.length - middleCommonSuffix + 32);
    const divergent = middle.slice(divergentStart, divergentEnd);

    if (divergent.length <= middleBudget) {
      // Anchor the truncation on the divergent slice itself, with a
      // little surrounding context. Both sides keep the bytes that
      // actually differ, so the diff signal survives.
      const surroundingBudget = middleBudget - divergent.length;
      const leadingBudget = Math.floor(surroundingBudget / 2);
      const trailingBudget = surroundingBudget - leadingBudget;
      const leading = middle.slice(Math.max(0, divergentStart - leadingBudget), divergentStart);
      const trailing = middle.slice(divergentEnd, divergentEnd + trailingBudget);
      const leadingOmitted = divergentStart - leading.length;
      const trailingOmitted = (middle.length - divergentEnd) - trailing.length;
      const segments = [
        leadingOmitted > 0 ? `[${leadingOmitted} characters omitted before divergent region]` : null,
        leading + divergent + trailing,
        trailingOmitted > 0 ? `[${trailingOmitted} characters omitted after divergent region]` : null,
      ].filter((segment): segment is string => Boolean(segment));
      return joinParts([before, segments.join("\n"), after]);
    }

    // The divergent slice itself outruns the budget. Keep its head and
    // tail so both sides still differ — each half is taken from the same
    // anchor offsets in old and new middles, so as long as those bytes
    // disagree the two sides do too.
    const half = Math.max(40, Math.floor(middleBudget / 2));
    const headSlice = divergent.slice(0, half);
    const tailSlice = divergent.slice(-half);
    const omittedInside = divergent.length - headSlice.length - tailSlice.length;
    return joinParts([
      before,
      [
        divergentStart > 0
          ? `[${divergentStart} characters omitted before divergent region]`
          : null,
        headSlice,
        omittedInside > 0
          ? `[${omittedInside} characters omitted from divergent region]`
          : null,
        tailSlice,
        (middle.length - divergentEnd) > 0
          ? `[${middle.length - divergentEnd} characters omitted after divergent region]`
          : null,
      ].filter((segment): segment is string => Boolean(segment)).join("\n"),
      after,
    ]);
  }

  return {
    ...record,
    oldText: shrink(oldMiddle),
    newText: shrink(newMiddle),
    __diffCompressed: true,
  };
}

function joinParts(parts: Array<string | null | undefined>) {
  return parts.filter((part): part is string => typeof part === "string" && part.length > 0).join("\n");
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
  const compressed = compressDiffContentPair(value);
  if (compressed) {
    // oldText/newText have already been compacted with diff-aware logic
    // that preserves their divergence. Skipping the generic per-string
    // truncator on those two fields is required — line-based truncation
    // would re-collapse them to identical head/tail strings and erase the
    // diff signal.
    return Object.fromEntries(
      Object.entries(compressed)
        .filter(([key]) => key !== "__diffCompressed")
        .map(([key, nested]) => (
          key === "oldText" || key === "newText"
            ? [key, nested]
            : [key, compactHistoryRawValue(nested)]
        )),
    );
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [key, compactHistoryRawValue(nested)]),
  );
}

type CompactableEntry = {
  type?: string;
  text?: string;
  raw?: unknown;
  [key: string]: unknown;
};

function compactEntryForHistory<T extends CompactableEntry>(entry: T): T {
  const text = (entry.type === "tool_call" || entry.type === "tool_call_update") && typeof entry.text === "string"
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

// ---------------------------------------------------------------------------
// Per-worker write chain.
//
// Mutating operations on `${runId}/${workerId}` files acquire both an
// in-process chain and an OS-visible lock. The chain keeps local callers
// ordered; the file lock covers Next/server module instances and dev
// process boundaries. Bridge entry deduplication depends on this because
// every writer must re-read the current transcript before assigning seqs.
// ---------------------------------------------------------------------------

const writeChainByKey = new Map<string, Promise<void>>();
let tmpCounter = 0;

// Cache of the next-seq to assign per (runId, workerId). Filled lazily on
// first append by reading existing entries. Kept valid by comparing file
// stat before each chained write so normal streaming appends do not parse
// the whole transcript every tick.
const nextSeqByKey = new Map<string, number>();
// Read-side cache: maps a (runId, workerId) to its latest persisted seq,
// pinned to the file's (size, mtimeMs). On a read we stat the file once;
// if the stat matches the pinned values, we return the cached seq without
// opening the file. Writes happen in a separate bridge process, so this
// cache cannot piggyback on nextSeqByKey — but the stat-based invariant
// catches any external writer's append correctly.
const readLatestSeqByKey = new Map<string, { latestSeq: number; size: number; mtimeMs: number }>();
// Same shape but for the full parsed entries list. Used by
// readWorkerEntriesSince to skip read+parse when (size, mtimeMs) matches.
// The entries list also lets us filter by afterSeq in memory, so even an
// afterSeq=0 first-load is served from this cache after the initial read.
const readEntriesByKey = new Map<string, { entries: WorkerEntry[]; latestSeq: number; size: number; mtimeMs: number }>();
// Cache of bridge entry ids that have already been written, used to make
// append-from-snapshot idempotent. Built lazily from the file on first
// use and updated on every successful append.
const seenIdsByKey = new Map<string, Set<string>>();
const fingerprintsByKey = new Map<string, Map<string, string>>();
const fileStateByKey = new Map<string, { size: number; mtimeMs: number }>();
let chainCacheDiskRefreshesForTests = 0;

function chainKey(runId: string, workerId: string) {
  return `${runId}/${workerId}`;
}

function runOnChain<T>(runId: string, workerId: string, task: () => Promise<T>): Promise<T> {
  const key = chainKey(runId, workerId);
  const previous = writeChainByKey.get(key) ?? Promise.resolve();
  const next = previous.then(() => task());
  const tracked = next.then(() => undefined, () => undefined);
  writeChainByKey.set(key, tracked);
  return next.finally(() => {
    if (writeChainByKey.get(key) === tracked) {
      writeChainByKey.delete(key);
    }
  });
}

function clearChainCaches(runId: string, workerId: string) {
  const key = chainKey(runId, workerId);
  nextSeqByKey.delete(key);
  seenIdsByKey.delete(key);
  fingerprintsByKey.delete(key);
  fileStateByKey.delete(key);
  readLatestSeqByKey.delete(key);
  readEntriesByKey.delete(key);
}

function workerFileLockDelay(attempt: number) {
  const delay = WORKER_FILE_LOCK_MIN_TIMEOUT_MS * (WORKER_FILE_LOCK_FACTOR ** attempt);
  return Math.min(Math.round(delay), WORKER_FILE_LOCK_MAX_TIMEOUT_MS);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isWorkerFileLockStale(lockPath: string) {
  try {
    const stat = await fs.stat(lockPath);
    try {
      await fs.access(path.join(lockPath, "owner.json"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return true;
      }
      throw error;
    }
    return stat.mtimeMs < Date.now() - WORKER_FILE_LOCK_STALE_MS;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function acquireWorkerFileLock(runId: string, workerId: string): Promise<() => Promise<void>> {
  const lockPath = workerFileLockPath(runId, workerId);
  const ownerPath = path.join(lockPath, "owner.json");
  const ownerToken = randomUUID();
  const owner = JSON.stringify({
    token: ownerToken,
    pid: process.pid,
    createdAt: new Date().toISOString(),
  });

  for (let attempt = 0; attempt <= WORKER_FILE_LOCK_RETRIES; attempt += 1) {
    try {
      await fs.mkdir(lockPath);
      try {
        await fs.writeFile(ownerPath, owner, "utf8");
      } catch (error) {
        await fs.rm(lockPath, { recursive: true, force: true });
        throw error;
      }

      let released = false;
      const refresh = async () => {
        if (released) {
          return;
        }
        const now = new Date();
        await fs.utimes(lockPath, now, now);
        await fs.utimes(ownerPath, now, now);
      };
      const interval = setInterval(() => {
        void refresh().catch(() => {});
      }, WORKER_FILE_LOCK_UPDATE_MS);
      interval.unref?.();

      return async () => {
        if (released) {
          return;
        }
        released = true;
        clearInterval(interval);
        try {
          const currentOwner = await fs.readFile(ownerPath, "utf8");
          if (currentOwner !== owner) {
            return;
          }
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            return;
          }
          throw error;
        }
        await fs.rm(lockPath, { recursive: true, force: true });
      };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") {
        throw error;
      }

      if (await isWorkerFileLockStale(lockPath)) {
        await fs.rm(lockPath, { recursive: true, force: true });
        continue;
      }

      if (attempt === WORKER_FILE_LOCK_RETRIES) {
        throw Object.assign(new Error(`Timed out waiting for worker output lock: ${lockPath}`), {
          code: "ELOCKED",
        });
      }

      await sleep(workerFileLockDelay(attempt));
    }
  }

  throw Object.assign(new Error(`Timed out waiting for worker output lock: ${lockPath}`), {
    code: "ELOCKED",
  });
}

async function withWorkerFileLock<T>(
  runId: string,
  workerId: string,
  task: () => Promise<T>,
): Promise<T> {
  const dir = runDir(runId);
  await fs.mkdir(dir, { recursive: true });
  const target = workerFilePath(runId, workerId);
  // Appending an empty string with `a` is an atomic touch.
  await fs.writeFile(target, "", { flag: "a" });
  const release = await acquireWorkerFileLock(runId, workerId);
  try {
    return await task();
  } finally {
    await release();
  }
}

async function readWorkerFileState(runId: string, workerId: string) {
  try {
    const stat = await fs.stat(workerFilePath(runId, workerId));
    return { size: stat.size, mtimeMs: stat.mtimeMs };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { size: 0, mtimeMs: 0 };
    }
    throw error;
  }
}

async function refreshChainCaches(runId: string, workerId: string): Promise<{ nextSeq: number; seen: Set<string>; fingerprints: Map<string, string> }> {
  const key = chainKey(runId, workerId);
  const currentFileState = await readWorkerFileState(runId, workerId);
  const cachedNextSeq = nextSeqByKey.get(key);
  const cachedSeen = seenIdsByKey.get(key);
  const cachedFingerprints = fingerprintsByKey.get(key);
  const cachedFileState = fileStateByKey.get(key);
  if (
    cachedNextSeq !== undefined
    && cachedSeen
    && cachedFingerprints
    && cachedFileState
    && cachedFileState.size === currentFileState.size
    && cachedFileState.mtimeMs === currentFileState.mtimeMs
  ) {
    return {
      nextSeq: cachedNextSeq,
      seen: cachedSeen,
      fingerprints: cachedFingerprints,
    };
  }

  chainCacheDiskRefreshesForTests += 1;
  const existing = await readCanonicalPersistedEntries(runId, workerId);
  let maxSeq = 0;
  const seen = new Set<string>();
  const fingerprints = new Map<string, string>();
  for (const entry of existing) {
    if (typeof entry.id === "string" && entry.id) {
      seen.add(entry.id);
      fingerprints.set(entry.id, workerEntryFingerprint(entry));
    }
    if (typeof entry.seq === "number" && Number.isFinite(entry.seq) && entry.seq > maxSeq) {
      maxSeq = entry.seq;
    }
  }
  const nextSeq = maxSeq + 1;
  nextSeqByKey.set(key, nextSeq);
  seenIdsByKey.set(key, seen);
  fingerprintsByKey.set(key, fingerprints);
  fileStateByKey.set(key, await readWorkerFileState(runId, workerId));
  return { nextSeq, seen, fingerprints };
}

async function rememberWorkerFileState(runId: string, workerId: string) {
  fileStateByKey.set(chainKey(runId, workerId), await readWorkerFileState(runId, workerId));
}

async function readAllPersistedEntries(runId: string, workerId: string): Promise<WorkerEntry[]> {
  // Mirrors readWorkerOutputEntries's plaintext-first fallback chain but
  // returns the raw on-disk shape (WorkerEntry-ish — seq may be absent on
  // legacy lines; that's fine since the writer treats missing seq as 0).
  const filePath = workerFilePath(runId, workerId);
  try {
    const body = await fs.readFile(filePath, "utf8");
    const parsed = parseWorkerEntryLines(body);
    if (body.trim() || parsed.length > 0) {
      return parsed;
    }
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

/**
 * Append a single worker entry to the JSONL file. The writer assigns
 * `seq` from the in-memory cursor (seeded from the file tail on first
 * use). Acquires the per-worker chain so it cannot interleave with
 * compaction/expand/delete.
 *
 * If `entry.id` is already present on disk (or in the seen-ids cache),
 * the call is a no-op and the previously persisted entry is returned
 * with `appended: false` so wake-up publishers do not re-announce old seqs.
 */
export type AppendWorkerEntryResult = {
  entry: WorkerEntry;
  appended: boolean;
};

export async function appendWorkerEntryWithResult(
  runId: string,
  workerId: string,
  entry: Omit<WorkerEntry, "seq">,
): Promise<AppendWorkerEntryResult> {
  return runOnChain(runId, workerId, async () => {
    return withWorkerFileLock(runId, workerId, async () => {
      // If a compaction race somehow stranded the plaintext file under .gz,
      // expand it first so cache refresh sees the live transcript rather
      // than the lock-created empty placeholder.
      await expandWorkerOutputFileInternal(runId, workerId);

      const { nextSeq, seen, fingerprints } = await refreshChainCaches(runId, workerId);
      if (entry.id && seen.has(entry.id)) {
        // Already persisted; load it back so the caller has a stable
        // record. Linear scan is fine: this is the dedup path and runs at
        // append cadence, not read cadence.
        const persisted = await readCanonicalPersistedEntries(runId, workerId);
        const match = persisted.find((line) => line.id === entry.id);
        if (match && typeof match.seq === "number") {
          return { entry: match, appended: false };
        }
        // Legacy line without seq: assign one virtually based on file
        // position. The writer doesn't advance nextSeq in this case.
        return { entry: { ...(entry as WorkerEntry), seq: 0 }, appended: false };
      }

      const persistedEntry: WorkerEntry = {
        ...(entry as WorkerEntry),
        seq: nextSeq,
      };
      const compact = compactEntryForHistory(persistedEntry as unknown as CompactableEntry) as unknown as WorkerEntry;
      const line = JSON.stringify(compact) + "\n";

      const target = workerFilePath(runId, workerId);
      const newlineGuard = await needsLeadingNewline(target);
      const handle = await fs.open(target, "a");
      try {
        await handle.appendFile(newlineGuard ? "\n" + line : line, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }

      if (entry.id) {
        seen.add(entry.id);
        fingerprints.set(entry.id, workerEntryFingerprint(compact));
      }
      nextSeqByKey.set(chainKey(runId, workerId), nextSeq + 1);
      await rememberWorkerFileState(runId, workerId);
      return { entry: compact, appended: true };
    });
  });
}

export async function appendWorkerEntry(
  runId: string,
  workerId: string,
  entry: Omit<WorkerEntry, "seq">,
): Promise<WorkerEntry> {
  return (await appendWorkerEntryWithResult(runId, workerId, entry)).entry;
}

/**
 * Diff-and-append a batch of bridge-emitted output entries. Exact
 * replays are skipped, but changed records with the same bridge id are
 * appended as revisions. Streaming assistant prose can arrive first as
 * "One" and later as the complete paragraph; the append-only stream must
 * publish that later revision with a fresh seq so clients repaint.
 *
 * Existing callers (`persistWorkerSnapshot`) get the same observable
 * behavior as the old overwrite-on-snapshot path with no file rewrite.
 */
export async function writeWorkerOutputEntries(
  runId: string,
  workerId: string,
  entries: AgentRecord["outputEntries"],
) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return;
  }

  await runOnChain(runId, workerId, async () => {
    await withWorkerFileLock(runId, workerId, async () => {
      await expandWorkerOutputFileInternal(runId, workerId);

      const { fingerprints } = await refreshChainCaches(runId, workerId);
      const newEntries: AgentOutputEntry[] = [];
      const acceptedFingerprintsById = new Map<string, string>();
      for (const entry of entries) {
        if (!entry) continue;
        // Real bridge entries always carry an id; tooling/migration code that
        // hands us synthetic snapshots may not. In that case, treat the entry
        // as opaque and always append (no dedup possible).
        const id = typeof entry.id === "string" && entry.id ? entry.id : null;
        if (id) {
          const fingerprint = bridgeOutputEntryFingerprint(entry);
          if (
            fingerprints.get(id) === fingerprint
            || acceptedFingerprintsById.get(id) === fingerprint
          ) {
            continue;
          }
          acceptedFingerprintsById.set(id, fingerprint);
        }
        newEntries.push(entry);
      }
      if (newEntries.length === 0) {
        return;
      }

      const key = chainKey(runId, workerId);
      let nextSeq = nextSeqByKey.get(key);
      if (nextSeq === undefined) {
        // refreshChainCaches just populated it; refuse to silently lose entries.
        throw new Error(`writeWorkerOutputEntries: missing nextSeq for ${key}`);
      }

      const target = workerFilePath(runId, workerId);
      const newlineGuard = await needsLeadingNewline(target);

      const lines: string[] = [];
      const appendedEntries: WorkerEntry[] = [];
      for (const entry of newEntries) {
        const id = typeof entry.id === "string" && entry.id ? entry.id : `synthetic-${nextSeq}`;
        // Preserve input shape: spread the entry first, then layer on
        // id/seq. Adding null placeholders for absent optional fields
        // would change the on-disk shape callers expect to round-trip.
        const promoted = {
          ...(entry as unknown as Record<string, unknown>),
          id,
          seq: nextSeq,
        };
        const compact = compactEntryForHistory(promoted as unknown as CompactableEntry) as unknown as WorkerEntry;
        lines.push(JSON.stringify(compact));
        appendedEntries.push(compact);
        fingerprints.set(id, workerEntryFingerprint(compact));
        nextSeq += 1;
      }
      const body = lines.join("\n") + "\n";

      const handle = await fs.open(target, "a");
      try {
        await handle.appendFile(newlineGuard ? "\n" + body : body, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }
      nextSeqByKey.set(key, nextSeq);
      await rememberWorkerFileState(runId, workerId);
      for (const entry of appendedEntries) {
        if (typeof entry.seq === "number" && Number.isFinite(entry.seq) && entry.seq > 0) {
          emitNamedEvent({
            kind: "worker.entry_appended",
            runId,
            workerId,
            seq: entry.seq,
          });
        }
      }
    });
  });
}

/**
 * If the file ends with bytes that are not a newline (e.g. a previous
 * append was truncated mid-line by a crash), the next append must start
 * with a newline so the truncated line stays a separate broken line
 * rather than being concatenated to our new JSON object. `parseWorkerEntryLines`
 * already tolerates malformed lines, so isolating the broken bytes is
 * enough to recover.
 */
async function needsLeadingNewline(target: string): Promise<boolean> {
  try {
    const stat = await fs.stat(target);
    if (stat.size === 0) {
      return false;
    }
    const handle = await fs.open(target, "r");
    try {
      const buf = Buffer.alloc(1);
      await handle.read(buf, 0, 1, stat.size - 1);
      return buf[0] !== 0x0a;
    } finally {
      await handle.close();
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

function parseWorkerEntryLines(body: string): WorkerEntry[] {
  const out: WorkerEntry[] = [];
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object") {
        out.push(parsed as WorkerEntry);
      }
    } catch {
      // skip malformed line (e.g. truncated last line after crash)
    }
  }
  return out;
}

async function readFromCompressedFile(runId: string, workerId: string): Promise<WorkerEntry[]> {
  const compressed = workerCompressedFilePath(runId, workerId);
  try {
    const buf = await fs.readFile(compressed);
    return parseWorkerEntryLines(gunzipSync(buf).toString("utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function readFromArchive(runId: string, workerId: string): Promise<WorkerEntry[]> {
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
    return parseWorkerEntryLines(entry.getData().toString("utf8"));
  } catch {
    return [];
  }
}

async function readLegacyDbEntries(workerId: string): Promise<WorkerEntry[]> {
  // Lazy import to avoid a circular dependency through @/server/db.
  const { db } = await import("@/server/db");
  const { workers } = await import("@/server/db/schema");
  const { eq } = await import("drizzle-orm");
  const row = await db
    .select({ outputEntriesJson: workers.outputEntriesJson })
    .from(workers)
    .where(eq(workers.id, workerId))
    .get();
  return parseLegacyOutputEntriesJson(row?.outputEntriesJson) as unknown as WorkerEntry[];
}

/**
 * Read all worker entries. Legacy entries without `seq` are assigned
 * monotonic virtual seqs in file order in-memory only — the file is not
 * rewritten on read. The first compaction sweep that touches the file
 * will persist the assigned seqs.
 */
export async function readWorkerOutputEntries(
  runId: string,
  workerId: string,
): Promise<OutputEntry[]> {
  const entries = await readCanonicalPersistedEntries(runId, workerId);
  return entries as unknown as OutputEntry[];
}

/**
 * Read entries with seq strictly greater than `afterSeq`. Returns the
 * latest persisted seq so the caller can advance its cursor even when
 * the returned list is empty (e.g. a wake-up arrived but the on-disk
 * tail hadn't actually changed yet).
 */
export async function readWorkerEntriesSince(
  runId: string,
  workerId: string,
  afterSeq: number,
): Promise<{ entries: WorkerEntry[]; latestSeq: number }> {
  const key = chainKey(runId, workerId);
  const filePath = workerFilePath(runId, workerId);

  // Authoritative in-process cursor: if afterSeq is already at-or-past
  // nextSeq-1, the client is caught up and no FS access is needed. See
  // readWorkerLatestSeq for the same invariant.
  const nextSeq = nextSeqByKey.get(key);
  if (afterSeq > 0 && nextSeq !== undefined && nextSeq > 0 && afterSeq >= nextSeq - 1) {
    return { entries: [], latestSeq: nextSeq - 1 };
  }

  // Stat the plaintext .jsonl up front. ENOENT here means we'll fall back
  // to compressed/legacy paths inside readCanonicalPersistedEntries and
  // can't validate the entries cache against an mtime, so skip the cache
  // entirely in that case.
  let stat: { size: number; mtimeMs: number } | null = null;
  try {
    const s = await fs.stat(filePath);
    stat = { size: s.size, mtimeMs: s.mtimeMs };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  if (stat) {
    const cached = readEntriesByKey.get(key);
    if (cached && cached.size === stat.size && cached.mtimeMs === stat.mtimeMs) {
      // File hasn't moved since we parsed it — serve from memory.
      // Trim allocation when the caller is already caught up so we don't
      // churn the GC on every snapshot poll.
      if (afterSeq > 0 && cached.latestSeq <= afterSeq) {
        return { entries: [], latestSeq: cached.latestSeq };
      }
      const filtered = afterSeq <= 0
        ? cached.entries
        : cached.entries.filter((entry) => typeof entry.seq === "number" && entry.seq > afterSeq);
      return { entries: filtered, latestSeq: cached.latestSeq };
    }
  }

  if (afterSeq > 0) {
    const fromJsonlTail = await readWorkerEntriesSinceJsonlTail(runId, workerId, afterSeq);
    if (fromJsonlTail) {
      // Tail-scan only gives us a partial entries list (those > afterSeq),
      // so we can't populate the full-entries cache here. Bump the seq
      // cache for the snapshot path's benefit.
      if (stat) {
        readLatestSeqByKey.set(key, {
          latestSeq: fromJsonlTail.latestSeq,
          size: stat.size,
          mtimeMs: stat.mtimeMs,
        });
      }
      return fromJsonlTail;
    }
  }

  const withSeqs = await readCanonicalPersistedEntries(runId, workerId);
  let latestSeq = 0;
  for (const entry of withSeqs) {
    if (typeof entry.seq === "number" && entry.seq > latestSeq) {
      latestSeq = entry.seq;
    }
  }
  if (stat) {
    readEntriesByKey.set(key, {
      entries: withSeqs,
      latestSeq,
      size: stat.size,
      mtimeMs: stat.mtimeMs,
    });
    readLatestSeqByKey.set(key, { latestSeq, size: stat.size, mtimeMs: stat.mtimeMs });
  }
  const filtered = afterSeq <= 0
    ? withSeqs
    : withSeqs.filter((entry) => typeof entry.seq === "number" && entry.seq > afterSeq);
  return { entries: filtered, latestSeq };
}

/**
 * Read the last `limit` entries (in seq order) and the file's latest seq.
 * Uses the same backward chunk-scan as readWorkerEntriesSinceJsonlTail —
 * for an active worker streaming output we only touch the tail of the
 * file, not the whole transcript.
 *
 * Returns null when the file doesn't exist or the tail-scan can't prove
 * its boundary (e.g. legacy lines without seq). Caller falls back to the
 * canonical full read.
 */
export async function readWorkerEntriesTail(
  runId: string,
  workerId: string,
  limit: number,
): Promise<{ entries: WorkerEntry[]; latestSeq: number; hasOlder: boolean } | null> {
  if (limit <= 0) {
    return { entries: [], latestSeq: 0, hasOlder: true };
  }
  return readWorkerEntriesTailJsonl(runId, workerId, limit);
}

async function readWorkerEntriesTailJsonl(
  runId: string,
  workerId: string,
  limit: number,
): Promise<{ entries: WorkerEntry[]; latestSeq: number; hasOlder: boolean } | null> {
  const filePath = workerFilePath(runId, workerId);
  let size = 0;
  try {
    size = (await fs.stat(filePath)).size;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
  if (size <= 0) {
    return { entries: [], latestSeq: 0, hasOlder: false };
  }

  const maxBytes = Math.min(size, 4 * 1024 * 1024);
  const chunkSize = Math.min(maxBytes, 64 * 1024);
  const handle = await fs.open(filePath, "r");
  try {
    let offset = size;
    let tail = "";
    while (offset > 0 && Buffer.byteLength(tail, "utf8") < maxBytes) {
      const readSize = Math.min(chunkSize, offset);
      offset -= readSize;
      const buffer = Buffer.alloc(readSize);
      await handle.read(buffer, 0, readSize, offset);
      tail = buffer.toString("utf8") + tail;

      const parsed = entriesTailInJsonlText(tail, offset === 0, limit);
      if (parsed === "incomplete") {
        continue;
      }
      return parsed;
    }
    return null;
  } finally {
    await handle.close();
  }
}

function entriesTailInJsonlText(
  text: string,
  includesFileStart: boolean,
  limit: number,
): { entries: WorkerEntry[]; latestSeq: number; hasOlder: boolean } | "incomplete" {
  const lines = text.split("\n");
  const firstLineIndex = includesFileStart ? 0 : 1;
  const entries: WorkerEntry[] = [];
  let latestSeq = 0;

  for (let index = lines.length - 1; index >= firstLineIndex; index -= 1) {
    const trimmed = lines[index]?.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as WorkerEntry;
      const seq = typeof parsed.seq === "number" && Number.isFinite(parsed.seq)
        ? Math.floor(parsed.seq)
        : 0;
      if (seq <= 0) {
        // Legacy line without seq — boundary can't be proven from the tail.
        return "incomplete";
      }
      if (latestSeq === 0) latestSeq = seq;
      entries.push(parsed);
      if (entries.length >= limit) {
        entries.reverse();
        const lowestSeq = entries[0]?.seq;
        return {
          entries,
          latestSeq,
          // hasOlder iff there's at least one more durable line before
          // the first kept entry — we don't know for sure here unless we
          // saw the file start, so we conservatively assume there is.
          hasOlder: !includesFileStart || (typeof lowestSeq === "number" && lowestSeq > 1),
        };
      }
    } catch {
      // Last line may be a partial write after a crash. Tolerate that
      // single tail malformed line; treat any earlier malformed line as
      // proof we cannot disambiguate the cursor and bail.
      if (index !== lines.length - 1) {
        return "incomplete";
      }
    }
  }

  if (includesFileStart) {
    entries.reverse();
    return { entries, latestSeq, hasOlder: false };
  }
  return "incomplete";
}

/**
 * Read up to `limit` entries with seq strictly less than `beforeSeq`,
 * along with the file's latest seq and whether older entries remain on
 * disk. Used to hydrate scroll-back without re-reading the prefix the
 * client already has.
 */
export async function readWorkerEntriesBefore(
  runId: string,
  workerId: string,
  beforeSeq: number,
  limit: number,
): Promise<{ entries: WorkerEntry[]; latestSeq: number; hasOlder: boolean }> {
  if (limit <= 0 || beforeSeq <= 1) {
    return { entries: [], latestSeq: 0, hasOlder: false };
  }
  // No clever shortcut: the older range may not be in the tail window, so
  // we read the full canonical entries (using the existing cache) and
  // filter. The readEntriesByKey cache makes repeated scroll-back cheap.
  const all = await readCanonicalPersistedEntries(runId, workerId);
  let latestSeq = 0;
  for (const entry of all) {
    if (typeof entry.seq === "number" && entry.seq > latestSeq) {
      latestSeq = entry.seq;
    }
  }
  const older = all.filter((entry) => typeof entry.seq === "number" && entry.seq < beforeSeq);
  const slice = older.slice(Math.max(0, older.length - limit));
  const lowestKeptSeq = slice[0]?.seq;
  const hasOlder = older.length > slice.length || (typeof lowestKeptSeq === "number" && lowestKeptSeq > 1);
  return { entries: slice, latestSeq, hasOlder };
}

async function readWorkerEntriesSinceJsonlTail(
  runId: string,
  workerId: string,
  afterSeq: number,
): Promise<{ entries: WorkerEntry[]; latestSeq: number } | null> {
  const filePath = workerFilePath(runId, workerId);
  let size = 0;
  try {
    size = (await fs.stat(filePath)).size;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
  if (size <= 0) {
    return null;
  }

  const maxBytes = Math.min(size, 1024 * 1024);
  const chunkSize = Math.min(maxBytes, 64 * 1024);
  const handle = await fs.open(filePath, "r");
  try {
    let offset = size;
    let tail = "";
    while (offset > 0 && Buffer.byteLength(tail, "utf8") < maxBytes) {
      const readSize = Math.min(chunkSize, offset);
      offset -= readSize;
      const buffer = Buffer.alloc(readSize);
      await handle.read(buffer, 0, readSize, offset);
      tail = buffer.toString("utf8") + tail;

      const parsed = entriesSinceInJsonlText(tail, offset === 0, afterSeq);
      if (parsed.complete) {
        return {
          entries: parsed.entries,
          latestSeq: parsed.latestSeq,
        };
      }
    }
    return null;
  } finally {
    await handle.close();
  }
}

function entriesSinceInJsonlText(text: string, includesFileStart: boolean, afterSeq: number) {
  const lines = text.split("\n");
  const firstLineIndex = includesFileStart ? 0 : 1;
  const entries: WorkerEntry[] = [];
  let latestSeq = 0;

  for (let index = lines.length - 1; index >= firstLineIndex; index -= 1) {
    const trimmed = lines[index]?.trim();
    if (!trimmed) {
      continue;
    }
    try {
      const parsed = JSON.parse(trimmed) as WorkerEntry;
      const seq = typeof parsed.seq === "number" && Number.isFinite(parsed.seq)
        ? Math.floor(parsed.seq)
        : 0;
      if (seq <= 0) {
        return { complete: false, entries: [], latestSeq: 0 };
      }
      latestSeq = Math.max(latestSeq, seq);
      if (seq <= afterSeq) {
        entries.reverse();
        return { complete: true, entries, latestSeq };
      }
      entries.push(parsed);
    } catch {
      // Last line can be truncated after a crash. Older malformed lines
      // are unusual; if we cannot prove the cursor boundary, fall back.
      if (index !== lines.length - 1) {
        return { complete: false, entries: [], latestSeq: 0 };
      }
    }
  }

  if (includesFileStart) {
    entries.reverse();
    return { complete: true, entries, latestSeq };
  }
  return { complete: false, entries: [], latestSeq: 0 };
}

/**
 * Return the latest durable worker-entry sequence number without loading
 * the whole transcript in the common JSONL case. Snapshot/bootstrap routes
 * only need this cursor hint; full content is fetched via
 * `readWorkerEntriesSince`.
 */
export async function readWorkerLatestSeq(
  runId: string,
  workerId: string,
): Promise<number> {
  const key = chainKey(runId, workerId);

  // Authoritative in-process cursor: every append in this process bumps
  // nextSeqByKey. If it's set, the latest persisted seq is nextSeq - 1
  // and no FS access is required. All writers to these files live in
  // the same Node process as this reader (see writeWorkerOutputEntries
  // call sites — sync.ts, snapshots.ts, recovery-reconciler.ts), so
  // this cache cannot fall behind disk.
  const nextSeq = nextSeqByKey.get(key);
  if (nextSeq !== undefined && nextSeq > 0) {
    return nextSeq - 1;
  }

  const filePath = workerFilePath(runId, workerId);
  let statForCache: { size: number; mtimeMs: number } | null = null;
  try {
    const stat = await fs.stat(filePath);
    statForCache = { size: stat.size, mtimeMs: stat.mtimeMs };
    const cached = readLatestSeqByKey.get(key);
    if (cached && cached.size === stat.size && cached.mtimeMs === stat.mtimeMs) {
      return cached.latestSeq;
    }
    if (stat.size > 0) {
      const seq = await readLatestSeqFromJsonlTail(filePath, stat.size);
      if (seq !== null) {
        readLatestSeqByKey.set(key, { latestSeq: seq, size: stat.size, mtimeMs: stat.mtimeMs });
        return seq;
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  const entries = await readCanonicalPersistedEntries(runId, workerId);
  let latestSeq = 0;
  for (const entry of entries) {
    if (typeof entry.seq === "number" && Number.isFinite(entry.seq) && entry.seq > latestSeq) {
      latestSeq = entry.seq;
    }
  }
  if (statForCache) {
    readLatestSeqByKey.set(key, { latestSeq, size: statForCache.size, mtimeMs: statForCache.mtimeMs });
  }
  return latestSeq;
}

async function readLatestSeqFromJsonlTail(filePath: string, size: number): Promise<number | null> {
  const maxBytes = Math.min(size, 1024 * 1024);
  const chunkSize = Math.min(maxBytes, 64 * 1024);
  const handle = await fs.open(filePath, "r");
  try {
    let offset = size;
    let tail = "";
    while (offset > 0 && Buffer.byteLength(tail, "utf8") < maxBytes) {
      const readSize = Math.min(chunkSize, offset);
      offset -= readSize;
      const buffer = Buffer.alloc(readSize);
      await handle.read(buffer, 0, readSize, offset);
      tail = buffer.toString("utf8") + tail;

      const seq = latestSeqInJsonlText(tail, offset === 0);
      if (seq !== null) {
        return seq;
      }
    }
    return null;
  } finally {
    await handle.close();
  }
}

function latestSeqInJsonlText(text: string, includesFileStart: boolean): number | null {
  const lines = text.split("\n");
  const firstLineIndex = includesFileStart ? 0 : 1;
  for (let index = lines.length - 1; index >= firstLineIndex; index -= 1) {
    const trimmed = lines[index]?.trim();
    if (!trimmed) {
      continue;
    }
    try {
      const parsed = JSON.parse(trimmed) as { seq?: unknown };
      const seq = typeof parsed.seq === "number" && Number.isFinite(parsed.seq)
        ? Math.floor(parsed.seq)
        : 0;
      if (seq > 0) {
        return seq;
      }
      return null;
    } catch {
      // The last line may be a partial write after a crash. Keep walking
      // backward for the latest complete entry.
    }
  }
  return null;
}

async function readCanonicalPersistedEntries(runId: string, workerId: string): Promise<WorkerEntry[]> {
  return normalizePersistedEntries(await readAllPersistedEntries(runId, workerId));
}

function normalizePersistedEntries(entries: WorkerEntry[]): WorkerEntry[] {
  const deduped = dedupePersistedEntries(entries);
  return normalizeWorkerEntrySeqs(deduped);
}

function workerEntryFingerprint(entry: unknown): string {
  if (!isPlainRecord(entry)) {
    return JSON.stringify(entry);
  }
  const { seq: _seq, ...rest } = entry;
  return JSON.stringify(rest);
}

function bridgeOutputEntryFingerprint(entry: AgentOutputEntry): string {
  const compact = compactEntryForHistory({
    ...(entry as unknown as Record<string, unknown>),
    seq: 0,
  } as unknown as CompactableEntry);
  return workerEntryFingerprint(compact);
}

function dedupePersistedEntries(entries: WorkerEntry[]): WorkerEntry[] {
  const seenFingerprints = new Set<string>();
  const out: WorkerEntry[] = [];
  for (const entry of entries) {
    const fingerprint = workerEntryFingerprint(entry);
    if (seenFingerprints.has(fingerprint)) {
      continue;
    }
    seenFingerprints.add(fingerprint);
    out.push(entry);
  }
  return out;
}

function normalizeWorkerEntrySeqs(entries: WorkerEntry[]): WorkerEntry[] {
  let previousSeq = 0;
  let needsRewrite = false;
  for (const entry of entries) {
    if (
      typeof entry.seq !== "number"
      || !Number.isFinite(entry.seq)
      || entry.seq <= previousSeq
    ) {
      needsRewrite = true;
      break;
    }
    previousSeq = entry.seq;
  }
  if (!needsRewrite) {
    return entries;
  }
  return entries.map((entry, index) => ({ ...entry, seq: index + 1 }));
}

export function parseLegacyOutputEntriesJson(value: string | null | undefined): OutputEntry[] {
  if (!value?.trim()) {
    return [];
  }
  const trimmed = value.trim();
  try {
    if (trimmed.startsWith(COMPRESSED_LEGACY_PREFIX)) {
      // Decompress synchronously using zlib for the one-shot migration path.
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

async function compactWorkerOutputFileInternal(runId: string, workerId: string): Promise<boolean> {
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
  // Rewrite the on-disk lines with their resolved seqs so legacy
  // pre-seq entries pick up durable sequence numbers in the gzip.
  const parsed = parseWorkerEntryLines(body.toString("utf8"));
  const withSeqs = normalizePersistedEntries(parsed);
  const normalizedBody = Buffer.from(withSeqs.map((entry) => JSON.stringify(entry)).join("\n") + (withSeqs.length > 0 ? "\n" : ""), "utf8");

  const target = workerCompressedFilePath(runId, workerId);
  tmpCounter = (tmpCounter + 1) >>> 0;
  const tmp = `${target}.tmp-${process.pid}-${Date.now()}-${tmpCounter}`;
  const compressed = gzipSync(normalizedBody);
  try {
    await fs.writeFile(tmp, compressed);
    await fs.rename(tmp, target);
  } catch (error) {
    fs.unlink(tmp).catch(() => undefined);
    throw error;
  }
  await fs.unlink(source).catch(() => undefined);
  // Caches stay valid: compaction preserves seqs and ids; the file just
  // moves from .jsonl to .gz. Caller holds the per-worker chain so no
  // append is concurrent with this move.
  return true;
}

async function expandWorkerOutputFileInternal(runId: string, workerId: string): Promise<boolean> {
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
  // Caches stay valid: the bytes are the same, only the file shape changed.
  return true;
}

export async function compactWorkerOutputFile(runId: string, workerId: string): Promise<boolean> {
  return runOnChain(runId, workerId, async () => {
    if (!existsSync(workerFilePath(runId, workerId))) {
      return false;
    }
    return withWorkerFileLock(runId, workerId, () => compactWorkerOutputFileInternal(runId, workerId));
  });
}

export async function expandWorkerOutputFile(runId: string, workerId: string): Promise<boolean> {
  return runOnChain(runId, workerId, () =>
    withWorkerFileLock(runId, workerId, () => expandWorkerOutputFileInternal(runId, workerId)));
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
 *
 * Acquires the per-worker write chain before touching each file. An
 * earlier version of this sweep mutated files outside the chain, which
 * could drop an append racing the rename; that latent loss bug is fixed
 * here.
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
  const rows: Array<{ id: string; status: string }> = workerIds.length > 0
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
  await runOnChain(runId, workerId, async () => {
    await withWorkerFileLock(runId, workerId, async () => {
      for (const target of [workerFilePath(runId, workerId), workerCompressedFilePath(runId, workerId)]) {
        try {
          await fs.unlink(target);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
            throw error;
          }
        }
      }
      clearChainCaches(runId, workerId);
    });
  });
}

export function workerOutputFilePathFor(runId: string, workerId: string) {
  return workerFilePath(runId, workerId);
}

/** @internal — vitest only */
export function __resetOutputStoreCachesForTests() {
  writeChainByKey.clear();
  nextSeqByKey.clear();
  seenIdsByKey.clear();
  fingerprintsByKey.clear();
  fileStateByKey.clear();
  readLatestSeqByKey.clear();
  readEntriesByKey.clear();
  chainCacheDiskRefreshesForTests = 0;
}

/** @internal — vitest only */
export function __getOutputStoreCacheStatsForTests() {
  return {
    workerCacheCount: nextSeqByKey.size,
    diskRefreshCount: chainCacheDiskRefreshesForTests,
  };
}
