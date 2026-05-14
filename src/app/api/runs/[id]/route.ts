import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import fs from "fs";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { cancelAgent, cancelAgentTerminalProcess } from "@/server/bridge-client";
import { errorResponse } from "@/server/api-errors";
import { recoverRun } from "@/server/runs/recovery";
import { stopRunObserver } from "@/server/supervisor/observer";
import { cancelSupervisorWake } from "@/server/supervisor/wake";
import { clearSupervisorWakeLease } from "@/server/supervisor/lease";
import { getAppDataPath } from "@/server/app-root";
import { requireApiSession } from "@/server/auth/guards";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
import { GitWorkspaceError } from "@/server/git/workspaces";
import { archiveRunOutputs } from "@/server/workers/output-store";
import { pauseForClarifications } from "@/server/clarifications/loop";
import { isArchivableRunStatus } from "@/server/runs/status";
import {
  plans,
  runs,
  messages,
  workers,
  clarifications,
  planItems,
  executionEvents,
  supervisorInterventions,
  queuedConversationMessages,
  recoveryIncidents,
  supervisorScheduledWakes,
  creditEvents,
  workerCounters,
  workerAssignments,
} from "@/server/db/schema";

function normalizeTitle(input: unknown) {
  const title = String(input ?? "").trim().replace(/\s+/g, " ");
  return title;
}

function normalizeWorkerStatus(status: string | null | undefined) {
  return (status ?? "").trim().toLowerCase().split(":")[0]?.trim() ?? "";
}

function isActiveWorkerStatus(status: string | null | undefined) {
  return ["starting", "working", "idle", "stuck"].includes(normalizeWorkerStatus(status));
}

function isSupervisorStopAlreadySettled(status: string | null | undefined) {
  return normalizeWorkerStatus(status) !== "running";
}

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

async function insertExecutionEvent(
  runId: string,
  eventType: string,
  details: Record<string, unknown>,
  workerId?: string | null,
) {
  await db.insert(executionEvents).values({
    id: randomUUID(),
    runId,
    workerId: workerId ?? null,
    planItemId: null,
    eventType,
    details: JSON.stringify(details),
    createdAt: new Date(),
  });
}

