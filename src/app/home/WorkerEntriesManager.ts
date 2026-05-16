/**
 * Single source of truth for the unified worker conversation stream on
 * the frontend.
 *
 * Per (workerId) we hold:
 *   - entries: the contiguous prefix [1..latestContiguousSeq], in seq
 *     order, never with gaps.
 *   - latestContiguousSeq: the highest seq we have proven contiguous
 *     from 1. Used as the cursor for refetch.
 *   - latestKnownSeq: the highest seq the server has told us exists.
 *     Updates immediately on a wake-up frame; the fetch fills the gap.
 *   - status: "idle" → "loading" → "loaded"; "error" on a fetch failure.
 *
 * The "loaded" check is one comparison:
 *   isLoaded(workerId) === entries reach latestKnownSeq.
 *
 * SSE frames carry only `{ workerId, seq }` — the content is fetched
 * via `GET /api/workers/:workerId/entries?afterSeq=`. The frame is a
 * wake-up hint; we never trust it as the entry payload.
 */
import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { WorkerEntry } from "@/server/workers/entries-types";
import { requestJson as defaultRequestJson } from "@/lib/app-errors";

type JsonRequester = typeof defaultRequestJson;

export type WorkerStreamStatus = "idle" | "loading" | "loaded" | "error";

export interface WorkerStreamState {
  workerId: string;
  entries: WorkerEntry[];
  latestContiguousSeq: number;
  latestKnownSeq: number;
  status: WorkerStreamStatus;
  lastError: string | null;
}

type Listener = (state: WorkerStreamState) => void;

interface FetchResponse {
  entries: WorkerEntry[];
  latestSeq: number;
}

export interface WorkerEntriesManagerOptions {
  requestJson?: JsonRequester;
  fetchEndpoint?: (workerId: string, afterSeq: number) => string;
}

function defaultFetchEndpoint(workerId: string, afterSeq: number) {
  return `/api/workers/${encodeURIComponent(workerId)}/entries?afterSeq=${afterSeq}`;
}

function initialState(workerId: string): WorkerStreamState {
  return {
    workerId,
    entries: [],
    latestContiguousSeq: 0,
    latestKnownSeq: 0,
    status: "idle",
    lastError: null,
  };
}

export const EMPTY_WORKER_STREAM_STATE: WorkerStreamState = initialState("__none__");

export class WorkerEntriesManager {
  private readonly stateByWorker = new Map<string, WorkerStreamState>();
  private readonly listenersByWorker = new Map<string, Set<Listener>>();
  private readonly inFlightByWorker = new Map<string, Promise<void>>();
  private readonly requestJson: JsonRequester;
  private readonly fetchEndpoint: (workerId: string, afterSeq: number) => string;

  constructor(options: WorkerEntriesManagerOptions = {}) {
    this.requestJson = options.requestJson ?? defaultRequestJson;
    this.fetchEndpoint = options.fetchEndpoint ?? defaultFetchEndpoint;
  }

  getState(workerId: string): WorkerStreamState {
    return this.stateByWorker.get(workerId) ?? initialState(workerId);
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
    if (state.status === "loaded" && state.latestContiguousSeq === state.latestKnownSeq) {
      return Promise.resolve();
    }
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
    void this.fetch(args.workerId, state.latestContiguousSeq);
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
      if (
        after.status === "loaded"
        && after.latestContiguousSeq > cursorBeforeFetch
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
    const next: WorkerStreamState = {
      ...previous,
      entries: merged,
      latestContiguousSeq: nextContiguous,
      latestKnownSeq: nextKnown,
      status: "loaded",
      lastError: null,
    };
    this.updateState(workerId, next);

    // Gap chasing happens in the fetch wrapper's .finally so that
    // inFlightByWorker is cleared before the recursive call.
  }

  private updateState(workerId: string, next: WorkerStreamState): void {
    this.stateByWorker.set(workerId, next);
    const listeners = this.listenersByWorker.get(workerId);
    if (!listeners) {
      return;
    }
    for (const listener of listeners) {
      listener(next);
    }
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
export function useWorkerStream(workerId: string | null) {
  const state = useSyncExternalStore(
    useCallback((listener) => (
      workerId ? workerEntriesManager.subscribe(workerId, listener) : () => {}
    ), [workerId]),
    useCallback(() => (
      workerId ? workerEntriesManager.getState(workerId) : EMPTY_WORKER_STREAM_STATE
    ), [workerId]),
    () => EMPTY_WORKER_STREAM_STATE,
  );
  useEffect(() => {
    if (!workerId) {
      return;
    }
    void workerEntriesManager.ensureLoaded(workerId);
  }, [workerId]);
  return {
    state,
    entries: state.entries,
    isLoaded: workerId ? workerEntriesManager.isLoaded(workerId) : false,
  };
}
