/**
 * Single source of truth for the unified worker conversation stream on
 * the frontend.
 *
 * Per (workerId) we hold a contiguous *window* [lowestSeq..latestContiguousSeq]:
 *   - entries: the contiguous window in seq order, never with gaps.
 *   - lowestSeq: the lowest seq currently in `entries` (0 if empty).
 *   - latestContiguousSeq: the highest seq we have proven contiguous
 *     from lowestSeq. Used as the cursor for forward refetch.
 *   - latestKnownSeq: the highest seq the server has told us exists.
 *     Updates immediately on a wake-up frame; the fetch fills the gap.
 *   - hasOlder: true if older entries exist on the server before
 *     lowestSeq. Set by initial tail-load and `loadOlder`.
 *   - status: "idle" → "loading" → "loaded"; "error" on a fetch failure.
 *
 * Initial load fetches the last N entries via `?limit=N`. Forward
 * extension uses `?afterSeq=latestContiguousSeq`. Backward hydration
 * uses `?beforeSeq=lowestSeq&limit=N` via `loadOlder`.
 *
 * SSE frames carry only `{ workerId, seq }` — the content is fetched
 * via the HTTP endpoint. The frame is a wake-up hint; we never trust
 * it as the entry payload.
 */
import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { WorkerEntry } from "@/server/workers/entries-types";
import { requestJson as defaultRequestJson } from "@/lib/app-errors";

type JsonRequester = typeof defaultRequestJson;
type WorkerEntryStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const DEFAULT_STORAGE_KEY = "omni-worker-entries-cache:v1";
const DEFAULT_MAX_WORKERS = 16;
const DEFAULT_MAX_SERIALIZED_BYTES = 4_000_000;
const DEFAULT_TAIL_LIMIT = 100;
const DEFAULT_OLDER_LIMIT = 100;

interface CachedWorkerStream {
  updatedAt: number;
  entries: WorkerEntry[];
}

interface WorkerEntriesCacheEnvelope {
  version: 1;
  workers: Record<string, CachedWorkerStream>;
}

export type WorkerStreamStatus = "idle" | "loading" | "loaded" | "error";

export interface WorkerStreamState {
  workerId: string;
  entries: WorkerEntry[];
  lowestSeq: number;
  latestContiguousSeq: number;
  latestKnownSeq: number;
  hasOlder: boolean;
  status: WorkerStreamStatus;
  lastError: string | null;
}

type Listener = (state: WorkerStreamState) => void;

interface FetchResponse {
  entries: WorkerEntry[];
  latestSeq: number;
  hasOlder?: boolean;
}

export interface WorkerEntriesManagerOptions {
  requestJson?: JsonRequester;
  fetchEndpoint?: (workerId: string, afterSeq: number) => string;
  fetchTailEndpoint?: (workerId: string, limit: number) => string;
  fetchBeforeEndpoint?: (workerId: string, beforeSeq: number, limit: number) => string;
  storage?: WorkerEntryStorage | null;
  storageKey?: string;
  maxWorkers?: number;
  maxSerializedBytes?: number;
  now?: () => number;
}

function defaultFetchEndpoint(workerId: string, afterSeq: number) {
  return `/api/workers/${encodeURIComponent(workerId)}/entries?afterSeq=${afterSeq}`;
}

function defaultFetchTailEndpoint(workerId: string, limit: number) {
  return `/api/workers/${encodeURIComponent(workerId)}/entries?limit=${limit}`;
}

function defaultFetchBeforeEndpoint(workerId: string, beforeSeq: number, limit: number) {
  return `/api/workers/${encodeURIComponent(workerId)}/entries?beforeSeq=${beforeSeq}&limit=${limit}`;
}

function latestSeq(entries: WorkerEntry[]) {
  return entries.reduce((latest, entry) => (
    typeof entry.seq === "number" && Number.isFinite(entry.seq)
      ? Math.max(latest, entry.seq)
      : latest
  ), 0);
}

function initialState(workerId: string, entries: WorkerEntry[] = []): WorkerStreamState {
  const latest = latestSeq(entries);
  const lowest = entries.length > 0
    ? entries.reduce((acc, entry) => (
      typeof entry.seq === "number" && entry.seq > 0 && (acc === 0 || entry.seq < acc) ? entry.seq : acc
    ), 0)
    : 0;
  return {
    workerId,
    entries,
    lowestSeq: lowest,
    latestContiguousSeq: latest,
    latestKnownSeq: latest,
    hasOlder: lowest > 1,
    status: entries.length > 0 ? "loaded" : "idle",
    lastError: null,
  };
}

