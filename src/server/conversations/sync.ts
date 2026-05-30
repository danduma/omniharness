import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { messages, queuedConversationMessages, runs, workers } from "@/server/db/schema";
import { refreshPlanningArtifactsForRun } from "@/server/planning/refresh";
import { normalizeAgentRecord, type AgentRecord } from "@/server/bridge-client";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
import { recordExecutionEvent } from "@/server/events/execution-event-store";
import { emitNamedEvent } from "@/server/events/named-events";
import { persistRunFailure } from "@/server/runs/failures";
import { isTerminalRunStatus } from "@/server/runs/status";
import { isLongWorkerCompletionText } from "@/server/supervisor/worker-completion";
import { startSupervisorRun } from "@/server/supervisor/start";
import { isRecoverableConnectionSupervisorError, isTransientSupervisorError } from "@/server/supervisor/retry";
import { readWorkerOutputEntries, writeWorkerOutputEntries } from "@/server/workers/output-store";
import { reconcileRunRecovery } from "@/server/runs/recovery-reconciler";
import { drainQueuedWorkerMessages } from "./queued-messages";
import {
  resolveDirectRunStatusFromWorkerOutput,
  updateDirectRunStatusFromWorkerOutput,
} from "./direct-run-status";

const EMPTY_IDLE_WORKER_OUTPUT_DIAGNOSTIC = "Worker is idle with no recorded output.";
const MISSING_IDLE_WORKER_OUTPUT_DIAGNOSTIC = "Worker is idle with no recorded output, and the bridge no longer has a live session for it.";

function isDirectRunMode(mode: string | null | undefined) {
  return mode === "direct" || mode === "commit";
}

function hasAgentOutput(agent: ReturnType<typeof normalizeAgentRecord>) {
  return Boolean(
    agent.renderedOutput?.trim()
    || agent.currentText.trim()
    || agent.lastText.trim()
    || agent.outputEntries?.some((entry) => entry.text.trim()),
  );
}

function normalizedStatus(value: string | null | undefined) {
  return value?.trim().toLowerCase().split(":")[0]?.trim() ?? "";
}

function isCompletedEntryStatus(value: string | null | undefined) {
  const status = normalizedStatus(value);
  return !status || [
    "approved",
    "cancelled",
    "canceled",
    "completed",
    "denied",
    "error",
    "failed",
    "success",
  ].includes(status);
}

function isInputEntry(entry: NonNullable<AgentRecord["outputEntries"]>[number]) {
  const type = (entry as { type?: string | null }).type;
  return type === "user_input" || type === "supervisor_input";
}

function isOpenWorkEntry(entry: NonNullable<AgentRecord["outputEntries"]>[number]) {
  if (entry.type !== "tool_call" && entry.type !== "tool_call_update" && entry.type !== "permission") {
    return false;
  }

  return !isCompletedEntryStatus(entry.status);
}

function directLiveAgentHasCompletedTurn(agent: ReturnType<typeof normalizeAgentRecord>) {
  const state = normalizedStatus(agent.state);
  if (state !== "working" && state !== "starting" && state !== "stuck") {
    return false;
  }

  if (!agent.stopReason?.trim() && !isLongWorkerCompletionText(agent.currentText || agent.lastText || agent.renderedOutput)) {
    return false;
  }

  if ((agent.pendingPermissions?.length ?? 0) > 0) {
    return false;
  }

  const entries = agent.outputEntries ?? [];
  if (entries.length === 0) {
    return false;
  }

  const lastInputIndex = entries.findLastIndex(isInputEntry);
  const turnEntries = entries.slice(lastInputIndex + 1);
  if (turnEntries.some(isOpenWorkEntry)) {
    return false;
  }

  const currentText = agent.currentText.trim();
  const lastText = agent.lastText.trim();
  if (currentText && lastText && currentText !== lastText) {
    return false;
  }

  const latestMeaningfulEntry = [...turnEntries].reverse().find((entry) => (
    entry.status !== "archived"
    && entry.text.trim().length > 0
  ));

  return latestMeaningfulEntry?.type === "message";
}

