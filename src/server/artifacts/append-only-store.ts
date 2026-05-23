/**
 * Shared bytes-level append-only artifact storage.
 *
 * Modelled on the worker output-store JSONL+gzip+lock pattern. Every
 * stream is identified by (runId, kind, ownerId) and lives at a
 * stream-relative path inside the run's artifact root. The bytes layer
 * knows about:
 *
 *   - JSONL append with a guard for crash-truncated tail lines
 *   - Per-stream serialization via an in-process write chain + an
 *     OS-visible lock directory (covers dev process restarts and
 *     parallel module instances)
 *   - Tail-scan reading with a parameterized line predicate so callers
 *     can terminate early on a cursor boundary
 *   - Gzip compaction of inactive streams to `<stream>.jsonl.gz`
 *   - Expanding `.jsonl.gz` back to plaintext on a fresh append
 *   - Read-side `(size, mtimeMs)` cache invariants so unchanged files
 *     return without I/O on repeat polls
 *
 * Domain semantics — entry dedup, history truncation, legacy DB
 * fallbacks, archive zips, schema-level normalization — live in the
 * per-domain adapter (e.g. worker output-store). This module is
 * deliberately ignorant of them.
 */
import { randomUUID } from "node:crypto";
import { promises as fs, existsSync } from "node:fs";
import path from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import {
  resolveArtifactRoot,
  resolveStreamPathWithin,
  type ArtifactRoot,
} from "./project-root";
import {
  ARTIFACT_STREAM_OWNER_NONE,
  normalizeArtifactOwnerId,
  type ArtifactStreamId,
} from "./stream-types";
import {
  appendIndexEntry,
  deleteIndex,
  findIndexPointForSeq,
  readIndex,
  rebuildIndex,
  shouldIndex,
} from "./stream-index";

// --- Tunables --------------------------------------------------------

const FILE_LOCK_STALE_MS = 30_000;
const FILE_LOCK_UPDATE_MS = 5_000;
const FILE_LOCK_RETRIES = 20;
const FILE_LOCK_MIN_TIMEOUT_MS = 25;
const FILE_LOCK_MAX_TIMEOUT_MS = 250;
const FILE_LOCK_FACTOR = 1.2;

// --- Public types ----------------------------------------------------

export interface ArtifactStreamLocation {
  /** Stream identity as stored in SQLite metadata. */
  id: ArtifactStreamId;
  /** Resolved artifact root (project-local or legacy global fallback). */
  root: ArtifactRoot;
  /**
   * Stream path *relative to the artifact root*. Stored in
   * `artifact_streams.relative_path`. Forward-slash separated for
   * portability across OSes that store the same SQLite file.
   */
  relativeStreamPath: string;
  /** Absolute path of the plaintext `.jsonl` file. */
  filePath: string;
  /** Absolute path of the gzipped variant `<stream>.jsonl.gz`. */
  compressedFilePath: string;
  /** Absolute path of the lock directory. */
  lockPath: string;
}

export interface AppendOptions {
  /** ID used to make the append idempotent. Re-appending the same id is a no-op. */
  recordId?: string | null;
}

export interface ReadEntriesSinceOptions {
  /** Maximum bytes to walk back from the file end. Default 1 MiB. */
  maxBytes?: number;
  /** Chunk size when reading the tail. Default 64 KiB. */
  chunkSize?: number;
}

// --- Path / identity helpers ----------------------------------------

export function streamRelativePath(id: ArtifactStreamId): string {
  switch (id.kind) {
    case "worker_entries": {
      const ownerId = id.ownerId?.trim();
      if (!ownerId) {
        throw new Error(`Worker artifact stream requires an ownerId (workerId).`);
      }
      return `workers/${ownerId}.jsonl`;
    }
    case "execution_events":
      return "execution-events.jsonl";
    case "supervisor_interventions":
      return "supervisor-interventions.jsonl";
    case "planning_review_findings":
      return "planning-review-findings.jsonl";
    default: {
      // Exhaustiveness guard.
      const _exhaustive: never = id.kind;
      throw new Error(`Unknown artifact stream kind: ${_exhaustive}`);
    }
  }
}

