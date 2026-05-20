import { randomUUID } from "crypto";
import { asc, eq } from "drizzle-orm";
import { spawnAgent, type AgentRecord } from "@/server/bridge-client";
import { db } from "@/server/db";
import { executionEvents, messages, queuedConversationMessages, runs, workers } from "@/server/db/schema";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
import { normalizeRunStatus } from "@/server/runs/status";
import { readWorkerYoloModeEnabled, resolveWorkerLaunchMode } from "@/server/worker-launch-mode";
import { readRuntimeEnvFromSettings } from "@/server/supervisor/runtime-settings";
import { resolveDirectRunStatusFromWorkerOutput } from "@/server/conversations/direct-run-status";
import { writeWorkerOutputEntries } from "@/server/workers/output-store";
import {
  markRecoveryIncidentFailed,
  markRecoveryIncidentNeedsUser,
  markRecoveryIncidentRecovering,
  markRecoveryIncidentResolved,
  openRecoveryIncident,
  type RecoveryIncidentKind,
} from "./recovery-incidents";
import { computeRecoveryBackoff, decideRecoveryAction, getRecoveryPolicy } from "./recovery-policy";
import {
  classifyRunRecoveryState,
  isRecoverableAgentMissingError,
  type RecoveryLiveAgentLike,
  type RecoveryState,
} from "./recovery-state";
import { restartImplementationRunFromLatestCheckpoint, setRunNeedsRecovery } from "./recovery-actions";

function incidentKindForState(state: RecoveryState): RecoveryIncidentKind {
  if (state.kind === "quota_waiting") {
    return "quota_exhausted";
  }
  if (state.kind === "queue_blocked") {
    return "queue_blocked";
  }
  if (state.kind === "lost_worker_resumable" && state.sessionId) {
    return "session_missing";
  }
  if (state.kind === "lost_worker_rerunnable" || state.kind === "needs_recovery") {
    return "worker_lost";
  }
  return "stale_running";
}

