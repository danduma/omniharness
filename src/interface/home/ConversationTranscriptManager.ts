/**
 * Run-scoped sibling of `WorkerEntriesManager`. Fetches the merged
 * transcript across every worker in a run from
 * the typed conversation transcript API, so the conversation UI can
 * render full history when the run has cycled through multiple workers
 * (cancel + respawn).
 *
 * Pagination is token-based because seq is per-worker, not global. The
 * server hands back an opaque cursor; we hand it back on the next poll.
 */
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import type { WorkerEntry } from "@/shared/worker-entries";
import { coalesceWorkerEntriesById } from "./WorkerEntriesManager";
import {
  DEFAULT_ENTRY_RETENTION,
  pruneEntryWindow,
  retainedEntryCount,
  type EntryRetentionPolicy,
} from "./entry-retention";
import {
  decodeConversationTranscriptToken,
  encodeConversationTranscriptToken,
} from "@/shared/conversation-transcript-token";
import type { RuntimeAPIs } from "@/runtime-api/types";
import { useRuntimeAPIs } from "@/runtime-api/provider";

export interface ConversationTranscriptEntry extends WorkerEntry {
  workerId: string;
}

export interface ConversationTranscriptState {
  entries: ConversationTranscriptEntry[];
  latestToken: string | null;
  oldestToken: string | null;
  hasOlder: boolean;
  status: "idle" | "loading" | "loaded" | "error";
  lastError: string | null;
  workerIds: string[];
  /**
   * Latched: true once this run's transcript has loaded at least once.
   * `status` cycles back through "loading" on every poll refresh, so
   * render gates must use this instead of `status === "loaded"`.
   */
  hasLoadedOnce: boolean;
}

interface TranscriptFetchResponse {
  entries: ConversationTranscriptEntry[];
  latestToken: string;
  oldestToken?: string;
  hasOlder?: boolean;
  workerIds: string[];
}

const DEFAULT_TRANSCRIPT_LIMIT = 100;

const EMPTY: ConversationTranscriptState = Object.freeze({
  entries: [],
  latestToken: null,
  oldestToken: null,
  hasOlder: false,
  status: "idle",
  lastError: null,
  workerIds: [],
  hasLoadedOnce: false,
});

export const EMPTY_CONVERSATION_TRANSCRIPT_STATE = EMPTY;

export interface ConversationTranscriptManagerOptions {
  transcript?: RuntimeAPIs["conversations"]["transcript"];
  retention?: EntryRetentionPolicy;
  now?: () => number;
}

export class ConversationTranscriptManager {
  private readonly stateByRunId = new Map<string, ConversationTranscriptState>();
  private readonly listenersByRunId = new Map<string, Set<() => void>>();
  private readonly inFlightByRunId = new Map<string, Promise<void>>();
  private readonly olderLoadInFlightByRunId = new Set<string>();
  // Last scroll-back load per run. Raises the retention ceiling so the
  // collector does not drop history the user is currently reading.
  private readonly lastScrollbackAtByRunId = new Map<string, number>();
  private readonly retention: EntryRetentionPolicy;
  private readonly now: () => number;
  private transcript: RuntimeAPIs["conversations"]["transcript"] | null;

  constructor(options: ConversationTranscriptManagerOptions = {}) {
    this.transcript = options.transcript ?? null;
    this.retention = options.retention ?? DEFAULT_ENTRY_RETENTION;
    this.now = options.now ?? Date.now;
  }

  configure(transcript: RuntimeAPIs["conversations"]["transcript"]) {
    this.transcript = transcript;
  }

  private load(input: Parameters<RuntimeAPIs["conversations"]["transcript"]>[0]) {
    if (!this.transcript) {
      return Promise.reject(new Error("Conversation transcripts are not connected to the runtime."));
    }
    return this.transcript(input) as Promise<TranscriptFetchResponse>;
  }

  getState(runId: string): ConversationTranscriptState {
    return this.stateByRunId.get(runId) ?? EMPTY;
  }

