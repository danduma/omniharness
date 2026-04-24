import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { runs, workers } from "@/server/db/schema";
import { collectPlannerArtifacts } from "@/server/planning/artifacts";
import { normalizeAgentRecord } from "@/server/bridge-client";

export async function syncConversationSessions(rawAgents: unknown[]) {
  const agents = rawAgents.map((agent) => normalizeAgentRecord(agent));
  const allRuns = await db.select().from(runs);
  const allWorkers = await db.select().from(workers);

  for (const run of allRuns) {
    if (run.mode === "implementation") {
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

    const nextRunState = agent.state === "error"
      ? "failed"
      : ["stopped", "cancelled", "done", "completed"].includes(agent.state)
        ? "done"
        : "running";

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
}
