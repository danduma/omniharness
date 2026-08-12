import { randomUUID } from "crypto";
import fs from "fs";
import { eq, lt } from "drizzle-orm";
import { db } from "@/server/db";
import { cancelAgent, cancelAgentTerminalProcess } from "@/server/bridge-client";
import { errorResponse } from "@/server/api-errors";
import { recoverRun } from "@/server/runs/recovery";
import { stopRunObserver } from "@/server/supervisor/observer";
import { cancelSupervisorWake } from "@/server/supervisor/wake";
import { cancelDurableSupervisorWake } from "@/server/supervisor/wake-schedule";
import { clearSupervisorWakeLease } from "@/server/supervisor/lease";
import { getAppDataPath } from "@/server/app-root";
import { requireApiSession } from "@/server/auth/guards";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
import { emitNamedEvent } from "@/server/events/named-events";
import { GitWorkspaceError } from "@/server/git/workspaces";
import { getRunLatestUnreadTimestamp } from "@/lib/conversation-state";
import { isPermanentAccountFailure } from "@/lib/provider-account-failures";
import { compactRunOutputs } from "@/server/workers/output-store";
import { cleanupRunArtifacts } from "@/server/artifacts/cleanup";
import { pauseForClarifications } from "@/server/clarifications/loop";
import { isArchivableRunStatus, isTerminalRunStatus } from "@/server/runs/status";
import { markRecoveryIncidentResolved } from "@/server/runs/recovery-incidents";
import {
  plans,
  runs,
  conversationReadMarkers,
  messages,
  workers,
  clarifications,
  planItems,
  supervisorInterventions,
  queuedConversationMessages,
  recoveryIncidents,
  supervisorScheduledWakes,
  creditEvents,
  settings,
  workerCounters,
  workerAssignments,
  workerCredentialAllocations,
  workerTokenUsage,
  planningReviewRuns,
  planningReviewRounds,
  planningReviewFindings,
  processSessions,
} from "@/server/db/schema";
import {
  recordExecutionEvent,
  deleteExecutionEventsForRun,
  deleteExecutionEventsForPlanItem,
} from "@/server/events/execution-event-store";
import { normalizeSessionType } from "@/server/session-providers/capabilities";
import { getSessionProvider } from "@/server/session-providers/registry";
import { stopLiveProcessForDelete } from "@/server/session-providers/process-store";
import type { OmniHttpHandler, OmniRequestContext } from "@/runtime/http/registry";
import { startSlowProbe } from "@/server/slow-probe";
import {
  abortWorkerTurn,
  advanceWorkerTurnGeneration,
  completeConversationDeletion,
  requestConversationDeletion,
  waitForConversationBackgroundTasks,
} from "@/server/conversations/worker-turn-gate";
import { runQuotaRecoveryMutation } from "@/server/quota/recovery-mutation";

function normalizeTitle(input: unknown) {
  return String(input ?? "").trim().replace(/\s+/g, " ");
}

