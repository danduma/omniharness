import { recordExecutionEvent } from "@/server/events/execution-event-store";
import { and, asc, eq, inArray } from "drizzle-orm";
import { askAgent, getAgent, spawnAgent, type AgentRecord } from "@/server/bridge-client";
import { db } from "@/server/db";
import { executionEvents, messages, queuedConversationMessages, recoveryIncidents, runs, workers } from "@/server/db/schema";
import { emitNamedEvent } from "@/server/events/named-events";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
import { normalizeRunStatus } from "@/server/runs/status";
import { readWorkerYoloModeEnabled, resolveWorkerLaunchMode } from "@/server/worker-launch-mode";
import { resolveWorkerLaunchSelection } from "@/server/workers/launch-selection";
import { readWorkerAllocatedAccountId } from "@/server/workers/allocated-account";
import { readRuntimeEnvFromSettings } from "@/server/supervisor/runtime-settings";
import {
  resolveDirectRunStatusFromWorkerOutput,
  updateDirectRunStatusFromWorkerOutput,
} from "@/server/conversations/direct-run-status";
import { buildDirectWorkerPrompt } from "@/server/conversations/direct-worker-prompt";
import {
  isWorkerTurnSupersededError,
  isWorkerTurnGenerationCurrent,
  runWorkerTurn,
  trackConversationBackgroundTask,
} from "@/server/conversations/worker-turn-gate";
import { appendAskResponseFallbackEntry } from "@/server/workers/response-fallback";
import {
  isRejectedSavedSessionErrorMessage,
  materializeProviderSessionFromWorkerStream,
} from "@/server/workers/session-recovery";
import { persistWorkerSnapshot } from "@/server/workers/snapshots";
import { withWorkerOutputWriteFence, writeWorkerOutputEntries } from "@/server/workers/output-store";
import { reconcileRecoveredHumanInputEntries } from "@/server/workers/human-input-entries";
import { assertRunNotHandoffFenced } from "@/server/handoff/fence";
import { runQuotaRecoveryMutation } from "@/server/quota/recovery-mutation";
import {
  isConcurrentAgentStartError,
  waitForConcurrentAgentStart,
} from "@/server/workers/runtime-agent-adoption";
import {
  markRecoveryIncidentFailed,
  markRecoveryIncidentNeedsUser,
  markRecoveryIncidentRecovering,
  markRecoveryIncidentResolved,
  openRecoveryIncident,
  resolveRecoveryIncidentsAfterHealthyTurn,
  type RecoveryIncidentKind,
} from "./recovery-incidents";
import { computeRecoveryBackoff, decideRecoveryAction, getRecoveryPolicy } from "./recovery-policy";
import {
  classifyRunRecoveryState,
  isRecoverableAgentMissingError,
  type RecoveryLiveAgentLike,
  type RecoveryState,
} from "./recovery-state";
import {
  requeueRecoverableQueuedMessages,
  restartImplementationRunFromLatestCheckpoint,
  setRunNeedsRecovery,
} from "./recovery-actions";

function isCorruptResumeFileError(value: string | null | undefined) {
  return /failed to load resumed session data from file/i.test(value ?? "");
}