  subscribe(runId: string, listener: () => void): () => void {
    const listeners = this.listenersByRunId.get(runId) ?? new Set();
    listeners.add(listener);
    this.listenersByRunId.set(runId, listeners);
    return () => {
      const current = this.listenersByRunId.get(runId);
      if (!current) return;
      current.delete(listener);
      if (current.size === 0) {
        this.listenersByRunId.delete(runId);
        this.collectUnsubscribedRun(runId);
      }
    };
  }

  ensureLoaded(runId: string): Promise<void> {
    const state = this.getState(runId);
    if (state.status === "loaded" || state.status === "loading") {
      return this.inFlightByRunId.get(runId) ?? Promise.resolve();
    }
    return this.fetchTail(runId);
  }

  refresh(runId: string): Promise<void> {
    if (this.inFlightByRunId.has(runId)) {
      return this.inFlightByRunId.get(runId)!;
    }
    const state = this.getState(runId);
    return state.latestToken ? this.fetchForward(runId, state.latestToken) : this.fetchTail(runId);
  }

  loadOlder(runId: string, limit: number = DEFAULT_TRANSCRIPT_LIMIT): Promise<void> {
    if (this.inFlightByRunId.has(runId)) {
      const existing = this.inFlightByRunId.get(runId)!;
      if (this.olderLoadInFlightByRunId.has(runId)) {
        return existing;
      }
      // A refresh may already be occupying the single-flight slot when the
      // user reaches the top of the viewport. Preserve that scroll-back
      // intent and start the older-page request after the refresh settles.
      return existing.then(
        () => this.loadOlder(runId, limit),
        () => this.loadOlder(runId, limit),
      );
    }
    const state = this.getState(runId);
    if (!state.hasOlder || !state.oldestToken) {
      return Promise.resolve();
    }
    // Reaching the top of the viewport is the only access signal that raises
    // the retention ceiling — live output at the bottom must not keep old
    // history pinned in memory.
    this.lastScrollbackAtByRunId.set(runId, this.now());
    this.olderLoadInFlightByRunId.add(runId);
    return this.fetchOlder(runId, state.oldestToken, limit).finally(() => {
      this.olderLoadInFlightByRunId.delete(runId);
    });
  }

  reset(): void {
    this.stateByRunId.clear();
    this.inFlightByRunId.clear();
    this.olderLoadInFlightByRunId.clear();
    this.listenersByRunId.clear();
    this.lastScrollbackAtByRunId.clear();
  }

  /**
   * Collapse a run's window to the hot tail. Called when the last subscriber
   * goes away: an unrendered transcript has no reason to hold scroll-back in
   * memory, and re-entering the conversation refetches.
   */
  private collectUnsubscribedRun(runId: string): void {
    const state = this.stateByRunId.get(runId);
    if (!state || state.entries.length === 0) {
      return;
    }
    const retained = this.applyRetention(runId, state.entries, state.oldestToken, state.hasOlder);
    if (retained.entries.length === state.entries.length) {
      return;
    }
    this.stateByRunId.set(runId, { ...state, ...retained });
  }