async function hasPersistedWorkerOutput(worker: typeof workers.$inferSelect) {
  if (
    worker.outputLog.trim()
    || worker.currentText.trim()
    || worker.lastText.trim()
  ) {
    return true;
  }

  const entries = await readWorkerOutputEntries(worker.runId, worker.id);
  return entries.some((entry) => {
    const text = (entry as { text?: unknown }).text;
    return typeof text === "string" && text.trim().length > 0;
  });
}

function resolveSyncedRunState(run: typeof runs.$inferSelect, agent: ReturnType<typeof normalizeAgentRecord>) {
  if (agent.state === "error") {
    return "failed";
  }

  if (isDirectRunMode(run.mode) && resolveDirectRunStatusFromWorkerOutput(agent) === "awaiting_user") {
    return "awaiting_user";
  }

  if (isDirectRunMode(run.mode) && directLiveAgentHasCompletedTurn(agent)) {
    return "done";
  }

  if (isDirectRunMode(run.mode) && agent.state === "idle" && hasAgentOutput(agent)) {
    return "done";
  }

  if (
    ["stopped", "cancelled", "done", "completed"].includes(agent.state)
    || (agent.state === "idle" && agent.stopReason === "end_turn" && hasAgentOutput(agent))
  ) {
    return "done";
  }

  return "running";
}

async function resolvePersistedRunState(run: typeof runs.$inferSelect, worker: typeof workers.$inferSelect) {
  const status = normalizedStatus(worker.status);

  if (status === "error") {
    return "failed";
  }

  if (isDirectRunMode(run.mode) && resolveDirectRunStatusFromWorkerOutput(worker) === "awaiting_user") {
    return "awaiting_user";
  }

  if (
    ["stopped", "cancelled", "done", "completed"].includes(status)
    || (status === "idle" && await hasPersistedWorkerOutput(worker))
  ) {
    return "done";
  }

  return "running";
}

async function isEmptyIdlePersistedWorker(worker: typeof workers.$inferSelect) {
  const status = normalizedStatus(worker.status);
  return status === "idle" && !(await hasPersistedWorkerOutput(worker));
}

function isIdleLiveAgentWithoutOutput(agent: ReturnType<typeof normalizeAgentRecord>) {
  return agent.state === "idle" && !hasAgentOutput(agent);
}

function isAgentBusyRunFailure(run: typeof runs.$inferSelect) {
  return run.status === "failed" && /\bagent is busy\b/i.test(run.lastError ?? "");
}

function isRecoverableImplementationTransientFailure(run: typeof runs.$inferSelect) {
  const lastError = run.lastError ?? "";
  return run.mode === "implementation"
    && run.status === "failed"
    && Boolean(lastError.trim())
    && isTransientSupervisorError(new Error(lastError));
}

function isRecoverableImplementationConnectionFailure(run: typeof runs.$inferSelect) {
  const lastError = run.lastError ?? "";
  return run.mode === "implementation"
    && run.status === "failed"
    && Boolean(lastError.trim())
    && isRecoverableConnectionSupervisorError(new Error(lastError));
}

function isCleanLiveAgent(agent: ReturnType<typeof normalizeAgentRecord>) {
  return agent.state !== "error" && !agent.lastError?.trim();
}

function isActiveLiveAgent(agent: ReturnType<typeof normalizeAgentRecord>) {
  const state = normalizedStatus(agent.state);
  return ["starting", "working", "stuck"].includes(state) || Boolean(agent.currentText.trim());
}

function isWorkerQueueDrainableStatus(status: string) {
  const normalized = normalizedStatus(status);
  return Boolean(normalized) && !["starting", "working", "stuck", "error", "cancelled"].includes(normalized);
}

