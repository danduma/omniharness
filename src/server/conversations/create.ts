import { randomUUID } from "crypto";
import fs from "fs";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { executionEvents, messages as dbMessages, plans, runs, settings, workers } from "@/server/db/schema";
import { createAdHocPlan } from "@/server/runs/ad-hoc-plan";
import { startSupervisorRun } from "@/server/supervisor/start";
import { askAgent, getAgent, spawnAgent, type AgentRecord } from "@/server/bridge-client";
import { queueConversationTitleGeneration } from "@/server/conversation-title";
import { normalizeConversationMode, type ConversationMode } from "./modes";
import { normalizeWorkerType, parseAllowedWorkerTypes } from "@/server/supervisor/worker-types";
import { buildPlannerSystemPrompt } from "@/server/prompts";
import { formatErrorMessage, persistRunFailure } from "@/server/runs/failures";
import { createRunId } from "@/server/runs/ids";
import { allocateWorkerIdentity } from "@/server/workers/ids";
import { persistWorkerSnapshot } from "@/server/workers/snapshots";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
import { emitNamedEvent } from "@/server/events/named-events";
import { refreshPlanningArtifactsForRun } from "@/server/planning/refresh";
import { getAppRoot } from "@/server/app-root";
import { appendAttachmentContext, normalizeChatAttachments, serializeChatAttachments, type ChatAttachment } from "@/lib/chat-attachments";
import { MANUAL_COMMIT_PROJECT_PROMPTS } from "@/lib/conversation-visuals";
import {
  GIT_AUTO_COMMIT_MILESTONES_SETTING,
  GIT_PUSH_ON_COMMIT_SETTING,
  parseBooleanSetting,
} from "@/lib/commit-workflow";
import { captureGitBaseline } from "@/server/git/auto-commit";
import { serializeMessageRecord } from "./message-records";
import { readWorkerYoloModeEnabled, resolveWorkerLaunchMode } from "@/server/worker-launch-mode";
import type { GitWorkspaceRunSnapshot, GitWorkspaceSnapshot, GitWorkspaceTarget, GitWorkspaceWarning } from "@/lib/git-workspace";
import { createBranchWorktree, validateWorkspaceTarget } from "@/server/git/workspaces";
import { setProjectGitWorkspaceDefaultTarget } from "@/server/projects/config";
import { pendingOrphanWorktreeError } from "@/server/git/orphan-recovery";


function buildInitialWorkerPrompt(mode: ConversationMode, command: string, projectRoot: string) {
  if (mode === "planning") {
    return `${buildPlannerSystemPrompt(projectRoot)}\n\nUser request:\n${command}`;
  }

  return command;
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

function isAgentBusyError(error: unknown) {
  return /\bagent is busy\b/i.test(formatErrorMessage(error));
}

function getDefaultConversationTitle(mode: ConversationMode, command: string) {
  if (mode === "direct" && MANUAL_COMMIT_PROJECT_PROMPTS.has(command)) {
    return "Commit";
  }

  return buildInitialConversationTitle(command);
}

function shouldGenerateConversationTitle(mode: ConversationMode, command: string) {
  return !(mode === "direct" && MANUAL_COMMIT_PROJECT_PROMPTS.has(command)) && Boolean(command.trim());
}

async function readCommitWorkflowSettings() {
  const rows = await db.select().from(settings);
  const values = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return {
    autoCommitMilestones: parseBooleanSetting(values[GIT_AUTO_COMMIT_MILESTONES_SETTING], false),
    pushOnCommit: parseBooleanSetting(values[GIT_PUSH_ON_COMMIT_SETTING], false),
  };
}

type GitWorkspaceLaunchRequest = {
  mode: "new_worktree";
  projectPath: string;
  newBranchName: string;
  checkoutPath: string;
  startPoint?: string;
  worktreeParent?: string;
  expectedHeadSha: string | null;
  expectedStatusFingerprint: string;
};

type ResolvedConversationWorkspace = {
  projectPath: string;
  runSnapshot: GitWorkspaceRunSnapshot | null;
  createdWorktree?: { projectPath: string; target: GitWorkspaceTarget };
};

function buildRunWorkspaceSnapshot(args: {
  target: GitWorkspaceTarget;
  snapshot: GitWorkspaceSnapshot;
  warnings?: GitWorkspaceWarning[];
}): GitWorkspaceRunSnapshot {
  const matchingWorktree = args.snapshot.worktrees.find((worktree) => worktree.checkoutPath === args.target.checkoutPath);
  const selectedAt = new Date().toISOString();
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
    selectedAt,
  };
}

