import { afterEach, describe, expect, it } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { createOmniHttpRegistry } from "@/runtime/http/registry";
import { startOmniHttpServer, type OmniHttpServerHandle } from "@/runtime/http/server";

describe("startOmniHttpServer", () => {
  let handle: OmniHttpServerHandle | null = null;

  afterEach(async () => {
    await handle?.stop();
    handle = null;
  });

  it("serves runtime registry responses over a real local HTTP server", async () => {
    const registry = createOmniHttpRegistry()
      .route("GET", "/api/runtime/status", () => Response.json({ ok: true }));

    handle = await startOmniHttpServer({
      host: "127.0.0.1",
      port: 0,
      surface: "test",
      registry,
    });

    const response = await fetch(`${handle.origin}/api/runtime/status`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(handle.getPort()).toBeGreaterThan(0);
  });

  it("serves staged renderer assets without routing them through the API registry", async () => {
    const staticDir = await fs.mkdtemp(path.join(os.tmpdir(), "omni-static-"));
    await fs.writeFile(path.join(staticDir, "index.html"), "<div id=\"root\"></div>");
    await fs.writeFile(path.join(staticDir, "renderer.js"), "window.loaded = true;");

    const registry = createOmniHttpRegistry()
      .route("GET", "/api/runtime/status", () => Response.json({ ok: true }));

    handle = await startOmniHttpServer({
      host: "127.0.0.1",
      port: 0,
      surface: "test",
      registry,
      staticDir,
    });

    const index = await fetch(`${handle.origin}/`);
    const asset = await fetch(`${handle.origin}/renderer.js`);
    const api = await fetch(`${handle.origin}/api/runtime/status`);

    expect(index.headers.get("content-type")).toContain("text/html");
    await expect(index.text()).resolves.toContain("root");
    expect(asset.headers.get("content-type")).toContain("text/javascript");
    await expect(asset.text()).resolves.toContain("loaded");
    await expect(api.json()).resolves.toEqual({ ok: true });
  });
});
