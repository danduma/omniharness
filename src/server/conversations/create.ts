import { randomUUID } from "crypto";
import fs from "fs";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { messages as dbMessages, plans, runs, settings, workers } from "@/server/db/schema";
import { recordExecutionEvent } from "@/server/events/execution-event-store";
import { createAdHocPlan } from "@/server/runs/ad-hoc-plan";
import { startSupervisorRun } from "@/server/supervisor/start";
import { askAgent, getAgent, spawnAgent, type AgentRecord } from "@/server/bridge-client";
import { queueConversationTitleGeneration } from "@/server/conversation-title";
import { resolveOmniRequest, type ConversationMode } from "./modes";
import { normalizeWorkerType, parseAllowedWorkerTypes } from "@/server/supervisor/worker-types";
import { buildPlannerSystemPrompt } from "@/server/prompts";
import { formatErrorMessage, persistRunFailure } from "@/server/runs/failures";
import { createRunId, RUN_ID_PATTERN } from "@/server/runs/ids";
import { allocateWorkerIdentity } from "@/server/workers/ids";
import { persistWorkerSnapshot } from "@/server/workers/snapshots";
import { appendLifecycleEntry, appendUserInputOnDelivery } from "@/server/workers/stream-writer";
import { appendAskResponseFallbackEntry } from "@/server/workers/response-fallback";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
import { emitNamedEvent } from "@/server/events/named-events";
import { refreshPlanningArtifactsForRun } from "@/server/planning/refresh";
import { getAppDataPath, getAppRoot } from "@/server/app-root";
import { appendAttachmentContext, normalizeChatAttachments, serializeChatAttachments, type ChatAttachment } from "@/lib/chat-attachments";
import {
  GIT_AUTO_COMMIT_MILESTONES_SETTING,
  GIT_PUSH_ON_COMMIT_SETTING,
  parseBooleanSetting,
} from "@/lib/commit-workflow";
import { captureGitBaseline } from "@/server/git/auto-commit";
import { serializeMessageRecord } from "./message-records";
import { runWorkerTurn, trackConversationBackgroundTask } from "./worker-turn-gate";
import { readWorkerYoloModeEnabled, resolveWorkerLaunchMode } from "@/server/worker-launch-mode";
import { readRuntimeEnvFromSettings } from "@/server/supervisor/runtime-settings";
import type { GitWorkspaceRunSnapshot, GitWorkspaceSnapshot, GitWorkspaceTarget, GitWorkspaceWarning } from "@/lib/git-workspace";
import { createBranchWorktree, validateWorkspaceTarget } from "@/server/git/workspaces";
import { setProjectGitWorkspaceDefaultTarget } from "@/server/projects/config";
import { pendingOrphanWorktreeError } from "@/server/git/orphan-recovery";
import { updateDirectRunStatusFromWorkerOutput } from "./direct-run-status";
import { isResourceAdmissionError } from "@/server/agent-runtime/resource-admission";
import { globalClaudeConfigDir } from "@/server/external-sessions/discovery";


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

function toErrorCause(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }

  return { name: "Error", message: String(error) };
}

async function persistInitialWorkerSpawnFailure(args: {
  runId: string;
  workerId: string;
  mode: "direct" | "planning" | "commit";
  error: unknown;
}) {
  const cause = toErrorCause(args.error);
  const failureMessage = formatErrorMessage(args.error);
  const now = new Date();

  await db.update(workers).set({
    status: "error",
    outputLog: failureMessage,
    updatedAt: now,
  }).where(eq(workers.id, args.workerId));

  if (args.mode === "planning") {
    const run = await db.select({ planId: runs.planId }).from(runs).where(eq(runs.id, args.runId)).get();
    if (run?.planId) {
      await db.update(plans).set({
        status: "failed",
        updatedAt: now,
      }).where(eq(plans.id, run.planId));
    }
  }

  await persistRunFailure(args.runId, args.error);
  await appendLifecycleEntry({
    runId: args.runId,
    workerId: args.workerId,
    text: `Worker spawn failed: ${failureMessage}`,
    timestamp: now,
    raw: { eventType: "worker.spawn_failed", mode: args.mode, reason: failureMessage },
  });
  emitNamedEvent({
    kind: "worker.status",
    runId: args.runId,
    workerId: args.workerId,
    prev: "starting",
    next: "error",
  });
  emitNamedEvent({
    kind: "error.surfaced",
    code: isResourceAdmissionError(args.error)
      ? "worker.spawn.resource_exhausted"
      : "worker.spawn.failed",
    message: `Failed to spawn worker for ${args.mode} conversation: ${cause.message}`,
    surface: "toast",
    runId: args.runId,
    workerId: args.workerId,
    cause,
  });
  notifyEventStreamSubscribers();
}

function getDefaultConversationTitle(mode: ConversationMode, command: string) {
  if (mode === "commit") {
    return "Commit";
  }

  return buildInitialConversationTitle(command);
}

