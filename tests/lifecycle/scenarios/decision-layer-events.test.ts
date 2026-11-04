/**
 * The decision layer is observable on the wire: each call is one
 * decision.requested followed by exactly one of answered / fallback, a
 * disabled layer reports decision.skipped once (not per call), and no frame
 * ever carries the API key or the decision state.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { executionEvents } from "@/server/db/schema";
import { eventsRouteModule as eventsRoute } from "@/../tests/helpers/runtime-routes";
import { __resetNamedEventsForTests } from "@/server/events/named-events";
import type { DecisionLayerConfig } from "@/server/decisions/config";
import { DecisionService } from "@/server/decisions/service";
import { createMockDecisionProvider } from "@/server/decisions/mock-provider";
import { DecisionProviderError } from "@/server/decisions/types";
import { DEFAULT_DECISION_MODEL } from "@/shared/decision-layer";
import { startLifecycleHarness, type LifecycleServer } from "../harness/server";
import { LifecycleClient } from "../harness/client";
import { Chaos, NO_CHAOS } from "../harness/chaos";
import { clearLifecycleSchema, seedDirectRun } from "../harness/fixtures";

const FAKE_KEY = "vck_TESTONLY_placeholder_0000";
const STATE_MARKER = "state-marker-must-not-appear-on-the-wire";

let server: LifecycleServer;
let client: LifecycleClient;

function config(overrides: Partial<DecisionLayerConfig> = {}): DecisionLayerConfig {
  return {
    enabled: true,
    actingPoints: new Set(),
    textModel: null,
    textTasks: new Set(),
    model: DEFAULT_DECISION_MODEL,
    escalationModel: null,
    zeroDataRetention: false,
    points: new Set(["supervisor_wake"]),
    apiKey: FAKE_KEY,
    baseUrl: null,
    ...overrides,
  };
}

beforeEach(async () => {
  __resetNamedEventsForTests();
  await db.delete(executionEvents);
  await clearLifecycleSchema();
  server = await startLifecycleHarness({ routes: [{ pattern: "/api/events", module: eventsRoute }] });
  client = new LifecycleClient({ baseUrl: server.baseUrl, chaos: new Chaos(5, NO_CHAOS) });
});

afterEach(async () => {
  await client.close();
  await server.stop();
});

describe("decision layer lifecycle", () => {
  it("streams skipped, answered and fallback outcomes without leaking key or state", async () => {
    const { runId } = await seedDirectRun();
    await client.bootstrapSnapshot(runId);
    await client.subscribe({ runId });

    let current = config({ enabled: false });
    let failNext = false;
    const service = new DecisionService({
      loadConfig: async () => current,
      createProvider: () => ({
        id: "mock",
        decide: async (call) => {
          if (failNext) throw new DecisionProviderError("rate_limited", "AI Gateway rate limited the request.", 429, 3);
          return createMockDecisionProvider().decide(call);
        },
      }),
      env: {},
    });
    const request = {
      point: "supervisor_wake" as const,
      runId,
      workerId: "worker-1",
      state: { summary: STATE_MARKER },
      questions: { wake: { type: "boolean" as const, instructions: "Does the supervisor need to act?" } },
      timeoutMs: 2_000,
    };

    await service.decide(request);
    await service.decide(request);
    await client.waitFor("decision.skipped", { timeoutMs: 10_000 });

    current = config();
    expect((await service.decide(request)).status).toBe("answered");
    const answered = await client.waitFor("decision.answered", { timeoutMs: 10_000 });
    expect(answered.id).toBeTruthy();
    expect(answered.payload).toMatchObject({ point: "supervisor_wake", runId, shadow: true, model: DEFAULT_DECISION_MODEL });

    failNext = true;
    expect(await service.decide(request)).toMatchObject({ status: "fallback", reason: "rate_limited" });
    await client.waitFor("decision.fallback", { timeoutMs: 10_000 });

    const frames = client.events.frames.filter((frame) => frame.event.startsWith("decision."));
    expect(frames.map((frame) => frame.event)).toEqual([
      "decision.skipped",
      "decision.requested",
      "decision.answered",
      "decision.requested",
      "decision.fallback",
    ]);
    const wire = JSON.stringify(client.events.frames.map((frame) => frame.payload));
    expect(wire).not.toContain(FAKE_KEY);
    expect(wire).not.toContain(STATE_MARKER);
  });
});
