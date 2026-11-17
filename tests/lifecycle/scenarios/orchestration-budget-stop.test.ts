/**
 * A stage whose reservation would exceed the workflow cap: dispatch stops
 * before any agent work, a surfaced budget error names the stage, and the
 * blocked stage stays resumable rather than silently failing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eventsRouteModule as eventsRoute } from "@/../tests/helpers/runtime-routes";
import { __resetNamedEventsForTests } from "@/server/events/named-events";
import { createDefaultOrchestrationPolicy } from "@/shared/orchestration-policy";
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
  client = new LifecycleClient({ baseUrl: server.baseUrl, chaos: new Chaos(13, NO_CHAOS) });
});

afterEach(async () => {
  await client.close();
  await server.stop();
  if (runId) await clearOrchestrationScenarioRows(runId);
});

describe("orchestration budget stop", () => {
  it("blocks the stage that would exceed the cap and surfaces an actionable error", async () => {
    ({ runId } = await seedOmniPlanningRun());
    await client.bootstrapSnapshot(runId);
    await client.subscribe({ runId });

    const policy = createDefaultOrchestrationPolicy();
    policy.profiles.balanced.runBudget.maxTokens = 100_000; // the planner alone reserves 600k
    await postAction(server.baseUrl, runId, { action: "create", policy });
    await postAction(server.baseUrl, runId, { action: "dispatch" });

    const blocked = await client.waitFor("orchestration.stage_blocked", { timeoutMs: 10_000 });
    expect(blocked.payload).toMatchObject({ runId, stage: "plan", code: "budget_exceeded" });
    const surfaced = await client.waitFor("error.surfaced", { timeoutMs: 10_000, predicate: (frame) => (frame.payload as { code?: string }).code === "orchestration.budget_exceeded" });
    expect(surfaced.payload).toMatchObject({ runId, surface: "banner" });
    expect(client.events.frames.some((frame) => frame.event === "orchestration.stage_dispatched" && (frame.payload as { stage: string }).stage === "plan")).toBe(false);

    const snapshot = await (await fetch(`${server.baseUrl}/api/runs/${runId}/orchestration`)).json() as { workflow: { next: unknown; stages: Array<{ stage: string; status: string; failureCode: string | null }> } };
    expect(snapshot.workflow.stages.find((stage) => stage.stage === "plan")).toMatchObject({ status: "blocked", failureCode: "budget_exceeded" });
    expect(snapshot.workflow.next).toMatchObject({ kind: "blocked", stage: "plan" });
  });
});
