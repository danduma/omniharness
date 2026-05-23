import { describe, expect, it, vi } from "vitest";
import { handleVSCodeBridgeMessage } from "@/vscode-extension/bridge";

describe("handleVSCodeBridgeMessage", () => {
  it("proxies API requests to the configured Omni runtime", async () => {
    const fetchImpl: typeof fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      expect(String(url)).toBe("http://127.0.0.1:3035/api/auth/session");
      expect(init?.method).toBe("GET");
      return new Response(JSON.stringify({ authenticated: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const response = await handleVSCodeBridgeMessage(
      {
        id: "1",
        type: "api:proxy",
        payload: {
          method: "GET",
          path: "/api/auth/session",
        },
      },
      {
        serverUrl: "http://127.0.0.1:3035/",
        fetchImpl,
      },
    );

    expect(response).toEqual({
      id: "1",
      type: "api:proxy",
      success: true,
      data: {
        status: 200,
        headers: { "content-type": "application/json" },
        bodyText: "{\"authenticated\":true}",
      },
    });
  });

  it("rejects unknown bridge messages with a typed error", async () => {
    const response = await handleVSCodeBridgeMessage(
      { id: "2", type: "unknown" },
      { serverUrl: "http://127.0.0.1:3035" },
    );

    expect(response).toEqual({
      id: "2",
      type: "unknown",
      success: false,
      error: {
        code: "vscode.bridge.unknown_message",
        message: "Unknown VS Code bridge message: unknown.",
        surface: "vscode",
      },
    });
  });

  it("refuses non-API proxy paths and unsupported methods before hitting the runtime", async () => {
    const fetchImpl = vi.fn();

    const nonApiResponse = await handleVSCodeBridgeMessage(
      {
        id: "path",
        type: "api:proxy",
        payload: {
          method: "GET",
          path: "/not-api",
        },
      },
      {
        serverUrl: "http://127.0.0.1:3035",
        fetchImpl,
      },
    );
    const methodResponse = await handleVSCodeBridgeMessage(
      {
        id: "method",
        type: "api:proxy",
        payload: {
          method: "CONNECT",
          path: "/api/auth/session",
        },
      },
      {
        serverUrl: "http://127.0.0.1:3035",
        fetchImpl,
      },
    );

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(nonApiResponse).toEqual({
      id: "path",
      type: "api:proxy",
      success: false,
      error: expect.objectContaining({
        code: "vscode.bridge.proxy_failed",
        surface: "vscode",
      }),
    });
    expect(methodResponse).toEqual({
      id: "method",
      type: "api:proxy",
      success: false,
      error: expect.objectContaining({
        code: "vscode.bridge.proxy_failed",
        surface: "vscode",
      }),
    });
  });

  it("proxies SSE frames to the webview and supports resume ids", async () => {
    const posted: unknown[] = [];
    const encoder = new TextEncoder();
    const fetchImpl: typeof fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      expect(String(url)).toBe("http://127.0.0.1:3035/api/events?runId=run-1&lastEventId=7");
      expect(init?.headers).toMatchObject({ accept: "text/event-stream" });
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode("id: 8\nevent: update\ndata: {\"runs\":[]}\n\n"));
          controller.close();
        },
      }), {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      });
    });

    const response = await handleVSCodeBridgeMessage(
      {
        id: "3",
        type: "sse:open",
        payload: {
          runId: "run-1",
          lastEventId: "7",
        },
      },
      {
        serverUrl: "http://127.0.0.1:3035",
        fetchImpl,
        postMessage: (message) => posted.push(message),
        sseStreams: new Map(),
      },
    );

    expect(response).toEqual({
      id: "3",
      type: "sse:open",
      success: true,
      data: { ok: true },
    });
    await vi.waitFor(() => {
      expect(posted).toEqual([
        {
          id: "3",
          type: "sse:event",
          success: true,
          data: {
            id: "8",
            event: "update",
            payload: { runs: [] },
          },
        },
      ]);
    });
  });
});
