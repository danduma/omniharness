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
  supervisorInterventions,
  validationRuns,
  workers,
} from "@/server/db/schema";
import { askAgent, cancelAgent, getAgent, spawnAgent, type AgentRecord } from "@/server/bridge-client";
import { createAdHocPlan, rewriteAdHocPlan } from "@/server/runs/ad-hoc-plan";
import { persistRunFailure } from "@/server/runs/failures";
import { startSupervisorRun } from "@/server/supervisor/start";
import { getAppDataPath } from "@/server/app-root";
import { PLANNER_SYSTEM_PROMPT } from "@/server/prompts";
import { parseAllowedWorkerTypes, normalizeWorkerType } from "@/server/supervisor/worker-types";
import { allocateWorkerIdentity } from "@/server/workers/ids";
import { persistWorkerSnapshot } from "@/server/workers/snapshots";

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
  await db.delete(supervisorInterventions).where(eq(supervisorInterventions.runId, runId));
  await db.delete(planItems).where(eq(planItems.planId, planId));
}

function buildDirectWorkerPrompt(mode: string, content: string) {
  if (mode === "planning") {
    return `${PLANNER_SYSTEM_PROMPT}\n\nUser request:\n${content}`;
  }

  return content;
}

function hasVisibleWorkerOutput(responseText: string, snapshot: AgentRecord | null) {
  if (responseText.trim()) {
    return true;
  }

  if (!snapshot) {
    return false;
  }

  return Boolean(
    snapshot.renderedOutput?.trim()
    || snapshot.currentText?.trim()
    || snapshot.lastText?.trim()
    || snapshot.outputEntries?.some((entry) => entry.text.trim()),
  );
}

function buildEmptyWorkerOutputMessage(snapshot: AgentRecord | null, responseState: string) {
  const stopReason = snapshot?.stopReason?.trim();
  if (stopReason) {
    return `Agent stopped without producing output. Stop reason: ${stopReason}.`;
  }

  return `Agent stopped without producing output. Final state: ${responseState || "unknown"}.`;
}

async function startDirectRerun(run: typeof runs.$inferSelect, content: string) {
  const { workerId, workerNumber } = await allocateWorkerIdentity(run.id);
  const cwd = run.projectPath || process.cwd();
  const allowedWorkerTypes = parseAllowedWorkerTypes(run.allowedWorkerTypes);
  const workerType = run.preferredWorkerType?.trim()
    ? normalizeWorkerType(run.preferredWorkerType)
    : allowedWorkerTypes[0] || "codex";
  const now = new Date();

  await db.insert(workers).values({
    id: workerId,
    runId: run.id,
    type: workerType,
    status: "starting",
    cwd,
    workerNumber,
    outputLog: "",
    outputEntriesJson: "[]",
    currentText: "",
    lastText: "",
    createdAt: now,
    updatedAt: now,
  });

  const agent = await spawnAgent({
    type: workerType,
    cwd,
    name: workerId,
    model: run.preferredWorkerModel?.trim() || undefined,
    effort: run.preferredWorkerEffort?.trim().toLowerCase() || undefined,
  });
  const response = await askAgent(workerId, buildDirectWorkerPrompt(run.mode, content));
  let snapshot: AgentRecord | null = null;
  try {
    snapshot = await getAgent(workerId);
    await persistWorkerSnapshot(workerId, snapshot);
  } catch {
    // The bridge may have already dropped a failed direct worker; the ask response still determines the visible state.
  }

  if (!hasVisibleWorkerOutput(response.response, snapshot)) {
    const failureMessage = buildEmptyWorkerOutputMessage(snapshot, response.state);

    await db.update(workers).set({
      type: snapshot?.type || agent.type || workerType,
      status: "error",
      cwd: snapshot?.cwd || agent.cwd || cwd,
      outputLog: failureMessage,
      bridgeSessionId: snapshot?.sessionId ?? agent.sessionId ?? null,
      bridgeSessionMode: snapshot?.sessionMode ?? agent.sessionMode ?? null,
      updatedAt: new Date(),
    }).where(eq(workers.id, workerId));

    await persistRunFailure(run.id, new Error(failureMessage));
    return;
  }

  await db.update(workers).set({
    type: agent.type || workerType,
    status: response.state,
    cwd: agent.cwd || cwd,
    outputLog: response.response.trim() ? response.response : "",
    bridgeSessionId: snapshot?.sessionId ?? agent.sessionId ?? null,
    bridgeSessionMode: snapshot?.sessionMode ?? agent.sessionMode ?? null,
    updatedAt: new Date(),
  }).where(eq(workers.id, workerId));

  await db.insert(messages).values({
    id: randomUUID(),
    runId: run.id,
    role: "worker",
    kind: run.mode,
    content: response.response,
    workerId,
    createdAt: new Date(),
  });
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

  if (run.mode === "implementation") {
    startSupervisorRun(args.runId);
  } else {
    await startDirectRerun(run, nextContent);
  }

  return { runId: args.runId };
}
