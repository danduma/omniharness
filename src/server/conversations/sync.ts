import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { runs, workers } from "@/server/db/schema";
import { collectPlannerArtifacts } from "@/server/planning/artifacts";
import { normalizeAgentRecord } from "@/server/bridge-client";
import { persistRunFailure } from "@/server/runs/failures";
import { isTerminalRunStatus } from "@/server/runs/status";

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

  try {
    const entries = JSON.parse(worker.outputEntriesJson) as unknown;
    return Array.isArray(entries)
      && entries.some((entry) => {
        if (!entry || typeof entry !== "object") {
          return false;
        }
        const text = (entry as { text?: unknown }).text;
        return typeof text === "string" && text.trim().length > 0;
      });
  } catch {
    return false;
  }
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

export async function syncConversationSessions(rawAgents: unknown[]) {
  const agents = rawAgents.map((agent) => normalizeAgentRecord(agent));
  const allRuns = await db.select().from(runs);
  const allWorkers = await db.select().from(workers);

  for (const run of allRuns) {
    if (run.mode === "implementation" || isTerminalRunStatus(run.status)) {
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
      outputEntriesJson: JSON.stringify(agent.outputEntries ?? []),
      currentText: agent.currentText,
      lastText: agent.lastText,
      updatedAt: new Date(),
    }).where(eq(workers.id, worker.id));

    const nextRunState = resolveSyncedRunState(agent);

    if (run.mode === "planning") {
      const outputText = [
        agent.renderedOutput,
        agent.currentText,
        agent.lastText,
        ...(agent.outputEntries ?? []).map((entry) => entry.text),
      ]
        .filter(Boolean)
        .join("\n\n");
      const artifacts = await collectPlannerArtifacts({
        cwd: agent.cwd || worker.cwd,
        outputText,
      });

      await db.update(runs).set({
        status: nextRunState,
        lastError: agent.lastError || run.lastError,
        specPath: artifacts.specPath,
        artifactPlanPath: artifacts.planPath,
        plannerArtifactsJson: JSON.stringify(artifacts),
        updatedAt: new Date(),
      }).where(eq(runs.id, run.id));
      continue;
    }

    await db.update(runs).set({
      status: nextRunState,
      lastError: agent.lastError || run.lastError,
      updatedAt: new Date(),
    }).where(eq(runs.id, run.id));
  }

  for (const run of allRuns) {
    if (run.mode === "implementation" || isTerminalRunStatus(run.status)) {
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
    if (nextRunState === run.status) {
      continue;
    }

    await db.update(runs).set({
      status: nextRunState,
      updatedAt: new Date(),
    }).where(eq(runs.id, run.id));
  }
}