async function resolveConversationWorkspace(args: {
  projectPath: string;
  gitWorkspaceTarget?: GitWorkspaceTarget | null;
  gitWorkspaceLaunch?: GitWorkspaceLaunchRequest | null;
}): Promise<ResolvedConversationWorkspace> {
  if (args.gitWorkspaceLaunch) {
    const result = await createBranchWorktree({
      projectPath: args.gitWorkspaceLaunch.projectPath,
      newBranchName: args.gitWorkspaceLaunch.newBranchName,
      checkoutPath: args.gitWorkspaceLaunch.checkoutPath,
      startPoint: args.gitWorkspaceLaunch.startPoint,
      worktreeParent: args.gitWorkspaceLaunch.worktreeParent,
      expectedHeadSha: args.gitWorkspaceLaunch.expectedHeadSha,
      expectedStatusFingerprint: args.gitWorkspaceLaunch.expectedStatusFingerprint,
    });
    persistWorkspaceDefaultTarget(args.gitWorkspaceLaunch.projectPath, result.target);
    return {
      projectPath: result.target.checkoutPath,
      runSnapshot: buildRunWorkspaceSnapshot({
        target: result.target,
        snapshot: result.snapshot,
      }),
      createdWorktree: {
        projectPath: args.gitWorkspaceLaunch.projectPath,
        target: result.target,
      },
    };
  }

  if (args.gitWorkspaceTarget) {
    const snapshot = await validateWorkspaceTarget(args.gitWorkspaceTarget);
    persistWorkspaceDefaultTarget(args.projectPath, args.gitWorkspaceTarget);
    return {
      projectPath: args.gitWorkspaceTarget.checkoutPath,
      runSnapshot: buildRunWorkspaceSnapshot({
        target: args.gitWorkspaceTarget,
        snapshot,
      }),
    };
  }

  return {
    projectPath: args.projectPath,
    runSnapshot: null,
  };
}

function persistWorkspaceDefaultTarget(projectPath: string, target: GitWorkspaceTarget) {
  if (!fs.existsSync(projectPath)) {
    return;
  }
  setProjectGitWorkspaceDefaultTarget(projectPath, target);
}

function buildInitialConversationTitle(command: string) {
  const firstLine = command
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .find(Boolean);

  if (!firstLine) {
    return "New conversation";
  }

  const maxLength = 80;
  if (firstLine.length <= maxLength) {
    return firstLine;
  }

  return `${firstLine.slice(0, maxLength - 3).trimEnd()}...`;
}

async function buildCreatedConversationResponse(args: {
  planId: string;
  runId: string;
  messageId: string;
  mode: ConversationMode;
}) {
  const plan = await db.select().from(plans).where(eq(plans.id, args.planId)).get();
  const run = await db.select().from(runs).where(eq(runs.id, args.runId)).get();
  const message = await db.select().from(dbMessages).where(eq(dbMessages.id, args.messageId)).get();

  return {
    planId: args.planId,
    runId: args.runId,
    mode: args.mode,
    plan,
    run,
    message: serializeMessageRecord(message),
  };
}

