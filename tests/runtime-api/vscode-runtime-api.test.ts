import { describe, expect, it } from "vitest";
import { createVSCodeRuntimeAPIs, type VSCodeRuntimeApiTransport } from "@/runtime-api/vscode";

describe("createVSCodeRuntimeAPIs", () => {
  it("proxies runtime requests through postMessage and resolves matching responses", async () => {
    const listeners: Array<(message: unknown) => void> = [];
    const sent: unknown[] = [];
    const transport: VSCodeRuntimeApiTransport = {
      postMessage(message) {
        sent.push(message);
        const request = message as { id: string; payload: { path: string } };
        queueMicrotask(() => {
          listeners.forEach((listener) => listener({
            id: request.id,
            type: "api:proxy",
            success: true,
            data: {
              status: 200,
              headers: {},
              bodyText: JSON.stringify({ path: request.payload.path }),
            },
          }));
        });
      },
      addMessageListener(listener) {
        listeners.push(listener);
        return () => {
          const index = listeners.indexOf(listener);
          if (index >= 0) listeners.splice(index, 1);
        };
      },
    };

    const apis = createVSCodeRuntimeAPIs({ transport });
    const response = await apis.settings.load();

    expect(response).toEqual({ path: "/api/settings" });
    expect(sent).toEqual([
      expect.objectContaining({
        type: "api:proxy",
        payload: expect.objectContaining({ method: "GET", path: "/api/settings" }),
      }),
    ]);
  });

  it("normalizes bridge and HTTP failures into typed runtime errors", async () => {
    const listeners: Array<(message: unknown) => void> = [];
    const transport: VSCodeRuntimeApiTransport = {
      postMessage(message) {
        const request = message as { id: string };
        queueMicrotask(() => {
          listeners.forEach((listener) => listener({
            id: request.id,
            type: "api:proxy",
            success: true,
            data: {
              status: 403,
              headers: {},
              bodyText: JSON.stringify({ error: { message: "Forbidden." } }),
            },
          }));
        });
      },
      addMessageListener(listener) {
        listeners.push(listener);
        return () => {};
      },
    };

    const apis = createVSCodeRuntimeAPIs({ transport });

    await expect(apis.settings.load()).rejects.toMatchObject({
      code: "runtime.http_403",
      message: "Forbidden.",
      surface: "vscode",
    });
  });

  it("opens a VS Code SSE bridge stream and closes it by stream id", () => {
    const listeners: Array<(message: unknown) => void> = [];
    const sent: unknown[] = [];
    const transport: VSCodeRuntimeApiTransport = {
      postMessage(message) {
        sent.push(message);
      },
      addMessageListener(listener) {
        listeners.push(listener);
        return () => {
          const index = listeners.indexOf(listener);
          if (index >= 0) listeners.splice(index, 1);
        };
      },
    };

    const seen: unknown[] = [];
    const apis = createVSCodeRuntimeAPIs({ transport });
    const subscription = apis.events.open({
      snapshot: false,
      runId: "run-1",
      lastEventId: "8",
    }, {
      onEvent: (event) => seen.push(event),
    });

    expect(sent[0]).toEqual(expect.objectContaining({
      type: "sse:open",
      payload: { runId: "run-1", lastEventId: "8" },
    }));

    const streamId = (sent[0] as { id: string }).id;
    listeners.forEach((listener) => listener({
      id: streamId,
      type: "sse:event",
      success: true,
      data: { event: "update", payload: { runs: [] } },
    }));
    subscription.close();

    expect(seen).toEqual([{ event: "update", payload: { runs: [] } }]);
    expect(sent[1]).toEqual({
      id: `${streamId}:close`,
      type: "sse:close",
      payload: { id: streamId },
    });
  });
});
