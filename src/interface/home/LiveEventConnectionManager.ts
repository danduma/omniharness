import {
  type AppErrorDescriptor,
  normalizeAppError,
} from "@/lib/app-errors";
import { compareEventStreamIds, parseEventStreamId } from "@/shared/runtime";
import type { RuntimeAPIs, RuntimeSubscription } from "@/runtime-api/types";
import {
  buildEventStreamUrl,
  createLegacyLiveEventAPIs,
} from "@/runtime-api/legacy-live-events";
import { safeSetBrowserStorageItem } from "@/lib/browser-storage";
import type { EventStreamState } from "./types";
import { workerEntriesManager } from "./WorkerEntriesManager";
import { sidebarWorkerActivityManager, type SidebarWorkerActivityManager } from "./SidebarWorkerActivityManager";

export { buildEventStreamUrl };

const SNAPSHOT_FALLBACK_INTERVAL_MS = 15_000;
const SNAPSHOT_FALLBACK_COOLDOWN_MS = 1_000;
const SNAPSHOT_VALIDATION_INTERVAL_MS = 5_000;

interface LiveEventConnectionManagerOptions {
  selectedRunId?: string | null;
  initialLastEventId?: string | number | null;
  cursor?: LiveEventCursorManager;
  events?: Pick<RuntimeAPIs["events"], "snapshot" | "open">;
  /** @deprecated Test-only compatibility. Production injects RuntimeAPIs.events. */
  EventSourceConstructor?: typeof EventSource;
  /** @deprecated Test-only compatibility. Production injects RuntimeAPIs.events. */
  requestJson?: <T>(
    input: RequestInfo | URL,
    init?: RequestInit,
    fallback?: Partial<AppErrorDescriptor>,
  ) => Promise<T>;
  /** @deprecated Test-only compatibility. Production injects RuntimeAPIs.events. */
  requestSnapshot?: (
    input: RequestInfo | URL,
    init: RequestInit | undefined,
    fallback: Partial<AppErrorDescriptor>,
  ) => Promise<SnapshotPollResult>;
  getSnapshotChecksum?: () => string | null | undefined;
  workerEntries?: Pick<typeof workerEntriesManager, "onKnownSeqs" | "onStreamResync" | "onWakeUp">;
  sidebarWorkerActivity?: Pick<SidebarWorkerActivityManager, "onKnownSeqs" | "onWakeUp">;
  applyUpdate: (state: EventStreamState) => void;
  reportError: (error: AppErrorDescriptor) => void;
  onStreamResync?: () => void;
  fallbackIntervalMs?: number;
  fallbackCooldownMs?: number;
  snapshotValidationIntervalMs?: number | null;
}

type SnapshotPollResponse = EventStreamState | {
  notModified: true;
  snapshotChecksum?: string;
  workerEntrySeqs?: Record<string, number>;
};

interface SnapshotPollResult {
  data: SnapshotPollResponse;
  lastEventId?: string | null;
}

function withFallbackErrorContext(
  error: unknown,
  fallback: Pick<AppErrorDescriptor, "source" | "action">,
) {
  const normalized = normalizeAppError(error, fallback);
  return {
    ...normalized,
    source: normalized.source || fallback.source,
    action: normalized.action || fallback.action,
  };
}

function isTransientConnectivityError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  if (error.name === "AbortError" || error.name === "NetworkError") {
    return true;
  }

  if (!(error instanceof TypeError)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("failed to fetch")
    || message.includes("network")
    || message.includes("load failed")
    || message.includes("offline")
  );
}

function normalizeLastEventId(lastEventId: string | number | null | undefined) {
  const value = String(lastEventId ?? "").trim();
  return value || null;
}

function compareEventIds(left: string, right: string) {
  if (parseEventStreamId(left) && parseEventStreamId(right)) {
    return compareEventStreamIds(left, right);
  }
  if (/^\d+$/.test(left) && /^\d+$/.test(right)) {
    const leftValue = BigInt(left);
    const rightValue = BigInt(right);
    return leftValue === rightValue ? 0 : leftValue > rightValue ? 1 : -1;
  }
  return left === right ? 0 : null;
}

export class LiveEventCursorManager {
  private lastEventId: string | null = null;
  private readonly storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
  private readonly storageKey: string | null;

  constructor(
    initialLastEventId?: string | number | null,
    options: {
      scopeKey?: string | null;
      storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
    } = {},
  ) {
    this.storage = options.storage ?? null;
    const scopeKey = options.scopeKey?.trim() ?? "";
    this.storageKey = scopeKey
      ? `omniharness:event-cursor:${scopeKey}`
      : null;
    if (this.storage && this.storageKey) {
      this.advance(this.storage.getItem(this.storageKey));
    }
    this.advance(initialLastEventId);
  }

  getCurrent() {
    return this.lastEventId;
  }

  advance(lastEventId: string | number | null | undefined) {
    const normalized = normalizeLastEventId(lastEventId);
    if (!normalized) return false;
    if (this.lastEventId) {
      const ordering = compareEventIds(normalized, this.lastEventId);
      if (ordering !== null && ordering <= 0) {
        return false;
      }
    }
    this.lastEventId = normalized;
    if (this.storage && this.storageKey) {
      safeSetBrowserStorageItem(this.storage, this.storageKey, normalized);
    }
    return true;
  }