async function runInitialWorkerTurn(args: {
  runId: string;
  workerId: string;
  workerType: string;
  cwd: string;
  agent: AgentRecord;
  mode: "direct" | "planning";
  command: string;
}) {
  try {
    await db.update(workers).set({
      status: "working",
      type: args.agent.type || args.workerType,
      cwd: args.agent.cwd || args.cwd,
      bridgeSessionId: args.agent.sessionId ?? null,
      bridgeSessionMode: args.agent.sessionMode ?? null,
      updatedAt: new Date(),
    }).where(eq(workers.id, args.workerId));
    if (args.mode === "planning") {
      await db.update(runs).set({
        status: "working",
        updatedAt: new Date(),
      }).where(eq(runs.id, args.runId));
    }
    notifyEventStreamSubscribers();

    const response = await askAgent(args.workerId, buildInitialWorkerPrompt(args.mode, args.command, args.cwd));
    let snapshot: AgentRecord | null = null;
    try {
      snapshot = await getAgent(args.workerId);
      await persistWorkerSnapshot(args.workerId, snapshot);
    } catch {
      // The bridge may have already dropped a failed worker; the ask response still determines the visible state.
    }

    if (!hasVisibleWorkerOutput(response.response, snapshot)) {
      const failureMessage = buildEmptyWorkerOutputMessage(snapshot, response.state);

      await db.update(workers).set({
        type: snapshot?.type || args.agent.type || args.workerType,
        status: "error",
        cwd: snapshot?.cwd || args.agent.cwd || args.cwd,
        outputLog: failureMessage,
        bridgeSessionId: snapshot?.sessionId ?? args.agent.sessionId ?? null,
        bridgeSessionMode: snapshot?.sessionMode ?? args.agent.sessionMode ?? null,
        updatedAt: new Date(),
      }).where(eq(workers.id, args.workerId));

      await persistRunFailure(args.runId, new Error(failureMessage));
      notifyEventStreamSubscribers();
      return;
    }

    await db.update(workers).set({
      type: args.agent.type || args.workerType,
      status: response.state,
      cwd: args.agent.cwd || args.cwd,
      outputLog: response.response.trim() ? response.response : "",
      bridgeSessionId: snapshot?.sessionId ?? args.agent.sessionId ?? null,
      bridgeSessionMode: snapshot?.sessionMode ?? args.agent.sessionMode ?? null,
      updatedAt: new Date(),
    }).where(eq(workers.id, args.workerId));

    await db.insert(dbMessages).values({
      id: randomUUID(),
      runId: args.runId,
      role: "worker",
      kind: args.mode,
      content: response.response,
      workerId: args.workerId,
      createdAt: new Date(),
    });

    if (args.mode === "planning") {
      const latestRun = await db.select().from(runs).where(eq(runs.id, args.runId)).get();
      const latestWorker = await db.select().from(workers).where(eq(workers.id, args.workerId)).get();
      if (latestRun) {
        await refreshPlanningArtifactsForRun({
          run: latestRun,
          worker: latestWorker,
          snapshot,
          responseText: response.response,
        });
      }
    } else {
      await db.update(runs).set({
        status: "done",
        updatedAt: new Date(),
      }).where(eq(runs.id, args.runId));
    }

    notifyEventStreamSubscribers();
  } catch (error) {
    if (isAgentBusyError(error)) {
      const now = new Date();
      await db.update(workers).set({
        status: "working",
        updatedAt: now,
      }).where(eq(workers.id, args.workerId));
      await db.update(runs).set({
        status: args.mode === "planning" ? "working" : "running",
        failedAt: null,
        lastError: null,
        updatedAt: now,
      }).where(eq(runs.id, args.runId));
      notifyEventStreamSubscribers();
      throw Object.assign(error instanceof Error ? error : new Error(formatErrorMessage(error)), { status: 409 });
    }

    await db.update(workers).set({
      status: "error",
      updatedAt: new Date(),
    }).where(eq(workers.id, args.workerId));
    await persistRunFailure(args.runId, error);
    notifyEventStreamSubscribers();
    throw error;
  }
}

async function startDirectWorkerConversation(args: {
  runId: string;
  workerId: string;
  workerType: string;
  cwd: string;
  mode?: string;
  preferredWorkerModel?: string | null;
  preferredWorkerEffort?: string | null;
  command: string;
}) {
  try {
    const agent = await spawnAgent({
      type: args.workerType,
      cwd: args.cwd,
      name: args.workerId,
      ...(args.mode ? { mode: args.mode } : {}),
      model: args.preferredWorkerModel?.trim() || undefined,
      effort: args.preferredWorkerEffort?.trim().toLowerCase() || undefined,
    });

    await runInitialWorkerTurn({
      runId: args.runId,
      workerId: args.workerId,
      workerType: args.workerType,
      cwd: args.cwd,
      agent,
      mode: "direct",
      command: args.command,
    });
  } catch (error) {
    if (isAgentBusyError(error)) {
      return;
    }

    const failureMessage = formatErrorMessage(error);
    await db.update(workers).set({
      status: "error",
      outputLog: failureMessage,
      updatedAt: new Date(),
    }).where(eq(workers.id, args.workerId));
    await persistRunFailure(args.runId, error);
    notifyEventStreamSubscribers();
    console.error("Initial direct conversation worker failed:", error);
  }
}

