/**
 * Run-scoped sibling of `WorkerEntriesManager`. Fetches the merged
 * transcript across every worker in a run from
 * `/api/conversations/:runId/transcript`, so the conversation UI can
 * render full history when the run has cycled through multiple workers
 * (cancel + respawn).
 *
 * Pagination is token-based because seq is per-worker, not global. The
 * server hands back an opaque cursor; we hand it back on the next poll.
 */
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import type { WorkerEntry } from "@/server/workers/entries-types";
import { requestJson as defaultRequestJson } from "@/lib/app-errors";
import { coalesceWorkerEntriesById } from "./WorkerEntriesManager";

export interface ConversationTranscriptEntry extends WorkerEntry {
  workerId: string;
}

export interface ConversationTranscriptState {
  entries: ConversationTranscriptEntry[];
  latestToken: string | null;
  status: "idle" | "loading" | "loaded" | "error";
  lastError: string | null;
  workerIds: string[];
}

interface TranscriptFetchResponse {
  entries: ConversationTranscriptEntry[];
  latestToken: string;
  workerIds: string[];
}

const EMPTY: ConversationTranscriptState = Object.freeze({
  entries: [],
  latestToken: null,
  status: "idle",
  lastError: null,
  workerIds: [],
});

export const EMPTY_CONVERSATION_TRANSCRIPT_STATE = EMPTY;

function endpoint(runId: string, afterToken: string | null) {
  const base = `/api/conversations/${encodeURIComponent(runId)}/transcript`;
  return afterToken ? `${base}?afterToken=${encodeURIComponent(afterToken)}` : base;
}

export interface ConversationTranscriptManagerOptions {
  requestJson?: typeof defaultRequestJson;
}

export class ConversationTranscriptManager {
  private readonly stateByRunId = new Map<string, ConversationTranscriptState>();
  private readonly listenersByRunId = new Map<string, Set<() => void>>();
  private readonly inFlightByRunId = new Map<string, Promise<void>>();
  private readonly requestJson: typeof defaultRequestJson;

  constructor(options: ConversationTranscriptManagerOptions = {}) {
    this.requestJson = options.requestJson ?? defaultRequestJson;
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
      }
    };
  }

  ensureLoaded(runId: string): Promise<void> {
    const state = this.getState(runId);
    if (state.status === "loaded" || state.status === "loading") {
      return this.inFlightByRunId.get(runId) ?? Promise.resolve();
    }
    return this.fetch(runId);
  }

  refresh(runId: string): Promise<void> {
    if (this.inFlightByRunId.has(runId)) {
      return this.inFlightByRunId.get(runId)!;
    }
    return this.fetch(runId);
  }

  reset(): void {
    this.stateByRunId.clear();
    this.inFlightByRunId.clear();
    this.listenersByRunId.clear();
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

  private async fetch(runId: string): Promise<void> {
    const previous = this.getState(runId);
    this.updateState(runId, { ...previous, status: "loading", lastError: null });
    const url = endpoint(runId, previous.latestToken);
    const promise = this.requestJson<TranscriptFetchResponse>(url, undefined, {
      source: "Conversation transcript",
      action: "Load conversation transcript",
    }).then(
      (response) => {
        const next: ConversationTranscriptState = {
          // Merge new entries onto the existing window. The server only
          // returns entries with seq > the per-worker cursor in the
          // token, so duplicates are not possible by id+seq, but we
          // still coalesce defensively for the rendering layer (same
          // logical entry id can have multiple seq rows under the
          // streaming-revision protocol).
          entries: coalesceWorkerEntriesById([...previous.entries, ...response.entries]) as ConversationTranscriptEntry[],
          latestToken: response.latestToken,
          workerIds: response.workerIds,
          status: "loaded",
          lastError: null,
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

  return {
    state,
    entries,
    isLoaded: state.status === "loaded",
    workerIds: state.workerIds,
  };
}
