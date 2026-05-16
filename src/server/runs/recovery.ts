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
  queuedConversationMessages,
  recoveryIncidents,
  runs,
  supervisorScheduledWakes,
  supervisorInterventions,
  workers,
} from "@/server/db/schema";
import { askAgent, cancelAgent, getAgent, spawnAgent, type AgentRecord } from "@/server/bridge-client";
import { createAdHocPlan, rewriteAdHocPlan } from "@/server/runs/ad-hoc-plan";
import { persistRunFailure } from "@/server/runs/failures";
import { createRunId } from "@/server/runs/ids";
import { clearSupervisorWakeLease } from "@/server/supervisor/lease";
import { startSupervisorRun } from "@/server/supervisor/start";
import { getAppDataPath } from "@/server/app-root";
import { buildPlannerSystemPrompt } from "@/server/prompts";
import { parseAllowedWorkerTypes, normalizeWorkerType } from "@/server/supervisor/worker-types";
import { allocateWorkerIdentity } from "@/server/workers/ids";
import { persistWorkerSnapshot } from "@/server/workers/snapshots";
import { appendUserInputOnDelivery } from "@/server/workers/stream-writer";
import { readWorkerYoloModeEnabled, resolveWorkerLaunchMode } from "@/server/worker-launch-mode";
import { readRuntimeEnvFromSettings } from "@/server/supervisor/runtime-settings";
import { emitNamedEvent } from "@/server/events/named-events";
import { isRecoverableAgentMissingError } from "./recovery-state";
import { createBranchWorktree } from "@/server/git/workspaces";
import { pendingOrphanWorktreeError } from "@/server/git/orphan-recovery";
import type { GitWorkspaceRunSnapshot, GitWorkspaceSnapshot, GitWorkspaceTarget, GitWorkspaceWarning } from "@/lib/git-workspace";

export type RecoveryAction = "retry" | "edit" | "fork";

interface RecoverRunArgs {
  runId: string;
  action: RecoveryAction;
  targetMessageId: string;
  content?: string;
  gitWorkspaceLaunch?: GitWorkspaceLaunchRequest | null;
}

interface GitWorkspaceLaunchRequest {
  mode: "new_worktree";
  projectPath: string;
  newBranchName: string;
  checkoutPath: string;
  startPoint?: string;
  worktreeParent?: string;
  expectedHeadSha: string | null;
  expectedStatusFingerprint: string;
}

export interface ForkRunWorktreeArgs {
  runId: string;
  targetMessageId?: string;
  contentOverride?: string;
  newBranchName: string;
  checkoutPath: string;
  startPoint?: string;
  worktreeParent?: string;
  expectedHeadSha: string | null;
  expectedStatusFingerprint: string;
}

function buildRunWorkspaceSnapshot(args: {
  target: GitWorkspaceTarget;
  snapshot: GitWorkspaceSnapshot;
  warnings?: GitWorkspaceWarning[];
}): GitWorkspaceRunSnapshot {
  const matchingWorktree = args.snapshot.worktrees.find((worktree) => worktree.checkoutPath === args.target.checkoutPath);
  return {
    target: args.target,
    headSha: matchingWorktree?.headSha ?? args.snapshot.headSha,
    branchName: matchingWorktree?.branchName ?? args.target.branchName ?? args.snapshot.branchName,
    detachedLabel: matchingWorktree?.detachedLabel ?? args.snapshot.detachedLabel,
    dirtyFileCount: matchingWorktree?.dirtyFileCount ?? args.snapshot.dirtyFileCount,
    conflictedFileCount: matchingWorktree?.conflictedFileCount ?? args.snapshot.conflictedFileCount,
    aheadCount: args.snapshot.aheadCount,
    behindCount: args.snapshot.behindCount,
    warnings: args.warnings ?? args.snapshot.warnings,
    selectedAt: new Date().toISOString(),
  };
}

