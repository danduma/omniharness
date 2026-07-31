import type {
  EventStreamHandlers,
  RuntimeAPIs,
  RuntimeApiError,
  RuntimeSubscription,
} from "./types";
import {
  normalizeRuntimeHttpError,
  parseRuntimeBody,
  type RuntimeDomainRequestOptions,
} from "./request";
import { createRuntimeDomains } from "./domains";
import { normalizeRuntimeStreamEvent } from "./stream";
import { createWebRuntimeAPIs } from "./web";
import {
  createCapacitorRuntimeAPIs,
  isCapacitorNativeRuntime,
} from "./capacitor";
import type {
  RunnerCredentialBinding,
  RunnerCredentialMetadata,
  RunnerCredentialStore,
} from "@/interface/runners/RunnerCredentialStore";
import type { RunnerProfile } from "@/interface/runners/RunnerProfile";

export type ElectronRuntimeTarget = {
  profileId: string;
  baseUrl: string;
  credentialRef: string | null;
  runnerInstanceId: string | null;
};

export type ElectronBridgeRequest = {
  id: string;
  type: "api:proxy" | "sse:open" | "sse:close" | "auth:native";
  target: ElectronRuntimeTarget;
  payload?: unknown;
};

export type ElectronBridgeResponse = {
  id: string;
  type: string;
  success: boolean;
  data?: unknown;
  error?: RuntimeApiError;
};

export type ElectronNativeBridge = {
  invokeRuntime(request: ElectronBridgeRequest): Promise<ElectronBridgeResponse>;
  addRuntimeListener(listener: (message: ElectronBridgeResponse) => void): () => void;
  profileGet(): string | null;
  profileSet(value: string): void;
  profileRemove(): void;
  credential(command: string, payload: unknown): Promise<unknown>;
  tls(command: string, payload: unknown): Promise<unknown>;
  openExternal(input: { url: string }): Promise<{ ok: true }>;
  chooseFolder?(): Promise<{ path: string | null }>;
  notify?(input: { title: string; body?: string }): Promise<{ ok: boolean }>;
};

declare global {
  interface Window {
    omniElectron?: ElectronNativeBridge;
  }
}

type ProxyResponse = {
  status: number;
  headers?: Record<string, string>;
  bodyText?: string;
  bodyBytes?: number[];
};

let requestSequence = 0;

function resolveBridge(bridge?: ElectronNativeBridge | null) {
  const value = bridge === undefined
    ? (typeof window !== "undefined" ? window.omniElectron : null)
    : bridge;
  if (!value) throw new Error("Electron runtime bridge is unavailable.");
  return value;
}

export function isElectronNativeRuntime() {
  return typeof window !== "undefined" && Boolean(window.omniElectron);
}

function targetFromProfile(profile: RunnerProfile): ElectronRuntimeTarget {
  return {
    profileId: profile.id,
    baseUrl: profile.baseUrl,
    credentialRef: profile.credentialRef,
    runnerInstanceId: profile.runnerInstanceId,
  };
}

