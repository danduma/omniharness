import { randomUUID } from "crypto";
import { asc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { messages, plans, runs } from "@/server/db/schema";
import { startSupervisorRun } from "@/server/supervisor/start";
import { assessPlanReadiness } from "@/server/plans/readiness";
import { parsePlan } from "@/server/plans/parser";
import { readinessRecordForPlanFile } from "@/server/plans/readiness-pipeline";
import { createRunId } from "@/server/runs/ids";
import fs from "fs";

interface PlannerArtifactRecord {
  path: string;
  kind: string;
  exists?: boolean;
  readiness?: {
    ready?: boolean;
    questions?: string[];
    gaps?: string[];
  } | null;
}

interface PlannerArtifactsSnapshot {
  specPath?: string | null;
  planPath?: string | null;
  candidates?: PlannerArtifactRecord[];
}

function parseArtifactsJson(value: string | null | undefined): PlannerArtifactsSnapshot {
  if (!value?.trim()) {
    return {};
  }

  try {
    return JSON.parse(value) as PlannerArtifactsSnapshot;
  } catch {
    return {};
  }
}

/**
 * Validate that a planning run has a plan ready to implement, and resolve the
 * concrete plan + spec paths. Shared by the legacy child-run promotion and the
 * in-run Omni planning→implementing transition (startImplementationPhase).
 */
export async function validatePlanForImplementation(args: {
  runId: string;
  run: typeof runs.$inferSelect;
  planPath?: string | null;
}): Promise<{ selectedPlanPath: string; specPath: string | null }> {
  const { run } = args;
  const artifacts = parseArtifactsJson(run.plannerArtifactsJson);
  const selectedPlanPath = args.planPath?.trim() || run.artifactPlanPath || artifacts.planPath || null;
  if (!selectedPlanPath) {
    throw new Error("No verified plan is available to promote");
  }

  const selectedArtifact = artifacts.candidates?.find((candidate) => candidate.path === selectedPlanPath) ?? null;
  if (selectedArtifact?.readiness && selectedArtifact.readiness.ready === false) {
    throw new Error("The selected plan is not ready for implementation");
  }
  const artifactAlreadyReady = selectedArtifact?.readiness?.ready === true;

  if (!fs.existsSync(selectedPlanPath)) {
    throw new Error(`Plan file not found: ${selectedPlanPath}`);
  }

  const record = await readinessRecordForPlanFile({
    runId: args.runId,
    planPath: selectedPlanPath,
  });
  if (record?.verdict?.verdict === "needs_rewrite") {
    throw new Error(`The selected plan needs a rewrite before implementation: ${record.verdict.headline}`);
  }

  // Even when a verdict is present, run the structural floor — it catches
  // edge cases like a plan file emptied between the verdict and the promote.
  const planMarkdown = fs.readFileSync(selectedPlanPath, "utf8");
  const readiness = await assessPlanReadiness(parsePlan(planMarkdown));
  if (!record?.verdict && !artifactAlreadyReady && !readiness.ready) {
    throw new Error("The selected plan is not ready for implementation");
  }

  return { selectedPlanPath, specPath: run.specPath || artifacts.specPath || null };
}

export async function promotePlanningRun(args: {
  runId: string;
  planPath?: string | null;
}) {
  const planningRun = await db.select().from(runs).where(eq(runs.id, args.runId)).get();
  if (!planningRun) {
    throw new Error(`Planning run ${args.runId} not found`);
  }

  if (planningRun.mode !== "planning") {
    throw new Error("Only planning conversations can be promoted");
  }

  const { selectedPlanPath, specPath } = await validatePlanForImplementation({
    runId: args.runId,
    run: planningRun,
    planPath: args.planPath,
  });

  const sourceMessages = await db.select().from(messages)
    .where(eq(messages.runId, args.runId))
    .orderBy(asc(messages.createdAt), asc(messages.id));

  const previousPlanningStatus = planningRun.status;
  await db.update(runs).set({
    status: "promoting",
    updatedAt: new Date(),
  }).where(eq(runs.id, planningRun.id));

  const newPlanId = randomUUID();
  await db.insert(plans).values({
    id: newPlanId,
    path: selectedPlanPath,
    status: "running",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const newRunId = createRunId();
  await db.insert(runs).values({
    id: newRunId,
    planId: newPlanId,
    mode: "implementation",
    projectPath: planningRun.projectPath,
    title: planningRun.title,
    preferredWorkerType: planningRun.preferredWorkerType,
    preferredWorkerModel: planningRun.preferredWorkerModel,
    preferredWorkerEffort: planningRun.preferredWorkerEffort,
    allowedWorkerTypes: planningRun.allowedWorkerTypes,
    parentRunId: planningRun.id,
    status: "running",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const userIntentMessages = sourceMessages.filter((message) => message.role === "user" && message.content.trim());
  const now = Date.now();
  await db.insert(messages).values(
    (userIntentMessages.length > 0
      ? userIntentMessages.map((message, index) => ({
          id: randomUUID(),
          runId: newRunId,
          role: "user",
          kind: message.kind || "checkpoint",
          content: message.content,
          createdAt: new Date(now + index),
        }))
      : [{
          id: randomUUID(),
          runId: newRunId,
          role: "user",
          kind: "checkpoint",
          content: `Implement ${selectedPlanPath}`,
          createdAt: new Date(now),
        }])
  );

  try {
    startSupervisorRun(newRunId);
  } catch (error) {
    await db.update(runs).set({
      status: previousPlanningStatus,
      updatedAt: new Date(),
    }).where(eq(runs.id, planningRun.id));
    throw error;
  }

  await db.update(runs).set({
    status: "promoted",
    specPath,
    artifactPlanPath: selectedPlanPath,
    updatedAt: new Date(),
  }).where(eq(runs.id, planningRun.id));

  return {
    runId: newRunId,
    planId: newPlanId,
    planPath: selectedPlanPath,
  };
}