async function findLatestUserMessageId(runId: string) {
  const runMessages = await db.select().from(messages).where(eq(messages.runId, runId));
  const latestUserMessage = runMessages
    .filter((message) => message.role === "user")
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  if (!latestUserMessage) {
    throw new Error("Fork source run has no user message to fork from");
  }
  return latestUserMessage.id;
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
  await db.delete(executionEvents).where(eq(executionEvents.runId, runId));
  await db.delete(supervisorInterventions).where(eq(supervisorInterventions.runId, runId));
  await db.delete(supervisorScheduledWakes).where(eq(supervisorScheduledWakes.runId, runId));
  await db.delete(recoveryIncidents).where(eq(recoveryIncidents.runId, runId));
  await db.delete(queuedConversationMessages).where(eq(queuedConversationMessages.runId, runId));
  await db.delete(planItems).where(eq(planItems.planId, planId));
}

function buildDirectWorkerPrompt(mode: string, content: string, projectRoot: string) {
  if (mode === "planning") {
    return `${buildPlannerSystemPrompt(projectRoot)}\n\nUser request:\n${content}`;
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
  const yoloModeEnabled = await readWorkerYoloModeEnabled();
  const workerMode = resolveWorkerLaunchMode(undefined, yoloModeEnabled);
  const { env: envParams } = await readRuntimeEnvFromSettings();

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
  emitNamedEvent({ kind: "worker.spawned", runId: run.id, workerId, workerType });

  const agent = await spawnAgent({
    type: workerType,
    cwd,
    name: workerId,
    ...(workerMode ? { mode: workerMode } : {}),
    env: envParams,
    model: run.preferredWorkerModel?.trim() || undefined,
    effort: run.preferredWorkerEffort?.trim().toLowerCase() || undefined,
  });
  const response = await askAgent(workerId, buildDirectWorkerPrompt(run.mode, content, cwd));
  await appendUserInputOnDelivery({
    runId: run.id,
    workerId,
    text: content,
    deliveredAt: new Date(),
  });
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

  // Worker response now lives in the unified worker stream.
}

function isAgentAlreadyExistsError(error: unknown, workerId: string) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes("agent already exists") && message.includes(workerId.toLowerCase());
}

async function resumeDirectRunFromSavedSession(
  run: typeof runs.$inferSelect,
  targetMessage: typeof messages.$inferSelect,
  content: string,
) {
  if (!isRecoverableAgentMissingError(run.lastError)) {
    return null;
  }

  const worker = (await db.select().from(workers).where(eq(workers.runId, run.id)))
    .find((candidate) => candidate.bridgeSessionId?.trim());
  const sessionId = worker?.bridgeSessionId?.trim();
  if (!worker || !sessionId) {
    return null;
  }

  const laterMessages = await db.select().from(messages).where(eq(messages.runId, run.id));
  const laterMessageIds = laterMessages
    .filter((message) => message.createdAt > targetMessage.createdAt)
    .map((message) => message.id);

  if (laterMessageIds.length > 0) {
    await db.delete(messages).where(inArray(messages.id, laterMessageIds));
  }

  const sessionMode = worker.bridgeSessionMode?.trim();
  const yoloModeEnabled = await readWorkerYoloModeEnabled();
  const workerMode = resolveWorkerLaunchMode(sessionMode, yoloModeEnabled);
  const { env: envParams } = await readRuntimeEnvFromSettings();
  let resumedWorker: AgentRecord;
  try {
    resumedWorker = await spawnAgent({
      type: worker.type,
      cwd: worker.cwd,
      name: worker.id,
      ...(workerMode ? { mode: workerMode } : {}),
      env: envParams,
      ...(run.preferredWorkerModel ? { model: run.preferredWorkerModel } : {}),
      ...(run.preferredWorkerEffort ? { effort: run.preferredWorkerEffort } : {}),
      resumeSessionId: sessionId,
    });
  } catch (error) {
    if (!isAgentAlreadyExistsError(error, worker.id)) {
      throw error;
    }
    resumedWorker = await getAgent(worker.id);
  }

  const resumedAt = new Date();
  await db.insert(executionEvents).values({
    id: randomUUID(),
    runId: run.id,
    workerId: worker.id,
    planItemId: null,
    eventType: "worker_session_resumed",
    details: JSON.stringify({
      summary: `Resumed ${worker.id} from saved session`,
      sessionId,
    }),
    createdAt: resumedAt,
  });

  await db.update(workers).set({
    status: "working",
    bridgeSessionId: resumedWorker.sessionId ?? sessionId,
    bridgeSessionMode: resumedWorker.sessionMode ?? sessionMode ?? null,
    updatedAt: resumedAt,
  }).where(eq(workers.id, worker.id));
  await persistWorkerSnapshot(worker.id, resumedWorker);

  await db.update(runs).set({
    status: "running",
    failedAt: null,
    lastError: null,
    updatedAt: resumedAt,
  }).where(eq(runs.id, run.id));

  const response = await askAgent(worker.id, buildDirectWorkerPrompt(run.mode, content, worker.cwd));
  await appendUserInputOnDelivery({
    runId: run.id,
    workerId: worker.id,
    text: content,
    deliveredAt: new Date(),
  });
  let snapshot: AgentRecord | null = null;
  try {
    snapshot = await getAgent(worker.id);
    await persistWorkerSnapshot(worker.id, snapshot);
  } catch {
    // The restored worker response is enough to update the conversation.
  }

  const completedAt = new Date();
  await db.update(workers).set({
    status: snapshot?.state ?? response.state,
    updatedAt: completedAt,
  }).where(eq(workers.id, worker.id));
  // Worker response now lives in the unified worker stream.

  return { runId: run.id };
}

