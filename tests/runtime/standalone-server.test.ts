import { afterEach, describe, expect, it } from "vitest";
import { createOmniRuntime } from "@/runtime";
import { createOmniHttpRegistry } from "@/runtime/http/registry";
import { startOmniServer, type OmniServerHandle } from "@/runtime/http/server";

describe("startOmniServer", () => {
  let handle: OmniServerHandle | null = null;

  afterEach(async () => {
    await handle?.stop();
    handle = null;
  });

  it("starts one runtime-backed standalone server and stops it cleanly", async () => {
    const runtime = createOmniRuntime({ surface: "electron", label: "Electron Test" });
    const registry = createOmniHttpRegistry()
      .route("GET", "/api/runtime/status", () => Response.json({ status: runtime.getStatus() }));

    handle = await startOmniServer({
      host: "127.0.0.1",
      port: 0,
      surface: "electron",
      runtime,
      registry,
    });

    expect(handle.isReady()).toBe(true);
    expect(runtime.getStatus()).toBe("running");

    const response = await fetch(`${handle.origin}/api/runtime/status`);
    await expect(response.json()).resolves.toEqual({ status: "running" });

    await handle.stop();
    expect(handle.isReady()).toBe(false);
    expect(runtime.getStatus()).toBe("stopped");
    handle = null;
  });
});
