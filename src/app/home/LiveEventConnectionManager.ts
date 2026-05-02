import { type AppErrorDescriptor, normalizeAppError, requestJson as defaultRequestJson } from "@/lib/app-errors";
import type { EventStreamState } from "./types";

const SNAPSHOT_FALLBACK_INTERVAL_MS = 5_000;
const SNAPSHOT_FALLBACK_COOLDOWN_MS = 1_000;

type JsonRequester = typeof defaultRequestJson;

interface LiveEventConnectionManagerOptions {
  selectedRunId?: string | null;
  EventSourceConstructor?: typeof EventSource;
  requestJson?: JsonRequester;
  applyUpdate: (state: EventStreamState) => void;
  reportError: (error: AppErrorDescriptor) => void;
  fallbackIntervalMs?: number;
  fallbackCooldownMs?: number;
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

export function buildEventStreamUrl(selectedRunId?: string | null) {
  const runParam = encodeRunParam(selectedRunId, "?");
  return runParam ? `/api/events${runParam}` : "/api/events";
}

export function buildPersistedSnapshotUrl(selectedRunId?: string | null) {
  return `/api/events?snapshot=1&persisted=1${encodeRunParam(selectedRunId, "&")}`;
}

export class LiveEventConnectionManager {
  private readonly selectedRunId?: string | null;
  private readonly EventSourceConstructor: typeof EventSource;
  private readonly requestJson: JsonRequester;
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
    this.EventSourceConstructor = options.EventSourceConstructor ?? EventSource;
    this.requestJson = options.requestJson ?? defaultRequestJson;
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
    this.eventSource = new this.EventSourceConstructor(buildEventStreamUrl(this.selectedRunId));
    this.eventSource.addEventListener("update", (event) => {
      this.handleUpdateEvent(event);
    });
    this.eventSource.addEventListener("update_error", (event) => {
      this.handleUpdateErrorEvent(event);
    });
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
    } catch {
      this.reportError({
        message: "The frontend received a malformed update payload from /api/events.",
        source: "Events",
        action: "Process live updates",
        suggestion: "Inspect the events route response payload and server logs, then refresh the page after fixing the malformed data.",
      });
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
      const data = await this.requestJson<EventStreamState>(
        buildPersistedSnapshotUrl(this.selectedRunId),
        undefined,
        {
          source: "Events",
          action: "Load live state snapshot",
        },
      );
      if (this.active) {
        this.applyUpdate(data);
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