function defaultStorage(): WorkerEntryStorage | null {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return null;
  }
  return window.localStorage;
}

function emptyEnvelope(): WorkerEntriesCacheEnvelope {
  return {
    version: 1,
    workers: {},
  };
}

function isWorkerEntryArray(value: unknown): value is WorkerEntry[] {
  return Array.isArray(value) && value.every((entry) => (
    typeof entry === "object"
    && entry !== null
    && typeof (entry as Partial<WorkerEntry>).id === "string"
    && typeof (entry as Partial<WorkerEntry>).seq === "number"
  ));
}

function compactEntryForCache(entry: WorkerEntry): WorkerEntry {
  return {
    ...entry,
    raw: undefined,
  };
}

export const EMPTY_WORKER_STREAM_STATE: WorkerStreamState = initialState("__none__");

export class WorkerEntriesManager {
  private readonly stateByWorker = new Map<string, WorkerStreamState>();
  private readonly listenersByWorker = new Map<string, Set<Listener>>();
  private readonly inFlightByWorker = new Map<string, Promise<void>>();
  private readonly wakeVersionByWorker = new Map<string, number>();
  private readonly requestJson: JsonRequester;
  private readonly fetchEndpoint: (workerId: string, afterSeq: number) => string;
  private readonly fetchTailEndpoint: (workerId: string, limit: number) => string;
  private readonly fetchBeforeEndpoint: (workerId: string, beforeSeq: number, limit: number) => string;
  private readonly storage: WorkerEntryStorage | null;
  private readonly storageKey: string;
  private readonly maxWorkers: number;
  private readonly maxSerializedBytes: number;
  private readonly now: () => number;

  constructor(options: WorkerEntriesManagerOptions = {}) {
    this.requestJson = options.requestJson ?? defaultRequestJson;
    this.fetchEndpoint = options.fetchEndpoint ?? defaultFetchEndpoint;
    this.fetchTailEndpoint = options.fetchTailEndpoint ?? defaultFetchTailEndpoint;
    this.fetchBeforeEndpoint = options.fetchBeforeEndpoint ?? defaultFetchBeforeEndpoint;
    this.storage = options.storage === undefined ? defaultStorage() : options.storage;
    this.storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;
    this.maxWorkers = options.maxWorkers ?? DEFAULT_MAX_WORKERS;
    this.maxSerializedBytes = options.maxSerializedBytes ?? DEFAULT_MAX_SERIALIZED_BYTES;
    this.now = options.now ?? Date.now;
  }

  getState(workerId: string, initialEntries: WorkerEntry[] = []): WorkerStreamState {
    const existing = this.stateByWorker.get(workerId);
    if (existing) {
      if (
        initialEntries.length > 0
        && existing.latestContiguousSeq === 0
        && existing.entries.length === 0
      ) {
        const hydrated = initialState(workerId, initialEntries);
        this.stateByWorker.set(workerId, hydrated);
        return hydrated;
      }
      return existing;
    }
    const cachedEntries = initialEntries.length > 0 ? [] : this.getCachedEntries(workerId);
    const nextEntries = initialEntries.length > 0 ? initialEntries : cachedEntries;
    const next = initialState(workerId, nextEntries);
    this.stateByWorker.set(workerId, next);
    if (nextEntries.length > 0) {
      this.rememberState(workerId, nextEntries);
    }
    return next;
  }

  isLoaded(workerId: string): boolean {
    const state = this.stateByWorker.get(workerId);
    if (!state) {
      return false;
    }
    return (
      state.status === "loaded"
      && state.latestContiguousSeq === state.latestKnownSeq
    );
  }

  subscribe(workerId: string, listener: Listener): () => void {
    let bucket = this.listenersByWorker.get(workerId);
    if (!bucket) {
      bucket = new Set<Listener>();
      this.listenersByWorker.set(workerId, bucket);
    }
    bucket.add(listener);
    return () => {
      bucket?.delete(listener);
      if (bucket && bucket.size === 0) {
        this.listenersByWorker.delete(workerId);
      }
    };
  }

