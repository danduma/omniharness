import type { RuntimeAPIs, RuntimeSubscription } from "./types";
import { createFetchRuntimeRequest } from "./request";
import {
  GOAL_SNAPSHOT_EVENT_TYPES,
  normalizeRuntimeStreamEvent,
  type RuntimeStreamEvent,
} from "./stream";
import { createRuntimeDomains } from "./domains";

export interface WebRuntimeApiOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  EventSourceImpl?: EventSourceConstructor;
  bearerToken?: string | (() => string | null);
}

type RuntimeEventSource = {
  close(): void;
  readyState?: number;
  onopen?: (() => void) | null;
  addEventListener(type: string, listener: (event: RuntimeStreamEvent) => void): void;
};

type EventSourceConstructor = new (url: string) => RuntimeEventSource;

function joinUrl(baseUrl: string, path: string) {
  if (!baseUrl) return path;
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

export function createWebRuntimeAPIs(options: WebRuntimeApiOptions = {}): RuntimeAPIs {
  const fetchImpl = options.fetchImpl
    ?? (typeof fetch !== "undefined" ? fetch : null);
  if (!fetchImpl) {
    throw new TypeError("A fetch implementation is required.");
  }
  const baseUrl = options.baseUrl ?? "";
  const EventSourceCtor: EventSourceConstructor | null = options.EventSourceImpl
    ?? (typeof EventSource !== "undefined"
      ? EventSource as unknown as EventSourceConstructor
      : null);

  const request = createFetchRuntimeRequest({
    baseUrl,
    fetchImpl,
    surface: "web",
    bearerToken: options.bearerToken,
  });

  const domains = createRuntimeDomains({
    request,
    openEvents(path, input, handlers): RuntimeSubscription {
      if (!EventSourceCtor) {
        handlers.onError?.({
          code: "runtime.events_unavailable",
          message: "Runtime event streaming requires EventSource support.",
          surface: "web",
        });
        return { close() {} };
      }

      let source: RuntimeEventSource | null = null;
      let closed = false;
      const emit = (event: RuntimeStreamEvent) => {
        handlers.onEvent(normalizeRuntimeStreamEvent(event));
      };
      const connect = async () => {
        let ticket: string | null = null;
        if (options.bearerToken) {
          const issued = await request("POST", "/api/auth/stream-ticket", {
            body: { path: new URL(path, "http://runtime.local").pathname },
          }) as { ticket: string };
          ticket = issued.ticket;
        }
        if (closed) {
          return;
        }
        const query = new URLSearchParams();
        if (ticket) {
          query.set("ticket", ticket);
        }
        if (input.lastEventId) {
          query.set("cursor", input.lastEventId);
        }
        const separator = path.includes("?") ? "&" : "?";
        const suffix = query.size > 0 ? `${separator}${query.toString()}` : "";
        const nextSource = new EventSourceCtor(
          joinUrl(baseUrl, `${path}${suffix}`),
        );
        source = nextSource;
        nextSource.onopen = () => handlers.onOpen?.();
        nextSource.addEventListener("message", emit);
        nextSource.addEventListener("update", emit);
        nextSource.addEventListener("data", emit);
        nextSource.addEventListener("exit", emit);
        nextSource.addEventListener("update_error", emit);
        nextSource.addEventListener("worker.entry_appended", emit);
        nextSource.addEventListener("stream.resync_required", emit);
        nextSource.addEventListener("auth.session_revoked", emit);
        nextSource.addEventListener("runner.stopping", emit);
        nextSource.addEventListener("runner.renamed", emit);
        nextSource.addEventListener("runner.rekeyed", emit);
        nextSource.addEventListener("worker.plan_updated", emit);
        nextSource.addEventListener("worker.plan_boundary_started", emit);
        for (const eventType of GOAL_SNAPSHOT_EVENT_TYPES) {
          nextSource.addEventListener(eventType, emit);
        }
        nextSource.addEventListener("error", () => {
          if (closed || source !== nextSource) {
            return;
          }
          if (nextSource.readyState !== 2) {
            handlers.onError?.({
              code: "runtime.events_reconnecting",
              message: "Event stream is reconnecting.",
              surface: "web",
            });
            return;
          }
          nextSource.close();
          source = null;
          handlers.onError?.({
            code: "runtime.events_failed",
            message: "Event stream failed.",
            surface: "web",
          });
        });
      };
      void connect().catch((error: unknown) => {
        if (closed) {
          return;
        }
        handlers.onError?.({
          code: "runtime.stream_ticket_failed",
          message: error instanceof Error ? error.message : String(error),
          surface: "web",
        });
      });
      return {
        close: () => {
          closed = true;
          source?.close();
        },
      };
    },
  });
  return {
    runtime: {
      surface: "web",
      label: "Web",
      supportsNativeNotifications: false,
      supportsEditorActions: false,
    },
    ...domains,
  };
}
