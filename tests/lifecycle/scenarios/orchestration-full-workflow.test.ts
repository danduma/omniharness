/**
 * Mocked end-to-end `balanced` journey: Jev triage is advisory (no gateway
 * key), Claude planning produces artifacts, the Codex plan review finds and
 * resolves one issue, Codex implements, an independent Claude review and a
 * validator pass — and the SSE stream records the complete causal sequence
 * and the ledger settles every stage. No provider credentials or real model
 * calls are involved: each stage owner is mocked at its module boundary and
 * reports through its real terminal named event.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { eventsRouteModule as eventsRoute } from "@/../tests/helpers/runtime-routes";
import { db } from "@/server/db";
import { planningReviewFindings, planningReviewRounds, planningReviewRuns, runs } from "@/server/db/schema";
import { __resetNamedEventsForTests, emitNamedEvent } from "@/server/events/named-events";
import { startLifecycleHarness, type LifecycleServer } from "../harness/server";
import { LifecycleClient } from "../harness/client";
import { Chaos, NO_CHAOS } from "../harness/chaos";
import { clearLifecycleSchema } from "../harness/fixtures";
import { clearOrchestrationScenarioRows, deterministicPreflightContext, orchestrationRouteModule, postAction, seedOmniPlanningRun } from "../harness/orchestration";

const mocks = vi.hoisted(() => ({
  startPlanningReview: vi.fn(),
  startImplementationPhase: vi.fn(),
  startCodeReview: vi.fn(),
  startSupervisorRun: vi.fn(),
  spawnAgent: vi.fn(),
  askAgent: vi.fn(),
}));

vi.mock("@/server/orchestration/model-catalog", async () => ({
  ...(await vi.importActual<typeof import("@/server/orchestration/model-catalog")>("@/server/orchestration/model-catalog")),
  createDefaultPreflightContext: () => deterministicPreflightContext(),
}));
vi.mock("@/server/planning/review", () => ({ startPlanningReview: mocks.startPlanningReview }));
vi.mock("@/server/planning/transition", () => ({ startImplementationPhase: mocks.startImplementationPhase }));
vi.mock("@/server/supervisor/start", () => ({ startSupervisorRun: mocks.startSupervisorRun }));
vi.mock("@/server/review/code-review", async () => ({
  ...(await vi.importActual<typeof import("@/server/review/code-review")>("@/server/review/code-review")),
  startCodeReview: mocks.startCodeReview,
}));
vi.mock("@/server/bridge-client", () => ({
  askAgent: mocks.askAgent,
  spawnAgent: mocks.spawnAgent,
  cancelAgent: vi.fn().mockResolvedValue(undefined),
  getAgent: vi.fn(),
  BRIDGE_URL: "http://localhost:0",
}));

import { registerOrchestrationSignalListener } from "@/server/orchestration/stage-adapters";

let server: LifecycleServer;
let client: LifecycleClient;
let runId = "";
let unregister: () => void = () => undefined;

type StagePayload = { stage?: string; outcome?: string; attempt?: number };

beforeEach(async () => {
  __resetNamedEventsForTests();
  await clearLifecycleSchema();
  server = await startLifecycleHarness({
    routes: [
      { pattern: "/api/events", module: eventsRoute },
      { pattern: "/api/runs/:id/orchestration", module: orchestrationRouteModule },
    ],
  });
  client = new LifecycleClient({ baseUrl: server.baseUrl, chaos: new Chaos(19, NO_CHAOS) });
  unregister = registerOrchestrationSignalListener();
  mocks.startPlanningReview.mockReset()
    .mockResolvedValueOnce({ reviewRunId: "rev-1", status: "running" })
    .mockResolvedValueOnce({ reviewRunId: "rev-2", status: "running" });
  mocks.startImplementationPhase.mockReset().mockResolvedValue({});
  mocks.startCodeReview.mockReset().mockResolvedValue({ reviewId: "cr-1", status: "running", reviewerType: "claude", implementerWorkerId: "w1" });
  mocks.spawnAgent.mockReset().mockResolvedValue({ type: "codex" });
  mocks.askAgent.mockReset().mockResolvedValue({
    response: "Ran checks.\n```json\n{\"verdict\":\"passed\",\"commands\":[{\"command\":\"pnpm vitest run\",\"exitCode\":0}]}\n```",
    state: "idle",
  });
});

afterEach(async () => {
  unregister();
  await client.close();
  await server.stop();
  if (runId) {
    await clearOrchestrationScenarioRows(runId);
    await db.delete(planningReviewRuns).where(eq(planningReviewRuns.runId, runId));
  }
});

function waitForStage(event: string, stage: string, attempt = 1) {
  return client.waitFor(event, {
    timeoutMs: 10_000,
    predicate: (frame) => (frame.payload as StagePayload).stage === stage && ((frame.payload as StagePayload).attempt ?? attempt) === attempt,
  });
}

async function seedPlanReview(reviewRunId: string, findings: number) {
  const now = new Date();
  await db.insert(planningReviewRuns).values({ id: reviewRunId, runId, status: "completed", agentSelection: "codex", roundsRequested: 1, startedAt: now, createdAt: now, updatedAt: now });
  const roundId = `${reviewRunId}-round-1`;
  await db.insert(planningReviewRounds).values({ id: roundId, reviewRunId, runId, roundNumber: 1, status: findings > 0 ? "revising" : "completed", createdAt: now, updatedAt: now });
  for (let index = 0; index < findings; index += 1) {
    await db.insert(planningReviewFindings).values({
      id: `${reviewRunId}-f${index}`, reviewRunId, roundId, runId, severity: "major", category: "testing", title: "No rollback test", createdAt: now,
    });
  }
}

describe("orchestration full workflow", () => {
  it("runs the balanced specialist journey with a causal event trail and settled ledger", async () => {
    ({ runId } = await seedOmniPlanningRun());
    await client.bootstrapSnapshot(runId);
    await client.subscribe({ runId });

    expect((await postAction(server.baseUrl, runId, { action: "create", profile: "balanced" })).status).toBe(200);
    await postAction(server.baseUrl, runId, { action: "dispatch" });

    // Jev is advisory: no key, so triage is recorded and the profile is unchanged.
    await waitForStage("orchestration.stage_completed", "triage");
    await waitForStage("orchestration.stage_waiting", "plan");

    // Claude planning produces artifacts.
    await db.update(runs).set({ status: "ready", plannerArtifactsJson: JSON.stringify({ planPath: "docs/plan.md" }) }).where(eq(runs.id, runId));
    emitNamedEvent({ kind: "plan.ready", runId, planId: null });
    await waitForStage("orchestration.stage_waiting", "plan_review");
    expect(mocks.startPlanningReview).toHaveBeenLastCalledWith(expect.objectContaining({ agentSelection: "codex", reviewerLaunch: { model: "gpt-5.6-terra", effort: "high" } }));

    // Codex plan review finds one issue; the planner already revised it, so the revision completes and is re-reviewed.
    await seedPlanReview("rev-1", 1);
    emitNamedEvent({ kind: "plan.review.finished", runId, reviewRunId: "rev-1", status: "completed" });
    await waitForStage("orchestration.stage_completed", "plan", 2);
    await waitForStage("orchestration.stage_waiting", "plan_review", 2);
    await seedPlanReview("rev-2", 0);
    emitNamedEvent({ kind: "plan.review.finished", runId, reviewRunId: "rev-2", status: "completed" });

    // Codex implements under the supervisor.
    await waitForStage("orchestration.stage_waiting", "implement");
    expect(mocks.startImplementationPhase).toHaveBeenCalledWith({ runId });
    emitNamedEvent({ kind: "supervisor.run_finished", runId, outcome: "completed" });

    // Independent Claude review, then validation.
    await waitForStage("orchestration.stage_waiting", "code_review");
    expect(mocks.startCodeReview).toHaveBeenCalledWith(expect.objectContaining({ reviewer: { workerType: "claude", model: "claude-sonnet-5-5", effort: "high" } }));
    emitNamedEvent({ kind: "code_review.finished", runId, reviewId: "cr-1", outcome: "approved", reason: "approved" });
    await waitForStage("orchestration.stage_completed", "validate");
    await client.waitFor("orchestration.workflow_completed", { timeoutMs: 10_000 });

    const completed = client.events.frames
      .filter((frame) => frame.event === "orchestration.stage_completed")
      .map((frame) => `${(frame.payload as StagePayload).stage}:${(frame.payload as StagePayload).outcome}`);
    expect(completed).toEqual([
      "triage:advisory",
      "plan:passed",
      "plan_review:changes_requested",
      "plan:passed",
      "plan_review:approved",
      "implement:passed",
      "code_review:approved",
      "validate:passed",
    ]);

    const snapshot = await (await fetch(`${server.baseUrl}/api/runs/${runId}/orchestration`)).json() as {
      workflow: { profile: string; next: { kind: string }; budget: { unsettledStages: number }; stages: Array<{ settled: boolean; stage: string }> };
    };
    expect(snapshot.workflow).toMatchObject({ profile: "balanced", next: { kind: "done" } });
    expect(snapshot.workflow.budget.unsettledStages).toBe(0);
    // Every stage with a reservation settled exactly once (triage skipped Jev, so it never reserved).
    expect(snapshot.workflow.stages.filter((stage) => stage.stage !== "triage").every((stage) => stage.settled)).toBe(true);
    const wire = JSON.stringify(client.events.frames.map((frame) => frame.payload));
    expect(wire).not.toMatch(/AI_GATEWAY_API_KEY|sk-[a-z]+-/);
  });
});