export function createElectronRuntimeAPIs(options: {
  target: ElectronRuntimeTarget;
  bridge?: ElectronNativeBridge | null;
  timeoutMs?: number;
}): RuntimeAPIs {
  const bridge = resolveBridge(options.bridge);
  const timeoutMs = options.timeoutMs ?? 30_000;

  async function invoke(
    type: ElectronBridgeRequest["type"],
    payload?: unknown,
    target = options.target,
  ) {
    const id = String(++requestSequence);
    const result = await Promise.race([
      bridge.invokeRuntime({ id, type, target, payload }),
      new Promise<never>((_, reject) => setTimeout(() => reject({
        code: "surface.bridge_failed",
        message: "Electron bridge request timed out.",
        surface: "electron",
      }), timeoutMs)),
    ]);
    if (!result || result.id !== id || result.type !== type) {
      throw {
        code: "surface.bridge_failed",
        message: "Electron bridge returned an invalid response.",
        surface: "electron",
      } satisfies RuntimeApiError;
    }
    if (!result.success) {
      throw result.error ?? {
        code: "surface.bridge_failed",
        message: "Electron bridge request failed.",
        surface: "electron",
      };
    }
    return result.data;
  }

  async function request(
    method: string,
    path: string,
    requestOptions: RuntimeDomainRequestOptions = {},
  ) {
    if (requestOptions.signal?.aborted) {
      throw requestOptions.signal.reason ?? new DOMException("Aborted", "AbortError");
    }
    const headers: Record<string, string> = { ...requestOptions.headers };
    let bodyText: string | undefined;
    let formData: Array<
      | { name: string; value: string }
      | { name: string; file: { name: string; type: string; bytes: number[] } }
    > | undefined;
    if (requestOptions.body !== undefined) {
      if (requestOptions.body instanceof FormData) {
        formData = await Promise.all(
          Array.from(requestOptions.body.entries()).map(async ([name, value]) => (
            typeof value === "string"
              ? { name, value }
              : {
                  name,
                  file: {
                    name: value.name,
                    type: value.type,
                    bytes: Array.from(new Uint8Array(await value.arrayBuffer())),
                  },
                }
          )),
        );
      } else {
        headers["content-type"] = "application/json";
        bodyText = JSON.stringify(requestOptions.body);
      }
    }
    const abort = new Promise<never>((_, reject) => {
      requestOptions.signal?.addEventListener("abort", () => reject(
        requestOptions.signal?.reason ?? new DOMException("Aborted", "AbortError"),
      ), { once: true });
    });
    const pending = invoke("api:proxy", {
      method,
      path,
      headers,
      bodyText,
      formData,
      responseType: requestOptions.responseType,
    }) as Promise<ProxyResponse>;
    const response = requestOptions.signal
      ? await Promise.race([pending, abort])
      : await pending;
    const parsed = requestOptions.responseType === "blob"
      ? new Blob([new Uint8Array(response.bodyBytes ?? [])], {
          type: response.headers?.["content-type"] ?? "application/octet-stream",
        })
      : requestOptions.responseType === "arrayBuffer"
        ? Uint8Array.from(response.bodyBytes ?? []).buffer
        : parseRuntimeBody(response.bodyText);
    if (response.status < 200 || response.status >= 300) {
      throw normalizeRuntimeHttpError({
        status: response.status,
        body: parsed,
        surface: "electron",
      });
    }
    return requestOptions.includeResponseMetadata
      ? { data: parsed, headers: response.headers ?? {} }
      : parsed;
  }

  const domains = createRuntimeDomains({
    request,
    openEvents(path, input, handlers: EventStreamHandlers): RuntimeSubscription {
      const id = String(++requestSequence);
      const unsubscribe = bridge.addRuntimeListener((message) => {
        if (message.id !== id) return;
        if (message.type === "sse:event" && message.success) {
          const frame = message.data as {
            type?: unknown;
            data?: unknown;
            lastEventId?: unknown;
          };
          if (typeof frame.type === "string" && typeof frame.data === "string") {
            handlers.onEvent(normalizeRuntimeStreamEvent({
              type: frame.type,
              data: frame.data,
              lastEventId: typeof frame.lastEventId === "string"
                ? frame.lastEventId
                : undefined,
            }));
          }
        } else if (!message.success) {
          handlers.onError?.(message.error ?? {
            code: "runtime.events_failed",
            message: "Electron event stream failed.",
            surface: "electron",
          });
        }
      });
      void bridge.invokeRuntime({
        id,
        type: "sse:open",
        target: options.target,
        payload: { path, lastEventId: input.lastEventId ?? null },
      }).then((response) => {
        if (response.success) handlers.onOpen?.();
        else handlers.onError?.(response.error ?? {
          code: "runtime.events_failed",
          message: "Electron event stream failed.",
          surface: "electron",
        });
      });
      return {
        close() {
          unsubscribe();
          void bridge.invokeRuntime({
            id: `${id}:close`,
            type: "sse:close",
            target: options.target,
            payload: { id },
          });
        },
      };
    },
  });

  return {
    runtime: {
      surface: "electron",
      label: "Desktop",
      supportsNativeNotifications: Boolean(bridge.notify),
      supportsEditorActions: false,
    },
    ...domains,
    native: {
      openExternal: (input) => bridge.openExternal(input),
      chooseFolder: bridge.chooseFolder
        ? () => bridge.chooseFolder!()
        : undefined,
      notify: bridge.notify
        ? (input) => bridge.notify!(input)
        : undefined,
    },
  };
}