async function startImplementationRerun(
  run: typeof runs.$inferSelect,
  plan: typeof plans.$inferSelect,
  args: RecoverRunArgs,
  targetMessage: typeof messages.$inferSelect,
  nextContent: string,
) {
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

  await clearRunDerivedState(args.runId, run.planId);
  await clearSupervisorWakeLease(args.runId);
  await db.update(plans).set({
    status: "running",
    updatedAt: new Date(),
  }).where(eq(plans.id, plan.id));
  await db.update(runs).set({
    status: "running",
    failedAt: null,
    lastError: null,
    updatedAt: new Date(),
  }).where(eq(runs.id, args.runId));

  startSupervisorRun(args.runId);

  return { runId: args.runId };
}

async function resumeImplementationRun(run: typeof runs.$inferSelect, plan: typeof plans.$inferSelect) {
  await clearSupervisorWakeLease(run.id);
  await clearMatchingRunFailureMessage(run);
  await db.update(plans).set({
    status: "running",
    updatedAt: new Date(),
  }).where(eq(plans.id, plan.id));
  await db.update(runs).set({
    status: "running",
    failedAt: null,
    lastError: null,
    updatedAt: new Date(),
  }).where(eq(runs.id, run.id));

  startSupervisorRun(run.id);
  return { runId: run.id };
}

