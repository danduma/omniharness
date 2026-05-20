import { describe, expect, it, vi } from "vitest";
import { createWebRuntimeAPIs } from "@/runtime-api/web";

describe("createWebRuntimeAPIs", () => {
  it("loads bootstrap data through the portable runtime API contract", async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("/api/runtime/bootstrap?run=run-1&project=%2Ftmp%2Fapp&pair=pair-1");
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
      listeners: Record<string, Array<(event: { data: string; type: string }) => void>>;
      closed: boolean;
      close(): void;
      addEventListener(type: string, listener: (event: { data: string; type: string }) => void): void;
    }> = [];

    class FakeEventSource {
      readonly listeners: Record<string, Array<(event: { data: string; type: string }) => void>> = {};
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
      baseUrl: "http://127.0.0.1:3035",
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
    expect(instances[0]?.url).toBe("http://127.0.0.1:3035/api/events?runId=run-1&lastEventId=42");

    instances[0]?.listeners.update?.[0]?.({ type: "update", data: "{\"runs\":[]}" });
    instances[0]?.listeners["stream.resync_required"]?.[0]?.({ type: "stream.resync_required", data: "{\"reason\":\"id_out_of_buffer\"}" });
    instances[0]?.listeners.error?.[0]?.({ type: "error", data: "" });
    subscription.close();

    expect(seen).toEqual([
      { kind: "update", payload: { runs: [] } },
      { kind: "stream.resync_required", reason: "id_out_of_buffer" },
    ]);
    expect(errors).toEqual([{ code: "runtime.events_failed", message: "Event stream failed.", surface: "web" }]);
    expect(instances[0]?.closed).toBe(true);
  });
});