function parseConfiguredProjectPaths(value: string | null | undefined) {
  if (!value?.trim()) {
    return [] as string[];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

function normalizeWorkerStatus(status: string | null | undefined) {
  return (status ?? "").trim().toLowerCase().split(":")[0]?.trim() ?? "";
}

function isActiveWorkerStatus(status: string | null | undefined) {
  return ["starting", "working", "idle", "stuck", "cred-exhausted"].includes(normalizeWorkerStatus(status));
}

function isSupervisorStopAlreadySettled(status: string | null | undefined) {
  return isTerminalRunStatus(status) || normalizeWorkerStatus(status) === "canceled";
}

// Classification lives in @/lib/provider-account-failures so this route, the
// supervisor retry gate and the frontend auto-resume gate cannot drift apart
// again — they previously disagreed about whether "403 Account suspended"
// was permanent.

function actionLabelForPostAction(action: unknown) {
  switch (action) {
    case "stop_supervisor":
      return "Stop supervisor";
    case "stop_worker":
      return "Stop worker";
    case "stop_worker_terminal":
      return "Stop worker terminal";
    case "archive":
      return "Archive";
    case "mark_read":
      return "Mark read";
    case "retry":
    case "edit":
    case "fork":
    default:
      return "Recover conversation";
  }
}

function gitWorkspaceStatus(error: unknown) {
  if (!(error instanceof GitWorkspaceError)) {
    return null;
  }
  if (
    error.code.startsWith("stale_")
    || error.code.includes("dirty")
    || error.code.includes("conflicted")
    || error.code === "branch_checked_out_elsewhere"
    || error.code === "pending_orphan_worktree"
  ) {
    return 409;
  }
  return 400;
}

function isTerminalProcessNotFoundError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /terminal process not found/i.test(message);
}

function emitUnsupportedSessionAction(args: {
  runId: string;
  sessionType: string;
  action: string;
  reason: string;
}) {
  emitNamedEvent({
    kind: "session.action.refused",
    runId: args.runId,
    sessionType: args.sessionType,
    action: args.action,
    code: "session.action.unsupported",
    reason: args.reason,
  });
  emitNamedEvent({
    kind: "error.surfaced",
    code: "session.action.unsupported",
    message: args.reason,
    surface: "toast",
    runId: args.runId,
  });
}

function readGitWorkspaceLaunch(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  if (candidate.mode !== "new_worktree") {
    return null;
  }
  if (
    typeof candidate.projectPath !== "string"
    || typeof candidate.newBranchName !== "string"
    || typeof candidate.checkoutPath !== "string"
    || typeof candidate.expectedStatusFingerprint !== "string"
    || !(typeof candidate.expectedHeadSha === "string" || candidate.expectedHeadSha === null)
  ) {
    return null;
  }
  return {
    mode: "new_worktree" as const,
    projectPath: candidate.projectPath,
    newBranchName: candidate.newBranchName,
    checkoutPath: candidate.checkoutPath,
    startPoint: typeof candidate.startPoint === "string" ? candidate.startPoint : undefined,
    worktreeParent: typeof candidate.worktreeParent === "string" ? candidate.worktreeParent : undefined,
    expectedHeadSha: candidate.expectedHeadSha,
    expectedStatusFingerprint: candidate.expectedStatusFingerprint,
  };
}

const USER_STOPPED_WORKER_QUESTION = "I paused the active workers after you stopped one. Is there anything you want to modify before I continue?";

function requireRunId(context: OmniRequestContext) {
  const runId = context.params?.id?.trim();
  if (!runId) {
    throw new Error("Run id is required.");
  }
  return runId;
}

async function insertExecutionEvent(
  runId: string,
  eventType: string,
  details: Record<string, unknown>,
  workerId?: string | null,
) {
  await recordExecutionEvent({
    runId,
    workerId: workerId ?? null,
    planItemId: null,
    eventType,
    details,
  });
}

async function cancelWorker(worker: typeof workers.$inferSelect) {
  // Stop is authoritative the moment it is pressed. Abort the running turn
  // locally first — that tears down the in-flight request without waiting on an
  // agent that may never answer — then advance the turn fence so any late write
  // from the dead turn is rejected instead of resurrecting `working` state.
  abortWorkerTurn(worker.id, "user stop");
  void cancelAgent(worker.id).catch(() => {
    // best effort: the bridge process may already be gone or wedged
  });

  const previousStatus = worker.status;
  await advanceWorkerTurnGeneration(worker.id, {
    status: "cancelled",
    clearCurrentText: true,
    updatedAt: new Date(),
  });
  await db.update(workers).set({
    lastText: worker.currentText || worker.lastText,
  }).where(eq(workers.id, worker.id));

  // Stop endpoints went through this helper but never emitted named
  // lifecycle events. Subscribers that watch `worker.status` /
  // `worker.terminal` missed every HTTP-initiated stop. Skip the emit
  // on re-cancel so duplicate requests don't double-toast.
  if (previousStatus !== "cancelled") {
    emitNamedEvent({
      kind: "worker.status",
      runId: worker.runId,
      workerId: worker.id,
      prev: previousStatus,
      next: "cancelled",
    });
    emitNamedEvent({
      kind: "worker.terminal",
      runId: worker.runId,
      workerId: worker.id,
      status: "cancelled",
    });
  }
}

async function settleRunRecoveryAfterUserStop(runId: string) {
  cancelSupervisorWake(runId);
  await cancelDurableSupervisorWake(runId);
  await clearSupervisorWakeLease(runId);

  const incidents = await db.select().from(recoveryIncidents).where(eq(recoveryIncidents.runId, runId));
  const unresolvedIncidents = incidents.filter((incident) => (
    incident.status === "open"
    || incident.status === "recovering"
    || incident.status === "needs_user"
  ));
  for (const incident of unresolvedIncidents) {
    await markRecoveryIncidentResolved({
      incidentId: incident.id,
      runId,
      workerId: incident.workerId,
      summary: "Recovery cancelled because the user stopped the conversation.",
      details: { reason: "user_stopped" },
    });
  }
}

async function pauseImplementationRunAfterWorkerStop(runId: string, stoppedWorkerId: string) {
  cancelSupervisorWake(runId);
  stopRunObserver(runId);
  await clearSupervisorWakeLease(runId);

  const runWorkers = await db.select().from(workers).where(eq(workers.runId, runId));
  const activeWorkers = runWorkers.filter((worker) => isActiveWorkerStatus(worker.status));
  for (const worker of activeWorkers) {
    await cancelWorker(worker);
  }

  await insertExecutionEvent(runId, "worker_stop_requested", {
    summary: `Paused work because ${stoppedWorkerId} was stopped by the user.`,
    reason: "User stopped a worker.",
    userInitiated: true,
    stoppedWorkerId,
    cancelledWorkerIds: activeWorkers.map((worker) => worker.id),
  }, stoppedWorkerId);

  await db.insert(messages).values({
    id: randomUUID(),
    runId,
    role: "supervisor",
    kind: "clarification",
    content: USER_STOPPED_WORKER_QUESTION,
    createdAt: new Date(),
  });
  await pauseForClarifications(runId, [USER_STOPPED_WORKER_QUESTION]);
}

async function markRunRead(runId: string, run: typeof runs.$inferSelect) {
  const runMessages = await db.select({
    runId: messages.runId,
    createdAt: messages.createdAt,
  }).from(messages).where(eq(messages.runId, runId));
  const lastReadAtIso = getRunLatestUnreadTimestamp(
    {
      id: run.id,
      status: run.status,
      createdAt: run.createdAt.toISOString(),
      updatedAt: run.updatedAt.toISOString(),
    },
    runMessages.map((message) => ({
      runId: message.runId,
      createdAt: message.createdAt.toISOString(),
    })),
  );

  if (!lastReadAtIso) {
    return null;
  }

  const now = new Date();
  const lastReadAt = new Date(lastReadAtIso);
  const changedMarkers = await db.insert(conversationReadMarkers)
    .values({
      runId,
      lastReadAt,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: conversationReadMarkers.runId,
      set: {
        lastReadAt,
        updatedAt: now,
      },
      setWhere: lt(conversationReadMarkers.lastReadAt, lastReadAt),
    })
    .returning({ lastReadAt: conversationReadMarkers.lastReadAt });

  if (changedMarkers.length === 0) {
    const currentMarker = await db.select({
      lastReadAt: conversationReadMarkers.lastReadAt,
    }).from(conversationReadMarkers).where(eq(conversationReadMarkers.runId, runId)).get();
    return currentMarker?.lastReadAt.toISOString() ?? lastReadAt.toISOString();
  }

  emitNamedEvent({ kind: "conversation.read", runId, lastReadAt: lastReadAt.toISOString() });
  return lastReadAt.toISOString();
}

export const handleRunPatchRequest: OmniHttpHandler = async (request, context) => {
  let patchActionLabel = "Update";
  try {
    if (request.method !== "PATCH") {
      return Response.json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, {
        status: 405,
        headers: { allow: "PATCH" },
      });
    }

    const auth = await requireApiSession(request, {
      source: "Runs",
      action: "Update",
      enforceSameOrigin: true,
    });
    if (auth.response) {
      return auth.response;
    }

    const runId = requireRunId(context);
    const body = await request.json();
    const hasTitlePatch = body && Object.prototype.hasOwnProperty.call(body, "title");
    const hasProjectPathPatch = body && Object.prototype.hasOwnProperty.call(body, "projectPath");

    if (!hasTitlePatch && !hasProjectPathPatch) {
      return errorResponse("No supported run changes provided", {
        status: 400,
        source: "Runs",
        action: patchActionLabel,
      });
    }

    // Validate the payload before touching storage: a malformed request is
    // malformed whether or not the run exists, and answering 404 for it hides
    // the actual problem from the caller.
    const patchedTitle = hasTitlePatch ? normalizeTitle(body?.title) : null;
    if (hasTitlePatch && !patchedTitle) {
      return errorResponse("Title cannot be empty", {
        status: 400,
        source: "Runs",
        action: "Rename",
      });
    }

    const existingRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    if (!existingRun) {
      return errorResponse("Run not found", {
        status: 404,
        source: "Runs",
        action: patchActionLabel,
      });
    }

    const updates: { title?: string; projectPath?: string } = {};
    const responsePayload: Record<string, unknown> = { ok: true, runId };

    if (hasTitlePatch && patchedTitle) {
      patchActionLabel = "Rename";
      updates.title = patchedTitle;
      responsePayload.title = patchedTitle;
    }

    if (hasProjectPathPatch) {
      patchActionLabel = "Move to project";
      if (!isTerminalRunStatus(existingRun.status)) {
        return errorResponse("Only finished conversations can be moved between projects", {
          status: 409,
          source: "Runs",
          action: patchActionLabel,
          details: [`Current status: ${existingRun.status}`],
        });
      }
      const projectPath = typeof body?.projectPath === "string" ? body.projectPath.trim() : "";
      if (!projectPath) {
        return errorResponse("Project path cannot be empty", {
          status: 400,
          source: "Runs",
          action: patchActionLabel,
        });
      }
      const projectSetting = await db.select().from(settings).where(eq(settings.key, "PROJECTS")).get();
      const configuredProjectPaths = parseConfiguredProjectPaths(projectSetting?.value);
      if (!configuredProjectPaths.includes(projectPath)) {
        return errorResponse("Project is not configured", {
          status: 400,
          source: "Runs",
          action: patchActionLabel,
        });
      }
      updates.projectPath = projectPath;
      responsePayload.projectPath = projectPath;
    }

    const updatedAt = new Date();
    await db
      .update(runs)
      .set({ ...updates, updatedAt })
      .where(eq(runs.id, runId));

    if (typeof updates.projectPath === "string") {
      emitNamedEvent({
        kind: "conversation.project_moved",
        runId,
        previousProjectPath: existingRun.projectPath,
        projectPath: updates.projectPath,
      });
    }
    notifyEventStreamSubscribers();

    return Response.json(responsePayload);
  } catch (error) {
    return errorResponse(error, {
      status: 500,
      source: "Runs",
      action: patchActionLabel,
    });
  }
};