export async function resolveArtifactStreamLocation(
  args: {
    runId: string;
    kind: ArtifactStreamId["kind"];
    ownerId: string | null;
    projectPath: string | null | undefined;
  },
  mode: "read" | "write",
): Promise<ArtifactStreamLocation> {
  const id: ArtifactStreamId = {
    runId: args.runId,
    kind: args.kind,
    ownerId: args.ownerId,
  };
  const root = await resolveArtifactRoot({ runId: args.runId, projectPath: args.projectPath }, mode);
  const relativeStreamPath = streamRelativePath(id);
  const filePath = resolveStreamPathWithin(root, relativeStreamPath);
  const compressedFilePath = `${filePath}.gz`;
  const lockPath = `${filePath}.lock`;
  return { id, root, relativeStreamPath, filePath, compressedFilePath, lockPath };
}

// --- In-process write chain -----------------------------------------

const writeChainsByKey = new Map<string, Promise<void>>();

function chainKey(id: ArtifactStreamId) {
  const owner = normalizeArtifactOwnerId(id.ownerId);
  return `${id.kind}::${id.runId}::${owner === ARTIFACT_STREAM_OWNER_NONE ? "_" : owner}`;
}

export function runOnArtifactChain<T>(id: ArtifactStreamId, task: () => Promise<T>): Promise<T> {
  const key = chainKey(id);
  const previous = writeChainsByKey.get(key) ?? Promise.resolve();
  const next = previous.then(() => task());
  const tracked = next.then(() => undefined, () => undefined);
  writeChainsByKey.set(key, tracked);
  return next.finally(() => {
    if (writeChainsByKey.get(key) === tracked) {
      writeChainsByKey.delete(key);
    }
  });
}

// --- File lock (mkdir-based, OS-visible) ----------------------------

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fileLockDelay(attempt: number) {
  const delay = FILE_LOCK_MIN_TIMEOUT_MS * (FILE_LOCK_FACTOR ** attempt);
  return Math.min(Math.round(delay), FILE_LOCK_MAX_TIMEOUT_MS);
}

function isRecoverableLockRaceError(error: unknown) {
  const code = (error as NodeJS.ErrnoException).code;
  return code === "ENOENT" || code === "ENOTDIR";
}

async function isFileLockStale(lockPath: string) {
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
    return stat.mtimeMs < Date.now() - FILE_LOCK_STALE_MS;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return true;
    }
    throw error;
  }
}

async function acquireArtifactFileLock(lockPath: string): Promise<() => Promise<void>> {
  const ownerPath = path.join(lockPath, "owner.json");
  const ownerToken = randomUUID();
  const owner = JSON.stringify({
    token: ownerToken,
    pid: process.pid,
    createdAt: new Date().toISOString(),
  });

  for (let attempt = 0; attempt <= FILE_LOCK_RETRIES; attempt += 1) {
    try {
      await fs.mkdir(lockPath);
      try {
        await fs.writeFile(ownerPath, owner, "utf8");
      } catch (error) {
        await fs.rm(lockPath, { recursive: true, force: true });
        if (isRecoverableLockRaceError(error)) {
          continue;
        }
        throw error;
      }

      let released = false;
      const refresh = async () => {
        if (released) return;
        const now = new Date();
        await fs.utimes(lockPath, now, now);
        await fs.utimes(ownerPath, now, now);
      };
      const interval = setInterval(() => {
        void refresh().catch(() => {});
      }, FILE_LOCK_UPDATE_MS);
      interval.unref?.();

      return async () => {
        if (released) return;
        released = true;
        clearInterval(interval);
        try {
          const currentOwner = await fs.readFile(ownerPath, "utf8");
          if (currentOwner !== owner) return;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
          throw error;
        }
        await fs.rm(lockPath, { recursive: true, force: true });
      };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") throw error;

      if (await isFileLockStale(lockPath)) {
        await fs.rm(lockPath, { recursive: true, force: true });
        continue;
      }
      if (attempt === FILE_LOCK_RETRIES) {
        throw Object.assign(new Error(`Timed out waiting for artifact lock: ${lockPath}`), {
          code: "ELOCKED",
        });
      }
      await sleep(fileLockDelay(attempt));
    }
  }

  throw Object.assign(new Error(`Timed out waiting for artifact lock: ${lockPath}`), {
    code: "ELOCKED",
  });
}

export async function withArtifactFileLock<T>(location: ArtifactStreamLocation, task: () => Promise<T>): Promise<T> {
  await fs.mkdir(path.dirname(location.filePath), { recursive: true });
  // Atomic touch so a fresh stream has something to lock against.
  await fs.writeFile(location.filePath, "", { flag: "a" });
  const release = await acquireArtifactFileLock(location.lockPath);
  try {
    return await task();
  } finally {
    await release();
  }
}

