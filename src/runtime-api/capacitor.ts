import {
  Capacitor,
  registerPlugin,
  type PluginListenerHandle,
} from "@capacitor/core";
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
import type {
  RunnerCredentialBinding,
  RunnerCredentialMetadata,
  RunnerCredentialStore,
} from "@/interface/runners/RunnerCredentialStore";
import type { RunnerProfile } from "@/interface/runners/RunnerProfile";
import {
  validateMobileRuntimePath,
  validateMobileRuntimeTarget,
  type MobileRuntimeTarget,
} from "../../apps/mobile/src/native-contract";

export type CapacitorRuntimeTarget = MobileRuntimeTarget;

type NativeResponse = {
  status: number;
  headers?: Record<string, string>;
  bodyText?: string;
  bodyBase64?: string;
};

type StreamFrame = {
  streamId: string;
  type: string;
  data: string;
  lastEventId?: string;
};

export interface OmniNativeRuntimePlugin {
  request(input: {
    requestId: string;
    target: CapacitorRuntimeTarget;
    method: string;
    path: string;
    headers: Record<string, string>;
    bodyText?: string;
    formData?: unknown;
    responseType?: string;
  }): Promise<NativeResponse>;
  cancelRequest(input: { requestId: string }): Promise<{ ok: boolean }>;
  authorize(input: {
    target: CapacitorRuntimeTarget;
    password: string;
    clientLabel: string;
  }): Promise<{ credentialRef: string }>;
  credential(input: { command: string; payload: unknown }): Promise<{ value?: unknown }>;
  confirmTls(input: {
    profileId: string;
    origin: string;
    fingerprint: string;
  }): Promise<{ ok: boolean }>;
  openStream(input: {
    streamId: string;
    target: CapacitorRuntimeTarget;
    path: string;
    lastEventId?: string | null;
  }): Promise<{ ok: boolean }>;
  closeStream(input: { streamId: string }): Promise<{ ok: boolean }>;
  openExternal(input: { url: string }): Promise<{ ok: true }>;
  notify(input: { title: string; body?: string }): Promise<{ ok: boolean }>;
  addListener(
    eventName: "streamFrame",
    listener: (frame: StreamFrame) => void,
  ): Promise<PluginListenerHandle>;
}

export const OmniNativeRuntime = registerPlugin<OmniNativeRuntimePlugin>(
  "OmniNativeRuntime",
);

let sequence = 0;

