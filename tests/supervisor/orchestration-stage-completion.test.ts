import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { runs } from "@/server/db/schema";
import { __resetNamedEventsForTests } from "@/server/events/named-events";
import type { BindingPreflightContext } from "@/server/orchestration/model-catalog";
import { OrchestrationService, type StageExecutors } from "@/server/orchestration/service";
import { handleOrchestrationSignal } from "@/server/orchestration/stage-adapters";
import { getBuiltInWorkerModelOptions } from "@/server/worker-models";
import { SUPPORTED_WORKER_TYPES } from "@/shared/worker-types";
import { seedOrchestrationRun } from "../server/orchestration/fixtures";

vi.mock("@/server/bridge-client", () => ({
  askAgent: vi.fn(),
  cancelAgent: vi.fn(),
  getAgent: vi.fn(),
  spawnAgent: vi.fn(),
  BRIDGE_URL: "http://localhost:0",
}));

function preflightContext(): BindingPreflightContext {
  return {
    catalog: Object.fromEntries(SUPPORTED_WORKER_TYPES.map((type) => [type, getBuiltInWorkerModelOptions(type)])) as BindingPreflightContext["catalog"],
    availability: () => ({ installed: true, credentials: true }),
    isQuotaBlocked: async () => false,
    validateAccount: async () => undefined,
    decisionKeyConfigured: true,
  };
}

/** Every stage waits except triage; only the supervisor's terminal event completes `implement`. */
function waitingExecutors(): StageExecutors {
  const waiting = { dispatch: async () => ({ kind: "waiting" as const }) };
  return {
    triage: { dispatch: async () => ({ kind: "completed", outcome: "advisory", usage: null }) },
    plan: waiting,
    plan_review: waiting,
    implement: waiting,
    code_review: waiting,
    validate: waiting,
  };
}

async function toImplement(service: OrchestrationService, runId: string) {
  const policy = (await import("@/shared/orchestration-policy")).createDefaultOrchestrationPolicy();
  policy.profiles.balanced.stages = policy.profiles.balanced.stages.filter((stage) => stage.stage !== "plan_review");
  await service.createWorkflow({ runId, policy });
  await service.dispatchNextStage(runId);
  await service.dispatchNextStage(runId);
  await handleOrchestrationSignal({ kind: "plan.ready", runId, planId: null }, service);
  return service.dispatchNextStage(runId);
}

beforeEach(() => {
  __resetNamedEventsForTests();
});

describe("supervisor terminal events complete the implement stage", () => {
  it("completes the implement stage when the supervisor marks the run complete", async () => {
    const { runId } = await seedOrchestrationRun();
    const service = new OrchestrationService({ executors: async () => waitingExecutors(), preflightContext, autoAdvance: false });
    expect(await toImplement(service, runId)).toMatchObject({ status: "dispatched", stage: "implement" });
    expect(await handleOrchestrationSignal({ kind: "supervisor.run_finished", runId, outcome: "completed" }, service)).toMatchObject({ matched: true });
    const implement = (await service.listStages(runId)).find((row) => row.stageKey === "implement");
    expect(implement).toMatchObject({ status: "completed", outcome: "passed" });
  });

  it("fails the implement stage when the supervisor gives up", async () => {
    const { runId } = await seedOrchestrationRun();
    const service = new OrchestrationService({ executors: async () => waitingExecutors(), preflightContext, autoAdvance: false });
    await toImplement(service, runId);
    await handleOrchestrationSignal({ kind: "supervisor.run_finished", runId, outcome: "failed" }, service);
    const implement = (await service.listStages(runId)).find((row) => row.stageKey === "implement");
    expect(implement).toMatchObject({ status: "failed", failureCode: "agent_failed" });
    expect(await service.dispatchNextStage(runId)).toMatchObject({ status: "blocked", stage: "implement" });
  });

  it("does not touch runs without a workflow", async () => {
    const { runId } = await seedOrchestrationRun();
    const service = new OrchestrationService({ executors: async () => waitingExecutors(), preflightContext, autoAdvance: false });
    expect(await handleOrchestrationSignal({ kind: "supervisor.run_finished", runId, outcome: "completed" }, service)).toEqual({ matched: false });
    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    expect(run?.orchestrationPolicyJson).toBeNull();
  });
});
