import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "fs/promises";
import http, { type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import os from "os";
import path from "path";
import crypto from "node:crypto";
import { constants as zlibConstants, createGzip } from "node:zlib";
import { createBoundedByteStream } from "@/runtime/http/bounded-byte-stream";
import { createOmniHttpRegistry } from "@/runtime/http/registry";
import { startOmniHttpServer, type OmniHttpServerHandle } from "@/runtime/http/server";
import {
  getEventCursor,
  getNamedEventsSince,
} from "@/server/events/named-events";

describe("startOmniHttpServer", () => {
  let handle: OmniHttpServerHandle | null = null;
  let proxyServer: http.Server | null = null;

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      if (!proxyServer) {
        resolve();
        return;
      }
      proxyServer.close(() => resolve());
      proxyServer.closeAllConnections();
    });
    proxyServer = null;
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
    const themeScript = "document.documentElement.dataset.theme = 'ready';";
    const renderer = "window.loaded = true;";
    await fs.mkdir(path.join(staticDir, "assets"));
    await fs.writeFile(
      path.join(staticDir, "index.html"),
      `<div id="root"></div><script id="omni-theme-bootstrap">${themeScript}</script>`,
    );
    await fs.writeFile(path.join(staticDir, "assets/renderer-abc123.js"), renderer);
    await fs.writeFile(path.join(staticDir, "csp-manifest.json"), JSON.stringify({
      schemaVersion: 1,
      themeScriptSha256: crypto.createHash("sha256").update(themeScript).digest("base64"),
      assets: [{
        path: "assets/renderer-abc123.js",
        sha256: crypto.createHash("sha256").update(renderer).digest("base64"),
      }],
    }));

    const registry = createOmniHttpRegistry()
      .route("GET", "/api/runtime/status", () => Response.json({ ok: true }));

    handle = await startOmniHttpServer({
      host: "127.0.0.1",
      port: 0,
      surface: "test",
      registry,
      staticDir,
      staticDirExplicit: true,
      buildStaticBootstrap: async () => ({ ok: true }),
    });

    const index = await fetch(`${handle.origin}/`);
    const asset = await fetch(`${handle.origin}/assets/renderer-abc123.js`);
    const api = await fetch(`${handle.origin}/api/runtime/status`);

    expect(index.headers.get("content-type")).toContain("text/html");
    await expect(index.text()).resolves.toContain("root");
    expect(asset.headers.get("content-type")).toContain("text/javascript");
    await expect(asset.text()).resolves.toContain("loaded");
    await expect(api.json()).resolves.toEqual({ ok: true });
  });

  it("flushes streaming response headers and each frame without buffering the body", async () => {
    const encoder = new TextEncoder();
    const registry = createOmniHttpRegistry()
      .route("GET", "/api/stream", () => new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode("first\n"));
          setTimeout(() => {
            controller.enqueue(encoder.encode("second\n"));
            controller.close();
          }, 250);
        },
      }), {
        headers: { "content-type": "text/event-stream" },
      }));

    handle = await startOmniHttpServer({
      host: "127.0.0.1",
      port: 0,
      surface: "test",
      registry,
    });

    const startedAt = performance.now();
    const response = await fetch(`${handle.origin}/api/stream`);
    const headersElapsedMs = performance.now() - startedAt;
    const reader = response.body?.getReader();
    expect(reader).toBeDefined();

    const first = await reader!.read();
    expect(headersElapsedMs).toBeLessThan(150);
    expect(new TextDecoder().decode(first.value)).toBe("first\n");

    const second = await reader!.read();
    expect(new TextDecoder().decode(second.value)).toBe("second\n");
    await reader!.cancel();
  });

  it("keeps individual frames flushable through a compressing proxy", async () => {
    const encoder = new TextEncoder();
    const registry = createOmniHttpRegistry()
      .route("GET", "/api/stream", () => new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode("first\n"));
          setTimeout(() => {
            controller.enqueue(encoder.encode("second\n"));
            controller.close();
          }, 250);
        },
      }), {
        headers: { "content-type": "text/event-stream" },
      }));

    handle = await startOmniHttpServer({
      host: "127.0.0.1",
      port: 0,
      surface: "test",
      registry,
    });
    proxyServer = http.createServer((request, response) => {
      const upstream = http.get(`${handle!.origin}${request.url}`, (upstreamResponse) => {
        response.statusCode = upstreamResponse.statusCode ?? 502;
        response.setHeader("content-type", "text/event-stream");
        response.setHeader("content-encoding", "gzip");
        response.flushHeaders();
        upstreamResponse
          .pipe(createGzip({ flush: zlibConstants.Z_SYNC_FLUSH }))
          .pipe(response);
      });
      upstream.once("error", (error) => response.destroy(error));
    });
    await new Promise<void>((resolve, reject) => {
      proxyServer!.once("error", reject);
      proxyServer!.listen(0, "127.0.0.1", resolve);
    });
    const proxyPort = (proxyServer.address() as AddressInfo).port;

    const startedAt = performance.now();
    const response = await fetch(`http://127.0.0.1:${proxyPort}/api/stream`);
    const headersElapsedMs = performance.now() - startedAt;
    const reader = response.body!.getReader();
    const first = await reader.read();

    expect(headersElapsedMs).toBeLessThan(150);
    expect(new TextDecoder().decode(first.value)).toBe("first\n");
    const second = await reader.read();
    expect(new TextDecoder().decode(second.value)).toBe("second\n");
    await reader.cancel();
  });

  it("cancels the upstream stream when the client disconnects", async () => {
    const cancelled = vi.fn();
    const encoder = new TextEncoder();
    const registry = createOmniHttpRegistry()
      .route("GET", "/api/stream", () => new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode("connected\n"));
        },
        cancel() {
          cancelled();
        },
      }), {
        headers: { "content-type": "text/event-stream" },
      }));

    handle = await startOmniHttpServer({
      host: "127.0.0.1",
      port: 0,
      surface: "test",
      registry,
    });

    const response = await fetch(`${handle.origin}/api/stream`);
    const reader = response.body!.getReader();
    await reader.read();
    await reader.cancel();

    await vi.waitFor(() => {
      expect(cancelled).toHaveBeenCalledTimes(1);
    });
  });

  it("waits for socket drain before pulling more upstream chunks", async () => {
    const chunk = new Uint8Array(64 * 1024);
    let pullCount = 0;
    const registry = createOmniHttpRegistry()
      .route("GET", "/api/backpressure", () => new Response(new ReadableStream({
        pull(controller) {
          pullCount += 1;
          controller.enqueue(chunk);
          if (pullCount === 64) {
            controller.close();
          }
        },
      }), {
        headers: { "content-type": "application/octet-stream" },
      }));

    handle = await startOmniHttpServer({
      host: "127.0.0.1",
      port: 0,
      surface: "test",
      registry,
    });

    const response = await new Promise<IncomingMessage>((resolve, reject) => {
      const request = http.get(`${handle!.origin}/api/backpressure`, resolve);
      request.once("error", reject);
    });
    response.pause();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(pullCount).toBeLessThan(64);

    let receivedBytes = 0;
    response.on("data", (data: Buffer) => {
      receivedBytes += data.byteLength;
    });
    response.resume();
    await new Promise<void>((resolve, reject) => {
      response.once("end", resolve);
      response.once("error", reject);
    });

    expect(pullCount).toBe(64);
    expect(receivedBytes).toBe(64 * chunk.byteLength);
  });

  it("bounds a non-reading subscriber to 256 frames or 1 MiB", async () => {
    let resolveOverflow: (() => void) | null = null;
    const overflow = new Promise<void>((resolve) => {
      resolveOverflow = resolve;
    });
    const frame = new Uint8Array(4096);
    const memoryBefore = process.memoryUsage().rss;
    const registry = createOmniHttpRegistry()
      .route("GET", "/api/bounded", () => new Response(createBoundedByteStream({
        start(writer) {
          setImmediate(() => {
            for (let index = 0; index < 400; index += 1) {
              if (!writer.enqueue(frame)) {
                break;
              }
            }
          });
        },
        onOverflow() {
          resolveOverflow?.();
        },
      }), {
        headers: { "content-type": "text/event-stream" },
      }));

    handle = await startOmniHttpServer({
      host: "127.0.0.1",
      port: 0,
      surface: "test",
      registry,
    });

    const response = await new Promise<IncomingMessage>((resolve, reject) => {
      const request = http.get(`${handle!.origin}/api/bounded`, resolve);
      request.once("error", reject);
    });
    response.pause();
    await Promise.race([
      overflow,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error("bounded stream did not overflow")), 3_000);
      }),
    ]);
    const memoryGrowth = process.memoryUsage().rss - memoryBefore;
    response.destroy();

    expect(memoryGrowth).toBeLessThan(64 * 1024 * 1024);
  });

  it("announces shutdown, flushes briefly, then cancels open readers", async () => {
    const cancelled = vi.fn();
    const cursorBeforeStop = getEventCursor();
    const encoder = new TextEncoder();
    const registry = createOmniHttpRegistry()
      .route("GET", "/api/stream", () => new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode("connected\n"));
        },
        cancel() {
          cancelled();
        },
      }), {
        headers: { "content-type": "text/event-stream" },
      }));

    handle = await startOmniHttpServer({
      host: "127.0.0.1",
      port: 0,
      surface: "test",
      registry,
    });
    const response = await new Promise<IncomingMessage>((resolve, reject) => {
      const request = http.get(`${handle!.origin}/api/stream`, resolve);
      request.once("error", reject);
    });
    response.pause();

    const startedAt = performance.now();
    await handle.stop();
    const stopElapsedMs = performance.now() - startedAt;
    handle = null;

    expect(stopElapsedMs).toBeGreaterThanOrEqual(450);
    expect(stopElapsedMs).toBeLessThan(1_500);
    expect(cancelled).toHaveBeenCalledTimes(1);
    expect(
      getNamedEventsSince(cursorBeforeStop).events.some(
        (entry) => entry.event.kind === "runner.stopping",
      ),
    ).toBe(true);
  });
});
