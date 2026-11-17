import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { orchestrationStages, runs } from "@/server/db/schema";
import { __resetNamedEventsForTests, getNamedEventsSince, type NamedEvent } from "@/server/events/named-events";
import { getRunBudgetSummary } from "@/server/orchestration/budget-ledger";
import type { BindingPreflightContext } from "@/server/orchestration/model-catalog";
import {
  OrchestrationRefusedError,
  OrchestrationService,
  OrchestrationStageError,
  type StageExecutionContext,
  type StageExecutors,
} from "@/server/orchestration/service";
import { createDefaultOrchestrationPolicy, type StageOutcome, type WorkflowStage } from "@/shared/orchestration-policy";
import { getBuiltInWorkerModelOptions } from "@/server/worker-models";
import { SUPPORTED_WORKER_TYPES } from "@/shared/worker-types";
import { seedOrchestrationRun } from "./fixtures";

function preflightContext(overrides: Partial<BindingPreflightContext> = {}): BindingPreflightContext {
  return {
    catalog: Object.fromEntries(SUPPORTED_WORKER_TYPES.map((type) => [type, getBuiltInWorkerModelOptions(type)])) as BindingPreflightContext["catalog"],
    availability: () => ({ installed: true, credentials: true }),
    isQuotaBlocked: async () => false,
    validateAccount: async () => undefined,
    decisionKeyConfigured: true,
    ...overrides,
  };
}

type Script = Partial<Record<WorkflowStage, (context: StageExecutionContext) => Promise<Awaited<ReturnType<StageExecutors[WorkflowStage]["dispatch"]>>>>>;

function executors(script: Script = {}) {
  const calls: StageExecutionContext[] = [];
  const base = {} as StageExecutors;
  for (const stage of ["triage", "plan", "plan_review", "implement", "code_review", "validate"] as const) {
    base[stage] = {
      dispatch: async (context) => {
        calls.push(context);
        const scripted = script[stage];
        if (scripted) return scripted(context);
        return { kind: "waiting", externalRef: `${stage}-${context.stage.attempt}` };
      },
    };
  }
  return { executors: base, calls };
}

function makeService(script: Script = {}, ctx: Partial<BindingPreflightContext> = {}, autoAdvance = false) {
  const { executors: stageExecutors, calls } = executors(script);
  const service = new OrchestrationService({
    executors: async () => stageExecutors,
    preflightContext: () => preflightContext(ctx),
    autoAdvance,
  });
  return { service, calls };
}

function events() {
  return getNamedEventsSince(0).events.map((entry) => entry.event as NamedEvent);
}

function kinds() {
  return events().map((event) => event.kind);
}

const triageInline: Script = {
  triage: async () => ({ kind: "completed", outcome: "advisory", usage: { inputTokens: 10, outputTokens: 5, costUsd: 0.001 } }),
};

async function completeActive(service: OrchestrationService, runId: string, outcome: StageOutcome, findings: unknown = null) {
  const active = (await service.listStages(runId)).find((row) => row.status === "waiting" || row.status === "dispatched");
  if (!active) throw new Error("no active stage");
  await service.completeStage({ stageId: active.id, outcome, usage: { inputTokens: 100, outputTokens: 50, costUsd: 1 }, findings });
  return active;
}

beforeEach(() => {
  __resetNamedEventsForTests();
});

