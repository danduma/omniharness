import { describe, expect, it, vi } from "vitest";
import { startElectronOmniRuntime, resolveElectronRendererUrl } from "../../apps/electron/src/runtime";
import { handleElectronNativeCommand, isAllowedElectronSender } from "../../apps/electron/src/native-bridge";

describe("Electron runtime shell", () => {
  it("starts the shared runtime server with the electron surface", async () => {
    const runtime = {
      surface: "electron" as const,
      label: "Test Desktop",
      start: vi.fn(),
      stop: vi.fn(),
      getStatus: () => "running" as const,
      getStartedAt: () => null,
    };
    const registry = { handle: vi.fn() } as never;
    const startServer = vi.fn(async (options) => ({
      origin: "http://127.0.0.1:4030",
      httpServer: {} as never,
      runtime,
      getPort: () => 4030,
      isReady: () => true,
      stop: vi.fn(),
      options,
    }));

    const handle = await startElectronOmniRuntime({
      host: "127.0.0.1",
      port: 4030,
      staticDir: "/tmp/omni-renderer",
      createRuntime: () => runtime,
      createRegistry: () => registry,
      startServer,
    });

    expect(startServer).toHaveBeenCalledWith(expect.objectContaining({
      host: "127.0.0.1",
      port: 4030,
      surface: "electron",
      runtime,
      registry,
      staticDir: "/tmp/omni-renderer",
    }));
    expect(handle.origin).toBe("http://127.0.0.1:4030");
  });

  it("resolves an explicit renderer URL before falling back to runtime origin", () => {
    expect(resolveElectronRendererUrl({
      runtimeOrigin: "http://127.0.0.1:4000",
      env: { OMNI_ELECTRON_RENDERER_URL: "http://localhost:3035" },
    })).toBe("http://localhost:3035");
    expect(resolveElectronRendererUrl({
      runtimeOrigin: "http://127.0.0.1:4000",
      env: {},
    })).toBe("http://127.0.0.1:4000");
  });

  it("allows native commands only from the runtime origin", async () => {
    expect(isAllowedElectronSender("http://127.0.0.1:4000/app", "http://127.0.0.1:4000")).toBe(true);
    expect(isAllowedElectronSender("https://example.com/app", "http://127.0.0.1:4000")).toBe(false);

    const openExternal = vi.fn(async () => ({ ok: true as const }));
    await expect(handleElectronNativeCommand({
      command: "openExternal",
      payload: { url: "https://example.com" },
    }, {
      runtimeOrigin: "http://127.0.0.1:4000",
      senderUrl: "http://127.0.0.1:4000/app",
      openExternal,
    })).resolves.toEqual({ ok: true });
    expect(openExternal).toHaveBeenCalledWith({ url: "https://example.com" });

    await expect(handleElectronNativeCommand({
      command: "openExternal",
      payload: { url: "https://example.com" },
    }, {
      runtimeOrigin: "http://127.0.0.1:4000",
      senderUrl: "https://example.com/app",
      openExternal,
    })).rejects.toThrow("untrusted origin");
  });

  it("refuses unsafe native external URL schemes", async () => {
    const openExternal = vi.fn(async () => ({ ok: true as const }));

    await expect(handleElectronNativeCommand({
      command: "openExternal",
      payload: { url: "file:///etc/passwd" },
    }, {
      runtimeOrigin: "http://127.0.0.1:4000",
      senderUrl: "http://127.0.0.1:4000/app",
      openExternal,
    })).rejects.toThrow("http and https");

    expect(openExternal).not.toHaveBeenCalled();
  });
});
