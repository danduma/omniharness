import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { inArray } from "drizzle-orm";
import { CLAUDE_MODEL_GATEWAY_SETTING_KEYS } from "@/lib/claude-model-gateway";
import { db } from "@/server/db";
import { messages, plans, runs, settings, workerCounters, workers } from "@/server/db/schema";
import { saveClaudeModelGatewaySettings } from "@/server/integrations/claude-model-gateway/settings";
import { __resetNamedEventsForTests } from "@/server/events/named-events";
import { startClaudeGatewayFixture, type ClaudeGatewayFixture } from "../../fixtures/claude-model-gateway/fixture-server";
import { startLifecycleHarness, type LifecycleServer } from "../harness/server";
import { LifecycleClient } from "../harness/client";
import { Chaos, NO_CHAOS } from "../harness/chaos";
import { eventsRouteModule as eventsRoute } from "@/../tests/helpers/runtime-routes";
import { claudeModelGatewayRouteModule as gatewayRoute } from "@/../tests/helpers/runtime-routes";
import { conversationsRouteModule as conversationsRoute } from "@/../tests/helpers/runtime-routes";
import { compareEventStreamIds } from "@/shared/runtime";

vi.mock("@/server/bridge-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/bridge-client")>();
  return {
    ...actual,
    spawnAgent: vi.fn().mockResolvedValue({ name: "worker", type: "claude", state: "idle" }),
    askAgent: vi.fn().mockResolvedValue({ response: "ok", state: "idle" }),
    getAgent: vi.fn().mockResolvedValue({}),
  };
});
vi.mock("@/server/git/auto-commit", () => ({ captureGitBaseline: vi.fn(() => null) }));

let fixture: ClaudeGatewayFixture;
let server: LifecycleServer;
let client: LifecycleClient;
const gatewayKeys = Object.values(CLAUDE_MODEL_GATEWAY_SETTING_KEYS);

beforeEach(async () => {
  __resetNamedEventsForTests();
  await db.delete(messages);
  await db.delete(workers);
  await db.delete(workerCounters);
  await db.delete(runs);
  await db.delete(plans);
  await db.delete(settings).where(inArray(settings.key, gatewayKeys));
  fixture = await startClaudeGatewayFixture();
  await saveClaudeModelGatewaySettings({
    mode: "external",
    enabled: false,
    baseUrl: fixture.baseUrl,
    apiToken: fixture.apiToken,
    managementToken: fixture.managementToken,
  });
  server = await startLifecycleHarness({ routes: [
    { pattern: "/api/events", module: eventsRoute },
    { pattern: "/api/integrations/claude-model-gateway", module: gatewayRoute },
    { pattern: "/api/conversations", module: conversationsRoute },
  ] });
  client = new LifecycleClient({ baseUrl: server.baseUrl, chaos: new Chaos(71, NO_CHAOS) });
});

afterEach(async () => {
  await client.close();
  await server.stop();
  await fixture.close();
  await db.delete(messages);
  await db.delete(workers);
  await db.delete(workerCounters);
  await db.delete(runs);
  await db.delete(plans);
  await db.delete(settings).where(inArray(settings.key, gatewayKeys));
});

describe("lifecycle harness — Claude model gateway", () => {
  test("publishes external start, model refresh, OAuth completion, and redacted canonical status", async () => {
    await client.bootstrapSnapshot();
    await client.subscribe({});
    fixture.completeOAuth();
    for (const action of ["start", "refresh_models", "connect"]) {
      const response = await client.fetch("/api/integrations/claude-model-gateway", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      expect(response.status).toBe(200);
    }
    const completed = await client.waitFor("claude_gateway.oauth_completed", { timeoutMs: 10_000 });
    const started = client.events.filterByEvent("claude_gateway.service_started")[0]!;
    const refreshed = client.events.filterByEvent("claude_gateway.models_refreshed")[0]!;
    expect(compareEventStreamIds(started.id!, refreshed.id!)).toBe(-1);
    expect(compareEventStreamIds(refreshed.id!, completed.id!)).toBe(-1);
    const snapshotResponse = await client.fetch("/api/events?snapshot=1&persisted=1");
    const snapshot = await snapshotResponse.json() as Record<string, unknown>;
    expect(snapshot.claudeModelGateway).toMatchObject({ service: "running", oauth: "connected" });
    expect(JSON.stringify(snapshot)).not.toContain(fixture.apiToken);
    expect(JSON.stringify(snapshot)).not.toContain(fixture.managementToken);
  });

  test("refuses an unavailable routed conversation before creating durable rows", async () => {
    await saveClaudeModelGatewaySettings({ enabled: true });
    fixture.setAvailable(false);
    await client.bootstrapSnapshot();
    await client.subscribe({});
    const response = await client.fetch("/api/conversations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: "direct",
        command: "must not fall back",
        preferredWorkerType: "claude",
        preferredWorkerModel: "cliproxyapi:gpt-5.6-sol",
        preferredWorkerAccountId: null,
        allowedWorkerTypes: ["claude"],
      }),
    });
    expect(response.status).toBeGreaterThanOrEqual(400);
    await client.waitFor("claude_gateway.spawn_refused", { timeoutMs: 10_000 });
    expect(await db.select().from(plans)).toHaveLength(0);
    expect(await db.select().from(runs)).toHaveLength(0);
    expect(await db.select().from(workers)).toHaveLength(0);
    expect(await db.select().from(messages)).toHaveLength(0);
  });
});