async function insertRecoveryExecutionEvent(
  runId: string,
  workerId: string | null | undefined,
  eventType: string,
  details: Record<string, unknown>,
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

async function loadRunRecoveryInputs(runId: string) {
  const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
  if (!run) {
    throw new Error("Run not found");
  }

  const [runWorkers, runMessages, runQueuedMessages] = await Promise.all([
    db.select().from(workers).where(eq(workers.runId, runId)),
    db.select().from(messages).where(eq(messages.runId, runId)).orderBy(asc(messages.createdAt)),
    db.select().from(queuedConversationMessages).where(eq(queuedConversationMessages.runId, runId)).orderBy(asc(queuedConversationMessages.createdAt)),
  ]);

  return { run, runWorkers, runMessages, runQueuedMessages };
}

async function markNeedsUser(args: {
  incidentId: string;
  runId: string;
  workerId?: string | null;
  reason: string;
  state: RecoveryState;
}) {
  await setRunNeedsRecovery({ runId: args.runId, reason: args.reason });
  await markRecoveryIncidentNeedsUser({
    incidentId: args.incidentId,
    runId: args.runId,
    workerId: args.workerId,
    reason: args.reason,
    details: {
      recoveryState: args.state.kind,
      recommendedAction: args.state.recommendedAction,
    },
  });
}

async function recordRecoveryPausedForUser(args: {
  runId: string;
  workerId?: string | null;
  state: RecoveryState;
  source?: string;
}) {
  const existing = await db.select().from(executionEvents).where(eq(executionEvents.runId, args.runId));
  const alreadyRecorded = existing.some((event) => (
    event.eventType === "recovery_paused_for_user"
    && event.workerId === (args.workerId ?? null)
  ));
  if (alreadyRecorded) {
    return;
  }

  await insertRecoveryExecutionEvent(args.runId, args.workerId, "recovery_paused_for_user", {
    summary: "Skipped automatic recovery because the run is awaiting user input.",
    source: args.source ?? "reconciler",
    recoveryState: args.state.kind,
    recommendedAction: args.state.recommendedAction,
  });
}

async function resumeSavedWorkerSession(args: {
  run: typeof runs.$inferSelect;
  worker: typeof workers.$inferSelect;
  state: RecoveryState;
  incidentId: string;
}) {
  const sessionId = args.state.sessionId || args.worker.bridgeSessionId;
  if (!sessionId) {
    throw new Error("No saved worker session is available");
  }
  const yoloModeEnabled = await readWorkerYoloModeEnabled();
  const workerMode = resolveWorkerLaunchMode(args.worker.bridgeSessionMode, yoloModeEnabled);
  const { env: envParams } = await readRuntimeEnvFromSettings();

  await markRecoveryIncidentRecovering({
    incidentId: args.incidentId,
    runId: args.run.id,
    workerId: args.worker.id,
    decision: "resume_session",
    details: { sessionId },
  });
  await insertRecoveryExecutionEvent(args.run.id, args.worker.id, "recovery_auto_resume_started", {
    summary: `Resuming ${args.worker.id} from saved session.`,
    incidentId: args.incidentId,
    sessionId,
  });
  await db.update(workers).set({
    status: "recovering",
    updatedAt: new Date(),
  }).where(eq(workers.id, args.worker.id));

  const resumed = await spawnAgent({
    type: args.worker.type,
    cwd: args.worker.cwd,
    name: args.worker.id,
    ...(workerMode ? { mode: workerMode } : {}),
    env: envParams,
    ...(args.run.preferredWorkerModel ? { model: args.run.preferredWorkerModel } : {}),
    ...(args.run.preferredWorkerEffort ? { effort: args.run.preferredWorkerEffort } : {}),
    resumeSessionId: sessionId,
  }) as AgentRecord;
  const nextRunStatus = args.run.mode === "direct"
    ? resolveDirectRunStatusFromWorkerOutput({
      renderedOutput: resumed.renderedOutput,
      currentText: resumed.currentText,
      lastText: resumed.lastText,
      outputEntries: resumed.outputEntries,
    })
    : "running";

  if (resumed.outputEntries) {
    await writeWorkerOutputEntries(args.run.id, args.worker.id, resumed.outputEntries);
  }

  await db.update(workers).set({
    status: resumed.state,
    currentText: resumed.currentText,
    lastText: resumed.lastText,
    bridgeSessionId: resumed.sessionId ?? sessionId,
    bridgeSessionMode: resumed.sessionMode ?? args.worker.bridgeSessionMode ?? null,
    updatedAt: new Date(),
  }).where(eq(workers.id, args.worker.id));
  await db.update(runs).set({
    status: nextRunStatus,
    failedAt: null,
    lastError: null,
    updatedAt: new Date(),
  }).where(eq(runs.id, args.run.id));
  await markRecoveryIncidentResolved({
    incidentId: args.incidentId,
    runId: args.run.id,
    workerId: args.worker.id,
    summary: `Resumed ${args.worker.id} from saved session.`,
    details: {
      sessionId,
      workerState: resumed.state,
    },
  });
  return { action: "resume_session" as const, runId: args.run.id, workerId: args.worker.id };
}

async function restartFromCheckpoint(args: {
  run: typeof runs.$inferSelect;
  workerId?: string | null;
  state: RecoveryState;
  incidentId: string;
  preserveQueuedMessages: boolean;
}) {
  await markRecoveryIncidentRecovering({
    incidentId: args.incidentId,
    runId: args.run.id,
    workerId: args.workerId,
    decision: "restart_from_checkpoint",
    details: {
      queuedMessageId: args.state.queuedMessageId ?? null,
      preserveQueuedMessages: args.preserveQueuedMessages,
    },
  });
  await insertRecoveryExecutionEvent(args.run.id, args.workerId, "recovery_auto_restart_started", {
    summary: "Restarting implementation run from latest user checkpoint.",
    incidentId: args.incidentId,
    queuedMessageId: args.state.queuedMessageId ?? null,
  });
  await db.update(runs).set({
    status: "recovering",
    updatedAt: new Date(),
  }).where(eq(runs.id, args.run.id));

  const result = await restartImplementationRunFromLatestCheckpoint({
    runId: args.run.id,
    workerId: args.workerId,
    preserveQueuedMessages: args.preserveQueuedMessages,
  });
  await markRecoveryIncidentResolved({
    incidentId: args.incidentId,
    runId: args.run.id,
    workerId: args.workerId,
    summary: "Restarted implementation run from latest user checkpoint.",
    details: result,
  });
  return { action: "restart_from_checkpoint" as const, ...result };
}

export async function reconcileRunRecovery(args: {
  runId: string;
  liveAgents: RecoveryLiveAgentLike[];
  force?: boolean;
  source?: string;
}) {
  const { run, runWorkers, runMessages, runQueuedMessages } = await loadRunRecoveryInputs(args.runId);
  const state = classifyRunRecoveryState({
    run,
    workers: runWorkers,
    liveAgents: args.liveAgents,
    messages: runMessages,
    queuedMessages: runQueuedMessages,
  });

  if (state.kind === "healthy" || state.kind === "recovering") {
    return { action: "none" as const, runId: run.id, recoveryState: state };
  }

  if (state.kind === "needs_recovery" && run.status === "needs_recovery" && !args.force) {
    return { action: "needs_user" as const, runId: run.id, recoveryState: state };
  }

  if (run.mode === "implementation" && normalizeRunStatus(run.status) === "awaiting_user") {
    await recordRecoveryPausedForUser({
      runId: run.id,
      workerId: state.workerId,
      state,
      source: args.source,
    });
    notifyEventStreamSubscribers();
    return { action: "none" as const, runId: run.id, recoveryState: state };
  }

  const incident = await openRecoveryIncident({
    runId: run.id,
    workerId: state.workerId,
    queuedMessageId: state.queuedMessageId,
    kind: incidentKindForState(state),
    lastError: state.reason ?? null,
    details: {
      source: args.source ?? "reconciler",
      recoveryState: state.kind,
      recommendedAction: state.recommendedAction,
      reason: state.reason ?? null,
    },
  });
  const policy = await getRecoveryPolicy();
  const decision = decideRecoveryAction({
    runMode: run.mode,
    recoveryState: state,
    policy,
    autoAttemptCount: incident.autoAttemptCount,
    force: args.force,
  });
  if (decision.action === "needs_user") {
    await markNeedsUser({
      incidentId: incident.id,
      runId: run.id,
      workerId: state.workerId,
      reason: decision.reason,
      state,
    });
    notifyEventStreamSubscribers();
    return { action: "needs_user" as const, runId: run.id, recoveryState: state };
  }

  if (decision.action === "wait_for_quota_reset") {
    return {
      action: "wait_for_quota_reset" as const,
      runId: run.id,
      recoveryState: state,
      resumeAt: decision.resumeAt,
    };
  }

  const nextAttemptAt = incident.autoAttemptCount > 0 && !args.force
    ? computeRecoveryBackoff({
      policy,
      attemptCount: incident.autoAttemptCount,
      nowMs: incident.updatedAt.getTime(),
    })
    : null;
  if (nextAttemptAt && nextAttemptAt.getTime() > Date.now()) {
    await insertRecoveryExecutionEvent(run.id, state.workerId, "recovery_backoff_scheduled", {
      summary: "Recovery is waiting for its retry backoff window.",
      incidentId: incident.id,
      nextAttemptAt: nextAttemptAt.toISOString(),
    });
    return { action: "wait_for_backoff" as const, runId: run.id, recoveryState: state, nextAttemptAt };
  }

  try {
    if (decision.action === "resume_session") {
      const worker = runWorkers.find((candidate) => candidate.id === state.workerId);
      if (!worker) {
        throw new Error("Recoverable worker not found");
      }
      const result = await resumeSavedWorkerSession({ run, worker, state, incidentId: incident.id });
      notifyEventStreamSubscribers();
      return { ...result, recoveryState: state };
    }

    if (decision.action === "restart_from_checkpoint") {
      const result = await restartFromCheckpoint({
        run,
        workerId: state.workerId,
        state,
        incidentId: incident.id,
        preserveQueuedMessages: policy.preserveQueuedMessages,
      });
      notifyEventStreamSubscribers();
      return { ...result, recoveryState: state };
    }

    if (decision.action === "mark_failed") {
      await markRecoveryIncidentFailed({
        incidentId: incident.id,
        runId: run.id,
        workerId: state.workerId,
        reason: decision.reason,
        details: { recoveryState: state.kind },
      });
      notifyEventStreamSubscribers();
      return { action: "failed" as const, runId: run.id, recoveryState: state };
    }

    return { action: "none" as const, runId: run.id, recoveryState: state };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (
      isRecoverableAgentMissingError(reason)
      && state.kind === "lost_worker_resumable"
      && run.mode === "implementation"
      && policy.restartFromCheckpointWhenSessionMissing
    ) {
      try {
        const restartResult = await restartFromCheckpoint({
          run,
          workerId: state.workerId,
          state: { ...state, kind: "lost_worker_rerunnable", sessionId: null },
          incidentId: incident.id,
          preserveQueuedMessages: policy.preserveQueuedMessages,
        });
        notifyEventStreamSubscribers();
        return { ...restartResult, recoveryState: state };
      } catch (restartError) {
        const restartReason = restartError instanceof Error ? restartError.message : String(restartError);
        await markNeedsUser({
          incidentId: incident.id,
          runId: run.id,
          workerId: state.workerId,
          reason: restartReason,
          state,
        });
        notifyEventStreamSubscribers();
        return { action: "needs_user" as const, runId: run.id, recoveryState: state };
      }
    }

    await markNeedsUser({
      incidentId: incident.id,
      runId: run.id,
      workerId: state.workerId,
      reason,
      state,
    });
    notifyEventStreamSubscribers();
    return { action: "needs_user" as const, runId: run.id, recoveryState: state };
  }
}
