import { randomUUID } from "crypto";
import { and, eq, inArray } from "drizzle-orm";
import { askAgent, spawnAgent, getAgent } from "@/server/bridge-client";
import { db } from "@/server/db";
import { executionEvents, recoveryIncidents, runs, workers } from "@/server/db/schema";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
import { formatErrorMessage } from "@/server/runs/failures";
import { markRecoveryIncidentResolved } from "@/server/runs/recovery-incidents";
import { recordSupervisorIntervention } from "@/server/supervisor/interventions";
import { readWorkerYoloModeEnabled, resolveWorkerLaunchMode } from "@/server/worker-launch-mode";
import { readRuntimeEnvFromSettings } from "@/server/supervisor/runtime-settings";
import { extractQuotaResetInfo } from "./reset-parser";
import { handleWorkerQuotaExhaustion, type QuotaRecoveryResult } from "./recovery";

type ResumeQuotaWorkersResult =
  | { state: "none"; resumedCount: number }
  | { state: "resumed"; resumedCount: number }
  | QuotaRecoveryResult;

function isAgentAlreadyExistsError(error: unknown, workerId: string) {
  const message = formatErrorMessage(error).toLowerCase();
  return message.includes("agent already exists") && message.includes(workerId.toLowerCase());
}

function appendWorkerOutput(existingLog: string | null | undefined, nextChunk: string) {
  if (!nextChunk) {
    return existingLog ?? "";
  }

  if (!existingLog) {
    return nextChunk;
  }

  const separator = existingLog.endsWith("\n") || nextChunk.startsWith("\n") ? "" : "\n";
  return `${existingLog}${separator}${nextChunk}`;
}

function shouldPromptResumedWorker(state: string | null | undefined) {
  return !/\b(working|running|busy|starting|pending)\b/i.test(state ?? "");
}

function buildQuotaResumePrompt(worker: typeof workers.$inferSelect) {
  const planHint = worker.initialPrompt?.trim()
    ? "Use your original assignment and the saved session history as the source of truth."
    : "Use the saved session history and current repository state as the source of truth.";

  return [
    "Continue the interrupted work now that the quota wait has cleared.",
    planHint,
    "Review where you left off, continue implementation or verification, and report clearly if anything is still blocked.",
  ].join(" ");
}

async function insertWorkerSessionResumedEvent(args: {
  runId: string;
  workerId: string;
  sessionId: string;
  incidentId: string;
}) {
  await db.insert(executionEvents).values({
    id: randomUUID(),
    runId: args.runId,
    workerId: args.workerId,
    planItemId: null,
    eventType: "worker_session_resumed",
    details: JSON.stringify({
      summary: `Resumed ${args.workerId} from saved session after quota reset.`,
      sessionId: args.sessionId,
      incidentId: args.incidentId,
      reason: "quota_wait",
    }),
    createdAt: new Date(),
  });
}

async function promptResumedQuotaWorker(args: {
  runId: string;
  worker: typeof workers.$inferSelect;
}) {
  const prompt = buildQuotaResumePrompt(args.worker);
  await recordSupervisorIntervention({
    runId: args.runId,
    workerId: args.worker.id,
    prompt,
    summary: "Prompted worker to continue after quota reset.",
    interventionType: "recovery",
  });
  const response = await askAgent(args.worker.id, prompt);
  const latestWorker = await db.select().from(workers).where(eq(workers.id, args.worker.id)).get();

  await db.update(workers).set({
    status: response.state,
    outputLog: appendWorkerOutput(latestWorker?.outputLog ?? args.worker.outputLog, response.response),
    updatedAt: new Date(),
  }).where(eq(workers.id, args.worker.id));
  await db.insert(executionEvents).values({
    id: randomUUID(),
    runId: args.runId,
    workerId: args.worker.id,
    planItemId: null,
    eventType: "worker_prompted",
    details: JSON.stringify({
      summary: `Sent quota recovery follow-up to ${args.worker.id}`,
      prompt,
      reason: "quota_wait",
    }),
    createdAt: new Date(),
  });
  notifyEventStreamSubscribers();
}

