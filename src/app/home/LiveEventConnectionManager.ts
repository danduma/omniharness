import { type AppErrorDescriptor, normalizeAppError, requestJson as defaultRequestJson } from "@/lib/app-errors";
import type { EventStreamState } from "./types";
import { workerEntriesManager } from "./WorkerEntriesManager";

const SNAPSHOT_FALLBACK_INTERVAL_MS = 15_000;
const SNAPSHOT_FALLBACK_COOLDOWN_MS = 1_000;

type JsonRequester = typeof defaultRequestJson;

interface LiveEventConnectionManagerOptions {
  selectedRunId?: string | null;
  initialLastEventId?: string | number | null;
  EventSourceConstructor?: typeof EventSource;
  requestJson?: JsonRequester;
  getSnapshotChecksum?: () => string | null | undefined;
  workerEntries?: Pick<typeof workerEntriesManager, "onKnownSeqs" | "onStreamResync" | "onWakeUp">;
  applyUpdate: (state: EventStreamState) => void;
  reportError: (error: AppErrorDescriptor) => void;
  fallbackIntervalMs?: number;
  fallbackCooldownMs?: number;
}

type SnapshotPollResponse = EventStreamState | {
  notModified: true;
  snapshotChecksum?: string;
};

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

export class LiveEventConnectionManager {
  private readonly selectedRunId?: string | null;
  private readonly initialLastEventId?: string | number | null;
  private readonly EventSourceConstructor: typeof EventSource;
  private readonly requestJson: JsonRequester;
  private readonly getSnapshotChecksum?: () => string | null | undefined;
  private readonly workerEntries: Pick<typeof workerEntriesManager, "onKnownSeqs" | "onStreamResync" | "onWakeUp">;
  private readonly applyUpdate: (state: EventStreamState) => void;
  private readonly reportError: (error: AppErrorDescriptor) => void;
  private readonly fallbackIntervalMs: number;
  private readonly fallbackCooldownMs: number;
  private eventSource: EventSource | null = null;
  private fallbackTimer: ReturnType<typeof setInterval> | null = null;
  private active = false;
  private pollingSnapshot = false;
  private lastSnapshotPollAt = 0;

  constructor(options: LiveEventConnectionManagerOptions) {
    this.selectedRunId = options.selectedRunId;
    this.initialLastEventId = options.initialLastEventId;
    this.EventSourceConstructor = options.EventSourceConstructor ?? EventSource;
    this.requestJson = options.requestJson ?? defaultRequestJson;
    this.getSnapshotChecksum = options.getSnapshotChecksum;
    this.workerEntries = options.workerEntries ?? workerEntriesManager;
    this.applyUpdate = options.applyUpdate;
    this.reportError = options.reportError;
    this.fallbackIntervalMs = options.fallbackIntervalMs ?? SNAPSHOT_FALLBACK_INTERVAL_MS;
    this.fallbackCooldownMs = options.fallbackCooldownMs ?? SNAPSHOT_FALLBACK_COOLDOWN_MS;
  }

  start() {
    if (this.active) {
      return;
    }

    this.active = true;
    this.eventSource = new this.EventSourceConstructor(buildEventStreamUrl(this.selectedRunId, this.initialLastEventId));
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
      this.workerEntries.onStreamResync();
    });
    this.eventSource.onopen = () => {
      this.stopFallbackPolling();
    };
    this.eventSource.onerror = () => {
      // Browsers emit this during sleep/offline transitions while EventSource keeps retrying.
      this.startFallbackPolling();
      void this.pollSnapshot({ force: true });
    };

    void this.pollSnapshot({ force: true });
  }

  stop() {
    this.active = false;
    this.stopFallbackPolling();
    this.eventSource?.close();
    this.eventSource = null;
  }

  private handleUpdateEvent(event: MessageEvent) {
    try {
      const data = JSON.parse(event.data) as EventStreamState;
      this.stopFallbackPolling();
      this.applyUpdate(data);
      this.workerEntries.onKnownSeqs(data.workerEntrySeqs);
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
      const data = JSON.parse(event.data) as { workerId?: unknown; seq?: unknown };
      const workerId = typeof data.workerId === "string" ? data.workerId : null;
      const seq = typeof data.seq === "number" ? data.seq : null;
      if (!workerId || seq == null) {
        return;
      }
      this.workerEntries.onWakeUp({ workerId, seq });
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

  private async pollSnapshot(options: { force?: boolean } = {}) {
    const now = Date.now();
    if (
      !this.active
      || this.pollingSnapshot
      || (!options.force && now - this.lastSnapshotPollAt < this.fallbackCooldownMs)
    ) {
      return;
    }

    this.lastSnapshotPollAt = now;
    this.pollingSnapshot = true;

    try {
      const data = await this.requestJson<SnapshotPollResponse>(
        buildPersistedSnapshotUrl(this.selectedRunId, this.getSnapshotChecksum?.()),
        undefined,
        {
          source: "Events",
          action: "Load live state snapshot",
        },
      );
      if (isNotModifiedSnapshot(data)) {
        return;
      }
      if (this.active) {
        this.applyUpdate(data);
        this.workerEntries.onKnownSeqs(data?.workerEntrySeqs);
      }
    } catch (error) {
      if (this.active) {
        if (isTransientConnectivityError(error)) {
          return;
        }

        this.reportError(withFallbackErrorContext(error, {
          source: "Events",
          action: "Load live state snapshot",
        }));
      }
    } finally {
      this.pollingSnapshot = false;
    }
  }
}
