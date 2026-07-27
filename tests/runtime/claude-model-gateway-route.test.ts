import { describe, expect, test, vi } from "vitest";
import { createOmniRuntimeHttpRegistry } from "@/runtime/http/routes";
import { createClaudeModelGatewayHandler } from "@/runtime/http/routes/claude-model-gateway";

const status = {
  revision: 9,
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
};

function fakeService() {
  return {
    inspect: vi.fn(async () => status),
    install: vi.fn(async () => ({ operationId: "install-1", status })),
    start: vi.fn(async () => ({ operationId: "start-1", status })),
    stop: vi.fn(async () => ({ operationId: "stop-1", status })),
    connect: vi.fn(async () => ({ operationId: "connect-1", url: "https://auth.example", state: "oauth-state", status })),
    refreshModels: vi.fn(async () => ({ operationId: "refresh-1", status })),
  };
}

describe("Claude model gateway HTTP route", () => {
  test("GET returns the complete redacted service snapshot", async () => {
    const service = fakeService();
    const handler = createClaudeModelGatewayHandler(service);
    const response = await handler(new Request("http://localhost/api/integrations/claude-model-gateway"), { surface: "test" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status });
    expect(service.inspect).toHaveBeenCalledTimes(1);
  });

  test.each([
    ["install", "install"],
    ["start", "start"],
    ["stop", "stop"],
    ["connect", "connect"],
    ["refresh_models", "refreshModels"],
  ])("POST %s delegates to the singleton operation", async (action, method) => {
    const service = fakeService();
    const handler = createClaudeModelGatewayHandler(service);
    const response = await handler(new Request("http://localhost/api/integrations/claude-model-gateway", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    }), { surface: "test" });
    expect(response.status).toBe(200);
    expect(service[method as keyof typeof service]).toHaveBeenCalledTimes(1);
  });

  test("rejects unsupported content types, malformed JSON, unknown fields, and actions", async () => {
    const handler = createClaudeModelGatewayHandler(fakeService());
    const requests = [
      new Request("http://localhost/api/integrations/claude-model-gateway", { method: "POST", body: "{}" }),
      new Request("http://localhost/api/integrations/claude-model-gateway", { method: "POST", headers: { "content-type": "application/json" }, body: "{" }),
      new Request("http://localhost/api/integrations/claude-model-gateway", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "start", token: "secret" }) }),
      new Request("http://localhost/api/integrations/claude-model-gateway", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "other" }) }),
    ];
    for (const request of requests) {
      const response = await handler(request, { surface: "test" });
      expect(response.status).toBe(400);
    }
  });

  test("is registered in the portable runtime", async () => {
    const response = await createOmniRuntimeHttpRegistry().handle(
      new Request("http://localhost/api/integrations/claude-model-gateway", { method: "OPTIONS" }),
      { surface: "test" },
    );
    expect(response.status).toBe(405);
  });
});
