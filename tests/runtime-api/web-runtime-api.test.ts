import { describe, expect, it, vi } from "vitest";
import { createWebRuntimeAPIs } from "@/runtime-api/web";

describe("createWebRuntimeAPIs", () => {
  it("loads bootstrap data through the portable runtime API contract", async () => {
    const fetchImpl: typeof fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      expect(String(url)).toBe("/api/runtime/bootstrap?run=run-1&project=%2Ftmp%2Fapp&pair=pair-1");
      expect(init?.method).toBe("GET");
      return Response.json({ route: { selectedRunId: "run-1" } });
    });

    const apis = createWebRuntimeAPIs({ fetchImpl });
    const bootstrap = await apis.bootstrap.load({
      selectedRunId: "run-1",
      draftProjectPath: "/tmp/app",
      pairToken: "pair-1",
    });

    expect(bootstrap).toEqual({ route: { selectedRunId: "run-1" } });
  });

  it("normalizes runtime API errors into a typed shape", async () => {
    const apis = createWebRuntimeAPIs({
      fetchImpl: async () =>
        Response.json({
          error: {
            message: "Authentication required.",
          },
        }, { status: 401 }),
    });

    await expect(apis.settings.load()).rejects.toMatchObject({
      code: "runtime.http_401",
      message: "Authentication required.",
      surface: "web",
    });
  });

  it("opens an SSE subscription with resume parameters and cancellable handlers", () => {
    const instances: Array<{
      url: string;
      readyState: number;
      listeners: Record<string, Array<(event: { data: string; type: string }) => void>>;
      closed: boolean;
      close(): void;
      addEventListener(type: string, listener: (event: { data: string; type: string }) => void): void;
    }> = [];

    class FakeEventSource {
      readonly listeners: Record<string, Array<(event: { data: string; type: string }) => void>> = {};
      readyState = 0;
      closed = false;

      constructor(readonly url: string) {
        instances.push(this);
      }

      addEventListener(type: string, listener: (event: { data: string; type: string }) => void) {
        this.listeners[type] ??= [];
        this.listeners[type].push(listener);
      }

      close() {
        this.closed = true;
      }
    }

    const seen: unknown[] = [];
    const errors: unknown[] = [];
    const apis = createWebRuntimeAPIs({
      baseUrl: "http://127.0.0.1:3050",
      EventSourceImpl: FakeEventSource,
    });

    const subscription = apis.events.open({
      snapshot: false,
      runId: "run-1",
      lastEventId: "42",
    }, {
      onEvent: (event) => seen.push(event),
      onError: (error) => errors.push(error),
    });

    expect(instances).toHaveLength(1);
    expect(instances[0]?.url).toBe("http://127.0.0.1:3050/api/events?runId=run-1&cursor=42");

    instances[0]?.listeners.update?.[0]?.({ type: "update", data: "{\"runs\":[]}" });
    instances[0]?.listeners["stream.resync_required"]?.[0]?.({ type: "stream.resync_required", data: "{\"reason\":\"cursor_evicted\"}" });
    instances[0]?.listeners["runner.rekeyed"]?.[0]?.({
      type: "runner.rekeyed",
      data: "{\"kind\":\"runner.rekeyed\",\"runnerInstanceId\":\"runner-2\"}",
    });
    instances[0]?.listeners.error?.[0]?.({ type: "error", data: "" });
    expect(instances[0]?.closed).toBe(false);
    expect(errors).toEqual([{
      code: "runtime.events_reconnecting",
      message: "Event stream is reconnecting.",
      surface: "web",
    }]);

    instances[0]!.readyState = 2;
    instances[0]?.listeners.error?.[0]?.({ type: "error", data: "" });
    subscription.close();

    expect(seen).toEqual([
      { kind: "update", payload: { runs: [] }, lastEventId: null },
      { kind: "stream.resync_required", reason: "cursor_evicted" },
      { kind: "runner.rekeyed", runnerInstanceId: "runner-2" },
    ]);
    expect(errors).toEqual([
      { code: "runtime.events_reconnecting", message: "Event stream is reconnecting.", surface: "web" },
      { code: "runtime.events_failed", message: "Event stream failed.", surface: "web" },
    ]);
    expect(instances[0]?.closed).toBe(true);
  });

  it("uses a fresh stream ticket for a browser bearer connection and closes native retry on error", async () => {
    const urls: string[] = [];
    const sources: Array<{
      closed: boolean;
      listeners: Record<string, Array<(event: { data: string; type: string }) => void>>;
    }> = [];
    class FakeEventSource {
      closed = false;
      readyState = 2;
      onopen: (() => void) | null = null;
      readonly listeners: Record<string, Array<(event: { data: string; type: string }) => void>> = {};
      constructor(url: string) {
        urls.push(url);
        sources.push(this);
      }
      addEventListener(type: string, listener: (event: { data: string; type: string }) => void) {
        this.listeners[type] ??= [];
        this.listeners[type].push(listener);
      }
      close() {
        this.closed = true;
      }
    }
    let ticketNumber = 0;
    const fetchImpl: typeof fetch = vi.fn(async (_url, init) => {
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer browser-token");
      ticketNumber += 1;
      return Response.json({
        ticket: `ticket-${ticketNumber}`,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      });
    });
    const apis = createWebRuntimeAPIs({
      baseUrl: "https://runner.example",
      bearerToken: "browser-token",
      fetchImpl,
      EventSourceImpl: FakeEventSource,
    });

    apis.events.open({
      snapshot: false,
      lastEventId: "epoch:4",
    }, {
      onEvent: vi.fn(),
      onError: vi.fn(),
    });
    await vi.waitFor(() => expect(sources).toHaveLength(1));
    expect(urls[0]).toBe(
      "https://runner.example/api/events?ticket=ticket-1&cursor=epoch%3A4",
    );
    expect(urls[0]).not.toContain("browser-token");

    sources[0]?.listeners.error?.[0]?.({ type: "error", data: "" });
    expect(sources[0]?.closed).toBe(true);

    apis.events.open({ snapshot: false }, {
      onEvent: vi.fn(),
      onError: vi.fn(),
    });
    await vi.waitFor(() => expect(sources).toHaveLength(2));
    expect(urls[1]).toContain("ticket=ticket-2");
  });
});