  ensureLoaded(workerId: string): Promise<void> {
    const state = this.getState(workerId);
    if (state.status === "loading") {
      return this.inFlightByWorker.get(workerId) ?? Promise.resolve();
    }
    const loadedEmptyWithoutProof = state.status === "loaded"
      && state.latestContiguousSeq === 0
      && state.latestKnownSeq === 0
      && state.entries.length === 0;
    if (
      state.status === "loaded"
      && state.latestContiguousSeq === state.latestKnownSeq
      && !loadedEmptyWithoutProof
    ) {
      return Promise.resolve();
    }
    // Cold start (no entries yet) → tail-load the last N entries instead
    // of pulling the whole transcript from seq 1.
    if (state.entries.length === 0) {
      return this.fetchTail(workerId, DEFAULT_TAIL_LIMIT);
    }
    return this.fetch(workerId, state.latestContiguousSeq);
  }

  /**
   * Fetch a page of older entries (strictly before lowestSeq). The
   * returned page is prepended to the window. Caller can poll
   * `state.hasOlder` to decide whether to keep loading on scroll-back.
   */
  loadOlder(workerId: string, limit: number = DEFAULT_OLDER_LIMIT): Promise<void> {
    const existing = this.inFlightByWorker.get(workerId);
    if (existing) return existing;
    const state = this.getState(workerId);
    if (!state.hasOlder || state.lowestSeq <= 1) {
      return Promise.resolve();
    }
    return this.fetchBefore(workerId, state.lowestSeq, limit);
  }

  refresh(workerId: string): Promise<void> {
    const state = this.getState(workerId);
    return this.fetch(workerId, state.latestContiguousSeq);
  }

  /**
   * Wake-up hint from the SSE stream. The body carries only
   * `{ workerId, seq }`; the entry payload is never trusted from here.
   * Triggers a refetch from the current contiguous cursor.
   */
  onWakeUp(args: { workerId: string; seq: number }): void {
    const state = this.getState(args.workerId);
    if (args.seq <= state.latestContiguousSeq) {
      // Already received; the wake-up was redundant (e.g. another tab fired).
      return;
    }
    this.updateState(args.workerId, {
      ...state,
      latestKnownSeq: Math.max(state.latestKnownSeq, args.seq),
    });
    this.markWake(args.workerId);
    void this.fetch(args.workerId, state.latestContiguousSeq);
  }

  /**
   * Durable cursor hints from `/api/events` snapshots. These recover
   * from missed `worker.entry_appended` wake-up frames without carrying
   * worker transcript content on the global snapshot stream.
   */
  onKnownSeqs(workerEntrySeqs: Record<string, unknown> | null | undefined): void {
    if (!workerEntrySeqs) {
      return;
    }

    for (const [workerId, rawSeq] of Object.entries(workerEntrySeqs)) {
      const seq = typeof rawSeq === "number" && Number.isFinite(rawSeq)
        ? Math.max(0, Math.floor(rawSeq))
        : 0;
      if (seq <= 0) {
        continue;
      }

      const state = this.getState(workerId);

      const latestKnownSeq = Math.max(state.latestKnownSeq, seq);
      if (latestKnownSeq <= state.latestContiguousSeq && state.status !== "error") {
        continue;
      }

      this.updateState(workerId, {
        ...state,
        latestKnownSeq,
      });
      this.markWake(workerId);
      void this.fetch(workerId, state.latestContiguousSeq);
    }
  }

  /**
   * Global SSE resync signal. Re-validates every worker we track by
   * refetching from each one's current contiguous cursor. A worker
   * whose `latestContiguousSeq === latestKnownSeq` will get an empty
   * fetch and stay loaded — a global resync is a no-op for it.
   */
  onStreamResync(): void {
    for (const workerId of this.stateByWorker.keys()) {
      const state = this.getState(workerId);
      void this.fetch(workerId, state.latestContiguousSeq);
    }
  }

  reset(): void {
    this.stateByWorker.clear();
    this.listenersByWorker.clear();
    this.inFlightByWorker.clear();
    this.wakeVersionByWorker.clear();
  }

