import { afterEach, describe, expect, it, vi } from "vitest";
import http from "node:http";

const { gzipDestroyReasons, gzipInstances, gzipWrites, forceGzipBackpressure } = vi.hoisted(() => ({
  gzipDestroyReasons: [] as unknown[],
  gzipInstances: [] as import("node:zlib").Gzip[],
  gzipWrites: [] as unknown[],
  forceGzipBackpressure: { current: false },
}));

vi.mock("node:zlib", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:zlib")>();
  return {
    ...actual,
    createGzip(...args: Parameters<typeof actual.createGzip>) {
      const gzip = actual.createGzip(...args);
      gzipInstances.push(gzip);
      const destroy = gzip.destroy.bind(gzip);
      const write = gzip.write.bind(gzip);
      gzip.write = ((...writeArgs: Parameters<typeof gzip.write>) => {
        gzipWrites.push(writeArgs[0]);
        const accepted = write(...writeArgs);
        return forceGzipBackpressure.current ? false : accepted;
      }) as typeof gzip.write;
      gzip.destroy = ((reason?: Error) => {
        gzipDestroyReasons.push(reason);
        return destroy(reason);
      }) as typeof gzip.destroy;
      return gzip;
    },
  };
});

import { createOmniHttpRegistry } from "@/runtime/http/registry";
import { startOmniHttpServer, type OmniHttpServerHandle } from "@/runtime/http/server";

describe("compressed response disconnect cleanup", () => {
  let handle: OmniHttpServerHandle | null = null;

  afterEach(async () => {
    gzipDestroyReasons.splice(0);
    gzipInstances.splice(0);
    gzipWrites.splice(0);
    forceGzipBackpressure.current = false;
    await handle?.stop();
    handle = null;
  });

  it("treats a client disconnect as cancellation rather than a gzip error", async () => {
    const encoder = new TextEncoder();
    const cancelled = vi.fn();
    const registry = createOmniHttpRegistry()
      .route("GET", "/api/stream", () => new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`data: ${"streaming ".repeat(20_000)}\n\n`));
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

    await new Promise<void>((resolve, reject) => {
      const request = http.get(`${handle!.origin}/api/stream`, {
        headers: { "accept-encoding": "gzip" },
      }, (response) => {
        response.once("data", () => {
          response.destroy();
          resolve();
        });
      });
      request.once("error", reject);
    });

    await vi.waitFor(() => expect(cancelled).toHaveBeenCalledTimes(1));
    expect(gzipDestroyReasons).not.toContainEqual(expect.any(Error));
  });

  it("settles a forced gzip backpressure waiter when the client disconnects", async () => {
    forceGzipBackpressure.current = true;
    const encoder = new TextEncoder();
    const cancelled = vi.fn();
    const registry = createOmniHttpRegistry()
      .route("GET", "/api/backpressured-stream", () => new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode("blocked gzip body"));
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

    await new Promise<void>((resolve, reject) => {
      const request = http.get(`${handle!.origin}/api/backpressured-stream`, {
        headers: { "accept-encoding": "gzip" },
      }, (response) => {
        response.destroy();
        resolve();
      });
      request.once("error", reject);
    });

    await vi.waitFor(() => expect(gzipWrites.length).toBeGreaterThan(0));
    await vi.waitFor(() => expect(cancelled).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => {
      expect(gzipInstances[0]?.listenerCount("drain")).toBe(0);
    });
  });
});
