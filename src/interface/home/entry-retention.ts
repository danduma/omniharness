/**
 * Retention policy for in-memory transcript windows.
 *
 * Both `WorkerEntriesManager` and `ConversationTranscriptManager` grow their
 * `entries` array on every forward fetch. A session that streams output for a
 * day accumulates tens of thousands of entries, all of which stay mounted in
 * the DOM and get rebuilt into activity items on every append. The tail limit
 * applied at hydration time does not help, because it is only consulted on
 * mount.
 *
 * The window is therefore garbage collected as it grows:
 *   - The newest `hotWindow` entries are always retained.
 *   - Scrolling back (a `loadOlder` call) marks the stream as recently
 *     accessed and raises the ceiling to `maxRetained` so that reading through
 *     history does not fight a collector that keeps dropping what was just
 *     fetched.
 *   - Once `scrollbackIdleMs` elapses with no further scrollback, the window
 *     collapses to `hotWindow` again. Live output arriving at the bottom is
 *     deliberately not an access signal: a session left streaming all day must
 *     still prune.
 *   - A stream with no subscribers is not on screen, so it collapses to
 *     `hotWindow` immediately rather than waiting out the idle timer.
 *
 * Trimming the head always implies `hasOlder`, since the dropped entries are
 * still on the server and scroll-back must be able to fetch them again.
 */

export interface EntryRetentionPolicy {
  /** Entries always kept, regardless of age or access. */
  hotWindow: number;
  /** Ceiling while scrollback is being actively used. */
  maxRetained: number;
  /** How long a scrollback keeps the ceiling raised. */
  scrollbackIdleMs: number;
}

export const DEFAULT_ENTRY_RETENTION: EntryRetentionPolicy = {
  hotWindow: 300,
  maxRetained: 2000,
  scrollbackIdleMs: 10 * 60 * 1000,
};

export interface RetainedCountInput {
  total: number;
  /** Timestamp of the last scroll-back load, or null if never. */
  lastScrollbackAt: number | null;
  now: number;
  /** False when nothing is rendering this stream. */
  isVisible: boolean;
  policy?: EntryRetentionPolicy;
}

/**
 * How many trailing entries should stay in memory. Never returns more than
 * `total`, so callers can compare against the current length to decide whether
 * a trim is needed at all.
 */
export function retainedEntryCount(input: RetainedCountInput): number {
  const policy = input.policy ?? DEFAULT_ENTRY_RETENTION;
  const ceiling = Math.max(policy.hotWindow, policy.maxRetained);
  const scrollbackIsRecent = input.isVisible
    && input.lastScrollbackAt !== null
    && input.now - input.lastScrollbackAt <= policy.scrollbackIdleMs;
  const allowance = scrollbackIsRecent ? ceiling : policy.hotWindow;
  return Math.min(input.total, allowance);
}

/**
 * Drop entries from the head so that at most `keep` remain. Returns the
 * original array reference when nothing is dropped, so that callers preserve
 * identity for memoized consumers.
 */
export function pruneEntryWindow<T>(entries: T[], keep: number): T[] {
  if (keep >= entries.length) {
    return entries;
  }
  return entries.slice(entries.length - Math.max(0, keep));
}