function shouldGenerateConversationTitle(mode: ConversationMode, command: string) {
  // Commit conversations have a stable product label; other modes can replace
  // the first-line fallback with a generated sidebar title.
  if (mode === "commit") {
    return false;
  }
  return Boolean(command.trim());
}

function shouldCaptureCommitWorkflowForMode(mode: ConversationMode) {
  return mode === "implementation" || mode === "direct";
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
  mode: "direct" | "planning" | "commit";
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
    await appendAskResponseFallbackEntry({
      runId: args.runId,
      workerId: args.workerId,
      responseText: response.response,
      snapshot,
    });

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

      await persistRunFailure(args.runId, new Error(failureMessage), {
        surface: { code: "worker.initial.empty_output", workerId: args.workerId },
      });
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

    // Worker response now lives in the unified worker stream via the
    // bridge entries written by persistWorkerSnapshot above. The
    // legacy role:"worker" messages row is no longer written.

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
      await updateDirectRunStatusFromWorkerOutput({
        runId: args.runId,
        workerId: args.workerId,
        responseText: response.response,
        renderedOutput: snapshot?.renderedOutput,
        currentText: snapshot?.currentText,
        lastText: snapshot?.lastText,
        outputEntries: snapshot?.outputEntries,
      });
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
    await persistRunFailure(args.runId, error, {
      surface: { code: "worker.initial.turn_failed", workerId: args.workerId },
    });
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
  externalClaudeSessionId?: string | null;
}) {
  let agent: AgentRecord;
  try {
    const { env: envParams } = await readRuntimeEnvFromSettings();
    const externalEnv = args.externalClaudeSessionId
      ? { ...envParams, CLAUDE_CONFIG_DIR: globalClaudeConfigDir() }
      : envParams;
    agent = await spawnAgent({
      type: args.workerType,
      cwd: args.cwd,
      name: args.workerId,
      ...(args.mode ? { mode: args.mode } : {}),
      env: externalEnv,
      model: args.preferredWorkerModel?.trim() || undefined,
      effort: args.preferredWorkerEffort?.trim().toLowerCase() || undefined,
      ...(args.externalClaudeSessionId ? { resumeSessionId: args.externalClaudeSessionId } : {}),
    });
  } catch (error) {
    await persistInitialWorkerSpawnFailure({
      runId: args.runId,
      workerId: args.workerId,
      mode: "direct",
      error,
    });
    console.error("Initial direct conversation worker spawn failed:", error);
    return;
  }

  // When resuming an external session with no initial command, just connect the
  // agent and leave the worker in awaiting_user state for the next message.
  if (args.externalClaudeSessionId && !args.command) {
    await db.update(workers).set({
      status: "awaiting_user",
      type: agent.type || args.workerType,
      cwd: agent.cwd || args.cwd,
      bridgeSessionId: agent.sessionId ?? null,
      bridgeSessionMode: agent.sessionMode ?? null,
      updatedAt: new Date(),
    }).where(eq(workers.id, args.workerId));
    await db.update(runs).set({
      status: "running",
      updatedAt: new Date(),
    }).where(eq(runs.id, args.runId));
    notifyEventStreamSubscribers();
    return;
  }

  try {
    await runWorkerTurn(args.workerId, () => runInitialWorkerTurn({
      runId: args.runId,
      workerId: args.workerId,
      workerType: args.workerType,
      cwd: args.cwd,
      agent,
      mode: "direct",
      command: args.command,
    }));
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
    await persistRunFailure(args.runId, error, {
      surface: { code: "worker.initial.turn_failed", workerId: args.workerId },
    });
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
  requestedRunId?: string | null;
  attachments?: ChatAttachment[];
  externalClaudeSessionId?: string | null;
}) {
  const command = args.command.trim();
  // Resolve the client request (which may be the "omni" alias) into the stored
  // run mode plus phase. `usePlanner` is true whenever the opening turn should
  // run the interactive planner worker rather than the supervisor: legacy
  // planning runs, or an Omni run that still needs a plan.
  const { runMode: mode, phase } = resolveOmniRequest(args.mode, command);
  const usePlanner = phase === "planning" || mode === "planning";
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
    const workerPrompt = appendAttachmentContext(command, attachments, {
      resolvePath: (storagePath) => getAppDataPath(storagePath),
    });
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
    // During the Omni planning phase no implementation has begun, so defer the
    // git baseline + commit-workflow capture until the run transitions into
    // implementation (see startImplementationPhase).
    const capturesImplementationWorkflow = shouldCaptureCommitWorkflowForMode(mode) && !usePlanner;
    const commitWorkflowSettings = capturesImplementationWorkflow
      ? await readCommitWorkflowSettings()
      : { autoCommitMilestones: false, pushOnCommit: false };
    const gitBaseline = capturesImplementationWorkflow && commitWorkflowSettings.autoCommitMilestones
      ? captureGitBaseline(projectPath)
      : null;
    const planId = randomUUID();
    const requestedRunId = args.requestedRunId?.trim() || null;
    if (requestedRunId && !RUN_ID_PATTERN.test(requestedRunId)) {
      throw Object.assign(new Error("Invalid requested run id."), { status: 400 });
    }
    await db.insert(plans).values({
      id: planId,
      path: planPath,
      status: usePlanner ? "starting" : "running",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const runId = requestedRunId || createRunId();
    await db.insert(runs).values({
      id: runId,
      planId,
      mode,
      phase,
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
      status: usePlanner ? "starting" : "running",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    runCreated = true;

    if (resolvedWorkspace.runSnapshot) {
      await recordExecutionEvent({
        runId,
        eventType: "git_workspace_selected",
        details: {
          target: resolvedWorkspace.runSnapshot.target,
          headSha: resolvedWorkspace.runSnapshot.headSha,
          branchName: resolvedWorkspace.runSnapshot.branchName,
          detachedLabel: resolvedWorkspace.runSnapshot.detachedLabel,
          dirtyFileCount: resolvedWorkspace.runSnapshot.dirtyFileCount,
          conflictedFileCount: resolvedWorkspace.runSnapshot.conflictedFileCount,
          aheadCount: resolvedWorkspace.runSnapshot.aheadCount,
          behindCount: resolvedWorkspace.runSnapshot.behindCount,
          warnings: resolvedWorkspace.runSnapshot.warnings,
        },
      });
    }

    const initialMessageId = randomUUID();
    const initialMessageCreatedAt = new Date();
    const initialMessage = {
      id: initialMessageId,
      runId,
      role: "user",
      kind: "checkpoint",
      content: command,
      attachmentsJson,
      createdAt: initialMessageCreatedAt,
    };

    if (phase === "implementing") {
      await db.insert(dbMessages).values(initialMessage);
      notifyEventStreamSubscribers();
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
        // Durable copy of the user's opening prompt so the terminal can still
        // render it if the messages row is ever lost (recovery, retry, manual
        // edit). The messages table was being treated as the single source of
        // truth, leaving direct conversations with no recoverable transcript.
        initialPrompt: command,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      if (!args.externalClaudeSessionId || command) {
        await appendUserInputOnDelivery({
          id: initialMessageId,
          runId,
          workerId,
          text: command,
          deliveredAt: initialMessageCreatedAt,
          attachments: attachments.map((attachment) => ({
            id: attachment.id,
            filename: attachment.name,
            mimeType: attachment.mimeType,
            sizeBytes: attachment.size,
          })),
        });
        await db.insert(dbMessages).values(initialMessage);
      }
      notifyEventStreamSubscribers();
      emitNamedEvent({ kind: "worker.spawned", runId, workerId, workerType });
      await appendLifecycleEntry({
        runId,
        workerId,
        text: `Worker spawned (${workerType})`,
        raw: { eventType: "worker.spawned", workerType },
      });

      const response = await buildCreatedConversationResponse({ planId, runId, messageId: initialMessageId, mode });

      if (!usePlanner) {
        const initialDirectTurn = startDirectWorkerConversation({
          runId,
          workerId,
          workerType,
          cwd,
          mode: workerMode,
          preferredWorkerModel: args.preferredWorkerModel,
          preferredWorkerEffort: args.preferredWorkerEffort,
          command: workerPrompt,
          externalClaudeSessionId: args.externalClaudeSessionId,
        });
        trackConversationBackgroundTask(initialDirectTurn).catch((error) => {
          console.error("Initial direct conversation worker failed:", error);
        });
      } else {
        // Planning mode: spawn the agent off the critical path so the
        // response returns instantly, mirroring direct mode. Spawn
        // failures surface via `error.surfaced` instead of the HTTP
        // response — the worker row already exists in `starting` and
        // `worker.spawned` has already fired, so observers can render.
        const initialPlanningTurn = (async () => {
          let agent;
          try {
            const { env: envParams } = await readRuntimeEnvFromSettings();
            agent = await spawnAgent({
              type: workerType,
              cwd,
              name: workerId,
              ...(workerMode ? { mode: workerMode } : {}),
              env: envParams,
              model: args.preferredWorkerModel?.trim() || undefined,
              effort: args.preferredWorkerEffort?.trim().toLowerCase() || undefined,
            });
          } catch (error) {
            await persistInitialWorkerSpawnFailure({
              runId,
              workerId,
              mode: "planning",
              error,
            });
            console.error(`Spawn for planning conversation failed:`, error);
            return;
          }

          try {
            await runWorkerTurn(workerId, () => runInitialWorkerTurn({
              runId,
              workerId,
              workerType,
              cwd,
              agent,
              mode: "planning",
              command: workerPrompt,
            }));
          } catch (error) {
            if (isAgentBusyError(error)) {
              return;
            }
            console.error(`Initial planning conversation turn failed:`, error);
          }
        })();
        void trackConversationBackgroundTask(initialPlanningTurn);
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