  clear() {
    this.lastEventId = null;
    if (this.storage && this.storageKey) {
      this.storage.removeItem(this.storageKey);
    }
  }
}

function isNotModifiedSnapshot(value: SnapshotPollResponse): value is Extract<SnapshotPollResponse, { notModified: true }> {
  return typeof value === "object" && value !== null && "notModified" in value && value.notModified === true;
}

export class LiveEventConnectionManager {
  private readonly selectedRunId?: string | null;
  private readonly events: Pick<RuntimeAPIs["events"], "snapshot" | "open">;
  private readonly getSnapshotChecksum?: () => string | null | undefined;
  private readonly workerEntries: Pick<typeof workerEntriesManager, "onKnownSeqs" | "onStreamResync" | "onWakeUp">;
  private readonly sidebarWorkerActivity: Pick<SidebarWorkerActivityManager, "onKnownSeqs" | "onWakeUp">;
  private readonly applyUpdate: (state: EventStreamState) => void;
  private readonly reportError: (error: AppErrorDescriptor) => void;
  private readonly onStreamResync?: () => void;
  private readonly fallbackIntervalMs: number;
  private readonly fallbackCooldownMs: number;
  private readonly snapshotValidationIntervalMs: number | null;
  private eventSource: RuntimeSubscription | null = null;
  private fallbackTimer: ReturnType<typeof setInterval> | null = null;
  private snapshotValidationTimer: ReturnType<typeof setInterval> | null = null;
  private active = false;
  private pollingSnapshot = false;
  private snapshotPollPromise: Promise<boolean> | null = null;
  private reconnectingAfterResync = false;
  private lastSnapshotPollAt = 0;
  private readonly cursor: LiveEventCursorManager;
  private connectionGeneration = 0;

  constructor(options: LiveEventConnectionManagerOptions) {
    this.selectedRunId = options.selectedRunId;
    this.cursor = options.cursor ?? new LiveEventCursorManager(options.initialLastEventId);
    this.cursor.advance(options.initialLastEventId);
    this.events = options.events ?? createLegacyLiveEventAPIs({
      EventSourceConstructor: options.EventSourceConstructor,
      requestJson: options.requestJson,
      requestSnapshot: options.requestSnapshot,
    });
    this.getSnapshotChecksum = options.getSnapshotChecksum;
    this.workerEntries = options.workerEntries ?? workerEntriesManager;
    this.sidebarWorkerActivity = options.sidebarWorkerActivity ?? sidebarWorkerActivityManager;
    this.applyUpdate = options.applyUpdate;
    this.reportError = options.reportError;
    this.onStreamResync = options.onStreamResync;
    this.fallbackIntervalMs = options.fallbackIntervalMs ?? SNAPSHOT_FALLBACK_INTERVAL_MS;
    this.fallbackCooldownMs = options.fallbackCooldownMs ?? SNAPSHOT_FALLBACK_COOLDOWN_MS;
    this.snapshotValidationIntervalMs = options.snapshotValidationIntervalMs === undefined
      ? SNAPSHOT_VALIDATION_INTERVAL_MS
      : options.snapshotValidationIntervalMs;
  }

  start() {
    if (this.active) {
      return;
    }

    this.active = true;
    this.openEventSource();

    this.startSnapshotValidation();
    void this.pollSnapshot({ force: true });
  }

  private openEventSource() {
    this.eventSource = this.events.open({
      snapshot: false,
      runId: this.selectedRunId,
      lastEventId: this.cursor.getCurrent(),
    }, {
      onOpen: () => {
        this.stopFallbackPolling();
      },
      onEvent: (event) => {
        const streamEvent = event as {
          kind?: string;
          payload?: unknown;
          lastEventId?: string | null;
        };
        if (streamEvent.kind === "update") {
          this.handleUpdateEvent(streamEvent);
        } else if (streamEvent.kind === "update_error") {
          this.handleUpdateErrorEvent(streamEvent.payload);
        } else if (streamEvent.kind === "worker.entry_appended") {
          this.handleWorkerEntryAppended(streamEvent.payload);
        } else if (streamEvent.kind === "stream.resync_required") {
          void this.handleStreamResyncRequired();
        }
      },
      onError: () => {
        this.startFallbackPolling();
        void this.pollSnapshot({ force: true });
      },
    });
  }

  stop() {
    this.active = false;
    this.connectionGeneration++;
    this.stopFallbackPolling();
    this.stopSnapshotValidation();
    this.eventSource?.close();
    this.eventSource = null;
  }

  private handleUpdateEvent(event: { payload?: unknown; lastEventId?: string | null }) {
    try {
      if (event.lastEventId && !this.cursor.advance(event.lastEventId)) {
        return;
      }
      const data = event.payload as EventStreamState;
      if (!data || typeof data !== "object") {
        throw new TypeError("Invalid live update.");
      }
      this.stopFallbackPolling();
      this.applyUpdate(data);
      this.workerEntries.onKnownSeqs(data.workerEntrySeqs);
      this.sidebarWorkerActivity.onKnownSeqs(data.workerEntrySeqs);
    } catch {
      this.reportError({
        message: "The frontend received a malformed live update payload.",
        source: "Events",
        action: "Process live updates",
        suggestion: "Inspect the events route response payload and server logs, then refresh the page after fixing the malformed data.",
      });
    }
  }

