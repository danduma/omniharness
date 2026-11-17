import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { codeReviewFindings, codeReviews, messages, runs } from "@/server/db/schema";
import { __resetNamedEventsForTests, getNamedEventsSince, type NamedEvent } from "@/server/events/named-events";
import type { BindingPreflightContext } from "@/server/orchestration/model-catalog";
import { getBuiltInWorkerModelOptions } from "@/server/worker-models";
import { SUPPORTED_WORKER_TYPES } from "@/shared/worker-types";
import { createDefaultOrchestrationPolicy } from "@/shared/orchestration-policy";
import { seedOrchestrationRun } from "./fixtures";

const mocks = vi.hoisted(() => ({
  startPlanningReview: vi.fn(),
  startImplementationPhase: vi.fn(),
  startCodeReview: vi.fn(),
  startSupervisorRun: vi.fn(),
  decide: vi.fn(),
}));

vi.mock("@/server/planning/review", () => ({ startPlanningReview: mocks.startPlanningReview }));
vi.mock("@/server/planning/transition", () => ({ startImplementationPhase: mocks.startImplementationPhase }));
vi.mock("@/server/supervisor/start", () => ({ startSupervisorRun: mocks.startSupervisorRun }));
vi.mock("@/server/review/code-review", async () => ({
  ...(await vi.importActual<typeof import("@/server/review/code-review")>("@/server/review/code-review")),
  startCodeReview: mocks.startCodeReview,
}));
vi.mock("@/server/decisions/service", async () => ({
  ...(await vi.importActual<typeof import("@/server/decisions/service")>("@/server/decisions/service")),
  decisionService: { decide: mocks.decide },
}));
vi.mock("@/server/bridge-client", () => ({
  askAgent: vi.fn(),
  cancelAgent: vi.fn().mockResolvedValue(undefined),
  getAgent: vi.fn(),
  spawnAgent: vi.fn(),
  BRIDGE_URL: "http://localhost:0",
}));

import { OrchestrationService } from "@/server/orchestration/service";
import { createDefaultStageExecutors, handleOrchestrationSignal } from "@/server/orchestration/stage-adapters";

function preflightContext(): BindingPreflightContext {
  return {
    catalog: Object.fromEntries(SUPPORTED_WORKER_TYPES.map((type) => [type, getBuiltInWorkerModelOptions(type)])) as BindingPreflightContext["catalog"],
    availability: () => ({ installed: true, credentials: true }),
    isQuotaBlocked: async () => false,
    validateAccount: async () => undefined,
    decisionKeyConfigured: true,
  };
}

function makeService() {
  const holder: { service: OrchestrationService | null } = { service: null };
  const service = new OrchestrationService({
    executors: async () => createDefaultStageExecutors(holder.service!),
    preflightContext,
    autoAdvance: false,
  });
  holder.service = service;
  return service;
}

function events() {
  return getNamedEventsSince(0).events.map((entry) => entry.event as NamedEvent);
}

async function activeStage(service: OrchestrationService, runId: string) {
  return (await service.listStages(runId)).find((row) => row.status === "waiting" || row.status === "dispatched") ?? null;
}

/** Drive a workflow up to (but not including) the given stage, using the real adapters. */
async function driveTo(service: OrchestrationService, runId: string, target: "plan_review" | "implement" | "code_review") {
  await service.dispatchNextStage(runId); // triage (Jev skipped → advisory)
  await db.update(runs).set({ status: "ready", plannerArtifactsJson: JSON.stringify({ planPath: "plan.md" }) }).where(eq(runs.id, runId));
  await service.dispatchNextStage(runId); // plan completes inline: artifacts are ready
  if (target === "plan_review") return;
  await service.dispatchNextStage(runId); // plan_review
  await handleOrchestrationSignal({ kind: "plan.review.finished", runId, reviewRunId: "review-1", status: "completed" }, service);
  if (target === "implement") return;
  await service.dispatchNextStage(runId); // implement
  await handleOrchestrationSignal({ kind: "supervisor.run_finished", runId, outcome: "completed" }, service);
}

beforeEach(() => {
  __resetNamedEventsForTests();
  mocks.startPlanningReview.mockReset().mockResolvedValue({ reviewRunId: "review-1", status: "running" });
  mocks.startImplementationPhase.mockReset().mockResolvedValue({});
  mocks.startCodeReview.mockReset().mockResolvedValue({ reviewId: "code-review-1", status: "running", reviewerType: "claude", implementerWorkerId: "w1" });
  mocks.startSupervisorRun.mockReset();
  mocks.decide.mockReset().mockResolvedValue({ status: "skipped", reason: "disabled" });
});