export const handleRunPostRequest: OmniHttpHandler = async (request, context) => {
  const probe = startSlowProbe(`POST /api/runs/${context.params?.id ?? "?"}`);
  let postActionLabel = "Recover conversation";
  try {
    if (request.method !== "POST") {
      probe.end();
      return Response.json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, {
        status: 405,
        headers: { allow: "POST" },
      });
    }

    const auth = await requireApiSession(request, {
      source: "Runs",
      action: "Recover conversation",
      enforceSameOrigin: true,
    });
    probe.mark("auth");
    if (auth.response) {
      probe.end();
      return auth.response;
    }

    const runId = requireRunId(context);
    const body = await request.json();
    probe.mark("body");
    const action = body?.action;
    postActionLabel = actionLabelForPostAction(action);
    const actionRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    probe.mark(`q.runLookup[action=${String(action ?? "?")}]`);
    if (!actionRun) {
      return errorResponse("Run not found", {
        status: 404,
        source: "Runs",
        action: postActionLabel,
      });
    }
    if (action === "mark_read") {
      const lastReadAt = await markRunRead(runId, actionRun);
      return Response.json({ ok: true, runId, lastReadAt });
    }

    const sessionType = normalizeSessionType(actionRun.sessionType);
    if (sessionType === "process" && action !== "archive") {
      if (action === "stop_supervisor" || action === "stop_worker") {
        const provider = getSessionProvider("process");
        return Response.json(await provider.stop({ runId, reason: "user" }));
      }
      const reason = `Action ${String(action ?? "unknown")} is not supported for process sessions.`;
      emitUnsupportedSessionAction({ runId, sessionType, action: String(action ?? "unknown"), reason });
      return errorResponse(reason, {
        status: 409,
        source: "Runs",
        action: postActionLabel,
      });
    }
    if (action === "archive") {
      const run = actionRun;
      if (!run) {
        return errorResponse("Run not found", {
          status: 404,
          source: "Runs",
          action: "Archive",
        });
      }
      if (!isArchivableRunStatus(run.status)) {
        return errorResponse("Only finished conversations can be archived", {
          status: 409,
          source: "Runs",
          action: "Archive",
          details: [`Current status: ${run.status}`],
        });
      }

      const archivedAt = new Date();
      await db.update(runs).set({
        archivedAt,
        updatedAt: archivedAt,
      }).where(eq(runs.id, runId));
      try {
        await compactRunOutputs(runId);
      } catch (error) {
        console.warn(`Failed to compact output entries for run ${runId}:`, error);
      }
      notifyEventStreamSubscribers();

      return Response.json({ ok: true, runId, archivedAt });
    }

    if (action === "stop_supervisor") {
      return runQuotaRecoveryMutation(runId, async () => {
        const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
        if (!run) {
          return errorResponse("Run not found", {
            status: 404,
            source: "Runs",
            action: "Stop supervisor",
          });
        }

        if (isSupervisorStopAlreadySettled(run.status)) {
          return Response.json({
            ok: true,
            runId,
            alreadyStopped: true,
            status: run.status,
          });
        }

        stopRunObserver(runId);

        // Persist the terminal ownership barrier while holding the same
        // per-run mutation fence used by quota recovery. A recovery callback
        // can finish before Stop or refuse after it, never interleave halfway.
        await db.update(runs).set({
          status: "cancelled",
          updatedAt: new Date(),
        }).where(eq(runs.id, runId));

        const runWorkers = await db.select().from(workers).where(eq(workers.runId, runId));
        const activeWorkers = runWorkers.filter((worker) => isActiveWorkerStatus(worker.status));
        for (const worker of activeWorkers) {
          await cancelWorker(worker);
        }

        await settleRunRecoveryAfterUserStop(runId);
        await insertExecutionEvent(runId, "supervisor_stopped", {
          summary: "Stopped supervisor and cancelled active workers.",
          reason: "User stopped the supervisor.",
          userInitiated: true,
          cancelledWorkerIds: activeWorkers.map((worker) => worker.id),
        });
        notifyEventStreamSubscribers();

        return Response.json({ ok: true, runId });
      });
    }

    if (action === "stop_worker") {
      const workerId = String(body?.workerId ?? "").trim();
      if (!workerId) {
        return errorResponse("workerId is required", {
          status: 400,
          source: "Runs",
          action: "Stop worker",
        });
      }

      return runQuotaRecoveryMutation(runId, async () => {
        const worker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
        if (!worker || worker.runId !== runId) {
          return errorResponse("Worker not found", {
            status: 404,
            source: "Runs",
            action: "Stop worker",
          });
        }

        const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
        if (run?.mode === "implementation") {
          await pauseImplementationRunAfterWorkerStop(runId, workerId);
          notifyEventStreamSubscribers();

          return Response.json({ ok: true, runId, workerId, paused: true });
        }

        await cancelWorker(worker);
        const updatedRunWorkers = await db.select().from(workers).where(eq(workers.runId, runId));
        const hasActiveWorker = updatedRunWorkers.some((candidate) => isActiveWorkerStatus(candidate.status));
        if (!hasActiveWorker) {
          await db.update(runs).set({
            status: "cancelled",
            updatedAt: new Date(),
          }).where(eq(runs.id, runId));
          await settleRunRecoveryAfterUserStop(runId);
        }
        await insertExecutionEvent(runId, "worker_cancelled", {
          summary: `Stopped ${workerId}`,
          reason: "User stopped this worker.",
          runCancelled: !hasActiveWorker,
        }, workerId);
        notifyEventStreamSubscribers();

        return Response.json({ ok: true, runId, workerId });
      });
    }

    if (action === "stop_worker_terminal") {
      const workerId = String(body?.workerId ?? "").trim();
      const terminalProcessId = String(body?.terminalProcessId ?? "").trim();
      const processId = String(body?.processId ?? "").trim();
      if (!workerId || !terminalProcessId || !processId) {
        return errorResponse("workerId, terminalProcessId, and processId are required", {
          status: 400,
          source: "Runs",
          action: "Stop worker terminal",
        });
      }

      const worker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
      if (!worker || worker.runId !== runId) {
        return errorResponse("Worker not found", {
          status: 404,
          source: "Runs",
          action: "Stop worker terminal",
        });
      }

      let alreadyStopped = false;
      try {
        await cancelAgentTerminalProcess(worker.id, processId, terminalProcessId);
      } catch (error) {
        if (!isTerminalProcessNotFoundError(error)) {
          throw error;
        }
        alreadyStopped = true;
      }

      await insertExecutionEvent(runId, "worker_terminal_cancelled", {
        summary: alreadyStopped
          ? `Terminal ${terminalProcessId} for ${workerId} was already stopped`
          : `Stopped terminal ${terminalProcessId} for ${workerId}`,
        reason: alreadyStopped
          ? "User stopped this terminal process, but it was already gone."
          : "User stopped this terminal process.",
        terminalProcessId,
        processId,
        alreadyStopped,
      }, workerId);
      notifyEventStreamSubscribers();

      return Response.json({ ok: true, runId, workerId, terminalProcessId, processId, alreadyStopped });
    }

    const targetMessageId = String(body?.targetMessageId ?? "");
    const content = typeof body?.content === "string" ? body.content : undefined;
    const manualRecovery = body?.manualRecovery === true;

    if (action !== "retry" && action !== "edit" && action !== "fork") {
      return errorResponse("Unsupported recovery action", {
        status: 400,
        source: "Runs",
        action: "Recover conversation",
      });
    }

    if (!targetMessageId) {
      return errorResponse("targetMessageId is required", {
        status: 400,
        source: "Runs",
        action: "Recover conversation",
      });
    }

    if (action === "retry" && !manualRecovery && actionRun.status === "failed" && isPermanentAccountFailure(actionRun.lastError)) {
      return errorResponse("This run cannot be auto-retried while the saved failure is an account, billing, or quota error.", {
        status: 409,
        source: "Runs",
        action: "Recover conversation",
      });
    }

    const result = await recoverRun({
      runId,
      action,
      targetMessageId,
      content,
      gitWorkspaceLaunch: readGitWorkspaceLaunch(body?.gitWorkspaceLaunch),
    });
    probe.mark("recoverRun");
    notifyEventStreamSubscribers();

    const response = Response.json({ ok: true, ...result });
    probe.end();
    return response;
  } catch (error) {
    probe.end();
    const errorMessage = error instanceof Error ? error.message : String(error);
    const status = gitWorkspaceStatus(error)
      ?? (typeof (error as { status?: unknown }).status === "number"
        ? (error as { status: number }).status
        : null)
      ?? (errorMessage.includes("must be a user message")
      || errorMessage.includes("required")
      || errorMessage.includes("direct control")
      ? 400
      : errorMessage.includes("not found")
        ? 404
        : 500);
    return errorResponse(error, {
      status,
      source: "Runs",
      action: postActionLabel,
      details: error instanceof GitWorkspaceError
        ? [
          `code: ${error.code}`,
          Object.keys(error.details).length > 0 ? `details: ${JSON.stringify(error.details)}` : null,
        ].filter((detail): detail is string => Boolean(detail))
        : undefined,
    });
  } finally {
    probe.end();
  }
};

