import { describe, expect, test, vi } from "vitest";
import { ClaudeModelGatewayManager } from "@/interface/home/ClaudeModelGatewayManager";

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
  test("routes actions through the runtime gateway API", async () => {
    const execute = vi.fn().mockResolvedValue({ status: status(1) });
    const manager = new ClaudeModelGatewayManager({
      load: vi.fn(),
      execute,
    });

    await manager.runAction("install");

    expect(execute).toHaveBeenCalledWith({ action: "install" });
    expect(manager.getSnapshot()).toMatchObject({ error: null, status: { revision: 1 } });
  });

  test("rejects slow responses and older server revisions", async () => {
    let resolveFirst!: (value: unknown) => void;
    const load = vi.fn()
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce({ status: status(3) });
    const manager = new ClaudeModelGatewayManager({ load, execute: vi.fn() });
    const first = manager.refresh();
    await manager.refresh();
    resolveFirst({ status: status(2) });
    await first;
    expect(manager.getSnapshot().status?.revision).toBe(3);
    manager.applyLiveStatus(status(1));
    expect(manager.getSnapshot().status?.revision).toBe(3);
  });

  test("accepts a lower revision after the live stream reports a backend resync", () => {
    const manager = new ClaudeModelGatewayManager({ load: vi.fn(), execute: vi.fn() });
    expect(manager.applyLiveStatus(status(50))).toBe(true);
    expect(manager.applyLiveStatus(status(1))).toBe(false);
    manager.resetRevisionAuthority();
    expect(manager.applyLiveStatus(status(1))).toBe(true);
    expect(manager.getSnapshot().status?.revision).toBe(1);
  });

  test("runs immediate actions and retains OAuth fallback details", async () => {
    const execute = vi.fn().mockResolvedValue({
      operationId: "connect-1",
      url: "https://auth.example/connect",
      state: "oauth-state",
      status: status(4),
    });
    const manager = new ClaudeModelGatewayManager({ load: vi.fn(), execute });
    await manager.runAction("connect");
    expect(execute).toHaveBeenCalledWith({ action: "connect" });
    expect(manager.getSnapshot()).toMatchObject({
      pendingAction: null,
      oauthUrl: "https://auth.example/connect",
      oauthState: "oauth-state",
      status: { revision: 4 },
    });
  });

  test("preserves actionable network errors and supports retry", async () => {
    const load = vi.fn()
      .mockRejectedValueOnce(new Error("Gateway is unavailable"))
      .mockResolvedValueOnce({ status: status(5) });
    const manager = new ClaudeModelGatewayManager({ load, execute: vi.fn() });
    await manager.refresh();
    expect(manager.getSnapshot().error).toBe("Gateway is unavailable");
    await manager.refresh();
    expect(manager.getSnapshot()).toMatchObject({ error: null, status: { revision: 5 } });
  });
});