export function isCapacitorNativeRuntime() {
  return typeof window !== "undefined" && Capacitor.isNativePlatform();
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function targetFromProfile(profile: RunnerProfile): CapacitorRuntimeTarget {
  return {
    profileId: profile.id,
    baseUrl: profile.baseUrl,
    credentialRef: profile.credentialRef,
    runnerInstanceId: profile.runnerInstanceId,
  };
}

export function createCapacitorRuntimeAPIs(options: {
  target: CapacitorRuntimeTarget;
  plugin?: OmniNativeRuntimePlugin;
}): RuntimeAPIs {
  const plugin = options.plugin ?? OmniNativeRuntime;
  const target = validateMobileRuntimeTarget(options.target);

  async function request(
    method: string,
    path: string,
    requestOptions: RuntimeDomainRequestOptions = {},
  ) {
    validateMobileRuntimePath(path);
    if (requestOptions.signal?.aborted) {
      throw requestOptions.signal.reason ?? new DOMException("Aborted", "AbortError");
    }
    const headers = { ...requestOptions.headers };
    let bodyText: string | undefined;
    let formData: unknown;
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
                  base64: bytesToBase64(
                    new Uint8Array(await value.arrayBuffer()),
                  ),
                },
              }
        )),
      );
    } else if (requestOptions.body !== undefined) {
      headers["content-type"] = "application/json";
      bodyText = JSON.stringify(requestOptions.body);
    }
    const requestId = `mobile-request-${++sequence}`;
    const pending = plugin.request({
      requestId,
      target,
      method,
      path,
      headers,
      bodyText,
      formData,
      responseType: requestOptions.responseType,
    });
    let rejectAborted: (reason: unknown) => void = () => {};
    const onAbort = () => {
      void plugin.cancelRequest({ requestId });
      rejectAborted(
        requestOptions.signal?.reason ?? new DOMException("Aborted", "AbortError"),
      );
    };
    const aborted = new Promise<never>((_, reject) => {
      rejectAborted = reject;
      requestOptions.signal?.addEventListener("abort", onAbort, { once: true });
    });
    let response: NativeResponse;
    try {
      response = requestOptions.signal
        ? await Promise.race([pending, aborted])
        : await pending;
    } finally {
      requestOptions.signal?.removeEventListener("abort", onAbort);
    }
    const bytes = response.bodyBase64
      ? Uint8Array.from(atob(response.bodyBase64), (value) => value.charCodeAt(0))
      : new Uint8Array();
    const parsed = requestOptions.responseType === "blob"
      ? new Blob([bytes], {
          type: response.headers?.["content-type"] ?? "application/octet-stream",
        })
      : requestOptions.responseType === "arrayBuffer"
        ? bytes.buffer
        : parseRuntimeBody(response.bodyText);
    if (response.status < 200 || response.status >= 300) {
      throw normalizeRuntimeHttpError({
        status: response.status,
        body: parsed,
        surface: "capacitor",
      });
    }
    return requestOptions.includeResponseMetadata
      ? { data: parsed, headers: response.headers ?? {} }
      : parsed;
  }

  const domains = createRuntimeDomains({
    request,
    openEvents(path, input, handlers: EventStreamHandlers): RuntimeSubscription {
      const streamId = `mobile-stream-${++sequence}`;
      let closed = false;
      let listener: PluginListenerHandle | null = null;
      void plugin.addListener("streamFrame", (frame) => {
        if (!closed && frame.streamId === streamId) {
          handlers.onEvent(normalizeRuntimeStreamEvent({
            type: frame.type,
            data: frame.data,
            lastEventId: frame.lastEventId,
          }));
        }
      }).then((handle) => {
        listener = handle;
        if (closed) void handle.remove();
      });
      void plugin.openStream({
        streamId,
        target,
        path: validateMobileRuntimePath(path),
        lastEventId: input.lastEventId,
      }).then(() => handlers.onOpen?.()).catch((error) => {
        handlers.onError?.({
          code: "runtime.events_failed",
          message: error instanceof Error ? error.message : String(error),
          surface: "capacitor",
        });
      });
      return {
        close() {
          closed = true;
          void listener?.remove();
          void plugin.closeStream({ streamId });
        },
      };
    },
  });

  return {
    runtime: {
      surface: "capacitor",
      label: "Mobile",
      supportsNativeNotifications: true,
      supportsEditorActions: false,
    },
    ...domains,
    native: {
      openExternal: (input) => plugin.openExternal(input),
      notify: (input) => plugin.notify(input),
    },
  };
}

export class CapacitorRunnerCredentialStore implements RunnerCredentialStore {
  constructor(private readonly plugin: OmniNativeRuntimePlugin = OmniNativeRuntime) {}

  async authorizeNative(input: RunnerCredentialBinding & {
    profileId: string;
    password: string;
    clientLabel: string;
  }) {
    const result = await this.plugin.authorize({
      target: {
        profileId: input.profileId,
        baseUrl: input.origin,
        credentialRef: null,
        runnerInstanceId: input.runnerInstanceId,
      },
      password: input.password,
      clientLabel: input.clientLabel,
    });
    if (!result || typeof result.credentialRef !== "string") {
      throw {
        code: "runtime.login_failed",
        message: "The native host did not return a credential handle.",
        surface: "capacitor",
      } satisfies RuntimeApiError;
    }
    return result.credentialRef;
  }

  confirmTls(input: { profileId: string; origin: string; fingerprint: string }) {
    return this.plugin.confirmTls(input).then(() => undefined);
  }

  async save(): Promise<string> {
    throw new Error("Mobile credentials can only be created by native login.");
  }

  async metadata(handle: string) {
    const result = await this.plugin.credential({
      command: "metadata",
      payload: { handle },
    });
    return (result.value ?? null) as RunnerCredentialMetadata | null;
  }

  rebind(handle: string, binding: RunnerCredentialBinding) {
    return this.plugin.credential({
      command: "rebind",
      payload: { handle, binding },
    }).then(() => undefined);
  }

  async useCredential<T>(
    _handle: string,
    _binding: RunnerCredentialBinding,
    _consumer: (token: string) => T | Promise<T>,
  ): Promise<T> {
    throw new Error("Mobile credential material is not available to the WebView.");
  }

  clear(handle: string) {
    return this.plugin.credential({
      command: "clear",
      payload: { handle },
    }).then(() => undefined);
  }

  clearForProfile(profileId: string) {
    return this.plugin.credential({
      command: "clearForProfile",
      payload: { profileId },
    }).then(() => undefined);
  }

  getRecoveryNoticeCode() {
    return null;
  }
}

export function createCapacitorRuntimeForProfile(
  profile: RunnerProfile,
  plugin?: OmniNativeRuntimePlugin,
) {
  return createCapacitorRuntimeAPIs({
    target: targetFromProfile(profile),
    plugin,
  });
}