export async function resumeQuotaExhaustedWorkers(args: {
  run: typeof runs.$inferSelect;
}): Promise<ResumeQuotaWorkersResult> {
  const incidents = await db.select().from(recoveryIncidents).where(and(
    eq(recoveryIncidents.runId, args.run.id),
    eq(recoveryIncidents.kind, "quota_exhausted"),
    inArray(recoveryIncidents.status, ["open", "recovering"]),
  ));
  const workerIncidents = incidents.filter((incident) => incident.workerId);
  if (workerIncidents.length === 0) {
    return { state: "none", resumedCount: 0 };
  }

  let resumedCount = 0;
  const yoloModeEnabled = await readWorkerYoloModeEnabled();
  const { env: envParams } = await readRuntimeEnvFromSettings();
  for (const incident of workerIncidents) {
    const worker = await db.select().from(workers).where(eq(workers.id, incident.workerId ?? "")).get();
    const sessionId = worker?.bridgeSessionId?.trim();
    if (!worker || !sessionId) {
      continue;
    }

    const workerMode = resolveWorkerLaunchMode(worker.bridgeSessionMode, yoloModeEnabled);
    try {
      let resumedWorker;
      try {
        resumedWorker = await spawnAgent({
          type: worker.type,
          cwd: worker.cwd,
          name: worker.id,
          ...(workerMode ? { mode: workerMode } : {}),
          env: envParams,
          ...(args.run.preferredWorkerModel ? { model: args.run.preferredWorkerModel } : {}),
          ...(args.run.preferredWorkerEffort ? { effort: args.run.preferredWorkerEffort } : {}),
          resumeSessionId: sessionId,
        });
      } catch (error) {
        if (!isAgentAlreadyExistsError(error, worker.id)) {
          throw error;
        }
        resumedWorker = await getAgent(worker.id, { retryIndefinitely: false });
      }

      await insertWorkerSessionResumedEvent({
        runId: args.run.id,
        workerId: worker.id,
        sessionId,
        incidentId: incident.id,
      });
      await db.update(workers).set({
        status: resumedWorker.state,
        bridgeSessionId: resumedWorker.sessionId ?? sessionId,
        bridgeSessionMode: resumedWorker.sessionMode ?? worker.bridgeSessionMode ?? null,
        updatedAt: new Date(),
      }).where(eq(workers.id, worker.id));
      if (shouldPromptResumedWorker(resumedWorker.state)) {
        await promptResumedQuotaWorker({
          runId: args.run.id,
          worker: {
            ...worker,
            status: resumedWorker.state,
            bridgeSessionId: resumedWorker.sessionId ?? sessionId,
            bridgeSessionMode: resumedWorker.sessionMode ?? worker.bridgeSessionMode ?? null,
          },
        });
      }
      await markRecoveryIncidentResolved({
        incidentId: incident.id,
        runId: args.run.id,
        workerId: worker.id,
        summary: "Worker session resumed after quota reset.",
        details: {
          recoveryState: "quota_resumed",
          recommendedAction: "none",
          sessionId,
        },
      });
      resumedCount += 1;
    } catch (error) {
      const quotaInfo = extractQuotaResetInfo(error, { provider: worker.type });
      if (quotaInfo.isQuotaError) {
        return handleWorkerQuotaExhaustion({
          runId: args.run.id,
          workerId: worker.id,
          text: quotaInfo.rawText,
          provider: worker.type,
        });
      }
      throw error;
    }
  }

  if (resumedCount > 0) {
    for (const incident of incidents.filter((candidate) => !candidate.workerId)) {
      await markRecoveryIncidentResolved({
        incidentId: incident.id,
        runId: args.run.id,
        workerId: null,
        summary: "Quota wait resolved after worker session resume.",
        details: {
          recoveryState: "quota_resumed",
          recommendedAction: "none",
        },
      });
    }
    notifyEventStreamSubscribers();
    return { state: "resumed", resumedCount };
  }
  return { state: "none", resumedCount: 0 };
}
