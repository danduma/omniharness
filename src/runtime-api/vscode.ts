import type { EventStreamHandlers, RuntimeAPIs, RuntimeApiError, RuntimeSubscription } from "./types";

export type VSCodeRuntimeBridgeRequest = {
  id: string;
  type: "api:proxy" | "vscode:openFile" | "vscode:openExternal" | "vscode:openDiff";
  payload?: unknown;
};

export type VSCodeRuntimeBridgeResponse = {
  id: string;
  type?: string;
  success: boolean;
  data?: unknown;
  error?: RuntimeApiError;
};

export interface VSCodeRuntimeApiTransport {
  postMessage(message: VSCodeRuntimeBridgeRequest): void;
  addMessageListener(listener: (message: unknown) => void): () => void;
}

export interface VSCodeRuntimeApiOptions {
  transport: VSCodeRuntimeApiTransport;
  timeoutMs?: number;
}

type ProxyResponse = {
  status: number;
  headers?: Record<string, string>;
  bodyText?: string;
};

let requestSeq = 0;

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

function parseBody(bodyText: string | undefined) {
  if (!bodyText) return null;
  return JSON.parse(bodyText) as unknown;
}

function normalizeHttpError(response: ProxyResponse, body: unknown): RuntimeApiError {
  const payload = body && typeof body === "object" && "error" in body
    ? (body as { error?: { code?: unknown; message?: unknown; details?: unknown } }).error
    : null;
  return {
    code: typeof payload?.code === "string" ? payload.code : `runtime.http_${response.status}`,
    message: typeof payload?.message === "string" ? payload.message : `Runtime request failed with HTTP ${response.status}.`,
    details: payload?.details,
    surface: "vscode",
  };
}

function normalizeBridgeError(error: unknown): RuntimeApiError {
  if (error && typeof error === "object" && "message" in error) {
    return {
      code: "surface.bridge_failed",
      message: String((error as { message?: unknown }).message),
      surface: "vscode",
    };
  }
  return {
    code: "surface.bridge_failed",
    message: String(error),
    surface: "vscode",
  };
}

export function createVSCodeRuntimeAPIs(options: VSCodeRuntimeApiOptions): RuntimeAPIs {
  const timeoutMs = options.timeoutMs ?? 30_000;

  function requestBridge(message: Omit<VSCodeRuntimeBridgeRequest, "id">): Promise<unknown> {
    const id = String(++requestSeq);
    return new Promise((resolve, reject) => {
      let settled = false;
      const unsubscribe = options.transport.addMessageListener((rawMessage) => {
        const response = rawMessage as Partial<VSCodeRuntimeBridgeResponse>;
        if (response.id !== id) {
          return;
        }
        settled = true;
        unsubscribe();
        clearTimeout(timer);
        if (response.success) {
          resolve(response.data);
        } else {
          reject(response.error ?? {
            code: "surface.bridge_failed",
            message: "VS Code bridge request failed.",
            surface: "vscode",
          });
        }
      });
      const timer = setTimeout(() => {
        if (settled) {
          return;
        }
        settled = true;
        unsubscribe();
        reject({
          code: "surface.bridge_failed",
          message: "VS Code bridge request timed out.",
          surface: "vscode",
        });
      }, timeoutMs);

      try {
        options.transport.postMessage({ ...message, id });
      } catch (error) {
        settled = true;
        unsubscribe();
        clearTimeout(timer);
        reject(normalizeBridgeError(error));
      }
    });
  }

  async function request(method: string, path: string, body?: unknown) {
    const headers: Record<string, string> = {};
    let bodyText: string | undefined;
    if (body !== undefined) {
      headers["content-type"] = "application/json";
      bodyText = JSON.stringify(body);
    }
    const proxyResponse = await requestBridge({
      type: "api:proxy",
      payload: { method, path, headers, bodyText },
    }) as ProxyResponse;
    const parsed = parseBody(proxyResponse.bodyText);
    if (proxyResponse.status < 200 || proxyResponse.status >= 300) {
      throw normalizeHttpError(proxyResponse, parsed);
    }
    return parsed;
  }

  function post(path: string, body: unknown) {
    return request("POST", path, body);
  }

  return {
    runtime: {
      surface: "vscode",
      label: "VS Code",
      supportsNativeNotifications: false,
      supportsEditorActions: true,
    },
    bootstrap: {
      load(input) {
        return request("GET", `/api/runtime/bootstrap${buildQuery({
          run: input.selectedRunId ?? null,
          project: input.draftProjectPath ?? null,
          pair: input.pairToken ?? null,
        })}`);
      },
    },
    events: {
      open(input, handlers: EventStreamHandlers): RuntimeSubscription {
        const id = String(++requestSeq);
        const unsubscribe = options.transport.addMessageListener((rawMessage) => {
          const message = rawMessage as Partial<VSCodeRuntimeBridgeResponse>;
          if (message.id !== id) {
            return;
          }
          if (message.type === "sse:event" && message.success) {
            handlers.onEvent(message.data);
            return;
          }
          if (message.success === false) {
            handlers.onError?.(message.error ?? {
              code: "runtime.events_failed",
              message: "VS Code event stream failed.",
              surface: "vscode",
            });
          }
        });
        options.transport.postMessage({
          id,
          type: "sse:open",
          payload: {
            runId: input.runId ?? null,
            lastEventId: input.lastEventId ?? null,
          },
        } as VSCodeRuntimeBridgeRequest);
        return {
          close() {
            unsubscribe();
            options.transport.postMessage({
              id: `${id}:close`,
              type: "sse:close",
              payload: { id },
            } as VSCodeRuntimeBridgeRequest);
          },
        };
      },
      fetchLog(input) {
        return request("GET", `/api/events/log${buildQuery({ since: input.since, runId: input.runId })}`);
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
        return request("GET", `/api/workers/${encodeURIComponent(input.workerId)}/entries${buildQuery({
          runId: input.runId,
          afterSeq: input.afterSeq == null ? null : String(input.afterSeq),
        })}`);
      },
    },
    settings: {
      load() {
        return request("GET", "/api/settings");
      },
      save(input) {
        return post("/api/settings", input);
      },
    },
    native: {
      openExternal(input) {
        return requestBridge({ type: "vscode:openExternal", payload: input }) as Promise<{ ok: true }>;
      },
    },
    editor: {
      openFile(input) {
        return requestBridge({ type: "vscode:openFile", payload: input }) as Promise<{ ok: true }>;
      },
      openDiff(input) {
        return requestBridge({ type: "vscode:openDiff", payload: input }) as Promise<{ ok: true }>;
      },
    },
  };
}
