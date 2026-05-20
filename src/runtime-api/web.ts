import type { RuntimeAPIs, RuntimeApiError, RuntimeSubscription } from "./types";

export interface WebRuntimeApiOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  EventSourceImpl?: EventSourceConstructor;
}

type RuntimeEventSourceEvent = {
  type: string;
  data: string;
};

type RuntimeEventSource = {
  close(): void;
  addEventListener(type: string, listener: (event: RuntimeEventSourceEvent) => void): void;
};

type EventSourceConstructor = new (url: string) => RuntimeEventSource;

function buildQuery(params: Record<string, string | null | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== "") {
      search.set(key, value);
    }
  }
  const value = search.toString();
  return value ? `?${value}` : "";
}

function joinUrl(baseUrl: string, path: string) {
  if (!baseUrl) return path;
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

function parseEventData(event: RuntimeEventSourceEvent) {
  if (!event.data) {
    return null;
  }
  try {
    return JSON.parse(event.data) as unknown;
  } catch {
    return event.data;
  }
}

function normalizeStreamEvent(event: RuntimeEventSourceEvent) {
  const data = parseEventData(event);
  if (event.type === "update") {
    return { kind: "update", payload: data };
  }
  if (event.type === "stream.resync_required") {
    return {
      kind: "stream.resync_required",
      ...(data && typeof data === "object" ? data : { payload: data }),
    };
  }
  return data;
}

async function parseJson(response: Response) {
  const text = await response.text();
  if (!text) return null;
  return JSON.parse(text) as unknown;
}

function normalizeError(response: Response, body: unknown): RuntimeApiError {
  const payload = body && typeof body === "object" && "error" in body
    ? (body as { error?: { code?: unknown; message?: unknown; details?: unknown; surface?: unknown } }).error
    : null;
  const message = typeof payload?.message === "string" ? payload.message : `Runtime request failed with HTTP ${response.status}.`;
  return {
    code: typeof payload?.code === "string" ? payload.code : `runtime.http_${response.status}`,
    message,
    details: payload?.details,
    surface: typeof payload?.surface === "string" ? payload.surface : "web",
  };
}

export function createWebRuntimeAPIs(options: WebRuntimeApiOptions = {}): RuntimeAPIs {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl ?? "";
  const EventSourceCtor = options.EventSourceImpl
    ?? (typeof EventSource !== "undefined" ? EventSource : null);

  async function request(path: string, init: RequestInit = {}) {
    const response = await fetchImpl(joinUrl(baseUrl, path), init);
    const body = await parseJson(response);
    if (!response.ok) {
      throw normalizeError(response, body);
    }
    return body;
  }

  function post(path: string, body: unknown) {
    return request(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  return {
    runtime: {
      surface: "web",
      label: "Web",
      supportsNativeNotifications: false,
      supportsEditorActions: false,
    },
    bootstrap: {
      load(input) {
        return request(`/api/runtime/bootstrap${buildQuery({
          run: input.selectedRunId ?? null,
          project: input.draftProjectPath ?? null,
          pair: input.pairToken ?? null,
        })}`, { method: "GET" });
      },
    },
    events: {
      open(input, handlers): RuntimeSubscription {
        if (!EventSourceCtor) {
          handlers.onError?.({
            code: "runtime.events_unavailable",
            message: "Runtime event streaming requires EventSource support.",
            surface: "web",
          });
          return { close() {} };
        }

        const source = new EventSourceCtor(joinUrl(baseUrl, `/api/events${buildQuery({
          runId: input.runId ?? null,
          lastEventId: input.lastEventId ?? null,
        })}`));
        const emit = (event: RuntimeEventSourceEvent) => {
          handlers.onEvent(normalizeStreamEvent(event));
        };
        source.addEventListener("message", emit);
        source.addEventListener("update", emit);
        source.addEventListener("stream.resync_required", emit);
        source.addEventListener("error", () => {
          handlers.onError?.({
            code: "runtime.events_failed",
            message: "Event stream failed.",
            surface: "web",
          });
        });

        return {
          close() {
            source.close();
          },
        };
      },
      fetchLog(input) {
        return request(`/api/events/log${buildQuery({ since: input.since, runId: input.runId })}`, { method: "GET" });
      },
    },
    conversations: {
      create(input) {
        return post("/api/conversations", input);
      },
      sendMessage(input) {
        return post("/api/messages", input);
      },
    },
    workers: {
      listEntries(input) {
        return request(`/api/workers/${encodeURIComponent(input.workerId)}/entries${buildQuery({
          runId: input.runId,
          afterSeq: input.afterSeq == null ? null : String(input.afterSeq),
        })}`, { method: "GET" });
      },
    },
    settings: {
      load() {
        return request("/api/settings", { method: "GET" });
      },
      save(input) {
        return post("/api/settings", input);
      },
    },
  };
}
