/**
 * Concurrent dispatch requests (SSE retries, double clicks, recovery
 * wake-ups) for one workflow: only one launch claim may create work, the
 * rest get a typed conflict, and the wire shows exactly one dispatch.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eventsRouteModule as eventsRoute } from "@/../tests/helpers/runtime-routes";
import { __resetNamedEventsForTests } from "@/server/events/named-events";
import { startLifecycleHarness, type LifecycleServer } from "../harness/server";
import { LifecycleClient } from "../harness/client";
import { Chaos, NO_CHAOS } from "../harness/chaos";
import { clearLifecycleSchema } from "../harness/fixtures";
import { clearOrchestrationScenarioRows, deterministicPreflightContext, orchestrationRouteModule, postAction, seedOmniPlanningRun } from "../harness/orchestration";

vi.mock("@/server/orchestration/model-catalog", async () => ({
  ...(await vi.importActual<typeof import("@/server/orchestration/model-catalog")>("@/server/orchestration/model-catalog")),
  createDefaultPreflightContext: () => deterministicPreflightContext(),
}));

let server: LifecycleServer;
let client: LifecycleClient;
let runId = "";

beforeEach(async () => {
  __resetNamedEventsForTests();
  await clearLifecycleSchema();
  server = await startLifecycleHarness({
    routes: [
      { pattern: "/api/events", module: eventsRoute },
      { pattern: "/api/runs/:id/orchestration", module: orchestrationRouteModule },
    ],
  });
  client = new LifecycleClient({ baseUrl: server.baseUrl, chaos: new Chaos(7, NO_CHAOS) });
});

afterEach(async () => {
  await client.close();
  await server.stop();
  if (runId) await clearOrchestrationScenarioRows(runId);
});

describe("orchestration duplicate dispatch", () => {
  it("creates one launch claim under concurrent dispatch requests", async () => {
    ({ runId } = await seedOmniPlanningRun());
    await client.bootstrapSnapshot(runId);
    await client.subscribe({ runId });

    expect((await postAction(server.baseUrl, runId, { action: "create" })).status).toBe(200);
    await client.waitFor("orchestration.workflow_created", { timeoutMs: 10_000 });

    const responses = await Promise.all(Array.from({ length: 6 }, () => postAction(server.baseUrl, runId, { action: "dispatch" })));
    expect(responses.every((response) => response.status === 200)).toBe(true);
    const bodies = await Promise.all(responses.map((response) => response.json() as Promise<{ ok: boolean; result?: { status: string } }>));
    expect(bodies.filter((body) => body.result?.status === "conflict").length).toBeGreaterThan(0);

    // Triage (Jev not configured) completes inline as advisory; the planner stage then waits.
    await client.waitFor("orchestration.stage_waiting", { timeoutMs: 10_000, predicate: (frame) => (frame.payload as { stage?: string }).stage === "plan" });
    // Let any straggling background advance settle before counting.
    await new Promise((resolve) => setTimeout(resolve, 200));

    const dispatched = client.events.frames.filter((frame) => frame.event === "orchestration.stage_dispatched");
    expect(dispatched.map((frame) => (frame.payload as { stage: string }).stage)).toEqual(["plan"]);
    const triageCompletions = client.events.frames.filter((frame) => frame.event === "orchestration.stage_completed" && (frame.payload as { stage: string }).stage === "triage");
    expect(triageCompletions).toHaveLength(1);
    expect(client.events.frames.some((frame) => frame.event === "orchestration.refused")).toBe(true);
  });
});
