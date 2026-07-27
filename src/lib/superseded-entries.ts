/**
 * Superseded worker-stream ranges.
 *
 * "Retry from here" and "edit in place" rewind a conversation to an earlier
 * message: the messages after it are deleted and the message is re-delivered,
 * either to a fresh worker or to the same worker on a resumed ACP session. The
 * worker stream is append-only, so everything the abandoned attempt produced —
 * including the original copy of the re-delivered user message — stays on disk
 * and used to keep rendering. The transcript then showed the same user message
 * twice (once at its old position, above output it had already been rewound
 * past) and interleaved the discarded answers with the new ones.
 *
 * Recovery records the discarded seq range on the worker instead, and readers
 * skip those entries. Nothing is deleted; the raw stream stays intact.
 */

export type SupersededSeqRange = {
  /** First superseded seq, inclusive — the original delivery of the message. */
  from: number;
  /** Last superseded seq, inclusive — the stream tip when the rewind happened. */
  through: number;
};

function isUsableRange(range: SupersededSeqRange) {
  return Number.isFinite(range.from)
    && Number.isFinite(range.through)
    && range.from >= 1
    && range.through >= range.from;
}

export function parseSupersededSeqRanges(value: string | null | undefined): SupersededSeqRange[] {
  if (!value?.trim()) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) {
    return [];
  }
  const ranges = parsed.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) {
      return [];
    }
    const record = entry as { from?: unknown; through?: unknown };
    const range = {
      from: Math.floor(Number(record.from)),
      through: Math.floor(Number(record.through)),
    };
    return isUsableRange(range) ? [range] : [];
  });
  return mergeSupersededSeqRanges(ranges);
}

/** Sort and coalesce overlapping/adjacent ranges so the stored list stays small. */
export function mergeSupersededSeqRanges(ranges: SupersededSeqRange[]): SupersededSeqRange[] {
  const usable = ranges.filter(isUsableRange).sort((left, right) => left.from - right.from);
  const merged: SupersededSeqRange[] = [];
  for (const range of usable) {
    const previous = merged.at(-1);
    if (previous && range.from <= previous.through + 1) {
      previous.through = Math.max(previous.through, range.through);
      continue;
    }
    merged.push({ ...range });
  }
  return merged;
}

export function serializeSupersededSeqRanges(ranges: SupersededSeqRange[]): string | null {
  const merged = mergeSupersededSeqRanges(ranges);
  return merged.length > 0 ? JSON.stringify(merged) : null;
}

export function isSupersededSeq(seq: number | null | undefined, ranges: SupersededSeqRange[]) {
  if (typeof seq !== "number" || !Number.isFinite(seq)) {
    return false;
  }
  return ranges.some((range) => seq >= range.from && seq <= range.through);
}

/** Drop the entries that belong to a discarded branch. */
export function withoutSupersededEntries<T extends { seq?: number | null }>(
  entries: T[],
  ranges: SupersededSeqRange[],
): T[] {
  return ranges.length === 0 ? entries : entries.filter((entry) => !isSupersededSeq(entry.seq, ranges));
}