async function pendingWorkerQueueCount(runId: string, workerId: string) {
  const records = await db.select({ id: queuedConversationMessages.id })
    .from(queuedConversationMessages)
    .where(and(
      eq(queuedConversationMessages.runId, runId),
      eq(queuedConversationMessages.targetWorkerId, workerId),
      eq(queuedConversationMessages.status, "pending"),
    ));
  return records.length;
}

async function recordQueueDrainDecision(args: {
  runId: string;
  workerId: string;
  source: string;
  workerStatus: string;
  pendingCount: number;
  decision: "drain" | "skip";
  reason: string;
}) {
  emitNamedEvent({
    kind: "queue.drain_decision",
    runId: args.runId,
    workerId: args.workerId,
    source: args.source,
    workerStatus: args.workerStatus,
    pendingCount: args.pendingCount,
    decision: args.decision,
    reason: args.reason,
  });
  await recordExecutionEvent({
    runId: args.runId,
    workerId: args.workerId,
    eventType: "queue_drain_decision",
    details: {
      summary: args.decision === "drain"
        ? `Draining ${args.pendingCount} queued message(s) for ${args.workerId}.`
        : `Skipped queue drain for ${args.workerId}: ${args.reason}.`,
      source: args.source,
      workerStatus: args.workerStatus,
      pendingCount: args.pendingCount,
      decision: args.decision,
      reason: args.reason,
    },
  });
}

async function drainQueuedWorkerMessagesWithObservation(args: {
  runId: string;
  workerId: string;
  workerStatus: string;
  source: string;
}) {
  const pendingCount = await pendingWorkerQueueCount(args.runId, args.workerId);
  if (pendingCount === 0) {
    return 0;
  }

  const drainable = isWorkerQueueDrainableStatus(args.workerStatus);
  await recordQueueDrainDecision({
    ...args,
    pendingCount,
    decision: drainable ? "drain" : "skip",
    reason: drainable ? "worker_drainable" : "worker_not_drainable",
  });
  if (!drainable) {
    return 0;
  }

  const deliveredCount = await drainQueuedWorkerMessages({ runId: args.runId, workerId: args.workerId });
  emitNamedEvent({
    kind: "queue.drain_finished",
    runId: args.runId,
    workerId: args.workerId,
    source: args.source,
    pendingCount,
    deliveredCount,
  });
  await recordExecutionEvent({
    runId: args.runId,
    workerId: args.workerId,
    eventType: "queue_drain_finished",
    details: {
      summary: `Queue drain finished for ${args.workerId}: delivered ${deliveredCount} of ${pendingCount}.`,
      source: args.source,
      pendingCount,
      deliveredCount,
    },
  });
  return deliveredCount;
}

function isRecoverableMissingDirectWorkerStatus(status: string) {
  const normalized = normalizedStatus(status);
  return ["starting", "working", "stuck", "recovering"].includes(normalized);
}

function isCancelledWorkerStatus(status: string | null | undefined) {
  const normalized = normalizedStatus(status);
  return normalized === "cancelled" || normalized === "canceled";
}

function isIdleDirectWorkerWithStaleCurrentText(worker: typeof workers.$inferSelect) {
  if (normalizedStatus(worker.status) !== "idle") {
    return false;
  }

  const currentText = worker.currentText.trim();
  if (!currentText) {
    return false;
  }

  const lastText = worker.lastText.trim();
  return !lastText || currentText === lastText;
}

async function clearStaleDirectCurrentText(run: typeof runs.$inferSelect, worker: typeof workers.$inferSelect) {
  if (!isDirectRunMode(run.mode) || !isTerminalRunStatus(run.status) || !isIdleDirectWorkerWithStaleCurrentText(worker)) {
    return false;
  }

  await db.update(workers).set({
    currentText: "",
    lastText: worker.lastText || worker.currentText,
    updatedAt: new Date(),
  }).where(eq(workers.id, worker.id));
  notifyEventStreamSubscribers();
  return true;
}