// --- JSONL helpers --------------------------------------------------

export function parseJsonlLines<T>(body: string): T[] {
  const out: T[] = [];
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object") {
        out.push(parsed as T);
      }
    } catch {
      // Skip malformed (e.g. truncated last line after crash).
    }
  }
  return out;
}

export async function needsLeadingNewline(target: string): Promise<boolean> {
  try {
    const stat = await fs.stat(target);
    if (stat.size === 0) return false;
    const handle = await fs.open(target, "r");
    try {
      const buf = Buffer.alloc(1);
      await handle.read(buf, 0, 1, stat.size - 1);
      return buf[0] !== 0x0a;
    } finally {
      await handle.close();
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

// --- File-state cache for read-side short-circuit ------------------

interface FileStateSnapshot {
  size: number;
  mtimeMs: number;
}

export async function readFileState(filePath: string): Promise<FileStateSnapshot | null> {
  try {
    const s = await fs.stat(filePath);
    return { size: s.size, mtimeMs: s.mtimeMs };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

// --- Append --------------------------------------------------------

/**
 * Append one JSON-encoded record line to the stream. The caller is
 * responsible for assigning the record's `seq` and serializing the
 * JSON (so domain-specific shapes — e.g. the worker entry record vs
 * the run-level envelope — stay in adapters).
 *
 * When `seq` is provided, the bytes layer also maintains a sparse
 * companion `<stream>.jsonl.idx` (every INDEX_CADENCE'th seq → byte
 * offset) so tail-N reads can seek directly. The index is opportunistic
 * — readers must tolerate it being absent or stale.
 *
 * Acquires both the in-process chain and the on-disk lock.
 */
export async function appendArtifactLine(
  location: ArtifactStreamLocation,
  serializedLine: string,
  options: { seq?: number } = {},
): Promise<void> {
  await runOnArtifactChain(location.id, () =>
    withArtifactFileLock(location, async () => {
      // If a previous compaction stranded the plaintext under .gz, expand
      // back before appending so the new bytes are atomically appended to
      // the live transcript and not lost on the next read. expand() also
      // rebuilds the sparse index from scratch.
      await expandArtifactStreamInternal(location);

      const guard = await needsLeadingNewline(location.filePath);
      const line = serializedLine.endsWith("\n") ? serializedLine : `${serializedLine}\n`;
      const writePayload = guard ? `\n${line}` : line;

      // Capture the byte offset where the line *starts* — that's what
      // the index points to. After a guard newline we're one byte
      // further in.
      const preStat = await readFileState(location.filePath);
      const preSize = preStat?.size ?? 0;
      const lineStartOffset = preSize + (guard ? 1 : 0);

      const handle = await fs.open(location.filePath, "a");
      try {
        await handle.appendFile(writePayload, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }

      if (options.seq != null && shouldIndex(options.seq)) {
        await appendIndexEntry(location, { seq: options.seq, offset: lineStartOffset });
      }
    }),
  );
}

// --- Read: all entries ---------------------------------------------

/**
 * Return all records currently durable on disk (plaintext first, then
 * gzip fallback). Callers that need legacy fallbacks (archive zip, DB
 * column, project-local → legacy global) should layer them above this.
 */
export async function readAllArtifactEntries<T>(location: ArtifactStreamLocation): Promise<T[]> {
  try {
    const body = await fs.readFile(location.filePath, "utf8");
    if (body.trim()) {
      return parseJsonlLines<T>(body);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  try {
    const buf = await fs.readFile(location.compressedFilePath);
    return parseJsonlLines<T>(gunzipSync(buf).toString("utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

// --- Read: latest seq tail-scan ------------------------------------

export interface SeqExtractor<T> {
  (line: string): { parsed: T | null; seq: number };
}

const DEFAULT_MAX_TAIL_BYTES = 1024 * 1024;
const DEFAULT_CHUNK_BYTES = 64 * 1024;

/**
 * Walk the plaintext file backward chunk-by-chunk until the highest
 * monotonic seq is found. Returns `null` when the boundary cannot be
 * proven (legacy entry without seq, file is gzipped only, etc.) — the
 * caller should fall back to a full read.
 */
export async function readLatestSeqFromTail<T>(
  location: ArtifactStreamLocation,
  extractor: SeqExtractor<T>,
  options: ReadEntriesSinceOptions = {},
): Promise<number | null> {
  const state = await readFileState(location.filePath);
  if (!state || state.size <= 0) return null;

  const maxBytes = Math.min(state.size, options.maxBytes ?? DEFAULT_MAX_TAIL_BYTES);
  const chunkSize = Math.min(maxBytes, options.chunkSize ?? DEFAULT_CHUNK_BYTES);
  const handle = await fs.open(location.filePath, "r");
  try {
    let offset = state.size;
    let tail = "";
    while (offset > 0 && Buffer.byteLength(tail, "utf8") < maxBytes) {
      const readSize = Math.min(chunkSize, offset);
      offset -= readSize;
      const buffer = Buffer.alloc(readSize);
      await handle.read(buffer, 0, readSize, offset);
      tail = buffer.toString("utf8") + tail;

      const lines = tail.split("\n");
      const firstLineIndex = offset === 0 ? 0 : 1;
      for (let i = lines.length - 1; i >= firstLineIndex; i -= 1) {
        const trimmed = lines[i]?.trim();
        if (!trimmed) continue;
        const { seq } = extractor(trimmed);
        if (seq > 0) return seq;
        // A non-positive seq is the cursor boundary signal — the
        // adapter decides whether to treat that as "bail to full read".
        // Returning null here keeps that policy in one place.
        return null;
      }
    }
    return null;
  } finally {
    await handle.close();
  }
}

/**
 * Walk the plaintext tail and collect records whose seq is strictly
 * greater than `afterSeq`, in ascending order. Returns `null` to signal
 * the caller should fall back to a full read (e.g. a non-monotonic
 * line was encountered before the boundary).
 */
export async function readEntriesSinceTail<T>(
  location: ArtifactStreamLocation,
  afterSeq: number,
  extractor: SeqExtractor<T>,
  options: ReadEntriesSinceOptions = {},
): Promise<{ entries: T[]; latestSeq: number } | null> {
  const state = await readFileState(location.filePath);
  if (!state || state.size <= 0) return null;

  const maxBytes = Math.min(state.size, options.maxBytes ?? DEFAULT_MAX_TAIL_BYTES);
  const chunkSize = Math.min(maxBytes, options.chunkSize ?? DEFAULT_CHUNK_BYTES);
  const handle = await fs.open(location.filePath, "r");
  try {
    let offset = state.size;
    let tail = "";
    while (offset > 0 && Buffer.byteLength(tail, "utf8") < maxBytes) {
      const readSize = Math.min(chunkSize, offset);
      offset -= readSize;
      const buffer = Buffer.alloc(readSize);
      await handle.read(buffer, 0, readSize, offset);
      tail = buffer.toString("utf8") + tail;

      const result = collectSinceInTail<T>(tail, offset === 0, afterSeq, extractor);
      if (result.complete) {
        return { entries: result.entries, latestSeq: result.latestSeq };
      }
    }
    return null;
  } finally {
    await handle.close();
  }
}

function collectSinceInTail<T>(
  text: string,
  includesFileStart: boolean,
  afterSeq: number,
  extractor: SeqExtractor<T>,
) {
  const lines = text.split("\n");
  const firstLineIndex = includesFileStart ? 0 : 1;
  const entries: T[] = [];
  let latestSeq = 0;

  for (let i = lines.length - 1; i >= firstLineIndex; i -= 1) {
    const trimmed = lines[i]?.trim();
    if (!trimmed) continue;
    const { parsed, seq } = extractor(trimmed);
    if (seq <= 0 || parsed === null) {
      // Cursor boundary unprovable from the tail; caller falls back.
      return { complete: false, entries: [], latestSeq: 0 };
    }
    if (latestSeq === 0) latestSeq = seq;
    if (seq <= afterSeq) {
      entries.reverse();
      return { complete: true, entries, latestSeq };
    }
    entries.push(parsed);
  }
  if (includesFileStart) {
    entries.reverse();
    return { complete: true, entries, latestSeq };
  }
  return { complete: false, entries: [], latestSeq: 0 };
}

// --- Compaction ----------------------------------------------------

let tmpCounter = 0;

async function expandArtifactStreamInternal(location: ArtifactStreamLocation): Promise<boolean> {
  let body: Buffer;
  try {
    body = await fs.readFile(location.compressedFilePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
  const decompressed = gunzipSync(body);
  tmpCounter = (tmpCounter + 1) >>> 0;
  const tmp = `${location.filePath}.tmp-${process.pid}-${Date.now()}-${tmpCounter}`;
  try {
    await fs.writeFile(tmp, decompressed);
    await fs.rename(tmp, location.filePath);
  } catch (error) {
    fs.unlink(tmp).catch(() => undefined);
    throw error;
  }
  await fs.unlink(location.compressedFilePath).catch(() => undefined);
  // The index was deleted on compact; rebuild it now that the plaintext
  // is back. Failure here is non-fatal — readers fall back to scan.
  try {
    await rebuildIndex(location);
  } catch {
    /* best-effort */
  }
  return true;
}

async function compactArtifactStreamInternal(location: ArtifactStreamLocation): Promise<boolean> {
  let body: Buffer;
  try {
    body = await fs.readFile(location.filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
  tmpCounter = (tmpCounter + 1) >>> 0;
  const tmp = `${location.compressedFilePath}.tmp-${process.pid}-${Date.now()}-${tmpCounter}`;
  const compressed = gzipSync(body);
  try {
    await fs.writeFile(tmp, compressed);
    await fs.rename(tmp, location.compressedFilePath);
  } catch (error) {
    fs.unlink(tmp).catch(() => undefined);
    throw error;
  }
  await fs.unlink(location.filePath).catch(() => undefined);
  // Index offsets are into the plaintext file that no longer exists.
  await deleteIndex(location);
  return true;
}

/** Public compact entry point — acquires chain + lock. */
export async function compactArtifactStream(location: ArtifactStreamLocation): Promise<boolean> {
  return runOnArtifactChain(location.id, () => {
    if (!existsSync(location.filePath)) return Promise.resolve(false);
    return withArtifactFileLock(location, () => compactArtifactStreamInternal(location));
  });
}

/** Public expand entry point — acquires chain + lock. */
export async function expandArtifactStream(location: ArtifactStreamLocation): Promise<boolean> {
  return runOnArtifactChain(location.id, () =>
    withArtifactFileLock(location, () => expandArtifactStreamInternal(location)),
  );
}

// --- Delete --------------------------------------------------------

export async function deleteArtifactStreamFiles(location: ArtifactStreamLocation): Promise<void> {
  await runOnArtifactChain(location.id, () =>
    withArtifactFileLock(location, async () => {
      for (const target of [location.filePath, location.compressedFilePath]) {
        try {
          await fs.unlink(target);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
      }
      await deleteIndex(location);
    }),
  );
}

// --- Index-aware tail-N read ---------------------------------------

/**
 * Read the last `limit` entries from the plaintext stream using the
 * sparse index when available. Falls back to `null` when the boundary
 * can't be proven from a fast seek (no index, stale index, legacy
 * pre-seq lines in the indexed region, gzipped-only stream).
 *
 * Callers can fall back to the slower backward chunk scan in that case.
 */
export async function readEntriesTailWithIndex<T>(
  location: ArtifactStreamLocation,
  latestSeq: number,
  limit: number,
  parseEnvelope: (line: string) => T | null,
): Promise<T[] | null> {
  if (limit <= 0 || latestSeq <= 0) return [];

  const index = await readIndex(location);
  // Want the largest indexed seq strictly below (latestSeq - limit + 1).
  // That gives us a seek point from which we can scan forward and still
  // collect at least `limit` records (plus a few extras we discard).
  const targetSeq = Math.max(1, latestSeq - limit);
  const seekPoint = findIndexPointForSeq(index, targetSeq);
  if (!seekPoint) return null;

  const fileState = await readFileState(location.filePath);
  if (!fileState || fileState.size <= seekPoint.offset) return null;

  // Read everything from the seek point to EOF in one shot. For a 250K
  // file with index every 100 records this is at most ~30K bytes of
  // forward read — a single sequential I/O.
  const handle = await fs.open(location.filePath, "r");
  let text: string;
  try {
    const readLength = fileState.size - seekPoint.offset;
    const buffer = Buffer.alloc(readLength);
    await handle.read(buffer, 0, readLength, seekPoint.offset);
    text = buffer.toString("utf8");
  } finally {
    await handle.close();
  }

  // First line in `text` is the record whose offset is seekPoint.offset
  // (i.e. seq === seekPoint.seq). Parse forward and keep the last
  // `limit` records.
  const entries: T[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parsed = parseEnvelope(trimmed);
    if (parsed === null) continue;
    entries.push(parsed);
  }
  if (entries.length === 0) return null;
  return entries.length > limit ? entries.slice(-limit) : entries;
}