  private handleWorkerEntryAppended(payload: unknown) {
    try {
      const data = payload as { workerId?: unknown; seq?: unknown; runId?: unknown };
      const workerId = typeof data.workerId === "string" ? data.workerId : null;
      const seq = typeof data.seq === "number" ? data.seq : null;
      const runId = typeof data.runId === "string" ? data.runId : null;
      if (!workerId || seq == null) {
        return;
      }
      this.workerEntries.onWakeUp({ workerId, seq });
      this.sidebarWorkerActivity.onWakeUp({ workerId, seq, runId });
    } catch {
      // Malformed frames are ignored — the next valid frame (or the
      // periodic snapshot poll) will re-sync any missed entries.
    }
  }

  private handleUpdateErrorEvent(payload: unknown) {
    try {
      this.reportError(withFallbackErrorContext(payload, {
        source: "Events",
        action: "Stream live updates",
      }));
    } catch {
      this.reportError({
        message: "The live event stream reported a malformed error payload.",
        source: "Events",
        action: "Stream live updates",
      });
    }

    this.startFallbackPolling();
    void this.pollSnapshot({ force: true });
  }

  private async handleStreamResyncRequired() {
    this.workerEntries.onStreamResync();
    this.onStreamResync?.();
    if (!this.active || this.reconnectingAfterResync) {
      return;
    }

    this.reconnectingAfterResync = true;
    this.eventSource?.close();
    this.eventSource = null;
    this.cursor.clear();
    try {
      const snapshotLoaded = await this.pollSnapshot({ force: true });
      if (!this.active || !snapshotLoaded) {
        this.startFallbackPolling();
        return;
      }

      this.openEventSource();
    } finally {
      this.reconnectingAfterResync = false;
    }
  }

  private startFallbackPolling() {
    if (this.fallbackTimer) {
      return;
    }

    this.fallbackTimer = setInterval(() => {
      void this.pollSnapshot();
    }, this.fallbackIntervalMs);
  }

  private stopFallbackPolling() {
    if (!this.fallbackTimer) {
      return;
    }

    clearInterval(this.fallbackTimer);
    this.fallbackTimer = null;
  }

  private startSnapshotValidation() {
    if (
      this.snapshotValidationTimer
      || this.snapshotValidationIntervalMs == null
      || this.snapshotValidationIntervalMs <= 0
    ) {
      return;
    }

    this.snapshotValidationTimer = setInterval(() => {
      void this.pollSnapshot();
    }, this.snapshotValidationIntervalMs);
  }

  private stopSnapshotValidation() {
    if (!this.snapshotValidationTimer) {
      return;
    }

    clearInterval(this.snapshotValidationTimer);
    this.snapshotValidationTimer = null;
  }

  private async pollSnapshot(options: { force?: boolean } = {}): Promise<boolean> {
    if (this.pollingSnapshot) {
      return this.snapshotPollPromise ?? Promise.resolve(false);
    }

    const now = Date.now();
    if (
      !this.active
      || (!options.force && now - this.lastSnapshotPollAt < this.fallbackCooldownMs)
    ) {
      return false;
    }

    this.lastSnapshotPollAt = now;
    this.pollingSnapshot = true;
    this.snapshotPollPromise = this.runSnapshotPoll();
    try {
      return await this.snapshotPollPromise;
    } finally {
      this.pollingSnapshot = false;
      this.snapshotPollPromise = null;
    }
  }

  private async runSnapshotPoll(): Promise<boolean> {
    const gen = this.connectionGeneration;
    try {
      const result = await this.events.snapshot({
        runId: this.selectedRunId,
        persisted: true,
        checksum: this.getSnapshotChecksum?.() ?? null,
      }) as SnapshotPollResult;
      if (!this.active || gen !== this.connectionGeneration) {
        return false;
      }
      this.setLastEventId(result.lastEventId);
      const data = result.data;
      if (isNotModifiedSnapshot(data)) {
        this.workerEntries.onKnownSeqs(data.workerEntrySeqs);
        this.sidebarWorkerActivity.onKnownSeqs(data.workerEntrySeqs);
        return true;
      }
      this.applyUpdate(data);
      this.workerEntries.onKnownSeqs(data?.workerEntrySeqs);
      this.sidebarWorkerActivity.onKnownSeqs(data?.workerEntrySeqs);
      return true;
    } catch (error) {
      if (this.active) {
        if (isTransientConnectivityError(error)) {
          return false;
        }

        this.reportError(withFallbackErrorContext(error, {
          source: "Events",
          action: "Load live state snapshot",
        }));
      }
      return false;
    }
  }

  private setLastEventId(lastEventId: string | number | null | undefined) {
    this.cursor.advance(lastEventId);
  }
}