  /**
   * Garbage collect the head of a run's merged transcript. See
   * `entry-retention.ts` for the policy.
   *
   * Dropping entries invalidates the server's `oldestToken`, which describes
   * the window the server last handed us rather than the one we still hold —
   * paging back from it would skip everything we just dropped. A replacement
   * token is minted from the retained entries: each worker still in the
   * window pages back from its lowest retained seq, and a worker whose
   * entries were dropped entirely pages back from just above its highest
   * dropped seq so those entries are reachable again.
   */
  private applyRetention(
    runId: string,
    entries: ConversationTranscriptEntry[],
    oldestToken: string | null,
    hasOlder: boolean,
  ): Pick<ConversationTranscriptState, "entries" | "oldestToken" | "hasOlder"> {
    const keep = retainedEntryCount({
      total: entries.length,
      lastScrollbackAt: this.lastScrollbackAtByRunId.get(runId) ?? null,
      now: this.now(),
      isVisible: (this.listenersByRunId.get(runId)?.size ?? 0) > 0,
      policy: this.retention,
    });
    const retained = pruneEntryWindow(entries, keep);
    if (retained.length === entries.length) {
      return { entries, oldestToken, hasOlder };
    }

    const dropped = entries.slice(0, entries.length - retained.length);
    const cursors = { ...decodeConversationTranscriptToken(oldestToken).cursors };
    const highestDropped = new Map<string, number>();
    for (const entry of dropped) {
      const seq = Math.floor(entry.seq);
      const existing = highestDropped.get(entry.workerId);
      if (existing === undefined || seq > existing) {
        highestDropped.set(entry.workerId, seq);
      }
    }
    const lowestRetained = new Map<string, number>();
    for (const entry of retained) {
      const seq = Math.floor(entry.seq);
      const existing = lowestRetained.get(entry.workerId);
      if (existing === undefined || seq < existing) {
        lowestRetained.set(entry.workerId, seq);
      }
    }
    for (const [workerId, seq] of highestDropped) {
      cursors[workerId] = seq + 1;
    }
    // A worker still present in the window overrides the dropped-cursor
    // above: its lowest retained seq is the real lower bound.
    for (const [workerId, seq] of lowestRetained) {
      cursors[workerId] = seq;
    }

    return {
      entries: retained,
      oldestToken: encodeConversationTranscriptToken({ cursors }),
      hasOlder: true,
    };
  }

  private updateState(runId: string, next: ConversationTranscriptState): void {
    this.stateByRunId.set(runId, next);
    const listeners = this.listenersByRunId.get(runId);
    if (listeners) {
      for (const listener of listeners) {
        listener();
      }
    }
  }

  private async fetchTail(runId: string, limit: number = DEFAULT_TRANSCRIPT_LIMIT): Promise<void> {
    const previous = this.getState(runId);
    this.updateState(runId, { ...previous, status: "loading", lastError: null });
    const promise = this.load({ runId, limit }).then(
      (response) => {
        const current = this.getState(runId);
        const next: ConversationTranscriptState = {
          ...current,
          entries: coalesceWorkerEntriesById(response.entries) as ConversationTranscriptEntry[],
          latestToken: response.latestToken,
          oldestToken: response.oldestToken ?? null,
          hasOlder: Boolean(response.hasOlder),
          workerIds: response.workerIds,
          status: "loaded",
          lastError: null,
          hasLoadedOnce: true,
        };
        this.updateState(runId, next);
      },
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        const failing = this.getState(runId);
        this.updateState(runId, { ...failing, status: "error", lastError: message });
      },
    ).finally(() => {
      this.inFlightByRunId.delete(runId);
    });
    this.inFlightByRunId.set(runId, promise);
    return promise;
  }

  private async fetchForward(runId: string, latestToken: string): Promise<void> {
    const previous = this.getState(runId);
    this.updateState(runId, { ...previous, status: "loading", lastError: null });
    const promise = this.load({ runId, afterToken: latestToken }).then(
      (response) => {
        const current = this.getState(runId);
        const merged = coalesceWorkerEntriesById([
          ...current.entries,
          ...response.entries,
        ]) as ConversationTranscriptEntry[];
        // Reuse the previous array when the poll appended nothing, so an idle
        // refresh does not hand every subscriber a new `entries` identity.
        const grew = merged.length > current.entries.length;
        // Garbage collect the head as the window grows. Without this the
        // window is unbounded: a session that streams for a day accumulates
        // every entry it ever received and re-renders all of them on each
        // append.
        const retained = grew
          ? this.applyRetention(
            runId,
            merged,
            current.oldestToken ?? response.oldestToken ?? null,
            current.hasOlder || Boolean(response.hasOlder),
          )
          : {
            entries: current.entries,
            oldestToken: current.oldestToken ?? response.oldestToken ?? null,
            hasOlder: current.hasOlder || Boolean(response.hasOlder),
          };
        const next: ConversationTranscriptState = {
          ...current,
          entries: retained.entries,
          latestToken: response.latestToken,
          oldestToken: retained.oldestToken,
          hasOlder: retained.hasOlder,
          workerIds: response.workerIds,
          status: "loaded",
          lastError: null,
          hasLoadedOnce: true,
        };
        this.updateState(runId, next);
      },
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        const failing = this.getState(runId);
        this.updateState(runId, { ...failing, status: "error", lastError: message });
      },
    ).finally(() => {
      this.inFlightByRunId.delete(runId);
    });
    this.inFlightByRunId.set(runId, promise);
    return promise;
  }

  private async fetchOlder(runId: string, oldestToken: string, limit: number): Promise<void> {
    const previous = this.getState(runId);
    this.updateState(runId, { ...previous, status: "loading", lastError: null });
    const promise = this.load({ runId, beforeToken: oldestToken, limit }).then(
      (response) => {
        const current = this.getState(runId);
        const next: ConversationTranscriptState = {
          ...current,
          entries: coalesceWorkerEntriesById([...response.entries, ...current.entries]) as ConversationTranscriptEntry[],
          latestToken: current.latestToken ?? response.latestToken,
          oldestToken: response.oldestToken ?? current.oldestToken,
          hasOlder: Boolean(response.hasOlder),
          workerIds: response.workerIds,
          status: "loaded",
          lastError: null,
          hasLoadedOnce: true,
        };
        this.updateState(runId, next);
      },
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        const failing = this.getState(runId);
        this.updateState(runId, { ...failing, status: "error", lastError: message });
      },
    ).finally(() => {
      this.inFlightByRunId.delete(runId);
    });
    this.inFlightByRunId.set(runId, promise);
    return promise;
  }
}