describe("orchestration service", () => {
  it("runs triage → plan → plan_review → implement → code_review → validate", async () => {
    const { runId } = await seedOrchestrationRun();
    const { service, calls } = makeService(triageInline);
    await service.createWorkflow({ runId });
    const order: string[] = [];
    let result = await service.dispatchNextStage(runId);
    expect(result).toMatchObject({ status: "completed_inline", stage: "triage" });
    order.push("triage");
    for (const [stage, outcome] of [["plan", "passed"], ["plan_review", "approved"], ["implement", "passed"], ["code_review", "approved"], ["validate", "passed"]] as const) {
      result = await service.dispatchNextStage(runId);
      expect(result).toMatchObject({ status: "dispatched", stage, waiting: true });
      order.push(stage);
      await completeActive(service, runId, outcome);
    }
    expect(await service.dispatchNextStage(runId)).toEqual({ status: "done" });
    expect(order).toEqual(["triage", "plan", "plan_review", "implement", "code_review", "validate"]);
    // Exact policy bindings reach the executors.
    expect(calls.find((call) => call.stage.stageKey === "plan_review")?.binding).toMatchObject({ workerType: "codex", model: "gpt-5.6-terra" });
    expect(calls.find((call) => call.stage.stageKey === "plan")?.canonicalModel).toBe("claude-opus-5-5");
    const summary = await getRunBudgetSummary(runId);
    expect(summary.unsettledStages).toBe(0);
    expect(kinds()).toContain("orchestration.workflow_completed");
  });

  it("re-opens the planner after review findings and passes the findings along", async () => {
    const { runId } = await seedOrchestrationRun();
    const { service, calls } = makeService(triageInline);
    await service.createWorkflow({ runId });
    await service.dispatchNextStage(runId);
    await service.dispatchNextStage(runId);
    await completeActive(service, runId, "passed");
    await service.dispatchNextStage(runId);
    await completeActive(service, runId, "changes_requested", [{ title: "missing rollback" }]);
    const revision = await service.dispatchNextStage(runId);
    expect(revision).toMatchObject({ status: "dispatched", stage: "plan", attempt: 2 });
    const planCall = calls.filter((call) => call.stage.stageKey === "plan").at(-1)!;
    expect(planCall.reason).toBe("revision");
    expect(planCall.previousFindings).toContain("missing rollback");
  });

  it("refuses to change the profile after the first non-triage dispatch", async () => {
    const { runId } = await seedOrchestrationRun();
    const { service } = makeService(triageInline);
    await service.createWorkflow({ runId });
    await service.selectProfile({ runId, profile: "thorough" });
    await service.dispatchNextStage(runId); // triage: no lock
    await service.selectProfile({ runId, profile: "balanced" });
    await service.dispatchNextStage(runId); // plan: locks
    await expect(service.selectProfile({ runId, profile: "economy" })).rejects.toBeInstanceOf(OrchestrationRefusedError);
    const surfaced = events().filter((event) => event.kind === "error.surfaced");
    expect(surfaced.some((event) => event.kind === "error.surfaced" && event.code === "orchestration.profile_locked")).toBe(true);
  });

  it("blocks on a token cap without creating a worker and keeps the stage resumable", async () => {
    const policy = createDefaultOrchestrationPolicy();
    policy.profiles.balanced.runBudget.maxTokens = 50_000; // below the plan stage's reservation
    const { runId } = await seedOrchestrationRun();
    const { service, calls } = makeService(triageInline);
    await service.createWorkflow({ runId, policy });
    await service.dispatchNextStage(runId);
    const blocked = await service.dispatchNextStage(runId);
    expect(blocked).toMatchObject({ status: "blocked", stage: "plan", code: "budget_exceeded" });
    expect(calls.filter((call) => call.stage.stageKey === "plan")).toHaveLength(0);
    const surfaced = events().find((event) => event.kind === "error.surfaced" && event.code === "orchestration.budget_exceeded");
    expect(surfaced).toBeTruthy();
    // The block is durable and explainable.
    const row = (await service.listStages(runId)).find((candidate) => candidate.stageKey === "plan");
    expect(row).toMatchObject({ status: "blocked", failureCode: "budget_exceeded" });
    expect(await service.dispatchNextStage(runId)).toMatchObject({ status: "blocked", stage: "plan" });
  });

  it("refuses a missing binding at preflight without dispatching", async () => {
    const { runId } = await seedOrchestrationRun();
    const { service, calls } = makeService(triageInline, { availability: (type) => ({ installed: type !== "claude", credentials: true }) });
    await service.createWorkflow({ runId });
    const report = await service.preflightWorkflow(runId);
    expect(report.ready).toBe(false);
    expect(report.stages.find((stage) => stage.stage === "plan")?.status).toBe("unavailable");
    expect(await db.select().from(orchestrationStages).where(eq(orchestrationStages.runId, runId))).toHaveLength(0);
    await service.dispatchNextStage(runId);
    const result = await service.dispatchNextStage(runId);
    expect(result).toMatchObject({ status: "blocked", stage: "plan", code: "binding_unavailable" });
    expect(calls.some((call) => call.stage.stageKey === "plan")).toBe(false);
  });

  it("never lets a low-confidence/unavailable triage change a profile, and triage never overrides the user", async () => {
    const { runId } = await seedOrchestrationRun();
    const { service } = makeService();
    await service.createWorkflow({ runId, profile: "thorough" });
    const recommendation = { complexity: "low", risk: "low", parallelizable: false, recommendedProfile: "economy", confidence: 0.95, model: "jev", requestId: "r1", shadow: false } as const;
    expect(await service.applyTriageRecommendation(runId, recommendation)).toEqual({ applied: false });
    expect(await service.applyTriageRecommendation(runId, null)).toEqual({ applied: false });
    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    expect(run?.orchestrationProfile).toBe("thorough");
  });

  it("treats an unavailable Jev as advisory: the workflow continues on the same profile", async () => {
    const { runId } = await seedOrchestrationRun();
    const { service, calls } = makeService({}, { decisionKeyConfigured: false });
    await service.createWorkflow({ runId });
    expect(await service.dispatchNextStage(runId)).toMatchObject({ status: "completed_inline", stage: "triage" });
    expect(calls).toHaveLength(0);
    expect(await service.dispatchNextStage(runId)).toMatchObject({ status: "dispatched", stage: "plan" });
    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    expect(run?.orchestrationProfile).toBe("balanced");
    expect(kinds()).toContain("orchestration.triage_ignored");
  });

  it("allows only one launch under concurrent dispatch requests", async () => {
    const { runId } = await seedOrchestrationRun();
    let launches = 0;
    const { service } = makeService({
      triage: async () => {
        launches += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return { kind: "waiting" };
      },
    });
    await service.createWorkflow({ runId });
    const results = await Promise.all(Array.from({ length: 5 }, () => service.dispatchNextStage(runId)));
    expect(launches).toBe(1);
    expect(results.filter((result) => result.status === "dispatched")).toHaveLength(1);
    expect(results.filter((result) => result.status === "conflict")).toHaveLength(4);
  });

  it("settles a stage exactly once even when completion is reported twice", async () => {
    const { runId } = await seedOrchestrationRun();
    const { service } = makeService();
    await service.createWorkflow({ runId });
    await service.dispatchNextStage(runId);
    const active = (await service.listStages(runId))[0]!;
    expect(await service.completeStage({ stageId: active.id, outcome: "advisory", usage: null })).toEqual({ completed: true });
    expect(await service.completeStage({ stageId: active.id, outcome: "advisory", usage: { inputTokens: 9, outputTokens: 9, costUsd: 9 } })).toEqual({ completed: false });
    const settled = events().filter((event) => event.kind === "orchestration.budget_settled");
    expect(settled).toHaveLength(1);
    expect(kinds()).toContain("orchestration.stage_signal_ignored");
  });

  it("keeps a recoverable failure as needs_recovery and retries it with a new attempt", async () => {
    const { runId } = await seedOrchestrationRun();
    let fail = true;
    const { service } = makeService({
      triage: async () => {
        if (fail) throw new OrchestrationStageError("handoff_failed", "target did not confirm launch", true);
        return { kind: "completed", outcome: "advisory", usage: null };
      },
    });
    await service.createWorkflow({ runId });
    expect(await service.dispatchNextStage(runId)).toMatchObject({ status: "failed", code: "handoff_failed" });
    const row = (await service.listStages(runId))[0]!;
    expect(row.status).toBe("needs_recovery");
    // A new service instance (process restart) recomputes the same block.
    const restarted = makeService().service;
    expect(await restarted.dispatchNextStage(runId)).toMatchObject({ status: "blocked", stage: "triage" });
    fail = false;
    expect(await service.retryStage(runId)).toMatchObject({ status: "completed_inline", stage: "triage", attempt: 2 });
    expect(kinds()).toEqual(expect.arrayContaining(["orchestration.stage_failed", "orchestration.stage_retried"]));
    expect(events().some((event) => event.kind === "error.surfaced" && event.code === "orchestration.handoff_failed")).toBe(true);
  });

  it("cancels the active stage and refuses further dispatch", async () => {
    const { runId } = await seedOrchestrationRun();
    const cancel = vi.fn(async () => undefined);
    const { executors: stageExecutors } = executors();
    stageExecutors.triage.cancel = cancel;
    const service = new OrchestrationService({ executors: async () => stageExecutors, preflightContext: () => preflightContext(), autoAdvance: false });
    await service.createWorkflow({ runId });
    await service.dispatchNextStage(runId);
    expect(await service.cancelWorkflow(runId)).toEqual({ cancelledStages: 1 });
    expect(cancel).toHaveBeenCalledTimes(1);
    await expect(service.dispatchNextStage(runId)).rejects.toMatchObject({ reason: "workflow_cancelled" });
    expect((await getRunBudgetSummary(runId)).unsettledStages).toBe(0);
  });

  it("refuses direct conversations and unknown profiles", async () => {
    const { runId } = await seedOrchestrationRun({ mode: "direct", phase: null });
    const { service } = makeService();
    await expect(service.createWorkflow({ runId })).rejects.toMatchObject({ reason: "unsupported_run" });
    const omni = await seedOrchestrationRun();
    await service.createWorkflow({ runId: omni.runId });
    await expect(service.selectProfile({ runId: omni.runId, profile: "lavish" })).rejects.toMatchObject({ reason: "invalid_profile" });
  });

  it("auto-advances after a completion when enabled", async () => {
    const { runId } = await seedOrchestrationRun();
    const { service, calls } = makeService(triageInline, {}, true);
    await service.createWorkflow({ runId });
    await service.dispatchNextStage(runId);
    for (let attempt = 0; attempt < 50 && !calls.some((call) => call.stage.stageKey === "plan"); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(calls.map((call) => call.stage.stageKey)).toEqual(["triage", "plan"]);
  });

  it("projects a snapshot with requested models, ledger, and next stage", async () => {
    const { runId } = await seedOrchestrationRun();
    const { service } = makeService(triageInline);
    await service.createWorkflow({ runId });
    await service.dispatchNextStage(runId);
    await service.dispatchNextStage(runId);
    const snapshot = await service.getWorkflowSnapshot(runId);
    expect(snapshot).toMatchObject({ profile: "balanced", locked: true, next: { kind: "active", stage: "plan" } });
    expect(snapshot?.stages.map((stage) => [stage.stage, stage.status, stage.requestedModel])).toEqual([
      ["triage", "completed", "typesafe-ai/jev"],
      ["plan", "waiting", "claude-opus-5-5"],
    ]);
    expect(snapshot?.stages[0]?.settledTokens).toBe(15);
    expect(JSON.stringify(snapshot)).not.toMatch(/sk-|apiKey/);
  });
});
