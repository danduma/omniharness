import { recordExecutionEvent } from "@/server/events/execution-event-store";
import { asc, eq } from "drizzle-orm";
import { askAgent, getAgent, spawnAgent, type AgentRecord } from "@/server/bridge-client";
import { db } from "@/server/db";
import { executionEvents, messages, queuedConversationMessages, runs, workers } from "@/server/db/schema";
import { emitNamedEvent } from "@/server/events/named-events";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
import { normalizeRunStatus } from "@/server/runs/status";
import { readWorkerYoloModeEnabled, resolveWorkerLaunchMode } from "@/server/worker-launch-mode";
import { resolveWorkerLaunchSelection } from "@/server/workers/launch-selection";
import { readRuntimeEnvFromSettings } from "@/server/supervisor/runtime-settings";
import {
  resolveDirectRunStatusFromWorkerOutput,
  updateDirectRunStatusFromWorkerOutput,
} from "@/server/conversations/direct-run-status";
import { buildDirectWorkerPrompt } from "@/server/conversations/direct-worker-prompt";
import {
  isWorkerTurnSupersededError,
  runWorkerTurn,
  trackConversationBackgroundTask,
} from "@/server/conversations/worker-turn-gate";
import { appendAskResponseFallbackEntry } from "@/server/workers/response-fallback";
import { persistWorkerSnapshot } from "@/server/workers/snapshots";
import { writeWorkerOutputEntries } from "@/server/workers/output-store";
import { reconcileRecoveredHumanInputEntries } from "@/server/workers/human-input-entries";
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

function isCorruptResumeFileError(value: string | null | undefined) {
  return /failed to load resumed session data from file/i.test(value ?? "");
}

const INTERRUPTED_DIRECT_TURN_PROMPT = buildDirectWorkerPrompt([
  "The OmniHarness runner restarted while you were working.",
  "Resume the interrupted task now and continue any implementation, edits, tests, or other workspace changes already authorized by the user's latest request.",
  "Do not stop merely to report the restart, repeat work that is already complete, or wait for another user message.",
].join(" "));

function normalizedAgentState(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().split(":")[0]?.trim() ?? "";
}

function recoveredDirectTurnNeedsPrompt(
  run: typeof runs.$inferSelect,
  resumed: AgentRecord,
) {
  if (run.mode !== "direct" && run.mode !== "commit") {
    return false;
  }
  if (normalizeRunStatus(run.status) === "awaiting_user") {
    return false;
  }
  if ((resumed.stopReason ?? "").trim()) {
    return false;
  }
  if (resolveDirectRunStatusFromWorkerOutput({
    workerStatus: resumed.state,
    renderedOutput: resumed.renderedOutput,
    currentText: resumed.currentText,
    lastText: resumed.lastText,
    outputEntries: resumed.outputEntries,
    pendingPermissions: resumed.pendingPermissions,
    pendingElicitations: resumed.pendingElicitations,
  }) === "awaiting_user") {
    return false;
  }
  return !["working", "running", "busy", "starting", "pending", "recovering"]
    .includes(normalizedAgentState(resumed.state));
}

