/**
 * A server restart while a stage was being launched: reconciliation must not
 * guess. The stage becomes needs_recovery (reservation kept), the user sees an
 * actionable error, and a retry claims a fresh attempt.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { eventsRouteModule as eventsRoute } from "@/../tests/helpers/runtime-routes";
import { db } from "@/server/db";
import { orchestrationStages } from "@/server/db/schema";
import { __resetNamedEventsForTests } from "@/server/events/named-events";
import { reconcileOrchestrationStages } from "@/server/orchestration/reconcile";
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
  client = new LifecycleClient({ baseUrl: server.baseUrl, chaos: new Chaos(11, NO_CHAOS) });
});

afterEach(async () => {
  await client.close();
  await server.stop();
  if (runId) await clearOrchestrationScenarioRows(runId);
});

describe("orchestration restart recovery", () => {
  it("moves an in-flight launch to needs_recovery and retries it with a new attempt", async () => {
    ({ runId } = await seedOmniPlanningRun());
    await client.bootstrapSnapshot(runId);
    await client.subscribe({ runId });
    await postAction(server.baseUrl, runId, { action: "create" });
    await postAction(server.baseUrl, runId, { action: "dispatch" });
    await client.waitFor("orchestration.stage_waiting", { timeoutMs: 10_000, predicate: (frame) => (frame.payload as { stage?: string }).stage === "plan" });

    // The process died between claiming and confirming the launch.
    await db.update(orchestrationStages).set({ status: "dispatched" })
      .where(and(eq(orchestrationStages.runId, runId), eq(orchestrationStages.stageKey, "plan")));
    const resumeId = client.resumeIdNow();
    client.dropSse();
    server.simulateRestart();
    // The client must be back on the new stream before reconciliation speaks.
    await client.subscribe({ runId, resumeFrom: resumeId });
    await client.waitFor("stream.resync_required", { timeoutMs: 10_000 });
    await reconcileOrchestrationStages();

    const reconciled = await client.waitFor("orchestration.recovery_reconciled", { timeoutMs: 10_000 });
    expect(reconciled.payload).toMatchObject({ runId, stage: "plan", action: "needs_recovery" });
    const surfaced = await client.waitFor("error.surfaced", { timeoutMs: 10_000, predicate: (frame) => (frame.payload as { code?: string }).code === "orchestration.needs_recovery" });
    expect(surfaced.payload).toMatchObject({ runId });

    const snapshot = await (await fetch(`${server.baseUrl}/api/runs/${runId}/orchestration`)).json() as { workflow: { next: { kind: string; reason?: string }; budget: { unsettledStages: number } } };
    expect(snapshot.workflow.next).toMatchObject({ kind: "blocked", reason: "needs_recovery" });
    expect(snapshot.workflow.budget.unsettledStages).toBe(1);

    const retry = await postAction(server.baseUrl, runId, { action: "retry" });
    expect(retry.status).toBe(200);
    await client.waitFor("orchestration.stage_retried", { timeoutMs: 10_000 });
    const redispatched = await client.waitFor("orchestration.stage_dispatched", {
      timeoutMs: 10_000,
      predicate: (frame) => (frame.payload as { stage?: string; attempt?: number }).stage === "plan" && (frame.payload as { attempt?: number }).attempt === 2,
    });
    expect(redispatched.payload).toMatchObject({ requestedModel: "claude-opus-5-5" });
    // Wait for the retried attempt to settle into waiting before cleanup.
    await client.waitFor("orchestration.stage_waiting", { timeoutMs: 10_000, predicate: (frame) => frame.id !== null && client.events.frames.indexOf(frame) > client.events.frames.indexOf(redispatched) });
  });
});
