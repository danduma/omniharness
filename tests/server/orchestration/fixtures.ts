import { randomUUID } from "node:crypto";
import { db } from "@/server/db";
import { orchestrationStages, plans, runs } from "@/server/db/schema";

export async function seedOrchestrationRun(overrides: Partial<typeof runs.$inferInsert> = {}) {
  const planId = randomUUID();
  const runId = randomUUID();
  const now = new Date();
  await db.insert(plans).values({ id: planId, path: "vibes/ad-hoc/plan.md", status: "running", createdAt: now, updatedAt: now });
  await db.insert(runs).values({
    id: runId,
    planId,
    mode: "implementation",
    phase: "planning",
    title: "Orchestrated task",
    status: "ready",
    projectPath: process.cwd(),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
  return { runId, planId };
}

let seqCounter = 0;

export async function insertStageRow(runId: string, values: Partial<typeof orchestrationStages.$inferInsert> = {}) {
  const now = new Date();
  const id = values.id ?? randomUUID();
  seqCounter += 1;
  await db.insert(orchestrationStages).values({
    id,
    runId,
    stageKey: "plan",
    attempt: 1,
    seq: seqCounter,
    status: "completed",
    bindingJson: "{}",
    createdAt: now,
    updatedAt: now,
    ...values,
  });
  return id;
}