  private markWake(workerId: string): void {
    this.wakeVersionByWorker.set(workerId, (this.wakeVersionByWorker.get(workerId) ?? 0) + 1);
  }

  private fetchTail(workerId: string, limit: number): Promise<void> {
    const existing = this.inFlightByWorker.get(workerId);
    if (existing) return existing;
    const previous = this.getState(workerId);
    this.updateState(workerId, { ...previous, status: "loading", lastError: null });
    const url = this.fetchTailEndpoint(workerId, limit);
    const promise = this.requestJson<FetchResponse>(url, undefined, {
      source: "Worker entries",
      action: "Load worker stream tail",
    }).then(
      (response) => {
        const current = this.getState(workerId);
        const sorted = [...response.entries].sort((a, b) => a.seq - b.seq);
        const latestContiguous = sorted.length > 0 ? sorted[sorted.length - 1]!.seq : 0;
        const lowest = sorted.length > 0 ? sorted[0]!.seq : 0;
        // Preserve any latestKnownSeq advance that landed via wake-up
        // while this tail load was in flight.
        const latestKnown = Math.max(current.latestKnownSeq, response.latestSeq ?? 0, latestContiguous);
        this.updateState(workerId, {
          ...current,
          entries: sorted,
          lowestSeq: lowest,
          latestContiguousSeq: latestContiguous,
          latestKnownSeq: latestKnown,
          hasOlder: response.hasOlder ?? (lowest > 1),
          status: "loaded",
          lastError: null,
        });
      },
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        const failing = this.getState(workerId);
        this.updateState(workerId, { ...failing, status: "error", lastError: message });
      },
    ).finally(() => {
      this.inFlightByWorker.delete(workerId);
      // If the server reported newer entries than we got in the tail
      // window, chase forward from latestContiguousSeq.
      const after = this.getState(workerId);
      if (after.status === "loaded" && after.latestContiguousSeq < after.latestKnownSeq) {
        void this.fetch(workerId, after.latestContiguousSeq);
      }
    });
    this.inFlightByWorker.set(workerId, promise);
    return promise;
  }

  private fetchBefore(workerId: string, beforeSeq: number, limit: number): Promise<void> {
    const existing = this.inFlightByWorker.get(workerId);
    if (existing) return existing;
    const previous = this.getState(workerId);
    this.updateState(workerId, { ...previous, status: "loading", lastError: null });
    const url = this.fetchBeforeEndpoint(workerId, beforeSeq, limit);
    const promise = this.requestJson<FetchResponse>(url, undefined, {
      source: "Worker entries",
      action: "Load older worker entries",
    }).then(
      (response) => {
        const current = this.getState(workerId);
        // Only accept entries strictly older than our current window and
        // adjacent to it (no gap to lowestSeq). If we'd introduce a gap,
        // drop the page — `loadOlder` can be retried.
        const sorted = [...response.entries]
          .filter((entry) => typeof entry.seq === "number" && entry.seq > 0 && entry.seq < current.lowestSeq)
          .sort((a, b) => a.seq - b.seq);
        if (sorted.length === 0) {
          this.updateState(workerId, {
            ...current,
            hasOlder: response.hasOlder ?? false,
            status: "loaded",
            lastError: null,
          });
          return;
        }
        const highestOlderSeq = sorted[sorted.length - 1]!.seq;
        if (current.lowestSeq > 0 && highestOlderSeq !== current.lowestSeq - 1) {
          // Gap — older page doesn't butt up to our window. Don't merge
          // (would violate the contiguity invariant). Still advance the
          // hasOlder hint if the server thinks there's nothing left.
          this.updateState(workerId, {
            ...current,
            hasOlder: response.hasOlder ?? current.hasOlder,
            status: "loaded",
            lastError: null,
          });
          return;
        }
        const lowest = sorted[0]!.seq;
        const merged = [...sorted, ...current.entries];
        this.updateState(workerId, {
          ...current,
          entries: merged,
          lowestSeq: lowest,
          hasOlder: response.hasOlder ?? (lowest > 1),
          status: "loaded",
          lastError: null,
        });
      },
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        const failing = this.getState(workerId);
        this.updateState(workerId, { ...failing, status: "error", lastError: message });
      },
    ).finally(() => {
      this.inFlightByWorker.delete(workerId);
    });
    this.inFlightByWorker.set(workerId, promise);
    return promise;
  }

  private fetch(workerId: string, afterSeq: number): Promise<void> {
    const existing = this.inFlightByWorker.get(workerId);
    if (existing) {
      return existing;
    }
    const previous = this.getState(workerId);
    this.updateState(workerId, { ...previous, status: "loading", lastError: null });
    const url = this.fetchEndpoint(workerId, afterSeq);
    const cursorBeforeFetch = previous.latestContiguousSeq;
    const knownBeforeFetch = previous.latestKnownSeq;
    const wakeVersionBeforeFetch = this.wakeVersionByWorker.get(workerId) ?? 0;
    const promise = this.requestJson<FetchResponse>(url, undefined, {
      source: "Worker entries",
      action: "Load worker stream",
    }).then(
      (response) => {
        this.applyFetchResult(workerId, afterSeq, response);
      },
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        const failing = this.getState(workerId);
        this.updateState(workerId, { ...failing, status: "error", lastError: message });
      },
    ).finally(() => {
      this.inFlightByWorker.delete(workerId);
      // If applyFetchResult advanced the contiguous prefix and a known
      // gap remains, chase it now. Requiring progress prevents an
      // infinite loop when the server reports `latestSeq` ahead of the
      // entries it returned (race or stale latest hint).
      const after = this.getState(workerId);
      const wakeUpAdvancedKnownSeq = after.latestKnownSeq > knownBeforeFetch;
      const wakeUpArrivedDuringFetch = (this.wakeVersionByWorker.get(workerId) ?? 0) > wakeVersionBeforeFetch;
      if (
        after.status === "loaded"
        && (after.latestContiguousSeq > cursorBeforeFetch || wakeUpAdvancedKnownSeq || wakeUpArrivedDuringFetch)
        && after.latestContiguousSeq < after.latestKnownSeq
      ) {
        void this.fetch(workerId, after.latestContiguousSeq);
      }
    });
    this.inFlightByWorker.set(workerId, promise);
    return promise;
  }

  private applyFetchResult(
    workerId: string,
    cursorBeforeFetch: number,
    response: FetchResponse,
  ): void {
    const previous = this.getState(workerId);
    // The endpoint returns entries strictly newer than `afterSeq`. If
    // the caller's view advanced between request and response, drop
    // anything we've already merged.
    const incoming = response.entries
      .filter((entry) => entry.seq > previous.latestContiguousSeq)
      .sort((a, b) => a.seq - b.seq);

    let nextContiguous = previous.latestContiguousSeq;
    const merged = [...previous.entries];
    for (const entry of incoming) {
      if (entry.seq === nextContiguous + 1) {
        merged.push(entry);
        nextContiguous = entry.seq;
      } else if (entry.seq > nextContiguous + 1) {
        // Gap. Don't include the entry; the next fetch (kicked off
        // below) will cover both this seq and the missing ones.
        break;
      }
    }

    const nextKnown = Math.max(previous.latestKnownSeq, response.latestSeq, nextContiguous);
    // If we started with no entries, lowestSeq becomes the first merged
    // entry's seq; otherwise the window's lower bound is unchanged.
    const nextLowest = previous.lowestSeq > 0
      ? previous.lowestSeq
      : merged[0]?.seq ?? 0;
    const next: WorkerStreamState = {
      ...previous,
      entries: merged,
      lowestSeq: nextLowest,
      latestContiguousSeq: nextContiguous,
      latestKnownSeq: nextKnown,
      // hasOlder is preserved; only tail-load or loadOlder updates it.
      // A forward fetch starting from lowestSeq=0 (empty window) can't
      // assert anything about whether older entries exist.
      status: "loaded",
      lastError: null,
    };
    this.updateState(workerId, next);

    // Gap chasing happens in the fetch wrapper's .finally so that
    // inFlightByWorker is cleared before the recursive call.
  }

  private updateState(workerId: string, next: WorkerStreamState): void {
    this.stateByWorker.set(workerId, next);
    if (next.status === "loaded") {
      this.rememberState(workerId, next.entries);
    }
    const listeners = this.listenersByWorker.get(workerId);
    if (!listeners) {
      return;
    }
    for (const listener of listeners) {
      listener(next);
    }
  }

  private getCachedEntries(workerId: string): WorkerEntry[] {
    const cached = this.readEnvelope().workers[workerId];
    if (!cached || !isWorkerEntryArray(cached.entries)) {
      return [];
    }
    return cached.entries;
  }

  private rememberState(workerId: string, entries: WorkerEntry[]): void {
    if (!this.storage || entries.length === 0) {
      return;
    }

    const currentEnvelope = this.readEnvelope();
    const envelope = this.pruneEnvelope({
      ...currentEnvelope,
      workers: {
        ...currentEnvelope.workers,
        [workerId]: {
          updatedAt: this.now(),
          entries: entries.map(compactEntryForCache),
        },
      },
    });
    const serialized = JSON.stringify(envelope);
    if (serialized.length > this.maxSerializedBytes) {
      return;
    }

    try {
      this.storage.setItem(this.storageKey, serialized);
    } catch {
      // localStorage is a preview cache only; live server state remains authoritative.
    }
  }

  private readEnvelope(): WorkerEntriesCacheEnvelope {
    if (!this.storage) {
      return emptyEnvelope();
    }

    try {
      const raw = this.storage.getItem(this.storageKey);
      if (!raw) {
        return emptyEnvelope();
      }

      const parsed = JSON.parse(raw) as Partial<WorkerEntriesCacheEnvelope>;
      if (parsed.version !== 1 || typeof parsed.workers !== "object" || parsed.workers === null) {
        return emptyEnvelope();
      }
      return {
        version: 1,
        workers: parsed.workers as Record<string, CachedWorkerStream>,
      };
    } catch {
      try {
        this.storage.removeItem(this.storageKey);
      } catch {
        // Ignore cleanup failures.
      }
      return emptyEnvelope();
    }
  }

  private pruneEnvelope(envelope: WorkerEntriesCacheEnvelope): WorkerEntriesCacheEnvelope {
    return {
      version: 1,
      workers: Object.fromEntries(
        Object.entries(envelope.workers)
          .sort((left, right) => {
            const updatedDelta = right[1].updatedAt - left[1].updatedAt;
            return updatedDelta !== 0 ? updatedDelta : left[0].localeCompare(right[0]);
          })
          .slice(0, this.maxWorkers),
      ),
    };
  }
}

