import type { EventStreamHandlers, RuntimeAPIs, RuntimeApiError, RuntimeSubscription } from "./types";
import {
  normalizeRuntimeStreamEvent,
} from "./stream";
import {
  normalizeRuntimeHttpError,
  parseRuntimeBody,
  type RuntimeDomainRequestOptions,
} from "./request";
import { createRuntimeDomains } from "./domains";

export type VSCodeRuntimeBridgeRequest = {
  id: string;
  type:
    | "api:proxy"
    | "sse:open"
    | "sse:close"
    | "vscode:openFile"
    | "vscode:openExternal"
    | "vscode:notify"
    | "vscode:openDiff"
    | "vscode:login"
    | "vscode:profiles"
    | "vscode:identity";
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
  profileId?: string;
}

type ProxyResponse = {
  status: number;
  headers?: Record<string, string>;
  bodyText?: string;
  bodyBytes?: number[];
};

let requestSeq = 0;

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
  const profileId = options.profileId;

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

  async function request(
    method: string,
    path: string,
    options: RuntimeDomainRequestOptions = {},
  ) {
    if (options.signal?.aborted) {
      throw options.signal.reason ?? new DOMException("Aborted", "AbortError");
    }
    const headers: Record<string, string> = { ...options.headers };
    let bodyText: string | undefined;
    let formData: Array<
      | { name: string; value: string }
      | { name: string; file: { name: string; type: string; bytes: number[] } }
    > | undefined;
    if (options.body !== undefined) {
      if (options.body instanceof FormData) {
        formData = await Promise.all(Array.from(options.body.entries()).map(async ([name, value]) => {
          if (typeof value === "string") {
            return { name, value };
          }
          return {
            name,
            file: {
              name: value.name,
              type: value.type,
              bytes: Array.from(new Uint8Array(await value.arrayBuffer())),
            },
          };
        }));
      } else {
        headers["content-type"] = "application/json";
        bodyText = JSON.stringify(options.body);
      }
    }
    const abort = new Promise<never>((_, reject) => {
      options.signal?.addEventListener("abort", () => {
        reject(options.signal?.reason ?? new DOMException("Aborted", "AbortError"));
      }, { once: true });
    });
    const bridgeRequest = requestBridge({
      type: "api:proxy",
      payload: {
        profileId,
        method,
        path,
        headers,
        bodyText,
        formData,
        responseType: options.responseType,
      },
    }) as Promise<ProxyResponse>;
    const proxyResponse = options.signal
      ? await Promise.race([bridgeRequest, abort])
      : await bridgeRequest;
    const parsed = options.responseType === "blob"
      ? new Blob([new Uint8Array(proxyResponse.bodyBytes ?? [])], {
          type: proxyResponse.headers?.["content-type"] ?? "application/octet-stream",
        })
      : options.responseType === "arrayBuffer"
        ? Uint8Array.from(proxyResponse.bodyBytes ?? []).buffer
        : parseRuntimeBody(proxyResponse.bodyText);
    if (proxyResponse.status < 200 || proxyResponse.status >= 300) {
      throw normalizeRuntimeHttpError({
        status: proxyResponse.status,
        body: parsed,
        surface: "vscode",
      });
    }
    return options.includeResponseMetadata
      ? { data: parsed, headers: proxyResponse.headers ?? {} }
      : parsed;
  }

  const domains = createRuntimeDomains({
    request,
    openEvents(path, input, handlers: EventStreamHandlers): RuntimeSubscription {
      const id = String(++requestSeq);
      const unsubscribe = options.transport.addMessageListener((rawMessage) => {
        const message = rawMessage as Partial<VSCodeRuntimeBridgeResponse>;
        if (message.id !== id) {
          return;
        }
        if (message.type === "sse:event" && message.success) {
          const frame = message.data as {
            id?: unknown;
            event?: unknown;
            payload?: unknown;
          };
          if (typeof frame.event === "string") {
            handlers.onEvent(normalizeRuntimeStreamEvent({
              type: frame.event,
              data: JSON.stringify(frame.payload ?? null),
              lastEventId: typeof frame.id === "string" ? frame.id : undefined,
            }));
          }
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
          profileId,
          path,
          lastEventId: input.lastEventId ?? null,
        },
      });
      return {
        close() {
          unsubscribe();
          options.transport.postMessage({
            id: `${id}:close`,
            type: "sse:close",
            payload: { id },
          });
        },
      };
    },
  });

  return {
    runtime: {
      surface: "vscode",
      label: "VS Code",
      supportsNativeNotifications: true,
      supportsEditorActions: true,
    },
    ...domains,
    native: {
      openExternal(input) {
        return requestBridge({ type: "vscode:openExternal", payload: input }) as Promise<{ ok: true }>;
      },
      notify(input) {
        return requestBridge({ type: "vscode:notify", payload: input }) as Promise<{ ok: boolean }>;
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