async function finishRecoveredDirectTurn(args: {
  run: typeof runs.$inferSelect;
  worker: typeof workers.$inferSelect;
  resumed: AgentRecord;
  incidentId: string;
}) {
  emitNamedEvent({
    kind: "worker.recovery_continuation_started",
    runId: args.run.id,
    workerId: args.worker.id,
  });
  await insertRecoveryExecutionEvent(args.run.id, args.worker.id, "recovery_continuation_started", {
    summary: `Continuing the interrupted turn for ${args.worker.id}.`,
    incidentId: args.incidentId,
  });

  try {
    const response = await askAgent(args.worker.id, INTERRUPTED_DIRECT_TURN_PROMPT);
    const snapshot = await getAgent(args.worker.id).catch(() => null);
    if (snapshot) {
      await persistWorkerSnapshot(args.worker.id, snapshot);
    }
    await appendAskResponseFallbackEntry({
      runId: args.run.id,
      workerId: args.worker.id,
      responseText: response.response,
      snapshot,
    });

    const finalWorkerStatus = snapshot?.state ?? response.state ?? "idle";
    await db.update(workers).set({
      status: finalWorkerStatus,
      updatedAt: new Date(),
    }).where(eq(workers.id, args.worker.id));
    await updateDirectRunStatusFromWorkerOutput({
      runId: args.run.id,
      workerId: args.worker.id,
      workerStatus: finalWorkerStatus,
      responseText: response.response,
      renderedOutput: snapshot?.renderedOutput,
      currentText: snapshot?.currentText,
      lastText: snapshot?.lastText,
      outputEntries: snapshot?.outputEntries,
      pendingPermissions: snapshot?.pendingPermissions,
      pendingElicitations: snapshot?.pendingElicitations,
    });
    emitNamedEvent({
      kind: "worker.recovery_continuation_completed",
      runId: args.run.id,
      workerId: args.worker.id,
    });
    await insertRecoveryExecutionEvent(args.run.id, args.worker.id, "recovery_continuation_completed", {
      summary: `Completed the recovered turn for ${args.worker.id}.`,
      incidentId: args.incidentId,
      workerState: finalWorkerStatus,
    });
    // The incident was already resolved when the session came back; the
    // continuation only reopens it if it fails outright.
  } catch (error) {
    if (isWorkerTurnSupersededError(error)) {
      emitNamedEvent({
        kind: "worker.recovery_continuation_superseded",
        runId: args.run.id,
        workerId: args.worker.id,
      });
      await insertRecoveryExecutionEvent(args.run.id, args.worker.id, "recovery_continuation_superseded", {
        summary: `Stopped the automatic continuation for ${args.worker.id} because a newer turn took over.`,
        incidentId: args.incidentId,
      });
      return;
    }
    const reason = error instanceof Error ? error.message : String(error);
    if (/\bagent is busy\b/i.test(reason)) {
      await db.update(workers).set({
        status: "working",
        updatedAt: new Date(),
      }).where(eq(workers.id, args.worker.id));
      emitNamedEvent({
        kind: "worker.recovery_continuation_completed",
        runId: args.run.id,
        workerId: args.worker.id,
      });
      return;
    }

    await setRunNeedsRecovery({ runId: args.run.id, reason });
    await db.update(workers).set({
      status: "error",
      currentText: "",
      updatedAt: new Date(),
    }).where(eq(workers.id, args.worker.id));
    await markRecoveryIncidentNeedsUser({
      incidentId: args.incidentId,
      runId: args.run.id,
      workerId: args.worker.id,
      reason,
      details: { continuationFailed: true },
    });
    emitNamedEvent({
      kind: "error.surfaced",
      code: "worker.resume.failed",
      message: reason,
      surface: "banner",
      runId: args.run.id,
      workerId: args.worker.id,
      cause: error instanceof Error ? { name: error.name, message: error.message } : null,
    });
    await insertRecoveryExecutionEvent(args.run.id, args.worker.id, "recovery_continuation_failed", {
      summary: `Could not continue the interrupted turn for ${args.worker.id}.`,
      incidentId: args.incidentId,
      reason,
    });
  } finally {
    notifyEventStreamSubscribers();
  }
}

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
  await recordExecutionEvent({
    runId,
    workerId: workerId ?? null,
    planItemId: null,
    eventType,
    details,
  });
}