// A single process-wide instance is fine because manager state is keyed
// by workerId and the same worker is never owned by two tabs. The
// reset() method exists for tests; production code should not call it.
export const workerEntriesManager = new WorkerEntriesManager();

/**
 * Subscribe to the unified worker conversation stream for a single
 * worker. Returns the live state plus a `isLoaded` boolean derived
 * from the manager's contiguous-prefix invariant.
 *
 * `workerId === null` returns a stable empty state and skips the
 * fetch.
 */
interface UseWorkerStreamOptions {
  refreshIntervalMs?: number | null;
}

export function useWorkerStream(
  workerId: string | null,
  initialEntries: WorkerEntry[] = [],
  options: UseWorkerStreamOptions = {},
) {
  const state = useSyncExternalStore(
    useCallback((listener) => (
      workerId ? workerEntriesManager.subscribe(workerId, listener) : () => {}
    ), [workerId]),
    useCallback(() => (
      workerId ? workerEntriesManager.getState(workerId, initialEntries) : EMPTY_WORKER_STREAM_STATE
    ), [initialEntries, workerId]),
    () => EMPTY_WORKER_STREAM_STATE,
  );
  useEffect(() => {
    if (!workerId) {
      return;
    }
    void workerEntriesManager.ensureLoaded(workerId);
  }, [workerId]);
  useEffect(() => {
    if (!workerId || !options.refreshIntervalMs || options.refreshIntervalMs <= 0) {
      return;
    }
    const intervalId = window.setInterval(() => {
      void workerEntriesManager.refresh(workerId);
    }, options.refreshIntervalMs);
    return () => window.clearInterval(intervalId);
  }, [options.refreshIntervalMs, workerId]);
  const loadOlder = useCallback((limit?: number) => {
    if (!workerId) return Promise.resolve();
    return workerEntriesManager.loadOlder(workerId, limit);
  }, [workerId]);
  return {
    state,
    entries: state.entries,
    isLoaded: workerId ? workerEntriesManager.isLoaded(workerId) : false,
    hasOlder: state.hasOlder,
    loadOlder,
  };
}