export const handleRunDeleteRequest: OmniHttpHandler = async (request, context) => {
  let deleteFailedRunId = context.params?.id?.trim() ?? "";
  try {
    if (request.method !== "DELETE") {
      return Response.json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, {
        status: 405,
        headers: { allow: "DELETE" },
      });
    }

    const auth = await requireApiSession(request, {
      source: "Runs",
      action: "Delete",
      enforceSameOrigin: true,
    });
    if (auth.response) {
      return auth.response;
    }

    const runId = requireRunId(context);
    deleteFailedRunId = runId;
    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    if (!run) {
      return errorResponse("Run not found", {
        status: 404,
        source: "Runs",
        action: "Delete",
      });
    }

    requestConversationDeletion(runId);

    cancelSupervisorWake(runId);
    stopRunObserver(runId);

    const plan = await db.select().from(plans).where(eq(plans.id, run.planId)).get();
    const runWorkers = await db.select().from(workers).where(eq(workers.runId, runId));
    const workerIds = runWorkers.map((worker) => worker.id);
    const planRows = await db.select().from(planItems).where(eq(planItems.planId, run.planId));
    const planItemIds = planRows.map((item) => item.id);

    if (normalizeSessionType(run.sessionType) === "process") {
      await stopLiveProcessForDelete(runId);
    }

    // Abort every live turn locally before asking the agents to stop. This is
    // what makes the wait below bounded: an aborted turn's request tears down
    // immediately, so `waitForConversationBackgroundTasks` settles instead of
    // blocking on an agent that may never acknowledge its cancel.
    for (const worker of runWorkers) {
      abortWorkerTurn(worker.id, "conversation delete");
    }
    for (const worker of runWorkers) {
      try {
        await cancelAgent(worker.id);
      } catch {
        // best-effort: still remove persisted records even if bridge process is already gone
      }
    }

    // The bridge acknowledges cancellation before an in-flight worker turn
    // has necessarily finished unwinding. Keep the run and its artifact
    // streams available until every server-owned turn for this run settles.
    await waitForConversationBackgroundTasks(runId);

    if (workerIds.length > 0) {
      for (const workerId of workerIds) {
        await db.delete(creditEvents).where(eq(creditEvents.workerId, workerId));
      }
    }

    await db.delete(messages).where(eq(messages.runId, runId));
    await db.delete(clarifications).where(eq(clarifications.runId, runId));
    await deleteExecutionEventsForRun(runId);
    await db.delete(supervisorInterventions).where(eq(supervisorInterventions.runId, runId));
    await db.delete(supervisorScheduledWakes).where(eq(supervisorScheduledWakes.runId, runId));
    await db.delete(recoveryIncidents).where(eq(recoveryIncidents.runId, runId));
    await db.delete(queuedConversationMessages).where(eq(queuedConversationMessages.runId, runId));
    await db.delete(conversationReadMarkers).where(eq(conversationReadMarkers.runId, runId));
    await db.delete(workerAssignments).where(eq(workerAssignments.runId, runId));
    await db.delete(workerCredentialAllocations).where(eq(workerCredentialAllocations.runId, runId));
    await db.delete(workerTokenUsage).where(eq(workerTokenUsage.runId, runId));
    await db.delete(planningReviewFindings).where(eq(planningReviewFindings.runId, runId));
    await db.delete(planningReviewRounds).where(eq(planningReviewRounds.runId, runId));
    await db.delete(planningReviewRuns).where(eq(planningReviewRuns.runId, runId));
    await db.delete(processSessions).where(eq(processSessions.runId, runId));
    await db.delete(workers).where(eq(workers.runId, runId));
    await db.delete(workerCounters).where(eq(workerCounters.runId, runId));

    // Remove on-disk artifact streams (project-local + legacy global). Must
    // run BEFORE the runs row is deleted because the cleanup helper reads
    // `runs.projectPath` to resolve the project-local root. The DB cascade
    // only deletes `artifact_streams` rows; the JSONL/.gz files are ours.
    const artifactCleanup = await cleanupRunArtifacts(runId);
    if (artifactCleanup.errors.length > 0) {
      console.warn(`[runs.delete] artifact cleanup errors for ${runId}:`, artifactCleanup.errors);
    }

    await db.delete(runs).where(eq(runs.id, runId));

    for (const planItemId of planItemIds) {
      await deleteExecutionEventsForPlanItem(planItemId);
    }

    await db.delete(planItems).where(eq(planItems.planId, run.planId));
    await db.delete(plans).where(eq(plans.id, run.planId));

    if (plan?.path.startsWith("vibes/ad-hoc/")) {
      const absolutePlanPath = getAppDataPath(plan.path);
      if (fs.existsSync(absolutePlanPath)) {
        fs.rmSync(absolutePlanPath);
      }
    }
    emitNamedEvent({ kind: "conversation.deleted", runId });
    completeConversationDeletion(runId);
    notifyEventStreamSubscribers();

    return Response.json({ ok: true, runId });
  } catch (error) {
    if (deleteFailedRunId) {
      completeConversationDeletion(deleteFailedRunId);
    }
    const cause = error instanceof Error ? error : new Error(String(error));
    const fkMatch = /FOREIGN KEY constraint failed/i.test(cause.message);
    const blockingTable = fkMatch
      ? cause.message.match(/table[: ]\s*([a-z_]+)/i)?.[1] ?? null
      : null;
    if (deleteFailedRunId) {
      emitNamedEvent({
        kind: "conversation.delete_failed",
        runId: deleteFailedRunId,
        blockingTable,
      });
      emitNamedEvent({
        kind: "error.surfaced",
        code: fkMatch ? "conversation.delete.foreign_key" : "conversation.delete.failed",
        message: fkMatch
          ? `Could not delete conversation: a related row in ${blockingTable ?? "another table"} blocks the deletion. This is an OmniHarness bug; please report it.`
          : `Could not delete conversation: ${cause.message}`,
        surface: "toast",
        runId: deleteFailedRunId,
        cause: { name: cause.name, message: cause.message },
      });
    }
    return errorResponse(error, {
      status: fkMatch ? 409 : 500,
      source: "Runs",
      action: "Delete",
    });
  }
};
