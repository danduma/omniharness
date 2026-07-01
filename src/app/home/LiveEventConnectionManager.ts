import {
  AppRequestError,
  type AppErrorDescriptor,
  normalizeAppError,
  parseErrorResponse,
  requestJson as defaultRequestJson,
} from "@/lib/app-errors";
import type { EventStreamState } from "./types";
import { workerEntriesManager } from "./WorkerEntriesManager";
import { sidebarWorkerActivityManager, type SidebarWorkerActivityManager } from "./SidebarWorkerActivityManager";

const SNAPSHOT_FALLBACK_INTERVAL_MS = 15_000;
const SNAPSHOT_FALLBACK_COOLDOWN_MS = 1_000;
const SNAPSHOT_VALIDATION_INTERVAL_MS = 5_000;

type JsonRequester = typeof defaultRequestJson;
type SnapshotRequester = (
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  fallback: Partial<AppErrorDescriptor>,
) => Promise<SnapshotPollResult>;

interface LiveEventConnectionManagerOptions {
  selectedRunId?: string | null;
  initialLastEventId?: string | number | null;
  EventSourceConstructor?: typeof EventSource;
  requestJson?: JsonRequester;
  requestSnapshot?: SnapshotRequester;
  getSnapshotChecksum?: () => string | null | undefined;
  workerEntries?: Pick<typeof workerEntriesManager, "onKnownSeqs" | "onStreamResync" | "onWakeUp">;
  sidebarWorkerActivity?: Pick<SidebarWorkerActivityManager, "onKnownSeqs" | "onWakeUp">;
  applyUpdate: (state: EventStreamState) => void;
  reportError: (error: AppErrorDescriptor) => void;
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

function encodeRunParam(selectedRunId: string | null | undefined, prefix: "?" | "&") {
  const runId = selectedRunId?.trim();
  return runId ? `${prefix}runId=${encodeURIComponent(runId)}` : "";
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

function encodeLastEventIdParam(lastEventId: string | number | null | undefined, prefix: "?" | "&") {
  const value = String(lastEventId ?? "").trim();
  return value ? `${prefix}lastEventId=${encodeURIComponent(value)}` : "";
}

function normalizeLastEventId(lastEventId: string | number | null | undefined) {
  const value = String(lastEventId ?? "").trim();
  return value || null;
}

export function buildEventStreamUrl(selectedRunId?: string | null, lastEventId?: string | number | null) {
  const runParam = encodeRunParam(selectedRunId, "?");
  const lastEventIdParam = encodeLastEventIdParam(lastEventId, runParam ? "&" : "?");
  return `/api/events${runParam}${lastEventIdParam}`;
}

export function buildPersistedSnapshotUrl(selectedRunId?: string | null, checksum?: string | null) {
  const checksumParam = checksum?.trim() ? `&checksum=${encodeURIComponent(checksum.trim())}` : "";
  return `/api/events?snapshot=1&persisted=1${encodeRunParam(selectedRunId, "&")}${checksumParam}`;
}

function isNotModifiedSnapshot(value: SnapshotPollResponse): value is Extract<SnapshotPollResponse, { notModified: true }> {
  return typeof value === "object" && value !== null && "notModified" in value && value.notModified === true;
}

async function defaultRequestSnapshot(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  fallback: Partial<AppErrorDescriptor>,
): Promise<SnapshotPollResult> {
  const response = await fetch(input, init);
  if (!response.ok) {
    throw new AppRequestError(await parseErrorResponse(response, fallback));
  }

  return {
    data: await response.json() as SnapshotPollResponse,
    lastEventId: response.headers.get("x-omni-last-event-id"),
  };
}

export class LiveEventConnectionManager {
  private readonly selectedRunId?: string | null;
  private readonly EventSourceConstructor: typeof EventSource;
  private readonly requestSnapshot: SnapshotRequester;
  private readonly getSnapshotChecksum?: () => string | null | undefined;
  private readonly workerEntries: Pick<typeof workerEntriesManager, "onKnownSeqs" | "onStreamResync" | "onWakeUp">;
  private readonly sidebarWorkerActivity: Pick<SidebarWorkerActivityManager, "onKnownSeqs" | "onWakeUp">;
  private readonly applyUpdate: (state: EventStreamState) => void;
  private readonly reportError: (error: AppErrorDescriptor) => void;
  private readonly fallbackIntervalMs: number;
  private readonly fallbackCooldownMs: number;
  private readonly snapshotValidationIntervalMs: number | null;
  private eventSource: EventSource | null = null;
  private fallbackTimer: ReturnType<typeof setInterval> | null = null;
  private snapshotValidationTimer: ReturnType<typeof setInterval> | null = null;
  private active = false;
  private pollingSnapshot = false;
  private snapshotPollPromise: Promise<boolean> | null = null;
  private reconnectingAfterResync = false;
  private lastSnapshotPollAt = 0;
  private lastEventId: string | null;
  private connectionGeneration = 0;

  constructor(options: LiveEventConnectionManagerOptions) {
    this.selectedRunId = options.selectedRunId;
    this.lastEventId = normalizeLastEventId(options.initialLastEventId);
    this.EventSourceConstructor = options.EventSourceConstructor ?? EventSource;
    const requestJson = options.requestJson;
    this.requestSnapshot = options.requestSnapshot
      ?? (requestJson
        ? async (input, init, fallback) => ({
          data: await requestJson<SnapshotPollResponse>(input, init, fallback),
          lastEventId: null,
        })
        : defaultRequestSnapshot);
    this.getSnapshotChecksum = options.getSnapshotChecksum;
    this.workerEntries = options.workerEntries ?? workerEntriesManager;
    this.sidebarWorkerActivity = options.sidebarWorkerActivity ?? sidebarWorkerActivityManager;
    this.applyUpdate = options.applyUpdate;
    this.reportError = options.reportError;
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
    this.eventSource = new this.EventSourceConstructor(buildEventStreamUrl(this.selectedRunId, this.lastEventId));
    this.eventSource.addEventListener("update", (event) => {
      this.handleUpdateEvent(event);
    });
    this.eventSource.addEventListener("update_error", (event) => {
      this.handleUpdateErrorEvent(event);
    });
    // Worker conversation stream wake-ups. The frame carries only
    // { workerId, seq } — the entry payload is always refetched via
    // /api/workers/:workerId/entries?afterSeq=. See
    // docs/architecture/worker-conversation-stream.md.
    this.eventSource.addEventListener("worker.entry_appended", (event) => {
      this.handleWorkerEntryAppended(event);
    });
    this.eventSource.addEventListener("stream.resync_required", () => {
      void this.handleStreamResyncRequired();
    });
    this.eventSource.onopen = () => {
      this.stopFallbackPolling();
    };
    this.eventSource.onerror = () => {
      // Browsers emit this during sleep/offline transitions while EventSource keeps retrying.
      this.startFallbackPolling();
      void this.pollSnapshot({ force: true });
    };
  }

  stop() {
    this.active = false;
    this.connectionGeneration++;
    this.stopFallbackPolling();
    this.stopSnapshotValidation();
    this.eventSource?.close();
    this.eventSource = null;
  }

  private handleUpdateEvent(event: MessageEvent) {
    try {
      const data = JSON.parse(event.data) as EventStreamState;
      this.stopFallbackPolling();
      this.applyUpdate(data);
      this.workerEntries.onKnownSeqs(data.workerEntrySeqs);
      this.sidebarWorkerActivity.onKnownSeqs(data.workerEntrySeqs);
    } catch {
      this.reportError({
        message: "The frontend received a malformed update payload from /api/events.",
        source: "Events",
        action: "Process live updates",
        suggestion: "Inspect the events route response payload and server logs, then refresh the page after fixing the malformed data.",
      });
    }
  }

  private handleWorkerEntryAppended(event: MessageEvent) {
    try {
      const data = JSON.parse(event.data) as { workerId?: unknown; seq?: unknown; runId?: unknown };
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

  private handleUpdateErrorEvent(event: MessageEvent) {
    try {
      this.reportError(withFallbackErrorContext(JSON.parse(event.data), {
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
    if (!this.active || this.reconnectingAfterResync) {
      return;
    }

    this.reconnectingAfterResync = true;
    this.eventSource?.close();
    this.eventSource = null;
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
      const result = await this.requestSnapshot(
        buildPersistedSnapshotUrl(this.selectedRunId, this.getSnapshotChecksum?.()),
        undefined,
        {
          source: "Events",
          action: "Load live state snapshot",
        },
      );
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
    const normalized = normalizeLastEventId(lastEventId);
    if (normalized) {
      this.lastEventId = normalized;
    }
  }
}