async function spawnOrAdoptRuntimeAgent(args: {
  workerId: string;
  spawn: () => Promise<AgentRecord>;
  expectedTurnGeneration?: number;
}) {
  const expectedTurnGeneration = args.expectedTurnGeneration;
  const assertCurrent = expectedTurnGeneration === undefined
    ? undefined
    : async () => {
        if (!await isWorkerTurnGenerationCurrent(args.workerId, expectedTurnGeneration)) {
          throw new Error("Worker turn was superseded by a newer worker turn");
        }
      };
  try {
    const spawned = await args.spawn();
    await assertCurrent?.();
    return spawned;
  } catch (error) {
    if (!isConcurrentAgentStartError(error, args.workerId)) {
      throw error;
    }
    return waitForConcurrentAgentStart({
      workerId: args.workerId,
      getAgent: (workerId) => getAgent(workerId, { retryIndefinitely: false }),
      ...(assertCurrent ? { assertCurrent } : {}),
    });
  }
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
  const expectedTurnGeneration = args.worker.turnGeneration;
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
    if (!await isWorkerTurnGenerationCurrent(args.worker.id, expectedTurnGeneration)) {
      throw new Error("Worker turn was superseded by a newer worker turn");
    }
    const response = await askAgent(args.worker.id, INTERRUPTED_DIRECT_TURN_PROMPT);
    const snapshot = await getAgent(args.worker.id).catch(() => null);
    if (snapshot) {
      await persistWorkerSnapshot(args.worker.id, snapshot, { expectedTurnGeneration });
    }
    await appendAskResponseFallbackEntry({
      runId: args.run.id,
      workerId: args.worker.id,
      responseText: response.response,
      snapshot,
      expectedTurnGeneration,
    });

    const finalWorkerStatus = snapshot?.state ?? response.state ?? "idle";
    const workerUpdated = await db.update(workers).set({
      status: finalWorkerStatus,
      updatedAt: new Date(),
    }).where(and(
      eq(workers.id, args.worker.id),
      eq(workers.turnGeneration, expectedTurnGeneration),
    )).returning({ id: workers.id }).get();
    if (!workerUpdated) {
      throw new Error("Worker turn was superseded by a newer worker turn");
    }
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
    if (
      isWorkerTurnSupersededError(error)
      || !await isWorkerTurnGenerationCurrent(args.worker.id, expectedTurnGeneration)
    ) {
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
      const busyWorkerRetained = await db.update(workers).set({
        status: "working",
        updatedAt: new Date(),
      }).where(and(
        eq(workers.id, args.worker.id),
        eq(workers.turnGeneration, expectedTurnGeneration),
      )).returning({ id: workers.id }).get();
      if (!busyWorkerRetained) {
        return;
      }
      emitNamedEvent({
        kind: "worker.recovery_continuation_completed",
        runId: args.run.id,
        workerId: args.worker.id,
      });
      return;
    }

    await withWorkerOutputWriteFence(args.run.id, args.worker.id, async () => {
      const failedWorker = await db.update(workers).set({
        status: "error",
        currentText: "",
        updatedAt: new Date(),
      }).where(and(
        eq(workers.id, args.worker.id),
        eq(workers.turnGeneration, expectedTurnGeneration),
      )).returning({ id: workers.id }).get();
      if (!failedWorker) {
        return;
      }
      await setRunNeedsRecovery({ runId: args.run.id, reason });
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
  const expectedTurnGeneration = args.worker.turnGeneration;
  const sessionId = args.state.sessionId || args.worker.bridgeSessionId;
  if (!sessionId) {
    throw new Error("No saved worker session is available");
  }
  const yoloModeEnabled = await readWorkerYoloModeEnabled();
  const workerMode = resolveWorkerLaunchMode(args.worker.bridgeSessionMode, yoloModeEnabled);
  const { env: envParams } = await readRuntimeEnvFromSettings();
  const launchSelection = resolveWorkerLaunchSelection(args.worker, args.run, {
    accountId: await readWorkerAllocatedAccountId(args.worker.id),
  });

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
  const recoveryClaimed = await db.update(workers).set({
    status: "recovering",
    updatedAt: new Date(),
  }).where(and(
    eq(workers.id, args.worker.id),
    eq(workers.turnGeneration, expectedTurnGeneration),
  )).returning({ id: workers.id }).get();
  if (!recoveryClaimed) {
    return { action: "none" as const, runId: args.run.id, workerId: args.worker.id };
  }

  let resumed: AgentRecord;
  let recreatedFromMissingSession = false;
  try {
    resumed = await spawnOrAdoptRuntimeAgent({
      workerId: args.worker.id,
      expectedTurnGeneration,
      spawn: () => spawnAgent({
        type: args.worker.type,
        cwd: args.worker.cwd,
        name: args.worker.id,
        ...(workerMode ? { mode: workerMode } : {}),
        env: envParams,
        ...(launchSelection.accountId ? { accountId: launchSelection.accountId } : {}),
        ...(launchSelection.model ? { model: launchSelection.model } : {}),
        ...(launchSelection.effort ? { effort: launchSelection.effort } : {}),
        resumeSessionId: sessionId,
      }) as Promise<AgentRecord>,
    });
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
    const recreationClaimed = await db.update(workers).set({
      status: "starting",
      bridgeSessionId: null,
      bridgeSessionMode: null,
      updatedAt: new Date(),
    }).where(and(
      eq(workers.id, args.worker.id),
      eq(workers.turnGeneration, expectedTurnGeneration),
    )).returning({ id: workers.id }).get();
    if (!recreationClaimed) {
      return { action: "none" as const, runId: args.run.id, workerId: args.worker.id };
    }
    resumed = await spawnOrAdoptRuntimeAgent({
      workerId: args.worker.id,
      expectedTurnGeneration,
      spawn: () => spawnAgent({
        type: args.worker.type,
        cwd: args.worker.cwd,
        name: args.worker.id,
        ...(workerMode ? { mode: workerMode } : {}),
        env: envParams,
        ...(launchSelection.accountId ? { accountId: launchSelection.accountId } : {}),
        ...(launchSelection.model ? { model: launchSelection.model } : {}),
        ...(launchSelection.effort ? { effort: launchSelection.effort } : {}),
      }) as Promise<AgentRecord>,
    });
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
    const outputPersisted = await writeWorkerOutputEntries(
      args.run.id,
      args.worker.id,
      resumed.outputEntries,
      { expectedTurnGeneration },
    );
    if (!outputPersisted) {
      return { action: "none" as const, runId: args.run.id, workerId: args.worker.id };
    }
  }
  await reconcileRecoveredHumanInputEntries({
    runId: args.run.id,
    workerId: args.worker.id,
    activeElicitationRequestIds: (resumed.pendingElicitations ?? []).map((entry) => entry.requestId),
    activePermissionRequestIds: (resumed.pendingPermissions ?? []).map((entry) => entry.requestId),
    reason: "the runner restarted and the recovered runtime no longer owns this request",
    expectedTurnGeneration,
  });

  const recoveryPersisted = await withWorkerOutputWriteFence(args.run.id, args.worker.id, async () => {
    const workerUpdated = await db.update(workers).set({
      status: continueInterruptedDirectTurn ? "working" : resumed.state,
      currentText: resumed.currentText,
      lastText: resumed.lastText,
      bridgeSessionId: resumed.sessionId ?? (recreatedFromMissingSession ? null : sessionId),
      bridgeSessionMode: resumed.sessionMode ?? args.worker.bridgeSessionMode ?? null,
      updatedAt: new Date(),
    }).where(and(
      eq(workers.id, args.worker.id),
      eq(workers.turnGeneration, expectedTurnGeneration),
    )).returning({ id: workers.id }).get();
    if (!workerUpdated) {
      return false;
    }

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
    // `running`, which is what the normal progress UI is for.
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
    // Settle the worker's *other* unsettled incidents too. `openRecoveryIncident`
    // keys on (run, kind, worker, queuedMessageId), so the same worker failing
    // twice with different queued-message context produces two rows — and this
    // path used to resolve only the one it opened. A restored session is proof
    // about the worker, not about one row, so an earlier `needs_user` incident
    // survived the resume that disproved it and kept the recovery banner up over
    // a healthy agent until some unrelated status transition swept it.
    await resolveRecoveryIncidentsAfterHealthyTurn({
      runId: args.run.id,
      workerId: args.worker.id,
      summary: `Resumed ${args.worker.id} from saved session.`,
      reason: "worker_session_resumed",
    });
    return true;
  });
  if (!recoveryPersisted) {
    return { action: "none" as const, runId: args.run.id, workerId: args.worker.id };
  }
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

/**
 * Replace a direct worker whose runtime agent is gone and no saved session can
 * bring it back, then let the blocked queued message drain into the fresh one.
 *
 * Without this a direct run had no recovery action at all once its session was
 * unusable — `queue_blocked` resolved to `needs_user`, and the Resume button
 * that `needs_user` advertises re-entered the same branch and changed nothing.
 */
async function restartDirectWorker(args: {
  run: typeof runs.$inferSelect;
  worker: typeof workers.$inferSelect;
  state: RecoveryState;
  incidentId: string;
  preserveQueuedMessages: boolean;
}) {
  const rejectedSessionId = args.worker.bridgeSessionId?.trim() || null;
  await markRecoveryIncidentRecovering({
    incidentId: args.incidentId,
    runId: args.run.id,
    workerId: args.worker.id,
    decision: "restart_direct_worker",
    details: {
      queuedMessageId: args.state.queuedMessageId ?? null,
      rejectedSessionId,
    },
  });
  await insertRecoveryExecutionEvent(args.run.id, args.worker.id, "recovery_direct_restart_started", {
    summary: `Starting a fresh direct worker for ${args.worker.id}; its saved session cannot be resumed.`,
    incidentId: args.incidentId,
    queuedMessageId: args.state.queuedMessageId ?? null,
    rejectedSessionId,
  });

  const yoloModeEnabled = await readWorkerYoloModeEnabled();
  const workerMode = resolveWorkerLaunchMode(args.worker.bridgeSessionMode, yoloModeEnabled);
  const { env: envParams } = await readRuntimeEnvFromSettings();
  const launchSelection = resolveWorkerLaunchSelection(args.worker, args.run, {
    accountId: await readWorkerAllocatedAccountId(args.worker.id),
  });
  const spawnParams = {
    type: args.worker.type,
    cwd: args.worker.cwd,
    name: args.worker.id,
    ...(workerMode ? { mode: workerMode } : {}),
    env: envParams,
    ...(launchSelection.accountId ? { accountId: launchSelection.accountId } : {}),
    ...(launchSelection.model ? { model: launchSelection.model } : {}),
    ...(launchSelection.effort ? { effort: launchSelection.effort } : {}),
  };

  // Before settling for an amnesiac worker, try to rebuild the provider session
  // file from the transcript OmniHarness already has on disk. A replacement that
  // remembers the conversation is worth a lot more than one that does not.
  let spawned: AgentRecord | null = null;
  if (rejectedSessionId) {
    const materialized = await materializeProviderSessionFromWorkerStream({
      type: args.worker.type,
      runId: args.run.id,
      workerId: args.worker.id,
      sessionId: rejectedSessionId,
      cwd: args.worker.cwd,
      env: envParams,
    }).catch(() => null);
    if (materialized) {
      await insertRecoveryExecutionEvent(args.run.id, args.worker.id, "worker_session_materialized", {
        summary: `Rebuilt ${materialized.provider} session ${rejectedSessionId} from the saved OmniHarness transcript.`,
        incidentId: args.incidentId,
        provider: materialized.provider,
        sessionId: rejectedSessionId,
        messageCount: materialized.messageCount,
      });
      spawned = await spawnOrAdoptRuntimeAgent({
        workerId: args.worker.id,
        expectedTurnGeneration: args.worker.turnGeneration,
        spawn: () => spawnAgent({
          ...spawnParams,
          resumeSessionId: rejectedSessionId,
        }) as Promise<AgentRecord>,
      }).catch(async (error: unknown) => {
        await insertRecoveryExecutionEvent(args.run.id, args.worker.id, "worker_session_materialized_resume_failed", {
          summary: `Rebuilt session ${rejectedSessionId} still would not resume; falling back to a fresh worker.`,
          incidentId: args.incidentId,
          reason: error instanceof Error ? error.message : String(error),
        });
        return null;
      }) as AgentRecord | null;
    }
  }

  if (!spawned) {
    const restartClaimed = await db.update(workers).set({
      status: "starting",
      bridgeSessionId: null,
      bridgeSessionMode: null,
      currentText: "",
      updatedAt: new Date(),
    }).where(and(
      eq(workers.id, args.worker.id),
      eq(workers.turnGeneration, args.worker.turnGeneration),
    )).returning({ id: workers.id }).get();
    if (!restartClaimed) {
      throw new Error("Worker turn was superseded by a newer worker turn");
    }
    spawned = await spawnOrAdoptRuntimeAgent({
      workerId: args.worker.id,
      expectedTurnGeneration: args.worker.turnGeneration,
      spawn: () => spawnAgent(spawnParams) as Promise<AgentRecord>,
    });
  }

  const resumedMaterializedSession = Boolean(
    rejectedSessionId && spawned.sessionId === rejectedSessionId,
  );

  const workerPersisted = await runQuotaRecoveryMutation(args.run.id, async () => {
    const currentRun = await db.select({ status: runs.status })
      .from(runs)
      .where(eq(runs.id, args.run.id))
      .get();
    if (!currentRun || ["cancelled", "canceled"].includes(normalizeRunStatus(currentRun.status))) {
      return false;
    }
    const updatedWorker = await db.update(workers).set({
      status: spawned.state,
      currentText: spawned.currentText,
      lastText: spawned.lastText,
      bridgeSessionId: spawned.sessionId ?? null,
      bridgeSessionMode: spawned.sessionMode ?? args.worker.bridgeSessionMode ?? null,
      updatedAt: new Date(),
    }).where(and(
      eq(workers.id, args.worker.id),
      eq(workers.turnGeneration, args.worker.turnGeneration),
    )).returning({ id: workers.id }).get();
    if (!updatedWorker) return false;
    await db.update(runs).set({
      status: "running",
      failedAt: null,
      lastError: null,
      updatedAt: new Date(),
    }).where(eq(runs.id, args.run.id));
    return true;
  });
  if (!workerPersisted) {
    throw new Error("Worker turn was superseded by a newer worker turn");
  }
  emitNamedEvent({
    kind: resumedMaterializedSession ? "worker.reattached" : "worker.recreated",
    runId: args.run.id,
    workerId: args.worker.id,
  });
  await insertRecoveryExecutionEvent(args.run.id, args.worker.id, "worker_session_recreated", {
    summary: resumedMaterializedSession
      ? `Restored ${args.worker.id} from a session rebuilt out of the saved transcript.`
      : `Started a fresh runtime worker for ${args.worker.id} after its saved session was lost.`,
    incidentId: args.incidentId,
    rejectedSessionId,
    newSessionId: spawned.sessionId ?? null,
    transcriptRestored: resumedMaterializedSession,
    reason: "direct_queue_blocked",
  });

  // The blocked message is still `failed` with an agent-missing error. Put it
  // back in the queue so the ordinary drain delivers it to the new worker;
  // leaving it failed would recreate the worker and still lose the message.
  const requeuedCount = await runQuotaRecoveryMutation(args.run.id, async () => {
    const [currentRun, currentWorker] = await Promise.all([
      db.select({ status: runs.status }).from(runs).where(eq(runs.id, args.run.id)).get(),
      db.select({ turnGeneration: workers.turnGeneration })
        .from(workers)
        .where(eq(workers.id, args.worker.id))
        .get(),
    ]);
    if (
      !currentRun
      || ["cancelled", "canceled"].includes(normalizeRunStatus(currentRun.status))
      || currentWorker?.turnGeneration !== args.worker.turnGeneration
    ) {
      return null;
    }
    const count = args.preserveQueuedMessages
      ? await requeueRecoverableQueuedMessages({ runId: args.run.id, workerId: args.worker.id })
      : 0;
    if (count > 0) {
      await insertRecoveryExecutionEvent(args.run.id, args.worker.id, "queued_message_requeued", {
        summary: `Requeued ${count} blocked message(s) for ${args.worker.id}.`,
        incidentId: args.incidentId,
        requeuedCount: count,
      });
    }
    await markRecoveryIncidentResolved({
      incidentId: args.incidentId,
      runId: args.run.id,
      workerId: args.worker.id,
      summary: resumedMaterializedSession
        ? `Restored ${args.worker.id} from its saved transcript.`
        : `Replaced ${args.worker.id} with a fresh direct worker.`,
      details: {
        rejectedSessionId,
        newSessionId: spawned.sessionId ?? null,
        requeuedCount: count,
        workerState: spawned.state,
        transcriptRestored: resumedMaterializedSession,
      },
    });
    await resolveRecoveryIncidentsAfterHealthyTurn({
      runId: args.run.id,
      workerId: args.worker.id,
      summary: `Replaced ${args.worker.id} with a working direct worker.`,
      reason: "direct_worker_restarted",
    });
    return count;
  });
  if (requeuedCount === null) {
    throw new Error("Worker turn was superseded by a newer worker turn");
  }
  return {
    action: "restart_direct_worker" as const,
    runId: args.run.id,
    workerId: args.worker.id,
    requeuedCount,
  };
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
  await assertRunNotHandoffFenced(args.runId);
  const { run, runWorkers, runMessages, runQueuedMessages } = await loadRunRecoveryInputs(args.runId);
  const state = classifyRunRecoveryState({
    run,
    workers: runWorkers,
    liveAgents: args.liveAgents,
    messages: runMessages,
    queuedMessages: runQueuedMessages,
  });

  if (state.kind === "healthy" || state.kind === "recovering") {
    // A silent early return here left incidents from an earlier failure hanging
    // open long after the run went healthy again, which is what kept the recovery
    // banner on screen. `recovering` is genuinely still in flight, so only
    // `healthy` settles the leftovers.
    if (state.kind === "healthy") {
      const resolved = await resolveRecoveryIncidentsAfterHealthyTurn({
        runId: run.id,
        summary: "Run is healthy again; clearing leftover recovery incidents.",
        reason: "run_reconciled_healthy",
      });
      if (resolved > 0) {
        notifyEventStreamSubscribers();
      }
    }
    return { action: "none" as const, runId: run.id, recoveryState: state };
  }

  if (state.kind === "needs_recovery" && run.status === "needs_recovery" && !args.force) {
    const existingIncident = await db.select({ id: recoveryIncidents.id })
      .from(recoveryIncidents)
      .where(and(
        eq(recoveryIncidents.runId, run.id),
        inArray(recoveryIncidents.status, ["open", "recovering", "needs_user", "failed"]),
      ))
      .get();
    if (existingIncident) {
      return { action: "needs_user" as const, runId: run.id, recoveryState: state };
    }
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

    if (decision.action === "restart_direct_worker") {
      const worker = runWorkers.find((candidate) => candidate.id === state.workerId)
        ?? runWorkers.slice().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
      if (!worker) {
        throw new Error("No direct worker is available to restart");
      }
      const result = await restartDirectWorker({
        run,
        worker,
        state,
        incidentId: incident.id,
        preserveQueuedMessages: policy.preserveQueuedMessages,
      });
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
    if (isWorkerTurnSupersededError(error)) {
      notifyEventStreamSubscribers();
      return { action: "none" as const, runId: run.id, recoveryState: state };
    }
    const reason = error instanceof Error ? error.message : String(error);
    // The bridge rejects a dead session with wording the agent-missing matcher
    // never covered ("Resource not found: <sessionId>"), so a resume that failed
    // for exactly the reason recovery exists fell straight through to the user.
    const savedSessionRejected = state.kind === "lost_worker_resumable"
      && (isRecoverableAgentMissingError(reason) || isRejectedSavedSessionErrorMessage(reason));

    if (savedSessionRejected && run.mode !== "implementation") {
      // A direct run has no checkpoint to fall back to, so its only route back
      // was the user — and Resume could not fix a session the provider has
      // already deleted. Replace the worker instead, keeping the transcript.
      const worker = runWorkers.find((candidate) => candidate.id === state.workerId);
      if (worker) {
        try {
          const restartResult = await restartDirectWorker({
            run,
            worker,
            state,
            incidentId: incident.id,
            preserveQueuedMessages: policy.preserveQueuedMessages,
          });
          notifyEventStreamSubscribers();
          return { ...restartResult, recoveryState: state };
        } catch (restartError) {
          await markNeedsUser({
            incidentId: incident.id,
            runId: run.id,
            workerId: state.workerId,
            reason: restartError instanceof Error ? restartError.message : String(restartError),
            state,
          });
          notifyEventStreamSubscribers();
          return { action: "needs_user" as const, runId: run.id, recoveryState: state };
        }
      }
    }

    if (
      savedSessionRejected
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
