import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { messages, runs, workers } from "@/server/db/schema";
import { refreshPlanningArtifactsForRun } from "@/server/planning/refresh";
import { normalizeAgentRecord } from "@/server/bridge-client";
import { persistRunFailure } from "@/server/runs/failures";
import { isTerminalRunStatus } from "@/server/runs/status";
import { startSupervisorRun } from "@/server/supervisor/start";
import { isTransientSupervisorError } from "@/server/supervisor/retry";
import { parseWorkerOutputEntries, serializeWorkerOutputEntries } from "@/server/workers/snapshots";
import { drainQueuedWorkerMessages } from "./queued-messages";

const MISSING_IDLE_WORKER_OUTPUT_DIAGNOSTIC = "Worker is idle with no recorded output, and the bridge no longer has a live session for it.";

function hasAgentOutput(agent: ReturnType<typeof normalizeAgentRecord>) {
  return Boolean(
    agent.renderedOutput?.trim()
    || agent.currentText.trim()
    || agent.lastText.trim()
    || agent.outputEntries?.some((entry) => entry.text.trim()),
  );
}

function hasPersistedWorkerOutput(worker: typeof workers.$inferSelect) {
  if (
    worker.outputLog.trim()
    || worker.currentText.trim()
    || worker.lastText.trim()
  ) {
    return true;
  }

  return parseWorkerOutputEntries(worker.outputEntriesJson).some((entry) => {
    const text = (entry as { text?: unknown }).text;
    return typeof text === "string" && text.trim().length > 0;
  });
}

function resolveSyncedRunState(agent: ReturnType<typeof normalizeAgentRecord>) {
  if (agent.state === "error") {
    return "failed";
  }

  if (
    ["stopped", "cancelled", "done", "completed"].includes(agent.state)
    || (agent.state === "idle" && agent.stopReason === "end_turn" && hasAgentOutput(agent))
  ) {
    return "done";
  }

  return "running";
}

function resolvePersistedRunState(worker: typeof workers.$inferSelect) {
  const status = worker.status.trim().toLowerCase().split(":")[0]?.trim() ?? "";

  if (status === "error") {
    return "failed";
  }

  if (
    ["stopped", "cancelled", "done", "completed"].includes(status)
    || (status === "idle" && hasPersistedWorkerOutput(worker))
  ) {
    return "done";
  }

  return "running";
}

function isEmptyIdlePersistedWorker(worker: typeof workers.$inferSelect) {
  const status = worker.status.trim().toLowerCase().split(":")[0]?.trim() ?? "";
  return status === "idle" && !hasPersistedWorkerOutput(worker);
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

function isCleanLiveAgent(agent: ReturnType<typeof normalizeAgentRecord>) {
  return agent.state !== "error" && !agent.lastError?.trim();
}

function isWorkerQueueDrainableStatus(status: string) {
  const normalized = status.trim().toLowerCase().split(":")[0]?.trim() ?? "";
  return Boolean(normalized) && !["starting", "working", "stuck", "error", "cancelled"].includes(normalized);
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

export async function syncConversationSessions(rawAgents: unknown[]) {
  const agents = rawAgents.map((agent) => normalizeAgentRecord(agent));
  const allRuns = await db.select().from(runs);
  const allWorkers = await db.select().from(workers);

  for (const run of allRuns) {
    const staleBusyFailure = isAgentBusyRunFailure(run);
    const staleImplementationTransientFailure = isRecoverableImplementationTransientFailure(run);
    if (run.mode === "implementation") {
      if (!staleImplementationTransientFailure) {
        continue;
      }

      const implementationWorker = allWorkers.find((candidate) => candidate.runId === run.id);
      const implementationAgent = implementationWorker
        ? agents.find((candidate) => candidate.name === implementationWorker.id)
        : null;
      if (!implementationWorker || !implementationAgent || !isCleanLiveAgent(implementationAgent)) {
        continue;
      }

      await db.update(workers).set({
        status: implementationAgent.state,
        cwd: implementationAgent.cwd || implementationWorker.cwd,
        outputEntriesJson: serializeWorkerOutputEntries(implementationAgent.outputEntries),
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

    const worker = allWorkers.find((candidate) => candidate.runId === run.id);
    if (!worker) {
      continue;
    }

    const agent = agents.find((candidate) => candidate.name === worker.id);
    if (!agent) {
      continue;
    }

    await db.update(workers).set({
      status: agent.state,
      cwd: agent.cwd || worker.cwd,
      outputEntriesJson: serializeWorkerOutputEntries(agent.outputEntries),
      currentText: agent.currentText,
      lastText: agent.lastText,
      updatedAt: new Date(),
    }).where(eq(workers.id, worker.id));

    const nextRunState = resolveSyncedRunState(agent);

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

    await db.update(runs).set({
      status: nextRunState,
      lastError: nextRunState === "failed" ? agent.lastError || run.lastError : null,
      failedAt: nextRunState === "failed" ? run.failedAt : null,
      updatedAt: new Date(),
    }).where(eq(runs.id, run.id));
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

    const worker = allWorkers.find((candidate) => candidate.runId === run.id);
    if (!worker || agents.some((agent) => agent.name === worker.id)) {
      continue;
    }

    if (isEmptyIdlePersistedWorker(worker)) {
      await db.update(workers).set({
        status: "error",
        outputLog: MISSING_IDLE_WORKER_OUTPUT_DIAGNOSTIC,
        updatedAt: new Date(),
      }).where(eq(workers.id, worker.id));
      await persistRunFailure(run.id, new Error(MISSING_IDLE_WORKER_OUTPUT_DIAGNOSTIC));
      continue;
    }

    const nextRunState = resolvePersistedRunState(worker);
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

    await db.update(runs).set({
      status: nextRunState,
      updatedAt: new Date(),
    }).where(eq(runs.id, run.id));
  }
}
