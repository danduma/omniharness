import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { orchestrationBudgetLedger, orchestrationStages, runs } from "@/server/db/schema";
import { reserveStageBudget } from "@/server/orchestration/budget-ledger";
import { deleteConversationForApi } from "@/runtime/http/routes/runs";
import { insertStageRow, seedOrchestrationRun } from "../orchestration/fixtures";

describe("orchestration schema", () => {
  it("adds nullable orchestration columns to runs", async () => {
    const { runId } = await seedOrchestrationRun();
    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    expect(run?.orchestrationPolicyJson).toBeNull();
    expect(run?.orchestrationProfile).toBeNull();
    expect(run?.orchestrationProfileLockedAt).toBeNull();
  });

  it("keeps (runId, stageKey, attempt) unique", async () => {
    const { runId } = await seedOrchestrationRun();
    await insertStageRow(runId, { stageKey: "plan", attempt: 1 });
    await expect(insertStageRow(runId, { stageKey: "plan", attempt: 1 })).rejects.toThrow();
    await expect(insertStageRow(runId, { stageKey: "plan", attempt: 2 })).resolves.toBeTypeOf("string");
  });

  it("allows only one active dispatch claim per run", async () => {
    const { runId } = await seedOrchestrationRun();
    await insertStageRow(runId, { stageKey: "plan", attempt: 1, status: "dispatched" });
    await expect(insertStageRow(runId, { stageKey: "plan_review", attempt: 1, status: "waiting" })).rejects.toThrow();
    await expect(insertStageRow(runId, { stageKey: "plan_review", attempt: 1, status: "pending" })).resolves.toBeTypeOf("string");
  });

  it("removes stages and ledger rows when the conversation is deleted", async () => {
    const { runId } = await seedOrchestrationRun({ mode: "direct", phase: null });
    const stageId = await insertStageRow(runId, { stageKey: "implement" });
    const reservation = await reserveStageBudget({
      runId,
      stageId,
      stageBudget: { maxTokens: 100, maxCostUsd: null },
      runBudget: { maxTokens: 1_000, maxCostUsd: null },
    });
    expect(reservation.ok).toBe(true);
    await deleteConversationForApi(runId);
    expect(await db.select().from(orchestrationStages).where(eq(orchestrationStages.runId, runId))).toHaveLength(0);
    expect(await db.select().from(orchestrationBudgetLedger).where(eq(orchestrationBudgetLedger.runId, runId))).toHaveLength(0);
    expect(await db.select().from(runs).where(eq(runs.id, runId)).get()).toBeUndefined();
  });
});
