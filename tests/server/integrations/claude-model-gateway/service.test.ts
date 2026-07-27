import { describe, expect, test, vi } from "vitest";
import { inspect } from "node:util";
import { createClaudeModelGatewayService } from "@/server/integrations/claude-model-gateway";
import type { ClaudeModelGatewaySettings } from "@/server/integrations/claude-model-gateway/settings";

const configured: ClaudeModelGatewaySettings = {
  mode: "managed",
  enabled: false,
  baseUrl: "http://127.0.0.1:8317",
  apiToken: "api-secret",
  managementToken: "management-secret",
  customModels: [{ id: "gpt-5.6-sol", label: "GPT-5.6 SOL" }],
  catalog: { models: [], updatedAt: null },
};

function fixture(overrides: Record<string, unknown> = {}) {
  const events: Array<Record<string, unknown>> = [];
  const settings: ClaudeModelGatewaySettings = structuredClone(configured);
  const processManager = {
    inspect: vi.fn(async () => ({ running: false, owned: false, record: null })),
    start: vi.fn(async () => ({ pid: 42 })),
    stop: vi.fn(async () => ({ stopped: true, pid: 42 })),
  };
  const client = {
    checkReady: vi.fn(async () => true),
    listModels: vi.fn(async () => [{ id: "gpt-5.6-sol", label: "GPT SOL" }]),
    createCodexOAuthUrl: vi.fn(async () => ({ url: "https://auth.example/connect", state: "oauth-state" })),
    isCodexOAuthConnected: vi.fn(async () => true),
  };
  const service = createClaudeModelGatewayService({
    homeDir: "/tmp/omni-home",
    readSettings: vi.fn(async () => ({ ...settings })),
    saveSettings: vi.fn(async (update: Partial<ClaudeModelGatewaySettings>) => Object.assign(settings, update)),
    writeProvisionalSettings: vi.fn(async () => ({ ...settings })),
    saveCatalog: vi.fn(async (models) => { settings.catalog = { models, updatedAt: new Date().toISOString() }; }),
    inspectInstallation: vi.fn(async () => null),
    installBinary: vi.fn(async () => ({ version: "7.2.71", executable: "/managed/cli-proxy-api", source: "managed" as const })),
    createClient: vi.fn(() => client),
    createProcessManager: vi.fn(() => processManager),
    emit: (event) => events.push(event),
    pollIntervalMs: 1,
    oauthTimeoutMs: 100,
    ...overrides,
  });
  return { service, events, settings, processManager, client };
}