describe("orchestration stage adapters", () => {
  it("launches plan review with the policy's Codex binding, not a global preference", async () => {
    const { runId } = await seedOrchestrationRun({ preferredWorkerType: "claude" });
    const service = makeService();
    await service.createWorkflow({ runId });
    await driveTo(service, runId, "plan_review");
    const result = await service.dispatchNextStage(runId);
    expect(result).toMatchObject({ status: "dispatched", stage: "plan_review" });
    expect(mocks.startPlanningReview).toHaveBeenCalledWith({
      runId,
      agentSelection: "codex",
      rounds: 1,
      reviewerLaunch: { model: "gpt-5.6-terra", effort: "high" },
    });
    expect((await activeStage(service, runId))?.externalRef).toBe("review-1");
  });

  it("cannot start implementation before an approved plan review", async () => {
    const { runId } = await seedOrchestrationRun();
    const service = makeService();
    await service.createWorkflow({ runId });
    await driveTo(service, runId, "plan_review");
    await service.dispatchNextStage(runId);
    expect(mocks.startImplementationPhase).not.toHaveBeenCalled();
    // A stale signal for a different review run is ignored.
    await handleOrchestrationSignal({ kind: "plan.review.finished", runId, reviewRunId: "other-review", status: "completed" }, service);
    expect((await activeStage(service, runId))?.stageKey).toBe("plan_review");
    expect(events().some((event) => event.kind === "orchestration.stage_signal_ignored" && event.reason === "stale_ref")).toBe(true);
  });

  it("pins the implementer CLI and model before starting the supervisor", async () => {
    const { runId } = await seedOrchestrationRun();
    const service = makeService();
    await service.createWorkflow({ runId });
    await driveTo(service, runId, "implement");
    await service.dispatchNextStage(runId);
    expect(mocks.startImplementationPhase).toHaveBeenCalledWith({ runId });
    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    expect(run).toMatchObject({ preferredWorkerType: "codex", preferredWorkerModel: "gpt-5.6-terra", preferredWorkerEffort: "high", allowedWorkerTypes: JSON.stringify(["codex"]) });
  });

  it("turns code review findings into one bounded repair stage, then blocks", async () => {
    const { runId } = await seedOrchestrationRun();
    const service = makeService();
    // Unreported usage keeps full reservations committed; lift the run cap so
    // this test exercises the repair cap rather than the budget cap.
    const policy = createDefaultOrchestrationPolicy();
    policy.profiles.balanced.runBudget = { maxTokens: null, maxCostUsd: null };
    await service.createWorkflow({ runId, policy });
    await driveTo(service, runId, "code_review");
    // The supervisor run is now in its implementing phase.
    await db.update(runs).set({ phase: "implementing", status: "done" }).where(eq(runs.id, runId));

    await service.dispatchNextStage(runId);
    expect(mocks.startCodeReview).toHaveBeenCalledWith({
      runId,
      maxRounds: 1,
      reviewer: { workerType: "claude", model: "claude-sonnet-5-5", effort: "high" },
    });
    const now = new Date();
    await db.insert(codeReviews).values({
      id: "code-review-1", runId, implementerWorkerId: "w1", implementerType: "codex", reviewerType: "claude",
      status: "cap_reached", maxRounds: 1, startedAt: now, createdAt: now, updatedAt: now,
    });
    await db.insert(codeReviewFindings).values({
      id: randomUUID(), reviewId: "code-review-1", runId, roundNumber: 1, severity: "major", file: "cache.ts", line: 2,
      claim: "evict() never resets the size counter", status: "open", createdAt: now, updatedAt: now,
    });
    await handleOrchestrationSignal({ kind: "code_review.finished", runId, reviewId: "code-review-1", outcome: "cap_reached", reason: "findings_open" }, service);

    const repair = await service.dispatchNextStage(runId);
    expect(repair).toMatchObject({ status: "dispatched", stage: "implement", attempt: 2 });
    expect(mocks.startSupervisorRun).toHaveBeenCalledWith(runId);
    const repairMessage = await db.select().from(messages).where(and(eq(messages.runId, runId), eq(messages.kind, "orchestration_stage"))).get();
    expect(repairMessage?.content).toContain("never resets the size counter");

    await handleOrchestrationSignal({ kind: "supervisor.run_finished", runId, outcome: "completed" }, service);
    mocks.startCodeReview.mockResolvedValueOnce({ reviewId: "code-review-2", status: "running", reviewerType: "claude", implementerWorkerId: "w1" });
    await service.dispatchNextStage(runId);
    await handleOrchestrationSignal({ kind: "code_review.finished", runId, reviewId: "code-review-2", outcome: "escalated", reason: "disagreement" }, service);
    expect(await service.dispatchNextStage(runId)).toMatchObject({ status: "blocked", stage: "code_review" });
  });

  it("settles every terminal agent result exactly once", async () => {
    const { runId } = await seedOrchestrationRun();
    const service = makeService();
    await service.createWorkflow({ runId });
    await driveTo(service, runId, "implement");
    await service.dispatchNextStage(runId);
    await handleOrchestrationSignal({ kind: "supervisor.run_finished", runId, outcome: "completed" }, service);
    await handleOrchestrationSignal({ kind: "supervisor.run_finished", runId, outcome: "completed" }, service);
    const stages = await service.listStages(runId);
    const settledIds = events().filter((event) => event.kind === "orchestration.budget_settled").map((event) => event.kind === "orchestration.budget_settled" ? event.stageId : "");
    expect(new Set(settledIds).size).toBe(settledIds.length);
    expect(settledIds.sort()).toEqual(stages.filter((row) => row.status === "completed").map((row) => row.id).sort());
  });

  it("ignores signals for conversations without a workflow", async () => {
    const { runId } = await seedOrchestrationRun();
    const service = makeService();
    expect(await handleOrchestrationSignal({ kind: "plan.ready", runId, planId: null }, service)).toEqual({ matched: false });
    expect(await service.listStages(runId)).toHaveLength(0);
  });
});