async function cancelWorker(worker: typeof workers.$inferSelect) {
  void cancelAgent(worker.id).catch(() => {
    // best effort: the bridge process may already be gone or wedged
  });

  await db.update(workers).set({
    status: "cancelled",
    updatedAt: new Date(),
  }).where(eq(workers.id, worker.id));
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiSession(req, {
      source: "Runs",
      action: "Rename",
      enforceSameOrigin: true,
    });
    if (auth.response) {
      return auth.response;
    }

    const { id: runId } = await params;
    const body = await req.json();
    const title = normalizeTitle(body?.title);

    if (!title) {
      return errorResponse("Title cannot be empty", {
        status: 400,
        source: "Runs",
        action: "Rename",
      });
    }

    await db
      .update(runs)
      .set({ title, updatedAt: new Date() })
      .where(eq(runs.id, runId));
    notifyEventStreamSubscribers();

    return NextResponse.json({ ok: true, runId, title });
  } catch (error: unknown) {
    return errorResponse(error, {
      status: 500,
      source: "Runs",
      action: "Rename",
    });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let postActionLabel = "Recover conversation";
  try {
    const auth = await requireApiSession(req, {
      source: "Runs",
      action: "Recover conversation",
      enforceSameOrigin: true,
    });
    if (auth.response) {
      return auth.response;
    }

    const { id: runId } = await params;
    const body = await req.json();
    const action = body?.action;
    postActionLabel = actionLabelForPostAction(action);
    if (action === "archive") {
      const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
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
        await archiveRunOutputs(runId);
      } catch (error) {
        console.warn(`Failed to zip output entries for run ${runId}:`, error);
      }
      notifyEventStreamSubscribers();

      return NextResponse.json({ ok: true, runId, archivedAt });
    }

    if (action === "stop_supervisor") {
      const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
      if (!run) {
        return errorResponse("Run not found", {
          status: 404,
          source: "Runs",
          action: "Stop supervisor",
        });
      }

      if (isSupervisorStopAlreadySettled(run.status)) {
        return NextResponse.json({
          ok: true,
          runId,
          alreadyStopped: true,
          status: run.status,
        });
      }

      cancelSupervisorWake(runId);
      stopRunObserver(runId);
      await clearSupervisorWakeLease(runId);

      const runWorkers = await db.select().from(workers).where(eq(workers.runId, runId));
      const activeWorkers = runWorkers.filter((worker) => isActiveWorkerStatus(worker.status));
      for (const worker of activeWorkers) {
        await cancelWorker(worker);
      }

      await db.update(runs).set({
        status: "cancelled",
        updatedAt: new Date(),
      }).where(eq(runs.id, runId));
      await insertExecutionEvent(runId, "supervisor_stopped", {
        summary: "Stopped supervisor and cancelled active workers.",
        reason: "User stopped the supervisor.",
        userInitiated: true,
        cancelledWorkerIds: activeWorkers.map((worker) => worker.id),
      });
      notifyEventStreamSubscribers();

      return NextResponse.json({ ok: true, runId });
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

        return NextResponse.json({ ok: true, runId, workerId, paused: true });
      }

      await cancelWorker(worker);
      const updatedRunWorkers = await db.select().from(workers).where(eq(workers.runId, runId));
      const hasActiveWorker = updatedRunWorkers.some((candidate) => isActiveWorkerStatus(candidate.status));
      if (!hasActiveWorker) {
        await db.update(runs).set({
          status: "cancelled",
          updatedAt: new Date(),
        }).where(eq(runs.id, runId));
      }
      await insertExecutionEvent(runId, "worker_cancelled", {
        summary: `Stopped ${workerId}`,
        reason: "User stopped this worker.",
        runCancelled: !hasActiveWorker,
      }, workerId);
      notifyEventStreamSubscribers();

      return NextResponse.json({ ok: true, runId, workerId });
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

      return NextResponse.json({ ok: true, runId, workerId, terminalProcessId, processId, alreadyStopped });
    }

    const targetMessageId = String(body?.targetMessageId ?? "");
    const content = typeof body?.content === "string" ? body.content : undefined;

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

    const result = await recoverRun({
      runId,
      action,
      targetMessageId,
      content,
      gitWorkspaceLaunch: readGitWorkspaceLaunch(body?.gitWorkspaceLaunch),
    });
    notifyEventStreamSubscribers();

    return NextResponse.json({ ok: true, ...result });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const status = gitWorkspaceStatus(error)
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
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiSession(req, {
      source: "Runs",
      action: "Delete",
      enforceSameOrigin: true,
    });
    if (auth.response) {
      return auth.response;
    }

    const { id: runId } = await params;
    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    if (!run) {
      return errorResponse("Run not found", {
        status: 404,
        source: "Runs",
        action: "Delete",
      });
    }

    cancelSupervisorWake(runId);
    stopRunObserver(runId);

    const plan = await db.select().from(plans).where(eq(plans.id, run.planId)).get();
    const runWorkers = await db.select().from(workers).where(eq(workers.runId, runId));
    const workerIds = runWorkers.map((worker) => worker.id);
    const planRows = await db.select().from(planItems).where(eq(planItems.planId, run.planId));
    const planItemIds = planRows.map((item) => item.id);

    for (const worker of runWorkers) {
      try {
        await cancelAgent(worker.id);
      } catch {
        // best-effort: still remove persisted records even if bridge process is already gone
      }
    }

    if (workerIds.length > 0) {
      for (const workerId of workerIds) {
        await db.delete(creditEvents).where(eq(creditEvents.workerId, workerId));
      }
    }

    await db.delete(messages).where(eq(messages.runId, runId));
    await db.delete(clarifications).where(eq(clarifications.runId, runId));
    await db.delete(executionEvents).where(eq(executionEvents.runId, runId));
    await db.delete(supervisorInterventions).where(eq(supervisorInterventions.runId, runId));
    await db.delete(supervisorScheduledWakes).where(eq(supervisorScheduledWakes.runId, runId));
    await db.delete(recoveryIncidents).where(eq(recoveryIncidents.runId, runId));
    await db.delete(queuedConversationMessages).where(eq(queuedConversationMessages.runId, runId));
    await db.delete(workerAssignments).where(eq(workerAssignments.runId, runId));
    await db.delete(workers).where(eq(workers.runId, runId));
    await db.delete(workerCounters).where(eq(workerCounters.runId, runId));
    await db.delete(runs).where(eq(runs.id, runId));

    for (const planItemId of planItemIds) {
      await db.delete(executionEvents).where(eq(executionEvents.planItemId, planItemId));
    }

    await db.delete(planItems).where(eq(planItems.planId, run.planId));
    await db.delete(plans).where(eq(plans.id, run.planId));

    if (plan?.path.startsWith("vibes/ad-hoc/")) {
      const absolutePlanPath = getAppDataPath(plan.path);
      if (fs.existsSync(absolutePlanPath)) {
        fs.rmSync(absolutePlanPath);
      }
    }
    notifyEventStreamSubscribers();

    return NextResponse.json({ ok: true, runId });
  } catch (error: unknown) {
    return errorResponse(error, {
      status: 500,
      source: "Runs",
      action: "Delete",
    });
  }
}