export class ElectronRunnerCredentialStore implements RunnerCredentialStore {
  private recoveryNoticeCode: string | null = null;

  constructor(private readonly bridge: ElectronNativeBridge = resolveBridge()) {}

  async authorizeNative(input: {
    profileId: string;
    origin: string;
    runnerInstanceId: string | null;
    password: string;
    clientLabel: string;
  }) {
    const response = await this.bridge.invokeRuntime({
      id: String(++requestSequence),
      type: "auth:native",
      target: {
        profileId: input.profileId,
        baseUrl: input.origin,
        credentialRef: null,
        runnerInstanceId: input.runnerInstanceId,
      },
      payload: {
        password: input.password,
        clientLabel: input.clientLabel,
      },
    });
    if (!response.success) throw response.error;
    const credentialRef = (response.data as { credentialRef?: unknown })?.credentialRef;
    if (typeof credentialRef !== "string") {
      throw new Error("Electron host did not return a credential handle.");
    }
    return credentialRef;
  }

  async save(): Promise<string> {
    throw new Error("Electron credentials can only be created by native login.");
  }

  confirmTls(input: {
    profileId: string;
    origin: string;
    fingerprint: string;
  }) {
    return this.bridge.tls("confirm", input).then(() => undefined);
  }

  metadata(handle: string) {
    return this.bridge.credential("metadata", { handle }) as Promise<RunnerCredentialMetadata | null>;
  }

  rebind(handle: string, binding: RunnerCredentialBinding) {
    return this.bridge.credential("rebind", { handle, binding }).then(() => undefined);
  }

  async useCredential<T>(
    _handle: string,
    _binding: RunnerCredentialBinding,
    _consumer: (token: string) => T | Promise<T>,
  ): Promise<T> {
    throw new Error("Electron credential material is not available to the renderer.");
  }

  clear(handle: string) {
    return this.bridge.credential("clear", { handle }).then(() => undefined);
  }

  clearForProfile(profileId: string) {
    return this.bridge.credential("clearForProfile", { profileId }).then(() => undefined);
  }

  getRecoveryNoticeCode() {
    return this.recoveryNoticeCode;
  }
}

export function createElectronProfileStorage(
  bridge: ElectronNativeBridge = resolveBridge(),
): Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  return {
    getItem: () => bridge.profileGet(),
    setItem: (_key, value) => bridge.profileSet(value),
    removeItem: () => bridge.profileRemove(),
  };
}

export function createElectronRuntimeForProfile(
  profile: RunnerProfile,
  bridge?: ElectronNativeBridge,
) {
  return createElectronRuntimeAPIs({
    target: targetFromProfile(profile),
    bridge,
  });
}

export function createRendererRuntimeAPIs(): RuntimeAPIs {
  if (isCapacitorNativeRuntime()) {
    return createCapacitorRuntimeAPIs({
      target: {
        profileId: "capacitor-shell",
        baseUrl: "http://127.0.0.1:3050",
        credentialRef: null,
        runnerInstanceId: null,
      },
    });
  }
  if (isElectronNativeRuntime()) {
    return createElectronRuntimeAPIs({
      target: {
        profileId: "electron-shell",
        baseUrl: "http://127.0.0.1",
        credentialRef: null,
        runnerInstanceId: null,
      },
    });
  }
  return createWebRuntimeAPIs();
}
