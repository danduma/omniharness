import { describe, expect, test, vi } from "vitest";
import { ClaudeModelGatewayManager } from "@/app/home/ClaudeModelGatewayManager";

const status = (revision: number) => ({
  revision,
  mode: "managed" as const,
  enabled: true,
  installation: "installed" as const,
  service: "running" as const,
  oauth: "connected" as const,
  connection: { baseUrl: "http://127.0.0.1:8317", apiTokenConfigured: true, managementTokenConfigured: true },
  installedVersion: "7.2.71",
  installedSource: "managed" as const,
  operation: null,
  models: { custom: [{ id: "gpt-5.6-sol" }], discovered: [], updatedAt: null, stale: false },
});

describe("ClaudeModelGatewayManager", () => {
  test("invokes browser fetch with the browser global as its receiver", async () => {
    const fetchImpl = vi.fn(function browserFetch(this: unknown) {
      if (this !== globalThis) {
        throw new TypeError("Illegal invocation");
      }
      return Promise.resolve(Response.json({ status: status(1) }));
    }) as unknown as typeof fetch;
    const manager = new ClaudeModelGatewayManager(fetchImpl);

    await manager.runAction("install");

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(manager.getSnapshot()).toMatchObject({ error: null, status: { revision: 1 } });
  });

  test("rejects slow responses and older server revisions", async () => {
    let resolveFirst!: (value: Response) => void;
    const fetchImpl = vi.fn()
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce(Response.json({ status: status(3) }));
    const manager = new ClaudeModelGatewayManager(fetchImpl);
    const first = manager.refresh();
    await manager.refresh();
    resolveFirst(Response.json({ status: status(2) }));
    await first;
    expect(manager.getSnapshot().status?.revision).toBe(3);
    manager.applyLiveStatus(status(1));
    expect(manager.getSnapshot().status?.revision).toBe(3);
  });

  test("accepts a lower revision after the live stream reports a backend resync", () => {
    const manager = new ClaudeModelGatewayManager(vi.fn());
    expect(manager.applyLiveStatus(status(50))).toBe(true);
    expect(manager.applyLiveStatus(status(1))).toBe(false);
    manager.resetRevisionAuthority();
    expect(manager.applyLiveStatus(status(1))).toBe(true);
    expect(manager.getSnapshot().status?.revision).toBe(1);
  });

  test("runs immediate actions and retains OAuth fallback details", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(Response.json({
      operationId: "connect-1",
      url: "https://auth.example/connect",
      state: "oauth-state",
      status: status(4),
    }));
    const manager = new ClaudeModelGatewayManager(fetchImpl);
    await manager.runAction("connect");
    expect(fetchImpl).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ action: "connect" }),
    }));
    expect(manager.getSnapshot()).toMatchObject({
      pendingAction: null,
      oauthUrl: "https://auth.example/connect",
      oauthState: "oauth-state",
      status: { revision: 4 },
    });
  });

  test("preserves actionable network errors and supports retry", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "Gateway is unavailable" } }), { status: 502 }))
      .mockResolvedValueOnce(Response.json({ status: status(5) }));
    const manager = new ClaudeModelGatewayManager(fetchImpl);
    await manager.refresh();
    expect(manager.getSnapshot().error).toBe("Gateway is unavailable");
    await manager.refresh();
    expect(manager.getSnapshot()).toMatchObject({ error: null, status: { revision: 5 } });
  });
});