async function loadRunRecoveryInputs(runId: string) {
  const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
  if (!run) {
    throw new Error("Run not found");
  }

  const [runWorkers, runMessages, runQueuedMessages] = await Promise.all([
    db.select().from(workers).where(eq(workers.runId, runId)),
    db.select().from(messages).where(eq(messages.runId, runId)).orderBy(asc(messages.createdAt), asc(messages.id)),
    db.select().from(queuedConversationMessages).where(eq(queuedConversationMessages.runId, runId)).orderBy(asc(queuedConversationMessages.createdAt), asc(queuedConversationMessages.id)),
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
  if (
    args.workerId
    && (
      args.state.kind === "lost_worker_resumable"
      || args.state.kind === "lost_worker_rerunnable"
      || args.state.kind === "needs_recovery"
      || args.state.kind === "queue_blocked"
    )
  ) {
    const worker = await db.select().from(workers).where(eq(workers.id, args.workerId)).get();
    const normalized = normalizeRunStatus(worker?.status).split(":")[0]?.trim();
    if (worker && normalized !== "lost") {
      await db.update(workers).set({
        status: "lost",
        currentText: "",
        updatedAt: new Date(),
      }).where(eq(workers.id, worker.id));
      emitNamedEvent({
        kind: "worker.status",
        runId: args.runId,
        workerId: worker.id,
        prev: worker.status,
        next: "lost",
      });
    }
  }
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
  const launchSelection = resolveWorkerLaunchSelection(args.worker, args.run);

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

  let resumed: AgentRecord;
  let recreatedFromMissingSession = false;
  try {
    resumed = await spawnAgent({
      type: args.worker.type,
      cwd: args.worker.cwd,
      name: args.worker.id,
      ...(workerMode ? { mode: workerMode } : {}),
      env: envParams,
      ...(launchSelection.accountId ? { accountId: launchSelection.accountId } : {}),
      ...(launchSelection.model ? { model: launchSelection.model } : {}),
      ...(launchSelection.effort ? { effort: launchSelection.effort } : {}),
      resumeSessionId: sessionId,
    }) as AgentRecord;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (!isCorruptResumeFileError(reason) || args.run.mode !== "implementation") {
      throw error;
    }

    await insertRecoveryExecutionEvent(args.run.id, args.worker.id, "worker_session_missing", {
      summary: `Saved bridge session for ${args.worker.id} is no longer available`,
      reason,
      sessionId,
    });
    await db.update(workers).set({
      status: "starting",
      bridgeSessionId: null,
      bridgeSessionMode: null,
      updatedAt: new Date(),
    }).where(eq(workers.id, args.worker.id));
    resumed = await spawnAgent({
      type: args.worker.type,
      cwd: args.worker.cwd,
      name: args.worker.id,
      ...(workerMode ? { mode: workerMode } : {}),
      env: envParams,
      ...(launchSelection.accountId ? { accountId: launchSelection.accountId } : {}),
      ...(launchSelection.model ? { model: launchSelection.model } : {}),
      ...(launchSelection.effort ? { effort: launchSelection.effort } : {}),
    }) as AgentRecord;
    recreatedFromMissingSession = true;
  }
  const continueInterruptedDirectTurn = recoveredDirectTurnNeedsPrompt(args.run, resumed);
  const nextRunStatus = continueInterruptedDirectTurn
    ? "running"
    : args.run.mode === "direct" || args.run.mode === "commit"
    ? resolveDirectRunStatusFromWorkerOutput({
      workerStatus: resumed.state,
      renderedOutput: resumed.renderedOutput,
      currentText: resumed.currentText,
      lastText: resumed.lastText,
      outputEntries: resumed.outputEntries,
      pendingPermissions: resumed.pendingPermissions,
      pendingElicitations: resumed.pendingElicitations,
    })
    : "running";

  if (resumed.outputEntries) {
    await writeWorkerOutputEntries(args.run.id, args.worker.id, resumed.outputEntries);
  }
  await reconcileRecoveredHumanInputEntries({
    runId: args.run.id,
    workerId: args.worker.id,
    activeElicitationRequestIds: (resumed.pendingElicitations ?? []).map((entry) => entry.requestId),
    activePermissionRequestIds: (resumed.pendingPermissions ?? []).map((entry) => entry.requestId),
    reason: "the runner restarted and the recovered runtime no longer owns this request",
  });

  await db.update(workers).set({
    status: continueInterruptedDirectTurn ? "working" : resumed.state,
    currentText: resumed.currentText,
    lastText: resumed.lastText,
    bridgeSessionId: resumed.sessionId ?? (recreatedFromMissingSession ? null : sessionId),
    bridgeSessionMode: resumed.sessionMode ?? args.worker.bridgeSessionMode ?? null,
    updatedAt: new Date(),
  }).where(eq(workers.id, args.worker.id));
  emitNamedEvent({
    kind: recreatedFromMissingSession ? "worker.recreated" : "worker.reattached",
    runId: args.run.id,
    workerId: args.worker.id,
  });
  if (recreatedFromMissingSession) {
    await insertRecoveryExecutionEvent(args.run.id, args.worker.id, "worker_session_recreated", {
      summary: `Started a fresh runtime worker for ${args.worker.id} after its saved session was rejected.`,
      rejectedSessionId: sessionId,
      newSessionId: resumed.sessionId ?? null,
      reason: "recovery_resume_missing_agent",
    });
  }
  await db.update(runs).set({
    status: nextRunStatus,
    failedAt: null,
    lastError: null,
    updatedAt: new Date(),
  }).where(eq(runs.id, args.run.id));
  // The incident is "this worker's session was lost". Restoring it is done the
  // moment the resumed agent is persisted. Any continuation turn that follows is
  // ordinary work — the worker row already says `working` and the run says
  // `running`, which is what the normal progress UI is for. Holding the incident
  // open until that turn ends left the recovery banner claiming OmniHarness was
  // still restoring the session for as long as the agent kept working, which
  // reads as a hung backend.
  await markRecoveryIncidentResolved({
    incidentId: args.incidentId,
    runId: args.run.id,
    workerId: args.worker.id,
    summary: `Resumed ${args.worker.id} from saved session.`,
    details: {
      sessionId,
      workerState: continueInterruptedDirectTurn ? "working" : resumed.state,
      ...(continueInterruptedDirectTurn ? { continuationPending: true } : {}),
    },
  });
  if (continueInterruptedDirectTurn) {
    const continuation = runWorkerTurn(args.worker.id, () => finishRecoveredDirectTurn({
      run: args.run,
      worker: args.worker,
      resumed,
      incidentId: args.incidentId,
    }));
    trackConversationBackgroundTask(continuation, { runId: args.run.id }).catch((error) => {
      process.stderr.write(
        `[recovery] interrupted turn continuation failed for ${args.worker.id}: ${error instanceof Error ? error.message : String(error)}\n`,
      );
    });
  }
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
