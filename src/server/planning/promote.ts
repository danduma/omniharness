import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { messages, plans, runs } from "@/server/db/schema";
import { startSupervisorRun } from "@/server/supervisor/start";
import { assessPlanReadiness } from "@/server/plans/readiness";
import { parsePlan } from "@/server/plans/parser";
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

  const artifacts = parseArtifactsJson(planningRun.plannerArtifactsJson);
  const selectedPlanPath = args.planPath?.trim() || planningRun.artifactPlanPath || artifacts.planPath || null;
  if (!selectedPlanPath) {
    throw new Error("No verified plan is available to promote");
  }

  const matchingCandidate = artifacts.candidates?.find((candidate) => candidate.path === selectedPlanPath && candidate.kind === "plan");
  if (matchingCandidate?.readiness?.ready === false) {
    throw new Error("The selected plan is not ready for implementation");
  }

  if (!fs.existsSync(selectedPlanPath)) {
    throw new Error(`Plan file not found: ${selectedPlanPath}`);
  }

  const planMarkdown = fs.readFileSync(selectedPlanPath, "utf8");
  const readiness = await assessPlanReadiness(parsePlan(planMarkdown));
  if (!readiness.ready) {
    throw new Error("The selected plan is not ready for implementation");
  }

  const sourceMessages = await db.select().from(messages)
    .where(eq(messages.runId, args.runId))
    .orderBy(messages.createdAt);

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

  const newRunId = randomUUID();
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
    specPath: planningRun.specPath || artifacts.specPath || null,
    artifactPlanPath: selectedPlanPath,
    updatedAt: new Date(),
  }).where(eq(runs.id, planningRun.id));

  return {
    runId: newRunId,
    planId: newPlanId,
    planPath: selectedPlanPath,
  };
}
