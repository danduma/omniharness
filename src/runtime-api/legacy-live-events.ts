import {
  AppRequestError,
  parseErrorResponse,
  type AppErrorDescriptor,
} from "@/lib/app-errors";
import { GOAL_SNAPSHOT_EVENT_TYPES, normalizeRuntimeStreamEvent } from "./stream";
import type {
  EventStreamHandlers,
  RuntimeAPIs,
  RuntimeSnapshotResult,
  RuntimeSubscription,
} from "./types";

type LegacySnapshotResult = {
  data: unknown;
  lastEventId?: string | null;
};

type LegacySnapshotRequester = (
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  fallback: Partial<AppErrorDescriptor>,
) => Promise<LegacySnapshotResult>;

type LegacyJsonRequester = <T>(
  input: RequestInfo | URL,
  init?: RequestInit,
  fallback?: Partial<AppErrorDescriptor>,
) => Promise<T>;

type LegacyEventSource = {
  close(): void;
  onerror: ((event: Event) => void) | null;
  onopen: ((event: Event) => void) | null;
  addEventListener(type: string, listener: (event: MessageEvent) => void): void;
};

type LegacyEventSourceConstructor = new (url: string) => LegacyEventSource;

function runParameter(runId: string | null | undefined, prefix: "?" | "&") {
  const value = runId?.trim();
  return value ? `${prefix}runId=${encodeURIComponent(value)}` : "";
}

export function buildEventStreamUrl(
  selectedRunId?: string | null,
  lastEventId?: string | number | null,
) {
  const runParam = runParameter(selectedRunId, "?");
  const cursor = String(lastEventId ?? "").trim();
  return `/api/events${runParam}${cursor
    ? `${runParam ? "&" : "?"}cursor=${encodeURIComponent(cursor)}`
    : ""}`;
}

export function buildPersistedSnapshotUrl(
  selectedRunId?: string | null,
  checksum?: string | null,
) {
  const checksumParam = checksum?.trim()
    ? `&checksum=${encodeURIComponent(checksum.trim())}`
    : "";
  return `/api/events?snapshot=1&persisted=1${runParameter(selectedRunId, "&")}${checksumParam}`;
}

export function createLegacyLiveEventAPIs(options: {
  EventSourceConstructor?: LegacyEventSourceConstructor;
  requestJson?: LegacyJsonRequester;
  requestSnapshot?: LegacySnapshotRequester;
  fetchImpl?: typeof fetch;
}): Pick<RuntimeAPIs["events"], "snapshot" | "open"> {
  const EventSourceConstructor = options.EventSourceConstructor
    ?? EventSource as unknown as LegacyEventSourceConstructor;
  return {
    async snapshot(input): Promise<RuntimeSnapshotResult> {
      const url = buildPersistedSnapshotUrl(input.runId, input.checksum);
      const fallback = {
        source: "Events",
        action: "Load live state snapshot",
      };
      if (options.requestSnapshot) {
        const result = await options.requestSnapshot(url, undefined, fallback);
        return {
          data: result.data,
          lastEventId: result.lastEventId ?? null,
        };
      }
      if (options.requestJson) {
        return {
          data: await options.requestJson(url, undefined, fallback),
          lastEventId: null,
        };
      }
      const fetchImpl = options.fetchImpl ?? fetch;
      const response = await fetchImpl(url, undefined);
      if (!response.ok) {
        throw new AppRequestError(await parseErrorResponse(response, fallback));
      }
      return {
        data: await response.json(),
        lastEventId: response.headers.get("x-omni-last-event-id"),
      };
    },
    open(input, handlers: EventStreamHandlers): RuntimeSubscription {
      const source = new EventSourceConstructor(
        buildEventStreamUrl(input.runId, input.lastEventId),
      );
      const eventTypes = [
        "update",
        "update_error",
        "worker.entry_appended",
        "worker.plan_updated",
        "worker.plan_boundary_started",
        "stream.resync_required",
        ...GOAL_SNAPSHOT_EVENT_TYPES,
      ];
      for (const type of eventTypes) {
        source.addEventListener(type, (event) => {
          handlers.onEvent(normalizeRuntimeStreamEvent({
            type,
            data: event.data,
            lastEventId: event.lastEventId,
          }));
        });
      }
      source.onopen = () => handlers.onOpen?.();
      source.onerror = () => {
        handlers.onError?.({
          code: "runtime.events_failed",
          message: "Event stream failed.",
          surface: "web",
        });
      };
      return { close: () => source.close() };
    },
  };
}
