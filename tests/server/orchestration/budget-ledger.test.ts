import { describe, expect, it } from "vitest";
import { getRunBudgetSummary, reserveStageBudget, settleStageBudget } from "@/server/orchestration/budget-ledger";
import { insertStageRow, seedOrchestrationRun } from "./fixtures";

const stageBudget = { maxTokens: 400, maxCostUsd: 4 };
const runBudget = { maxTokens: 1_000, maxCostUsd: 10 };

describe("orchestration budget ledger", () => {
  it("refuses a reservation above the stage cap", async () => {
    const { runId } = await seedOrchestrationRun();
    const stageId = await insertStageRow(runId);
    const result = await reserveStageBudget({ runId, stageId, stageBudget, runBudget, tokens: 401 });
    expect(result).toMatchObject({ ok: false, reason: "stage_cap" });
  });

  it("refuses a reservation that would exceed the run cap", async () => {
    const { runId } = await seedOrchestrationRun();
    const first = await insertStageRow(runId, { stageKey: "plan" });
    const second = await insertStageRow(runId, { stageKey: "plan_review" });
    const third = await insertStageRow(runId, { stageKey: "implement" });
    expect((await reserveStageBudget({ runId, stageId: first, stageBudget, runBudget })).ok).toBe(true);
    expect((await reserveStageBudget({ runId, stageId: second, stageBudget, runBudget })).ok).toBe(true);
    expect(await reserveStageBudget({ runId, stageId: third, stageBudget, runBudget })).toMatchObject({ ok: false, reason: "run_cap", committedTokens: 800 });
  });

  it("admits at most the cap under concurrent reservations", async () => {
    const { runId } = await seedOrchestrationRun();
    const stageIds = await Promise.all(Array.from({ length: 6 }, (_, index) => insertStageRow(runId, { stageKey: `s${index}` })));
    const results = await Promise.all(stageIds.map((stageId) => reserveStageBudget({ runId, stageId, stageBudget, runBudget })));
    expect(results.filter((result) => result.ok)).toHaveLength(2);
    expect((await getRunBudgetSummary(runId)).committedTokens).toBe(800);
  });

  it("is idempotent per stage reservation", async () => {
    const { runId } = await seedOrchestrationRun();
    const stageId = await insertStageRow(runId);
    const first = await reserveStageBudget({ runId, stageId, stageBudget, runBudget });
    const second = await reserveStageBudget({ runId, stageId, stageBudget, runBudget });
    expect(first).toMatchObject({ ok: true, duplicate: false });
    expect(second).toMatchObject({ ok: true, duplicate: true });
    expect((await getRunBudgetSummary(runId)).reservedTokens).toBe(400);
  });

  it("settles exactly once and frees unused budget only for reported usage", async () => {
    const { runId } = await seedOrchestrationRun();
    const stageId = await insertStageRow(runId);
    await reserveStageBudget({ runId, stageId, stageBudget, runBudget });
    const settled = await settleStageBudget({ runId, stageId, usage: { inputTokens: 100, outputTokens: 50, costUsd: 1.5 } });
    const again = await settleStageBudget({ runId, stageId, usage: { inputTokens: 999, outputTokens: 999, costUsd: 99 } });
    expect(settled).toEqual({ settled: true, duplicate: false, usageUnknown: false });
    expect(again.duplicate).toBe(true);
    const summary = await getRunBudgetSummary(runId);
    expect(summary.committedTokens).toBe(150);
    expect(summary.committedCostUsd).toBeCloseTo(1.5);
    expect(summary.unsettledStages).toBe(0);
  });

  it("preserves usageUnknown and keeps the reservation committed", async () => {
    const { runId } = await seedOrchestrationRun();
    const stageId = await insertStageRow(runId);
    await reserveStageBudget({ runId, stageId, stageBudget, runBudget });
    const settled = await settleStageBudget({ runId, stageId, usage: null });
    expect(settled.usageUnknown).toBe(true);
    const summary = await getRunBudgetSummary(runId);
    expect(summary.unknownUsageStages).toBe(1);
    expect(summary.settledTokens).toBe(0);
    expect(summary.committedTokens).toBe(400);
  });

  it("treats null caps as unlimited", async () => {
    const { runId } = await seedOrchestrationRun();
    const stageId = await insertStageRow(runId);
    const result = await reserveStageBudget({
      runId,
      stageId,
      stageBudget: { maxTokens: null, maxCostUsd: null },
      runBudget: { maxTokens: null, maxCostUsd: null },
      tokens: 5_000_000,
    });
    expect(result.ok).toBe(true);
  });
});