async function clearMatchingRunFailureMessage(run: typeof runs.$inferSelect) {
  if (!run.lastError) {
    return;
  }

  await db.delete(messages).where(and(
    eq(messages.runId, run.id),
    eq(messages.role, "system"),
    eq(messages.kind, "error"),
    eq(messages.content, `Run failed: ${run.lastError}`),
  ));
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

  if (run.mode === "implementation") {
    if (args.action !== "retry" && args.action !== "edit") {
      throw new Error("Fork recovery is only available in direct control conversations");
    }

    if (args.action === "retry") {
      return resumeImplementationRun(run, plan);
    }

    return startImplementationRerun(run, plan, args, targetMessage, nextContent);
  }

  if (run.mode !== "direct") {
    throw new Error("Recovery actions are only available in direct control conversations");
  }

  if (args.action === "retry") {
    const resumed = await resumeDirectRunFromSavedSession(run, targetMessage, nextContent);
    if (resumed) {
      return resumed;
    }
  }

  if (args.action === "fork") {
    await cancelRunWorkers(args.runId);

    const newPlanId = randomUUID();
    const newRunId = createRunId();
    const now = new Date();
    const workspaceResult = args.gitWorkspaceLaunch
      ? await createBranchWorktree({
        projectPath: args.gitWorkspaceLaunch.projectPath,
        newBranchName: args.gitWorkspaceLaunch.newBranchName,
        checkoutPath: args.gitWorkspaceLaunch.checkoutPath,
        startPoint: args.gitWorkspaceLaunch.startPoint,
        worktreeParent: args.gitWorkspaceLaunch.worktreeParent,
        expectedHeadSha: args.gitWorkspaceLaunch.expectedHeadSha,
        expectedStatusFingerprint: args.gitWorkspaceLaunch.expectedStatusFingerprint,
      })
      : null;
    const runWorkspaceSnapshot = workspaceResult
      ? buildRunWorkspaceSnapshot({
        target: workspaceResult.target,
        snapshot: workspaceResult.snapshot,
      })
      : null;
    let forkedRunCreated = false;

    try {
      const planPath = createAdHocPlan(nextContent);

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
        mode: run.mode,
        title: run.title,
        projectPath: workspaceResult?.target.checkoutPath ?? run.projectPath,
        preferredWorkerType: run.preferredWorkerType,
        preferredWorkerModel: run.preferredWorkerModel,
        preferredWorkerEffort: run.preferredWorkerEffort,
        allowedWorkerTypes: run.allowedWorkerTypes,
        gitWorkspaceJson: runWorkspaceSnapshot ? JSON.stringify(runWorkspaceSnapshot) : null,
        parentRunId: args.runId,
        forkedFromMessageId: args.targetMessageId,
        status: "running",
        createdAt: now,
        updatedAt: now,
      });
      forkedRunCreated = true;

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

      if (runWorkspaceSnapshot) {
        await db.insert(executionEvents).values({
          id: randomUUID(),
          runId: newRunId,
          eventType: "git_workspace_forked",
          details: JSON.stringify({
            parentRunId: args.runId,
            forkedFromMessageId: args.targetMessageId,
            target: runWorkspaceSnapshot.target,
            headSha: runWorkspaceSnapshot.headSha,
            branchName: runWorkspaceSnapshot.branchName,
            detachedLabel: runWorkspaceSnapshot.detachedLabel,
            dirtyFileCount: runWorkspaceSnapshot.dirtyFileCount,
            conflictedFileCount: runWorkspaceSnapshot.conflictedFileCount,
            warnings: runWorkspaceSnapshot.warnings,
          }),
          createdAt: now,
        });
      }

      const newRun = await db.select().from(runs).where(eq(runs.id, newRunId)).get();
      if (!newRun) {
        throw new Error("Forked run not found");
      }

      await startDirectRerun(newRun, nextContent);
      return {
        runId: newRunId,
        ...(workspaceResult && runWorkspaceSnapshot
          ? {
            target: workspaceResult.target,
            runLaunchSnapshot: runWorkspaceSnapshot,
            snapshot: workspaceResult.snapshot,
          }
          : {}),
      };
    } catch (error) {
      if (workspaceResult && args.gitWorkspaceLaunch && !forkedRunCreated) {
        throw pendingOrphanWorktreeError({
          projectPath: args.gitWorkspaceLaunch.projectPath,
          operation: "fork_run_worktree",
          target: workspaceResult.target,
          sourceRunId: args.runId,
          targetMessageId: args.targetMessageId,
          error,
        });
      }
      throw error;
    }
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
  await clearSupervisorWakeLease(args.runId);
  await db.update(runs).set({
    status: "running",
    failedAt: null,
    lastError: null,
    updatedAt: new Date(),
  }).where(eq(runs.id, args.runId));

  await startDirectRerun(run, nextContent);

  return { runId: args.runId };
}

export async function forkRunIntoWorktree(args: ForkRunWorktreeArgs) {
  const run = await db.select().from(runs).where(eq(runs.id, args.runId)).get();
  const projectPath = run?.projectPath?.trim();
  if (!run || !projectPath) {
    throw new Error("Fork source run is missing a project path");
  }
  const targetMessageId = args.targetMessageId?.trim() || await findLatestUserMessageId(args.runId);
  return recoverRun({
    runId: args.runId,
    action: "fork",
    targetMessageId,
    content: args.contentOverride,
    gitWorkspaceLaunch: {
      mode: "new_worktree",
      projectPath,
      newBranchName: args.newBranchName,
      checkoutPath: args.checkoutPath,
      startPoint: args.startPoint,
      worktreeParent: args.worktreeParent,
      expectedHeadSha: args.expectedHeadSha,
      expectedStatusFingerprint: args.expectedStatusFingerprint,
    },
  });
}
