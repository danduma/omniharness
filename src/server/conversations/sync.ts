import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { messages, runs, workers } from "@/server/db/schema";
import { refreshPlanningArtifactsForRun } from "@/server/planning/refresh";
import { normalizeAgentRecord } from "@/server/bridge-client";
import { persistRunFailure } from "@/server/runs/failures";
import { isTerminalRunStatus } from "@/server/runs/status";
import { startSupervisorRun } from "@/server/supervisor/start";
import { isRecoverableConnectionSupervisorError, isTransientSupervisorError } from "@/server/supervisor/retry";
import { readWorkerOutputEntries, writeWorkerOutputEntries } from "@/server/workers/output-store";
import { reconcileRunRecovery } from "@/server/runs/recovery-reconciler";
import { drainQueuedWorkerMessages } from "./queued-messages";
import {
  resolveDirectRunStatusFromWorkerOutput,
  updateDirectRunStatusFromWorkerOutput,
} from "./direct-run-status";

const MISSING_IDLE_WORKER_OUTPUT_DIAGNOSTIC = "Worker is idle with no recorded output, and the bridge no longer has a live session for it.";

function hasAgentOutput(agent: ReturnType<typeof normalizeAgentRecord>) {
  return Boolean(
    agent.renderedOutput?.trim()
    || agent.currentText.trim()
    || agent.lastText.trim()
    || agent.outputEntries?.some((entry) => entry.text.trim()),
  );
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

  if (run.mode === "direct" && resolveDirectRunStatusFromWorkerOutput(agent) === "awaiting_user") {
    return "awaiting_user";
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
  const status = worker.status.trim().toLowerCase().split(":")[0]?.trim() ?? "";

  if (status === "error") {
    return "failed";
  }

  if (run.mode === "direct" && resolveDirectRunStatusFromWorkerOutput(worker) === "awaiting_user") {
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
  const status = worker.status.trim().toLowerCase().split(":")[0]?.trim() ?? "";
  return status === "idle" && !(await hasPersistedWorkerOutput(worker));
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
  const state = agent.state.trim().toLowerCase().split(":")[0]?.trim() ?? "";
  return ["starting", "working", "stuck"].includes(state) || Boolean(agent.currentText.trim());
}

function isWorkerQueueDrainableStatus(status: string) {
  const normalized = status.trim().toLowerCase().split(":")[0]?.trim() ?? "";
  return Boolean(normalized) && !["starting", "working", "stuck", "error", "cancelled"].includes(normalized);
}

function isRecoverableMissingDirectWorkerStatus(status: string) {
  const normalized = status.trim().toLowerCase().split(":")[0]?.trim() ?? "";
  return ["starting", "working", "stuck", "recovering"].includes(normalized);
}

function isCancelledWorkerStatus(status: string | null | undefined) {
  const normalized = status?.trim().toLowerCase().split(":")[0]?.trim() ?? "";
  return normalized === "cancelled" || normalized === "canceled";
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

      if (!options.selectedRunId || options.selectedRunId === run.id) {
        const recoveryResult = await reconcileRunRecovery({
          runId: run.id,
          liveAgents: agents,
          source: "conversation-sync",
        });
        if (recoveryResult.action !== "none" && recoveryResult.action !== "wait_for_backoff") {
          continue;
        }
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

    if (isTerminalRunStatus(run.status) && !staleBusyFailure) {
      continue;
    }

    const worker = selectConversationWorker(run.id, allWorkers);
    if (!worker) {
      continue;
    }

    const agent = agents.find((candidate) => candidate.name === worker.id);
    if (!agent) {
      continue;
    }

    await writeWorkerOutputEntries(run.id, worker.id, agent.outputEntries);
    await db.update(workers).set({
      status: agent.state,
      cwd: agent.cwd || worker.cwd,
      currentText: agent.currentText,
      lastText: agent.lastText,
      updatedAt: new Date(),
    }).where(eq(workers.id, worker.id));

    const nextRunState = resolveSyncedRunState(run, agent);

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
      if (isWorkerQueueDrainableStatus(agent.state)) {
        await drainQueuedWorkerMessages({ runId: run.id, workerId: worker.id });
      }
      continue;
    }

    if (nextRunState === "awaiting_user") {
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
    if (isWorkerQueueDrainableStatus(agent.state)) {
      await drainQueuedWorkerMessages({ runId: run.id, workerId: worker.id });
    }
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
      run.mode === "direct"
      && options.selectedRunId === run.id
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
      await persistRunFailure(run.id, new Error(MISSING_IDLE_WORKER_OUTPUT_DIAGNOSTIC));
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
      if (isWorkerQueueDrainableStatus(worker.status)) {
        await drainQueuedWorkerMessages({ runId: run.id, workerId: worker.id });
      }
      continue;
    }

    if (nextRunState === "awaiting_user") {
      await updateDirectRunStatusFromWorkerOutput({
        runId: run.id,
        workerId: worker.id,
        outputLog: worker.outputLog,
        currentText: worker.currentText,
        lastText: worker.lastText,
        outputEntriesJson: worker.outputEntriesJson,
      });
    } else {
      await db.update(runs).set({
        status: nextRunState,
        updatedAt: new Date(),
      }).where(eq(runs.id, run.id));
    }
  }
}
