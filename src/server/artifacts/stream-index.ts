/**
 * Sparse seq→offset index alongside each JSONL artifact stream.
 *
 * For a stream `<stream>.jsonl`, we keep a companion `<stream>.jsonl.idx`
 * file with one JSON line per indexed entry: `{"seq": N, "offset": B}`.
 * An entry is appended whenever a record's seq is a multiple of
 * `INDEX_CADENCE`.
 *
 * The index is read-only opportunistic: every reader treats it as a
 * speed-up, never a source of truth. If it's missing, stale, or
 * corrupt, the reader falls back to the existing backward scan.
 *
 * Gzipped streams have no index — when a stream is compacted the index
 * is deleted. When the gzipped stream is expanded back to plaintext
 * the index is rebuilt by a single forward scan.
 */
import { promises as fs } from "node:fs";
import type { ArtifactStreamLocation } from "./append-only-store";

/**
 * One indexed entry every N records. Tunable per-stream if needed; the
 * default is conservative for ~hundreds-of-KB transcripts.
 */
export const INDEX_CADENCE = 100;

export interface IndexEntry {
  /** A record's seq. */
  seq: number;
  /** Byte offset where the line for `seq` starts in the plaintext .jsonl. */
  offset: number;
}

function indexPath(location: ArtifactStreamLocation): string {
  return `${location.filePath}.idx`;
}

/**
 * Append a single (seq, offset) row to the on-disk index. Best-effort
 * — if the index file is missing it's created. Errors are swallowed
 * because the index is never authoritative.
 */
export async function appendIndexEntry(
  location: ArtifactStreamLocation,
  entry: IndexEntry,
): Promise<void> {
  try {
    const line = `${JSON.stringify({ seq: entry.seq, offset: entry.offset })}\n`;
    await fs.appendFile(indexPath(location), line, "utf8");
  } catch {
    // Best-effort — losing the index just means slower tail reads
    // until the next compaction/rebuild.
  }
}

/**
 * Read and parse the on-disk index, sorted ascending by seq. Returns
 * `null` if the index is missing.
 */
export async function readIndex(location: ArtifactStreamLocation): Promise<IndexEntry[] | null> {
  let body: string;
  try {
    body = await fs.readFile(indexPath(location), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  const entries: IndexEntry[] = [];
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as Partial<IndexEntry>;
      const seq = typeof parsed.seq === "number" && Number.isFinite(parsed.seq) ? Math.floor(parsed.seq) : 0;
      const offset = typeof parsed.offset === "number" && Number.isFinite(parsed.offset) ? Math.floor(parsed.offset) : -1;
      if (seq > 0 && offset >= 0) {
        entries.push({ seq, offset });
      }
    } catch {
      // Skip malformed lines — partial writes can leave one bad line at
      // the tail; everything else stays usable.
    }
  }
  entries.sort((a, b) => a.seq - b.seq);
  return entries;
}

/**
 * Best (seq, offset) point at-or-before `targetSeq` in the index. Used
 * to find a seek point for "give me the last N records" reads.
 */
export function findIndexPointForSeq(index: IndexEntry[] | null, targetSeq: number): IndexEntry | null {
  if (!index || index.length === 0 || targetSeq <= 0) return null;
  // Linear is fine — INDEX_CADENCE=100 means even a 100K-entry stream
  // has only 1000 index points, and most callers want the tail.
  let best: IndexEntry | null = null;
  for (let i = index.length - 1; i >= 0; i -= 1) {
    if (index[i]!.seq <= targetSeq) {
      best = index[i]!;
      break;
    }
  }
  return best;
}

export async function deleteIndex(location: ArtifactStreamLocation): Promise<void> {
  try {
    await fs.unlink(indexPath(location));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

/**
 * Rebuild the index by scanning the plaintext file from the start.
 * Returns the number of index entries written. No-op if the file
 * doesn't exist.
 *
 * Always replaces an existing index — we don't try to repair partial
 * indices in place, just regenerate.
 */
export async function rebuildIndex(location: ArtifactStreamLocation): Promise<number> {
  let body: string;
  try {
    body = await fs.readFile(location.filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
    throw error;
  }
  const entries: IndexEntry[] = [];
  let cursor = 0;
  // Pre-encode buffer-length for offset accuracy. The file was appended
  // line-by-line as UTF-8 so cursor advance must use byte length.
  for (const line of body.split("\n")) {
    const lineLen = Buffer.byteLength(line, "utf8");
    const lineStart = cursor;
    cursor += lineLen + 1; // +1 for the "\n" delimiter we just split on
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as { seq?: unknown };
      const seq = typeof parsed.seq === "number" && Number.isFinite(parsed.seq) ? Math.floor(parsed.seq) : 0;
      if (seq > 0 && seq % INDEX_CADENCE === 0) {
        entries.push({ seq, offset: lineStart });
      }
    } catch {
      // Skip malformed lines; they don't get indexed.
    }
  }
  // Write atomically: tmp + rename so a concurrent reader never sees a
  // half-written index.
  const tmp = `${indexPath(location)}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tmp, entries.map((e) => `${JSON.stringify(e)}\n`).join(""), "utf8");
  await fs.rename(tmp, indexPath(location));
  return entries.length;
}

/**
 * Decide whether a freshly-appended record should also add an index
 * entry. Public so the bytes-layer append can call it cheaply.
 */
export function shouldIndex(seq: number): boolean {
  return seq > 0 && seq % INDEX_CADENCE === 0;
}