describe("Claude model gateway service", () => {
  test("returns a complete redacted snapshot with monotonic revisions", async () => {
    const { service } = fixture();
    const first = await service.inspect();
    expect(first).toMatchObject({
      revision: expect.any(Number),
      mode: "managed",
      enabled: false,
      installation: "absent",
      service: "stopped",
      oauth: "disconnected",
      connection: {
        baseUrl: "http://127.0.0.1:8317",
        apiTokenConfigured: true,
        managementTokenConfigured: true,
      },
    });
    expect(JSON.stringify(first)).not.toContain("api-secret");
    expect(JSON.stringify(first)).not.toContain("management-secret");

    const second = await service.refreshModels();
    expect(second.status.revision).toBeGreaterThan(first.revision);
  });

  test("deduplicates concurrent installs and emits the exact successful transition sequence", async () => {
    let finishInstall!: () => void;
    const installBinary = vi.fn(() => new Promise<{ version: string; executable: string; source: "managed" }>((resolve) => {
      finishInstall = () => resolve({ version: "7.2.71", executable: "/managed/cli-proxy-api", source: "managed" });
    }));
    const { service, events } = fixture({ installBinary });
    const first = service.install();
    const second = service.install();
    await vi.waitFor(() => expect(installBinary).toHaveBeenCalledTimes(1));
    finishInstall();
    const [a, b] = await Promise.all([first, second]);
    expect(a.operationId).toBe(b.operationId);
    expect(events.map((event) => event.kind)).toEqual([
      "claude_gateway.install_started",
      "claude_gateway.install_completed",
    ]);
  });

  test("starts, connects with server-owned completion polling, refreshes, and stops", async () => {
    const { service, events, processManager } = fixture({
      inspectInstallation: vi.fn(async () => ({ version: "7.2.71", executable: "/managed/cli-proxy-api", source: "managed" as const })),
    });
    await service.start();
    const connected = await service.connect();
    expect(connected).toMatchObject({ url: "https://auth.example/connect", state: "oauth-state" });
    await vi.waitFor(() => expect(service.getSnapshot().oauth).toBe("connected"));
    await service.refreshModels();
    await service.stop();
    expect(processManager.start).toHaveBeenCalledTimes(1);
    expect(processManager.stop).toHaveBeenCalledTimes(1);
    expect(events.map((event) => event.kind)).toEqual([
      "claude_gateway.service_starting",
      "claude_gateway.service_started",
      "claude_gateway.oauth_started",
      "claude_gateway.oauth_completed",
      "claude_gateway.models_refreshed",
      "claude_gateway.service_stopped",
    ]);
  });

  test("surfaces stable failures without leaking tokens", async () => {
    const { service, events } = fixture({
      installBinary: vi.fn(async () => { throw new Error("download failed with api-secret"); }),
    });
    const rejection = await service.install().catch((error: unknown) => error);
    expect(rejection).toBeInstanceOf(Error);
    expect((rejection as Error).message).toContain("download failed");
    expect((rejection as Error).message).not.toContain("api-secret");
    expect(events.map((event) => event.kind)).toEqual([
      "claude_gateway.install_started",
      "claude_gateway.install_failed",
      "error.surfaced",
    ]);
    expect(JSON.stringify(events)).not.toContain("api-secret");
    expect(events.at(-1)).toMatchObject({ code: "claude_gateway.install_failed" });
    expect(inspect(rejection)).not.toContain("api-secret");
  });

  test("serializes conflicting actions so stop cannot overtake start", async () => {
    let finishStart!: () => void;
    const processManager = {
      inspect: vi.fn(async () => ({ running: false, owned: false })),
      start: vi.fn(() => new Promise<{ pid: number }>((resolve) => { finishStart = () => resolve({ pid: 42 }); })),
      stop: vi.fn(async () => ({ stopped: true })),
    };
    const { service } = fixture({
      inspectInstallation: vi.fn(async () => ({ version: "7.2.71", executable: "/managed/cli-proxy-api", source: "managed" as const })),
      createProcessManager: vi.fn(() => processManager),
    });
    const starting = service.start();
    const stopping = service.stop();
    await vi.waitFor(() => expect(processManager.start).toHaveBeenCalledTimes(1));
    expect(processManager.stop).not.toHaveBeenCalled();
    finishStart();
    await Promise.all([starting, stopping]);
    expect(processManager.stop).toHaveBeenCalledTimes(1);
    expect(service.getSnapshot()).toMatchObject({ enabled: false, service: "stopped" });
  });

  test("probes managed readiness and restores provider connection state during inspection", async () => {
    const processManager = {
      inspect: vi.fn(async () => ({ running: true, owned: true })),
      start: vi.fn(),
      stop: vi.fn(),
    };
    const { service, settings, client } = fixture({ createProcessManager: vi.fn(() => processManager) });
    settings.enabled = true;
    client.isCodexOAuthConnected.mockResolvedValueOnce(true);
    await expect(service.inspect()).resolves.toMatchObject({ service: "running", oauth: "connected" });
    expect(client.checkReady).toHaveBeenCalledTimes(1);
    expect(client.isCodexOAuthConnected).toHaveBeenCalledTimes(1);
  });

  test("marks an owned managed process unreachable when its API is not ready", async () => {
    const processManager = {
      inspect: vi.fn(async () => ({ running: true, owned: true })),
      start: vi.fn(),
      stop: vi.fn(),
    };
    const { service, settings, client, events } = fixture({ createProcessManager: vi.fn(() => processManager) });
    settings.enabled = true;
    client.checkReady.mockRejectedValueOnce(new Error("not accepting requests"));
    await expect(service.inspect()).resolves.toMatchObject({ service: "unreachable" });
    expect(events).toContainEqual(expect.objectContaining({ kind: "claude_gateway.service_probe_failed", mode: "managed" }));
  });

  test("stops an owned managed process for shutdown without disabling boot recovery", async () => {
    const saveSettings = vi.fn(async () => undefined);
    const { service, settings, processManager } = fixture({ saveSettings });
    settings.enabled = true;
    await service.shutdown();
    expect(processManager.stop).toHaveBeenCalledTimes(1);
    expect(saveSettings).not.toHaveBeenCalled();
    expect(service.getSnapshot()).toMatchObject({ enabled: true, service: "stopped" });
  });

  test("external mode probes readiness but never starts or stops a process", async () => {
    const { service, settings, client, processManager } = fixture();
    settings.mode = "external";
    settings.enabled = true;
    await service.start();
    await service.stop();
    expect(client.checkReady).toHaveBeenCalled();
    expect(processManager.start).not.toHaveBeenCalled();
    expect(processManager.stop).not.toHaveBeenCalled();
  });

  test("records a redacted named failure when an external status probe is unreachable", async () => {
    const { service, settings, client, events } = fixture();
    settings.mode = "external";
    settings.enabled = true;
    client.checkReady.mockRejectedValueOnce(new Error("upstream rejected api-secret"));

    await expect(service.inspect()).resolves.toMatchObject({ service: "unreachable" });
    expect(events).toEqual([
      {
        kind: "claude_gateway.service_probe_failed",
        mode: "external",
        reason: "upstream rejected [redacted]",
      },
      expect.objectContaining({
        kind: "error.surfaced",
        code: "claude_gateway.not_ready",
        surface: "log",
      }),
    ]);
    expect(JSON.stringify(events)).not.toContain("api-secret");
  });
});