export const conversationTranscriptManager = new ConversationTranscriptManager();

interface UseConversationTranscriptOptions {
  refreshIntervalMs?: number | null;
  enabled?: boolean;
}

/**
 * Subscribe to the merged conversation transcript for a run. When
 * `runId` is null or `options.enabled` is false, returns an empty
 * state and skips the fetch.
 */
export function useConversationTranscript(
  runId: string | null,
  options: UseConversationTranscriptOptions = {},
) {
  const runtimeApis = useRuntimeAPIs();
  conversationTranscriptManager.configure(runtimeApis.conversations.transcript);
  const enabled = options.enabled !== false && Boolean(runId);

  const state = useSyncExternalStore(
    useCallback((listener) => (
      runId && enabled ? conversationTranscriptManager.subscribe(runId, listener) : () => {}
    ), [runId, enabled]),
    useCallback(() => (
      runId && enabled ? conversationTranscriptManager.getState(runId) : EMPTY
    ), [runId, enabled]),
    () => EMPTY,
  );

  useEffect(() => {
    if (!runId || !enabled) return;
    void conversationTranscriptManager.ensureLoaded(runId);
  }, [runId, enabled]);

  useEffect(() => {
    if (!runId || !enabled) return;
    if (!options.refreshIntervalMs || options.refreshIntervalMs <= 0) return;
    const handle = window.setInterval(() => {
      void conversationTranscriptManager.refresh(runId);
    }, options.refreshIntervalMs);
    return () => window.clearInterval(handle);
  }, [enabled, options.refreshIntervalMs, runId]);

  const entries = useMemo(() => state.entries, [state.entries]);

  const loadOlder = useCallback((limit?: number) => {
    if (!runId) return Promise.resolve();
    return conversationTranscriptManager.loadOlder(runId, limit);
  }, [runId]);

  return {
    state,
    entries,
    isLoaded: state.status === "loaded",
    hasLoadedOnce: state.hasLoadedOnce,
    hasOlder: state.hasOlder,
    loadOlder,
    workerIds: state.workerIds,
  };
}
