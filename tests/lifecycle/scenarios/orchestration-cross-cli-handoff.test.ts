/**
 * Cross-CLI safety for orchestrated workflows.
 *
 * Omni runs may mix CLIs (the HANDOFF_REQUIRED invariant covers only direct
 * conversations), so a Claude planner and a Codex implementer share one run.
 * What must never happen is a provider switch under a live conversation:
 *  - a direct conversation is refused at workflow creation, with no rows;
 *  - an Omni planner already running on another CLI than the policy binds
 *    fails the plan stage with identity_mismatch instead of being swapped.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { eventsRouteModule as eventsRoute } from "@/../tests/helpers/runtime-routes";
import { db } from "@/server/db";
import { orchestrationStages, runs, workers } from "@/server/db/schema";
import { __resetNamedEventsForTests } from "@/server/events/named-events";
import { startLifecycleHarness, type LifecycleServer } from "../harness/server";
import { LifecycleClient } from "../harness/client";
import { Chaos, NO_CHAOS } from "../harness/chaos";
import { clearLifecycleSchema, seedDirectRun } from "../harness/fixtures";
import { clearOrchestrationScenarioRows, deterministicPreflightContext, orchestrationRouteModule, postAction, seedOmniPlanningRun } from "../harness/orchestration";

vi.mock("@/server/orchestration/model-catalog", async () => ({
  ...(await vi.importActual<typeof import("@/server/orchestration/model-catalog")>("@/server/orchestration/model-catalog")),
  createDefaultPreflightContext: () => deterministicPreflightContext(),
}));

let server: LifecycleServer;
let client: LifecycleClient;
const cleanup: string[] = [];

beforeEach(async () => {
  __resetNamedEventsForTests();
  await clearLifecycleSchema();
  server = await startLifecycleHarness({
    routes: [
      { pattern: "/api/events", module: eventsRoute },
      { pattern: "/api/runs/:id/orchestration", module: orchestrationRouteModule },
    ],
  });
  client = new LifecycleClient({ baseUrl: server.baseUrl, chaos: new Chaos(17, NO_CHAOS) });
});

afterEach(async () => {
  await client.close();
  await server.stop();
  for (const runId of cleanup.splice(0)) await clearOrchestrationScenarioRows(runId);
});

describe("orchestration cross-CLI safety", () => {
  it("refuses a direct conversation without writing anything", async () => {
    const { runId } = await seedDirectRun();
    cleanup.push(runId);
    await client.bootstrapSnapshot(runId);
    await client.subscribe({ runId });
    const response = await postAction(server.baseUrl, runId, { action: "create" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: false, refused: "unsupported_run" });
    const refused = await client.waitFor("orchestration.refused", { timeoutMs: 10_000 });
    expect(refused.payload).toMatchObject({ runId, action: "create", reason: "unsupported_run" });
    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    expect(run?.orchestrationPolicyJson).toBeNull();
  });

  it("never swaps a live planner's CLI: the plan stage fails with identity_mismatch", async () => {
    const { runId } = await seedOmniPlanningRun();
    cleanup.push(runId);
    const now = new Date();
    await db.insert(workers).values({ id: `${runId}-worker-1`, runId, type: "codex", status: "idle", cwd: process.cwd(), workerNumber: 1, createdAt: now, updatedAt: now });
    await client.bootstrapSnapshot(runId);
    await client.subscribe({ runId });

    await postAction(server.baseUrl, runId, { action: "create" });
    await postAction(server.baseUrl, runId, { action: "dispatch" });

    const failed = await client.waitFor("orchestration.stage_failed", { timeoutMs: 10_000 });
    expect(failed.payload).toMatchObject({ runId, stage: "plan", code: "identity_mismatch", recoverable: false });
    await client.waitFor("error.surfaced", { timeoutMs: 10_000, predicate: (frame) => (frame.payload as { code?: string }).code === "orchestration.identity_mismatch" });
    const worker = await db.select().from(workers).where(eq(workers.id, `${runId}-worker-1`)).get();
    expect(worker?.type).toBe("codex");
    const plan = (await db.select().from(orchestrationStages).where(eq(orchestrationStages.runId, runId))).find((row) => row.stageKey === "plan");
    expect(plan).toMatchObject({ status: "failed", failureCode: "identity_mismatch" });
    await db.delete(workers).where(eq(workers.runId, runId));
  });
});
