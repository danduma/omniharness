import fs from "fs";
import { randomUUID } from "crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import {
  clarifications,
  creditEvents,
  executionEvents,
  messages,
  planItems,
  plans,
  runs,
  validationRuns,
  workers,
} from "@/server/db/schema";
import { cancelAgent } from "@/server/bridge-client";
import { createAdHocPlan, rewriteAdHocPlan } from "@/server/runs/ad-hoc-plan";
import { startSupervisorRun } from "@/server/supervisor/start";
import { getAppDataPath } from "@/server/app-root";

export type RecoveryAction = "retry" | "edit" | "fork";

interface RecoverRunArgs {
  runId: string;
  action: RecoveryAction;
  targetMessageId: string;
  content?: string;
}

async function cancelRunWorkers(runId: string) {
  const runWorkers = await db.select().from(workers).where(eq(workers.runId, runId));

  for (const worker of runWorkers) {
    try {
      await cancelAgent(worker.id);
    } catch {
      // best-effort cancellation before cleanup
    }
    await db.update(workers).set({
      status: "cancelled",
      updatedAt: new Date(),
    }).where(eq(workers.id, worker.id));
  }

  const workerIds = runWorkers.map((worker) => worker.id);
  if (workerIds.length > 0) {
    await db.delete(creditEvents).where(inArray(creditEvents.workerId, workerIds));
  }
}

async function clearRunDerivedState(runId: string, planId: string) {
  await db.delete(clarifications).where(eq(clarifications.runId, runId));
  await db.delete(validationRuns).where(eq(validationRuns.runId, runId));
  await db.delete(executionEvents).where(eq(executionEvents.runId, runId));
  await db.delete(planItems).where(eq(planItems.planId, planId));
}

export async function recoverRun(args: RecoverRunArgs) {
  const run = await db.select().from(runs).where(eq(runs.id, args.runId)).get();
  if (!run) {
    throw new Error("Run not found");
  }

  const plan = await db.select().from(plans).where(eq(plans.id, run.planId)).get();
  if (!plan) {
    throw new Error("Plan not found");
  }

  const targetMessage = await db.select().from(messages).where(and(
    eq(messages.id, args.targetMessageId),
    eq(messages.runId, args.runId),
  )).get();

  if (!targetMessage || targetMessage.role !== "user") {
    throw new Error("Target message must be a user message in this run");
  }

  const nextContent = typeof args.content === "string" && args.content.trim()
    ? args.content.trim()
    : targetMessage.content;

  if (!nextContent) {
    throw new Error("Content cannot be empty");
  }

  if (args.action === "fork") {
    await cancelRunWorkers(args.runId);

    const newPlanId = randomUUID();
    const newRunId = randomUUID();
    const planPath = createAdHocPlan(nextContent);
    const now = new Date();

    await db.insert(plans).values({
      id: newPlanId,
      path: planPath,
      status: "running",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(runs).values({
      id: newRunId,
      planId: newPlanId,
      title: run.title,
      projectPath: run.projectPath,
      preferredWorkerType: run.preferredWorkerType,
      preferredWorkerModel: run.preferredWorkerModel,
      preferredWorkerEffort: run.preferredWorkerEffort,
      allowedWorkerTypes: run.allowedWorkerTypes,
      parentRunId: args.runId,
      forkedFromMessageId: args.targetMessageId,
      status: "running",
      createdAt: now,
      updatedAt: now,
    });

    const messagesToCopy = (await db.select().from(messages).where(eq(messages.runId, args.runId)))
      .filter((message) => message.createdAt <= targetMessage.createdAt)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    for (const message of messagesToCopy) {
      await db.insert(messages).values({
        id: randomUUID(),
        runId: newRunId,
        role: message.role,
        kind: message.id === args.targetMessageId ? "checkpoint" : message.kind,
        content: message.id === args.targetMessageId ? nextContent : message.content,
        createdAt: now,
      });
    }

    startSupervisorRun(newRunId);
    return { runId: newRunId };
  }

  await cancelRunWorkers(args.runId);

  const laterMessages = await db.select().from(messages).where(eq(messages.runId, args.runId));
  const laterMessageIds = laterMessages
    .filter((message) => message.createdAt > targetMessage.createdAt)
    .map((message) => message.id);

  if (laterMessageIds.length > 0) {
    await db.delete(messages).where(inArray(messages.id, laterMessageIds));
  }

  if (args.action === "edit") {
    await db.update(messages).set({
      content: nextContent,
      editedFromMessageId: args.targetMessageId,
    }).where(eq(messages.id, args.targetMessageId));
  }

  if (plan.path.startsWith("vibes/ad-hoc/")) {
    rewriteAdHocPlan(plan.path, nextContent);
  } else {
    fs.writeFileSync(getAppDataPath(plan.path), nextContent, "utf-8");
  }

  await clearRunDerivedState(args.runId, run.planId);
  await db.update(runs).set({
    status: "running",
    failedAt: null,
    lastError: null,
    updatedAt: new Date(),
  }).where(eq(runs.id, args.runId));

  startSupervisorRun(args.runId);
  return { runId: args.runId };
}
