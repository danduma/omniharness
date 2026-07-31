import { describe, expect, it, vi } from "vitest";
import {
  CapacitorRunnerCredentialStore,
  createCapacitorRuntimeAPIs,
  type OmniNativeRuntimePlugin,
} from "@/runtime-api/capacitor";

function createPlugin() {
  let streamListener: ((frame: {
    streamId: string;
    type: string;
    data: string;
    lastEventId?: string;
  }) => void) | null = null;
  const plugin: OmniNativeRuntimePlugin = {
    request: vi.fn(async () => ({
      status: 200,
      headers: { "content-type": "application/json" },
      bodyText: "{\"ok\":true}",
    })),
    cancelRequest: vi.fn(async () => ({ ok: true })),
    authorize: vi.fn(async () => ({ credentialRef: "native-handle" })),
    credential: vi.fn(async () => ({})),
    confirmTls: vi.fn(async () => ({ ok: true })),
    openStream: vi.fn(async () => ({ ok: true })),
    closeStream: vi.fn(async () => ({ ok: true })),
    openExternal: vi.fn(async () => ({ ok: true as const })),
    notify: vi.fn(async () => ({ ok: true })),
    addListener: vi.fn(async (_name, listener) => {
      streamListener = listener;
      return { remove: vi.fn(async () => {}) };
    }),
  };
  return {
    plugin,
    emit(frame: Parameters<NonNullable<typeof streamListener>>[0]) {
      streamListener?.(frame);
    },
  };
}

describe("Capacitor runtime bridge", () => {
  it("keeps bearer material native and passes only a bound credential handle", async () => {
    const { plugin } = createPlugin();
    const store = new CapacitorRunnerCredentialStore(plugin);

    await expect(store.authorizeNative({
      profileId: "profile-1",
      origin: "https://runner.example",
      runnerInstanceId: "runner-1",
      password: "not-visible-to-webview-after-login",
      clientLabel: "Phone",
    })).resolves.toBe("native-handle");
    await expect(store.useCredential(
      "native-handle",
      { origin: "https://runner.example", runnerInstanceId: "runner-1" },
      () => "should-not-run",
    )).rejects.toThrow("not available");
    expect(plugin.authorize).toHaveBeenCalledWith(expect.objectContaining({
      target: expect.objectContaining({
        credentialRef: null,
        profileId: "profile-1",
      }),
    }));
  });

  it("normalizes native stream frames, preserves cursors, and closes native work", async () => {
    const { plugin, emit } = createPlugin();
    const apis = createCapacitorRuntimeAPIs({
      target: {
        profileId: "profile-1",
        baseUrl: "https://runner.example",
        credentialRef: "native-handle",
        runnerInstanceId: "runner-1",
      },
      plugin,
    });
    const seen: unknown[] = [];
    const opened = vi.fn();
    const subscription = apis.events.open({
      snapshot: false,
      runId: "run-1",
      lastEventId: "41",
    }, {
      onOpen: opened,
      onEvent: (event) => seen.push(event),
    });
    await vi.waitFor(() => expect(plugin.openStream).toHaveBeenCalled());
    const streamId = vi.mocked(plugin.openStream).mock.calls[0]?.[0].streamId;
    emit({
      streamId: streamId!,
      type: "update",
      data: "{\"runs\":[]}",
      lastEventId: "42",
    });
    subscription.close();

    expect(opened).toHaveBeenCalledOnce();
    expect(seen).toEqual([{
      kind: "update",
      payload: { runs: [] },
      lastEventId: "42",
    }]);
    expect(plugin.openStream).toHaveBeenCalledWith(expect.objectContaining({
      lastEventId: "41",
      path: "/api/events?runId=run-1",
    }));
    expect(plugin.closeStream).toHaveBeenCalledWith({ streamId });
  });

  it("honors an already-aborted request without entering native code", async () => {
    const { plugin } = createPlugin();
    const apis = createCapacitorRuntimeAPIs({
      target: {
        profileId: "profile-1",
        baseUrl: "https://runner.example",
        credentialRef: null,
        runnerInstanceId: null,
      },
      plugin,
    });
    const controller = new AbortController();
    controller.abort(new DOMException("Stopped", "AbortError"));

    await expect(apis.auth.session({ signal: controller.signal })).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(plugin.request).not.toHaveBeenCalled();
  });

  it("cancels native work when a live request is aborted", async () => {
    const { plugin } = createPlugin();
    vi.mocked(plugin.request).mockImplementationOnce(() => new Promise(() => {}));
    const apis = createCapacitorRuntimeAPIs({
      target: {
        profileId: "profile-1",
        baseUrl: "https://runner.example",
        credentialRef: null,
        runnerInstanceId: null,
      },
      plugin,
    });
    const controller = new AbortController();
    const pending = apis.auth.session({ signal: controller.signal });
    await vi.waitFor(() => expect(plugin.request).toHaveBeenCalledOnce());
    const requestId = vi.mocked(plugin.request).mock.calls[0]?.[0].requestId;
    controller.abort(new DOMException("Stopped", "AbortError"));

    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(plugin.cancelRequest).toHaveBeenCalledWith({ requestId });
  });

  it("returns typed TLS and HTTP failures without native secrets", async () => {
    const { plugin } = createPlugin();
    vi.mocked(plugin.request).mockResolvedValueOnce({
      status: 495,
      headers: { "content-type": "application/json" },
      bodyText: JSON.stringify({
        error: {
          code: "runtime.tls_untrusted",
          message: "Confirm runner certificate.",
          details: { fingerprint: "sha256/example" },
        },
      }),
    });
    const apis = createCapacitorRuntimeAPIs({
      target: {
        profileId: "profile-1",
        baseUrl: "https://runner.example",
        credentialRef: "native-handle",
        runnerInstanceId: "runner-1",
      },
      plugin,
    });

    await expect(apis.auth.session()).rejects.toMatchObject({
      code: "runtime.tls_untrusted",
      message: "Confirm runner certificate.",
      surface: "capacitor",
    });
  });
});
