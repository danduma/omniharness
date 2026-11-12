import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { codeReviews, orchestrationStages, runs } from "@/server/db/schema";
import { __resetNamedEventsForTests, getNamedEventsSince, type NamedEvent } from "@/server/events/named-events";
import { reserveStageBudget, getRunBudgetSummary } from "@/server/orchestration/budget-ledger";
import { OrchestrationService } from "@/server/orchestration/service";
import { reconcileOrchestrationStages } from "@/server/orchestration/reconcile";
import { createDefaultOrchestrationPolicy } from "@/shared/orchestration-policy";
import { insertStageRow, seedOrchestrationRun } from "./fixtures";

vi.mock("@/server/bridge-client", () => ({
  askAgent: vi.fn(),
  cancelAgent: vi.fn(),
  getAgent: vi.fn(),
  spawnAgent: vi.fn(),
  BRIDGE_URL: "http://localhost:0",
}));

const service = new OrchestrationService({ executors: async () => { throw new Error("no dispatch during reconcile"); }, autoAdvance: false });

async function orchestratedRun(overrides: Partial<typeof runs.$inferInsert> = {}) {
  const seeded = await seedOrchestrationRun({
    orchestrationPolicyJson: JSON.stringify(createDefaultOrchestrationPolicy()),
    orchestrationPolicyVersion: 1,
    orchestrationProfile: "balanced",
    ...overrides,
  });
  return seeded;
}

function events() {
  return getNamedEventsSince(0).events.map((entry) => entry.event as NamedEvent);
}

beforeEach(async () => {
  __resetNamedEventsForTests();
  // Each test sees only its own active stages.
  await db.update(orchestrationStages).set({ status: "cancelled" }).where(eq(orchestrationStages.status, "waiting"));
  await db.update(orchestrationStages).set({ status: "cancelled" }).where(eq(orchestrationStages.status, "dispatched"));
});

describe("orchestration startup reconciliation", () => {
  it("moves an unproven launch to needs_recovery, keeps its reservation, and surfaces it", async () => {
    const { runId } = await orchestratedRun();
    const stageId = await insertStageRow(runId, { stageKey: "plan", status: "dispatched" });
    await reserveStageBudget({ runId, stageId, stageBudget: { maxTokens: 100, maxCostUsd: null }, runBudget: { maxTokens: 1_000, maxCostUsd: null } });
    const results = await reconcileOrchestrationStages(service);
    expect(results).toContainEqual({ stageId, action: "needs_recovery" });
    const row = await db.select().from(orchestrationStages).where(eq(orchestrationStages.id, stageId)).get();
    expect(row).toMatchObject({ status: "needs_recovery", failureCode: "interrupted_by_restart" });
    expect((await getRunBudgetSummary(runId)).unsettledStages).toBe(1);
    expect(events().some((event) => event.kind === "error.surfaced" && event.code === "orchestration.needs_recovery")).toBe(true);
  });

  it("adopts a waiting planner and a running supervisor", async () => {
    const planning = await orchestratedRun();
    const planStage = await insertStageRow(planning.runId, { stageKey: "plan", status: "waiting" });
    const implementing = await orchestratedRun({ phase: "implementing", status: "running" });
    const implementStage = await insertStageRow(implementing.runId, { stageKey: "implement", status: "waiting" });
    const results = await reconcileOrchestrationStages(service);
    expect(results).toEqual(expect.arrayContaining([
      { stageId: planStage, action: "adopted" },
      { stageId: implementStage, action: "adopted" },
    ]));
    const row = await db.select().from(orchestrationStages).where(eq(orchestrationStages.id, implementStage)).get();
    expect(row?.status).toBe("waiting");
  });

  it("settles a stage from its owner's durable terminal record", async () => {
    const { runId } = await orchestratedRun({ phase: "implementing", status: "done" });
    const implementStage = await insertStageRow(runId, { stageKey: "implement", attempt: 1, status: "waiting" });
    await reconcileOrchestrationStages(service);
    expect((await db.select().from(orchestrationStages).where(eq(orchestrationStages.id, implementStage)).get())?.status).toBe("completed");

    const reviewRun = await orchestratedRun({ phase: "implementing", status: "done" });
    const now = new Date();
    await db.insert(codeReviews).values({
      id: `review-${reviewRun.runId}`, runId: reviewRun.runId, implementerWorkerId: "w", implementerType: "codex", reviewerType: "claude",
      status: "approved", maxRounds: 1, startedAt: now, createdAt: now, updatedAt: now,
    });
    const reviewStage = await insertStageRow(reviewRun.runId, { stageKey: "code_review", status: "waiting", externalRef: `review-${reviewRun.runId}` });
    await reconcileOrchestrationStages(service);
    expect(await db.select().from(orchestrationStages).where(eq(orchestrationStages.id, reviewStage)).get()).toMatchObject({ status: "completed", outcome: "approved" });
  });

  it("never treats a still-running helper as finished", async () => {
    const { runId } = await orchestratedRun({ phase: "implementing", status: "done" });
    const now = new Date();
    await db.insert(codeReviews).values({
      id: `running-${runId}`, runId, implementerWorkerId: "w", implementerType: "codex", reviewerType: "claude",
      status: "running", maxRounds: 1, startedAt: now, createdAt: now, updatedAt: now,
    });
    const stageId = await insertStageRow(runId, { stageKey: "code_review", status: "waiting", externalRef: `running-${runId}` });
    const validateRun = await orchestratedRun({ phase: "implementing", status: "done" });
    const validateStage = await insertStageRow(validateRun.runId, { stageKey: "validate", status: "waiting" });
    await reconcileOrchestrationStages(service);
    expect((await db.select().from(orchestrationStages).where(eq(orchestrationStages.id, stageId)).get())?.status).toBe("needs_recovery");
    expect((await db.select().from(orchestrationStages).where(eq(orchestrationStages.id, validateStage)).get())?.status).toBe("needs_recovery");
  });
});