export async function createConversation(args: {
  mode?: unknown;
  command: string;
  projectPath?: string | null;
  gitWorkspaceTarget?: GitWorkspaceTarget | null;
  gitWorkspaceLaunch?: GitWorkspaceLaunchRequest | null;
  preferredWorkerType?: string | null;
  preferredWorkerModel?: string | null;
  preferredWorkerEffort?: string | null;
  allowedWorkerTypes?: string[] | string | null;
  attachments?: ChatAttachment[];
}) {
  const mode = normalizeConversationMode(args.mode);
  const command = args.command.trim();
  const requestedProjectPath = args.projectPath?.trim() || getAppRoot();
  let createdWorktree: { projectPath: string; target: GitWorkspaceTarget } | null = null;
  let runCreated = false;

  try {
    const resolvedWorkspace = await resolveConversationWorkspace({
      projectPath: requestedProjectPath,
      gitWorkspaceTarget: args.gitWorkspaceTarget,
      gitWorkspaceLaunch: args.gitWorkspaceLaunch,
    });
    createdWorktree = resolvedWorkspace.createdWorktree ?? null;
    const projectPath = resolvedWorkspace.projectPath;
    const attachments = normalizeChatAttachments(args.attachments ?? []);
    const attachmentsJson = serializeChatAttachments(attachments);
    const workerPrompt = appendAttachmentContext(command, attachments);
    const preferredWorkerType = args.preferredWorkerType?.trim()
      ? normalizeWorkerType(args.preferredWorkerType)
      : null;
    const defaultTitle = getDefaultConversationTitle(mode, command);
    const generateTitle = shouldGenerateConversationTitle(mode, command);
    const allowedWorkerTypes = parseAllowedWorkerTypes(
      Array.isArray(args.allowedWorkerTypes)
        ? JSON.stringify(args.allowedWorkerTypes)
        : typeof args.allowedWorkerTypes === "string"
          ? args.allowedWorkerTypes
          : null,
    );

    const planPath = createAdHocPlan(command, attachments);
    const commitWorkflowSettings = mode === "implementation"
      ? await readCommitWorkflowSettings()
      : { autoCommitMilestones: false, pushOnCommit: false };
    const gitBaseline = mode === "implementation" && commitWorkflowSettings.autoCommitMilestones
      ? captureGitBaseline(projectPath)
      : null;
    const planId = randomUUID();
    await db.insert(plans).values({
      id: planId,
      path: planPath,
      status: mode === "planning" ? "starting" : "running",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const runId = createRunId();
    await db.insert(runs).values({
      id: runId,
      planId,
      mode,
      projectPath,
      title: defaultTitle,
      preferredWorkerType,
      preferredWorkerModel: args.preferredWorkerModel?.trim() || null,
      preferredWorkerEffort: args.preferredWorkerEffort?.trim().toLowerCase() || null,
      allowedWorkerTypes: JSON.stringify(allowedWorkerTypes),
      autoCommitMilestones: commitWorkflowSettings.autoCommitMilestones,
      pushOnCommit: commitWorkflowSettings.pushOnCommit,
      gitBaselineJson: gitBaseline ? JSON.stringify(gitBaseline) : null,
      gitWorkspaceJson: resolvedWorkspace.runSnapshot ? JSON.stringify(resolvedWorkspace.runSnapshot) : null,
      completionCommitSha: null,
      status: mode === "planning" ? "starting" : "running",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    runCreated = true;

    if (resolvedWorkspace.runSnapshot) {
      await db.insert(executionEvents).values({
        id: randomUUID(),
        runId,
        eventType: "git_workspace_selected",
        details: JSON.stringify({
          target: resolvedWorkspace.runSnapshot.target,
          headSha: resolvedWorkspace.runSnapshot.headSha,
          branchName: resolvedWorkspace.runSnapshot.branchName,
          detachedLabel: resolvedWorkspace.runSnapshot.detachedLabel,
          dirtyFileCount: resolvedWorkspace.runSnapshot.dirtyFileCount,
          conflictedFileCount: resolvedWorkspace.runSnapshot.conflictedFileCount,
          aheadCount: resolvedWorkspace.runSnapshot.aheadCount,
          behindCount: resolvedWorkspace.runSnapshot.behindCount,
          warnings: resolvedWorkspace.runSnapshot.warnings,
        }),
        createdAt: new Date(),
      });
    }

    const initialMessageId = randomUUID();
    await db.insert(dbMessages).values({
      id: initialMessageId,
      runId,
      role: "user",
      kind: "checkpoint",
      content: command,
      attachmentsJson,
      createdAt: new Date(),
    });
    notifyEventStreamSubscribers();

    if (mode === "implementation") {
      startSupervisorRun(runId);
    } else {
      const { workerId, workerNumber } = await allocateWorkerIdentity(runId);
      const cwd = projectPath || process.cwd();
      const workerType = preferredWorkerType || allowedWorkerTypes[0] || "codex";
      const yoloModeEnabled = await readWorkerYoloModeEnabled();
      const workerMode = resolveWorkerLaunchMode(undefined, yoloModeEnabled);

      await db.insert(workers).values({
        id: workerId,
        runId,
        type: workerType,
        status: "starting",
        cwd,
        workerNumber,
        outputLog: "",
        outputEntriesJson: "[]",
        currentText: "",
        lastText: "",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      emitNamedEvent({ kind: "worker.spawned", runId, workerId, workerType });

      const response = await buildCreatedConversationResponse({ planId, runId, messageId: initialMessageId, mode });

      if (mode === "direct") {
        startDirectWorkerConversation({
          runId,
          workerId,
          workerType,
          cwd,
          mode: workerMode,
          preferredWorkerModel: args.preferredWorkerModel,
          preferredWorkerEffort: args.preferredWorkerEffort,
          command: workerPrompt,
        }).catch((error) => {
          console.error("Initial direct conversation worker failed:", error);
        });
      } else {
        let agent;
        try {
          agent = await spawnAgent({
            type: workerType,
            cwd,
            name: workerId,
            ...(workerMode ? { mode: workerMode } : {}),
            model: args.preferredWorkerModel?.trim() || undefined,
            effort: args.preferredWorkerEffort?.trim().toLowerCase() || undefined,
          });
        } catch (error) {
          // Worker row was inserted and `worker.spawned` already fired
          // — without an explicit failure event, observers see the row
          // in `starting` forever and the wire goes silent. Make the
          // failure visible.
          const cause = error instanceof Error ? error : new Error(String(error));
          emitNamedEvent({
            kind: "error.surfaced",
            code: "worker.spawn.failed",
            message: `Failed to spawn worker for ${mode} conversation: ${cause.message}`,
            surface: "toast",
            runId,
            workerId,
            cause: { name: cause.name, message: cause.message },
          });
          throw error;
        }

        runInitialWorkerTurn({
          runId,
          workerId,
          workerType,
          cwd,
          agent,
          mode,
          command: workerPrompt,
        }).catch((error) => {
          if (isAgentBusyError(error)) {
            return;
          }

          console.error(`Initial ${mode} conversation turn failed:`, error);
        });
      }

      if (generateTitle) {
        queueConversationTitleGeneration({ runId, command }).catch((error) => {
          console.error("Conversation title generation failed:", error);
        });
      }
      return response;
    }

    if (generateTitle) {
      queueConversationTitleGeneration({ runId, command }).catch((error) => {
        console.error("Conversation title generation failed:", error);
      });
    }

    return buildCreatedConversationResponse({ planId, runId, messageId: initialMessageId, mode });
  } catch (error) {
    if (createdWorktree && !runCreated) {
      throw pendingOrphanWorktreeError({
        projectPath: createdWorktree.projectPath,
        operation: "conversation_launch",
        target: createdWorktree.target,
        error,
      });
    }
    throw error;
  }
}