function workerCreatedAtMs(worker: typeof workers.$inferSelect) {
  const time = worker.createdAt.getTime();
  return Number.isFinite(time) ? time : 0;
}

function compareWorkersForFollowUp(a: typeof workers.$inferSelect, b: typeof workers.$inferSelect) {
  const workerNumberDiff = (b.workerNumber ?? 0) - (a.workerNumber ?? 0);
  if (workerNumberDiff !== 0) {
    return workerNumberDiff;
  }

  const createdAtDiff = workerCreatedAtMs(b) - workerCreatedAtMs(a);
  if (createdAtDiff !== 0) {
    return createdAtDiff;
  }

  return b.id.localeCompare(a.id);
}

function selectConversationWorker(runId: string, allWorkers: Array<typeof workers.$inferSelect>) {
  const sortedWorkers = allWorkers
    .filter((candidate) => candidate.runId === runId)
    .sort(compareWorkersForFollowUp);
  return sortedWorkers.find((worker) => !isCancelledWorkerStatus(worker.status)) ?? sortedWorkers[0] ?? null;
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

export async function syncConversationSessions(rawAgents: unknown[], options: { selectedRunId?: string | null } = {}) {
  const agents = rawAgents.map((agent) => normalizeAgentRecord(agent));
  const selectedRunId = options.selectedRunId?.trim() || null;
  const allRuns = selectedRunId
    ? await db.select().from(runs).where(eq(runs.id, selectedRunId))
    : await db.select().from(runs);
  const allWorkers = selectedRunId
    ? await db.select().from(workers).where(eq(workers.runId, selectedRunId))
    : await db.select().from(workers);

  for (const run of allRuns) {
    const staleBusyFailure = isAgentBusyRunFailure(run);
    const staleImplementationTransientFailure = isRecoverableImplementationTransientFailure(run);
    const staleImplementationConnectionFailure = isRecoverableImplementationConnectionFailure(run);
    if (run.mode === "implementation") {
      const implementationWorkers = allWorkers.filter((candidate) => candidate.runId === run.id);
      let syncedActiveLiveWorker = false;

      for (const implementationWorker of implementationWorkers) {
        const implementationAgent = agents.find((candidate) => candidate.name === implementationWorker.id);
        const cancelledWorkerHasMatchingLiveSession = Boolean(
          implementationAgent
          && implementationWorker.bridgeSessionId
          && implementationWorker.bridgeSessionMode
          && implementationAgent.sessionId === implementationWorker.bridgeSessionId
          && implementationAgent.sessionMode === implementationWorker.bridgeSessionMode,
        );
        if (isCancelledWorkerStatus(implementationWorker.status)
          && !cancelledWorkerHasMatchingLiveSession) {
          continue;
        }
        if (!implementationAgent || !isCleanLiveAgent(implementationAgent) || !isActiveLiveAgent(implementationAgent)) {
          continue;
        }

        await writeWorkerOutputEntries(run.id, implementationWorker.id, implementationAgent.outputEntries);
        await db.update(workers).set({
          status: implementationAgent.state,
          cwd: implementationAgent.cwd || implementationWorker.cwd,
          currentText: implementationAgent.currentText,
          lastText: implementationAgent.lastText,
          bridgeSessionId: implementationAgent.sessionId ?? implementationWorker.bridgeSessionId,
          bridgeSessionMode: implementationAgent.sessionMode ?? implementationWorker.bridgeSessionMode,
          updatedAt: new Date(),
        }).where(eq(workers.id, implementationWorker.id));
        syncedActiveLiveWorker = true;
      }

      if (syncedActiveLiveWorker) {
        if (run.status !== "running" || run.failedAt || run.lastError) {
          await db.update(runs).set({
            status: "running",
            failedAt: null,
            lastError: null,
            updatedAt: new Date(),
          }).where(eq(runs.id, run.id));
          await clearMatchingRunFailureMessage(run);
          startSupervisorRun(run.id);
        }
        continue;
      }

      if (!staleImplementationTransientFailure) {
        continue;
      }

      const implementationWorker = implementationWorkers[0];
      const implementationAgent = implementationWorker
        ? agents.find((candidate) => candidate.name === implementationWorker.id)
        : null;
      if (!implementationWorker || !implementationAgent || !isCleanLiveAgent(implementationAgent)) {
        if (staleImplementationConnectionFailure) {
          const resumableWorker = implementationWorkers.find((worker) => worker.bridgeSessionId?.trim());
          if (resumableWorker) {
            await db.update(runs).set({
              status: "running",
              failedAt: null,
              lastError: null,
              updatedAt: new Date(),
            }).where(eq(runs.id, run.id));
            await clearMatchingRunFailureMessage(run);
            startSupervisorRun(run.id);
          }
        }
        continue;
      }

      await writeWorkerOutputEntries(run.id, implementationWorker.id, implementationAgent.outputEntries);
      await db.update(workers).set({
        status: implementationAgent.state,
        cwd: implementationAgent.cwd || implementationWorker.cwd,
        currentText: implementationAgent.currentText,
        lastText: implementationAgent.lastText,
        updatedAt: new Date(),
      }).where(eq(workers.id, implementationWorker.id));
      await db.update(runs).set({
        status: "running",
        failedAt: null,
        lastError: null,
        updatedAt: new Date(),
      }).where(eq(runs.id, run.id));
      await clearMatchingRunFailureMessage(run);
      startSupervisorRun(run.id);
      continue;
    }

    const worker = selectConversationWorker(run.id, allWorkers);
    if (!worker) {
      continue;
    }

    if (await clearStaleDirectCurrentText(run, worker)) {
      continue;
    }

    const agent = agents.find((candidate) => candidate.name === worker.id);
    const selectedTerminalDirectRunStillStreaming = Boolean(
      options.selectedRunId === run.id
      && isDirectRunMode(run.mode)
      && agent
      && isActiveLiveAgent(agent),
    );
    if (isTerminalRunStatus(run.status) && !staleBusyFailure && !selectedTerminalDirectRunStillStreaming) {
      continue;
    }

    if (!agent) {
      continue;
    }

    if (
      isDirectRunMode(run.mode)
      && worker.status.trim().toLowerCase().split(":")[0]?.trim() === "idle"
      && isIdleLiveAgentWithoutOutput(agent)
    ) {
      await db.update(workers).set({
        status: "error",
        cwd: agent.cwd || worker.cwd,
        currentText: agent.currentText,
        lastText: agent.lastText,
        outputLog: EMPTY_IDLE_WORKER_OUTPUT_DIAGNOSTIC,
        updatedAt: new Date(),
      }).where(eq(workers.id, worker.id));
      await persistRunFailure(run.id, new Error(EMPTY_IDLE_WORKER_OUTPUT_DIAGNOSTIC), {
        surface: { code: "worker.idle.empty_output", workerId: worker.id },
      });
      continue;
    }

    await writeWorkerOutputEntries(run.id, worker.id, agent.outputEntries);
    const nextRunState = resolveSyncedRunState(run, agent);
    const quiescedDirectWorker = isDirectRunMode(run.mode) && directLiveAgentHasCompletedTurn(agent);
    await db.update(workers).set({
      status: quiescedDirectWorker ? "idle" : agent.state,
      cwd: agent.cwd || worker.cwd,
      currentText: quiescedDirectWorker ? "" : agent.currentText,
      lastText: agent.lastText,
      updatedAt: new Date(),
    }).where(eq(workers.id, worker.id));

    if (run.mode === "planning") {
      const result = await refreshPlanningArtifactsForRun({
        run,
        worker,
        snapshot: agent,
        status: nextRunState === "running" ? "working" : undefined,
      });
      if (staleBusyFailure && result.status !== "failed") {
        await clearMatchingRunFailureMessage(run);
      }
      await drainQueuedWorkerMessagesWithObservation({
        runId: run.id,
        workerId: worker.id,
        workerStatus: agent.state,
        source: "live_planning_sync",
      });
      continue;
    }

    if (isDirectRunMode(run.mode) && (nextRunState === "awaiting_user" || nextRunState === "done")) {
      await updateDirectRunStatusFromWorkerOutput({
        runId: run.id,
        workerId: worker.id,
        renderedOutput: agent.renderedOutput,
        currentText: agent.currentText,
        lastText: agent.lastText,
        outputEntries: agent.outputEntries,
      });
    } else {
      await db.update(runs).set({
        status: nextRunState,
        lastError: nextRunState === "failed" ? agent.lastError || run.lastError : null,
        failedAt: nextRunState === "failed" ? run.failedAt : null,
        updatedAt: new Date(),
      }).where(eq(runs.id, run.id));
    }
    if (staleBusyFailure && nextRunState !== "failed") {
      await clearMatchingRunFailureMessage(run);
    }
    const effectiveWorkerStatus = quiescedDirectWorker ? "idle" : agent.state;
    await drainQueuedWorkerMessagesWithObservation({
      runId: run.id,
      workerId: worker.id,
      workerStatus: effectiveWorkerStatus,
      source: "live_worker_sync",
    });
  }

  for (const run of allRuns) {
    const staleBusyFailure = isAgentBusyRunFailure(run);
    if (run.mode === "implementation" || (isTerminalRunStatus(run.status) && !staleBusyFailure)) {
      continue;
    }

    const worker = selectConversationWorker(run.id, allWorkers);
    if (!worker || agents.some((agent) => agent.name === worker.id)) {
      continue;
    }

    if (
      options.selectedRunId === run.id
      && isRecoverableMissingDirectWorkerStatus(worker.status)
    ) {
      const recoveryResult = await reconcileRunRecovery({
        runId: run.id,
        liveAgents: agents,
        source: "conversation-sync",
      });
      if (recoveryResult.action !== "none" && recoveryResult.action !== "wait_for_backoff") {
        continue;
      }
    }

    if (await isEmptyIdlePersistedWorker(worker)) {
      await db.update(workers).set({
        status: "error",
        outputLog: MISSING_IDLE_WORKER_OUTPUT_DIAGNOSTIC,
        updatedAt: new Date(),
      }).where(eq(workers.id, worker.id));
      await persistRunFailure(run.id, new Error(MISSING_IDLE_WORKER_OUTPUT_DIAGNOSTIC), {
        surface: { code: "worker.idle.missing_output", workerId: worker.id },
      });
      continue;
    }

    const nextRunState = await resolvePersistedRunState(run, worker);
    if (run.mode === "planning") {
      await refreshPlanningArtifactsForRun({
        run,
        worker,
        status: nextRunState === "running" ? "working" : undefined,
      });
      continue;
    }

    if (nextRunState === run.status) {
      await drainQueuedWorkerMessagesWithObservation({
        runId: run.id,
        workerId: worker.id,
        workerStatus: worker.status,
        source: "persisted_state_unchanged",
      });
      continue;
    }

    if (isDirectRunMode(run.mode) && (nextRunState === "awaiting_user" || nextRunState === "done")) {
      await updateDirectRunStatusFromWorkerOutput({
        runId: run.id,
        workerId: worker.id,
        outputLog: worker.outputLog,
        currentText: worker.currentText,
        lastText: worker.lastText,
        outputEntriesJson: worker.outputEntriesJson,
      });
      await drainQueuedWorkerMessagesWithObservation({
        runId: run.id,
        workerId: worker.id,
        workerStatus: worker.status,
        source: "persisted_direct_completion",
      });
    } else {
      await db.update(runs).set({
        status: nextRunState,
        updatedAt: new Date(),
      }).where(eq(runs.id, run.id));
    }
  }
}
