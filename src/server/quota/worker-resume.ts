import { and, eq, inArray } from "drizzle-orm";
import { askAgent, cancelAgent, spawnAgent, getAgent, type AgentRecord } from "@/server/bridge-client";
import { db } from "@/server/db";
import { recoveryIncidents, runs, workers } from "@/server/db/schema";
import { recordExecutionEvent } from "@/server/events/execution-event-store";
import { emitNamedEvent } from "@/server/events/named-events";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
import { isRunnableImplementationRun, normalizeRunStatus } from "@/lib/run-status";
import { formatErrorMessage } from "@/server/runs/failures";
import {
  claimRecoveryIncident,
  markRecoveryIncidentNeedsUser,
  markRecoveryIncidentResolved,
} from "@/server/runs/recovery-incidents";
import { recordSupervisorIntervention } from "@/server/supervisor/interventions";
import { appendAskResponseFallbackEntry } from "@/server/workers/response-fallback";
import { persistWorkerSnapshot } from "@/server/workers/snapshots";
import { appendSupervisorInputOnDelivery } from "@/server/workers/stream-writer";
import { readWorkerYoloModeEnabled, resolveWorkerLaunchMode } from "@/server/worker-launch-mode";
import { resolveWorkerLaunchSelection } from "@/server/workers/launch-selection";
import { readWorkerAllocatedAccountId } from "@/server/workers/allocated-account";
import { readRuntimeEnvFromSettings } from "@/server/supervisor/runtime-settings";
import { isTransientSupervisorError } from "@/server/supervisor/retry";
import {
  hasFutureDurableSupervisorWake,
  scheduleDurableSupervisorWakeAt,
} from "@/server/supervisor/wake-schedule";
import {
  isWorkerTurnAbortedError,
  isWorkerTurnGenerationCurrent,
  isWorkerTurnSupersededError,
  readWorkerTurnGeneration,
  runWorkerTurn,
} from "@/server/conversations/worker-turn-gate";
import { runQuotaRecoveryMutation } from "@/server/quota/recovery-mutation";
import { extractQuotaResetInfo } from "./reset-parser";
import { clearResolvedQuotaIncidents } from "./type-blocking";
import {
  handleWorkerQuotaExhaustion,
  refuseLateQuotaRecovery,
  type QuotaRecoveryResult,
} from "./recovery";

type ResumeQuotaWorkersResult =
  | { state: "none"; resumedCount: number }
  | { state: "resumed"; resumedCount: number }
  | QuotaRecoveryResult;

/**
 * Where a direct-run quota resume was triggered from. Each source keeps its own
 * copy for the "nothing left to resume" message and the recorded event reason,
 * because those strings are what the banner and the event log show the user.
 */
export type DirectQuotaResumeSource = "durable_wake" | "watchdog_sweep" | "manual_resume";

const MISSING_SESSION_REASONS: Record<DirectQuotaResumeSource, string> = {
  durable_wake: "Quota reset arrived, but no resumable worker session was available.",
  watchdog_sweep: "Quota reset elapsed, but no resumable worker session was available.",
  manual_resume: "Quota reset resume was requested, but no resumable worker session was available.",
};

const MISSING_SESSION_EVENT_REASONS: Record<DirectQuotaResumeSource, string> = {
  durable_wake: "quota_wait",
  watchdog_sweep: "watchdog_sweep",
  manual_resume: "manual_resume",
};

const RESUMABLE_QUOTA_INCIDENT_STATUSES = ["open", "recovering"] as const;

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
  emitNamedEvent({ kind: "worker.reattached", runId: args.runId, workerId: args.workerId });
  await recordExecutionEvent({
    runId: args.runId,
    workerId: args.workerId,
    planItemId: null,
    eventType: "worker_session_resumed",
    details: {
      summary: `Resumed ${args.workerId} from saved session after quota reset.`,
      sessionId: args.sessionId,
      incidentId: args.incidentId,
      reason: "quota_wait",
    },
  });
}

async function promptResumedQuotaWorker(args: {
  runId: string;
  worker: typeof workers.$inferSelect;
  incidentId: string;
  turnGeneration: number;
}) {
  const prompt = buildQuotaResumePrompt(args.worker);
  const response = await runWorkerTurn(args.worker.id, () => askAgent(
    args.worker.id,
    prompt,
    undefined,
    { expectedTurnGeneration: args.turnGeneration },
  ));
  const deliveryRefusal = await runQuotaRecoveryMutation(args.runId, async () => {
    const refused = await refuseLateQuotaRecovery({
      runId: args.runId,
      workerId: args.worker.id,
      incidentId: args.incidentId,
      now: new Date(),
    });
    if (refused) return refused;
    if (!await isWorkerTurnGenerationCurrent(args.worker.id, args.turnGeneration)) {
      return { state: "superseded" as const };
    }
    const deliveredAt = new Date();
    await recordSupervisorIntervention({
      runId: args.runId,
      workerId: args.worker.id,
      prompt,
      summary: "Prompted worker to continue after quota reset.",
      interventionType: "recovery",
    });
    await appendSupervisorInputOnDelivery({
      runId: args.runId,
      workerId: args.worker.id,
      text: prompt,
      deliveredAt,
    });
    return null;
  });
  if (deliveryRefusal) {
    if (deliveryRefusal.state === "ignored") return deliveryRefusal;
    throw new Error(`Worker turn was superseded by a newer worker turn: ${args.worker.id}`);
  }
  let snapshot: AgentRecord | null = null;
  try {
    snapshot = await getAgent(args.worker.id, { retryIndefinitely: false });
    await persistWorkerSnapshot(args.worker.id, snapshot);
  } catch {
    // The ask response is still the durable fallback when the bridge snapshot is unavailable.
  }
  await appendAskResponseFallbackEntry({
    runId: args.runId,
    workerId: args.worker.id,
    responseText: response.response,
    snapshot,
  });
  const latestWorker = await db.select().from(workers).where(eq(workers.id, args.worker.id)).get();

  const persistenceRefusal = await runQuotaRecoveryMutation(args.runId, async () => {
    const refused = await refuseLateQuotaRecovery({
      runId: args.runId,
      workerId: args.worker.id,
      incidentId: args.incidentId,
      now: new Date(),
    });
    if (refused) return refused;
    const updated = await db.update(workers).set({
      status: response.state,
      currentText: "",
      lastText: "",
      outputLog: appendWorkerOutput(latestWorker?.outputLog ?? args.worker.outputLog, response.response),
      updatedAt: new Date(),
    }).where(and(
      eq(workers.id, args.worker.id),
      eq(workers.turnGeneration, args.turnGeneration),
    )).returning({ id: workers.id });
    if (updated.length === 0) return { state: "superseded" as const };
    await recordExecutionEvent({
      runId: args.runId,
      workerId: args.worker.id,
      planItemId: null,
      eventType: "worker_prompted",
      details: {
        summary: `Sent quota recovery follow-up to ${args.worker.id}`,
        prompt,
        reason: "quota_wait",
      },
      createdAt: new Date(),
    });
    return null;
  });
  if (persistenceRefusal) {
    if (persistenceRefusal.state === "ignored") return persistenceRefusal;
    throw new Error(`Worker turn was superseded by a newer worker turn: ${args.worker.id}`);
  }
  notifyEventStreamSubscribers();
  return null;
}

export async function resumeQuotaExhaustedWorkers(args: {
  run: typeof runs.$inferSelect;
}): Promise<ResumeQuotaWorkersResult> {
  const initialRefusal = await refuseLateQuotaRecovery({ runId: args.run.id, now: new Date() });
  if (initialRefusal) return initialRefusal;
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
  for (const candidateIncident of workerIncidents) {
    const worker = await db.select().from(workers).where(eq(workers.id, candidateIncident.workerId ?? "")).get();
    const sessionId = worker?.bridgeSessionId?.trim();
    if (!worker || !sessionId) {
      continue;
    }

    const incident = await runQuotaRecoveryMutation(args.run.id, async () => {
      const refused = await refuseLateQuotaRecovery({
        runId: args.run.id,
        workerId: worker.id,
        incidentId: candidateIncident.id,
        now: new Date(),
      });
      if (refused) return refused;
      return claimRecoveryIncident({
        incidentId: candidateIncident.id,
        runId: args.run.id,
        workerId: worker.id,
        decision: "resume_quota_worker",
        details: { sessionId, reason: "quota_wait" },
      });
    });
    if (!incident) {
      continue;
    }
    if ("state" in incident) return incident;

    const workerMode = resolveWorkerLaunchMode(worker.bridgeSessionMode, yoloModeEnabled);
    const launchSelection = resolveWorkerLaunchSelection(worker, args.run, {
      accountId: await readWorkerAllocatedAccountId(worker.id),
    });
    const turnGeneration = await readWorkerTurnGeneration(worker.id);
    try {
      let resumedWorker;
      try {
        resumedWorker = await spawnAgent({
          type: worker.type,
          cwd: worker.cwd,
          name: worker.id,
          ...(workerMode ? { mode: workerMode } : {}),
          env: envParams,
          ...(launchSelection.accountId ? { accountId: launchSelection.accountId } : {}),
          ...(launchSelection.model ? { model: launchSelection.model } : {}),
          ...(launchSelection.effort ? { effort: launchSelection.effort } : {}),
          resumeSessionId: sessionId,
        });
      } catch (error) {
        if (!isAgentAlreadyExistsError(error, worker.id)) {
          throw error;
        }
        resumedWorker = await getAgent(worker.id, { retryIndefinitely: false });
      }

      const resumeRefusal = await runQuotaRecoveryMutation(args.run.id, async () => {
        const refused = await refuseLateQuotaRecovery({
          runId: args.run.id,
          workerId: worker.id,
          incidentId: incident.id,
          now: new Date(),
        });
        if (refused) return refused;
        const updated = await db.update(workers).set({
          status: resumedWorker.state,
          bridgeSessionId: resumedWorker.sessionId ?? sessionId,
          bridgeSessionMode: resumedWorker.sessionMode ?? worker.bridgeSessionMode ?? null,
          currentText: resumedWorker.currentText ?? "",
          lastText: resumedWorker.lastText ?? "",
          updatedAt: new Date(),
        }).where(and(
          eq(workers.id, worker.id),
          eq(workers.turnGeneration, turnGeneration),
        )).returning({ id: workers.id });
        if (updated.length === 0) {
          return { state: "superseded" as const };
        }
        await insertWorkerSessionResumedEvent({
          runId: args.run.id,
          workerId: worker.id,
          sessionId,
          incidentId: incident.id,
        });
      // Resolve before prompting, not after. The successful resume is already
      // proof the quota window reopened; `promptResumedQuotaWorker` then awaits
      // a full agent turn, and sequencing the resolve behind it left the
      // incident `open` — and the "Waiting for quota reset" banner up — for the
      // entire turn, while the worker was visibly working. If the window did
      // not actually reopen, the ask below throws and the catch reopens a fresh
      // incident via `handleWorkerQuotaExhaustion`.
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
        return null;
      });
      if (resumeRefusal) {
        void cancelAgent(worker.id).catch(() => undefined);
        if (resumeRefusal.state === "ignored") return resumeRefusal;
        throw new Error(`Worker turn was superseded by a newer worker turn: ${worker.id}`);
      }
      resumedCount += 1;
      notifyEventStreamSubscribers();
      if (shouldPromptResumedWorker(resumedWorker.state)) {
        const promptRefusal = await promptResumedQuotaWorker({
          runId: args.run.id,
          worker: {
            ...worker,
            status: resumedWorker.state,
            bridgeSessionId: resumedWorker.sessionId ?? sessionId,
            bridgeSessionMode: resumedWorker.sessionMode ?? worker.bridgeSessionMode ?? null,
          },
          incidentId: incident.id,
          turnGeneration,
        });
        if (promptRefusal) return promptRefusal;
      }
    } catch (error) {
      const caughtRefusal = await refuseLateQuotaRecovery({
        runId: args.run.id,
        workerId: worker.id,
        incidentId: incident.id,
        now: new Date(),
      });
      if (caughtRefusal) return caughtRefusal;
      if (isWorkerTurnSupersededError(error) || isWorkerTurnAbortedError(error)) {
        const supersededRefusal = await runQuotaRecoveryMutation(args.run.id, async () => {
          const refused = await refuseLateQuotaRecovery({
            runId: args.run.id,
            workerId: worker.id,
            incidentId: incident.id,
            now: new Date(),
          });
          if (refused) return refused;
          emitNamedEvent({
            kind: "worker.recovery_continuation_superseded",
            runId: args.run.id,
            workerId: worker.id,
          });
          await recordExecutionEvent({
            runId: args.run.id,
            workerId: worker.id,
            planItemId: null,
            eventType: "quota_resume_prompt_superseded",
            details: {
              summary: `Stopped the automatic quota-resume prompt for ${worker.id} because a newer turn took over.`,
              incidentId: incident.id,
            },
          });
          await markRecoveryIncidentResolved({
            incidentId: incident.id,
            runId: args.run.id,
            workerId: worker.id,
            summary: "Quota recovery handed control to a newer worker turn.",
            details: {
              recoveryState: "quota_resumed",
              recommendedAction: "none",
              sessionId,
              continuationSuperseded: true,
            },
          });
          return null;
        });
        if (supersededRefusal) return supersededRefusal;
        resumedCount += 1;
        continue;
      }
      const quotaInfo = extractQuotaResetInfo(error, { provider: worker.type });
      if (quotaInfo.isQuotaError) {
        return handleWorkerQuotaExhaustion({
          runId: args.run.id,
          workerId: worker.id,
          text: quotaInfo.rawText,
          provider: worker.type,
        });
      }

      const reason = error instanceof Error ? error.message : String(error);
      if (isTransientSupervisorError(error)) {
        const transientRefusal = await runQuotaRecoveryMutation(args.run.id, async () => {
          const refused = await refuseLateQuotaRecovery({
            runId: args.run.id,
            workerId: worker.id,
            incidentId: incident.id,
            now: new Date(),
          });
          if (refused) return refused;
          await db.update(recoveryIncidents).set({
            status: "open",
            lastError: reason,
            updatedAt: new Date(),
          }).where(eq(recoveryIncidents.id, incident.id));
          return null;
        });
        if (transientRefusal) return transientRefusal;
        throw error;
      }

      const failureRefusal = await runQuotaRecoveryMutation(args.run.id, async () => {
        const refused = await refuseLateQuotaRecovery({
          runId: args.run.id,
          workerId: worker.id,
          incidentId: incident.id,
          now: new Date(),
        });
        if (refused) return refused;
        await db.update(runs).set({
          status: "needs_recovery",
          failedAt: null,
          lastError: reason,
          updatedAt: new Date(),
        }).where(eq(runs.id, args.run.id));
        await db.update(workers).set({
          status: "error",
          currentText: "",
          updatedAt: new Date(),
        }).where(eq(workers.id, worker.id));
        await markRecoveryIncidentNeedsUser({
          incidentId: incident.id,
          runId: args.run.id,
          workerId: worker.id,
          reason,
          details: {
            resumeFailed: true,
            sessionId,
            errorType: "non_quota_resume_failure",
          },
        });
        await recordExecutionEvent({
          runId: args.run.id,
          workerId: worker.id,
          planItemId: null,
          eventType: "quota_resume_failed",
          details: {
            summary: `Quota recovery could not resume ${worker.id}.`,
            incidentId: incident.id,
            reason,
            sessionId,
          },
        });
        return null;
      });
      if (failureRefusal) return failureRefusal;
      notifyEventStreamSubscribers();
      return {
        state: "needs_recovery" as const,
        runId: args.run.id,
        incidentId: incident.id,
        quota: quotaInfo,
      };
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

/**
 * Resume a non-implementation (direct/commit) run once its quota window has
 * reopened, and settle the run status afterwards.
 *
 * Callers must decide *whether* to resume from the open `quota_exhausted`
 * incident — never from `runs.status`. Direct-run status is rewritten by
 * conversation sync and the worker-output resolver, neither of which knows
 * about quota, so a run parked as `quota_waiting` can be flipped to
 * `running`/`done` before the reset lands.
 */
export async function resumeDirectRunAfterQuotaReset(args: {
  run: typeof runs.$inferSelect;
  source: DirectQuotaResumeSource;
}): Promise<ResumeQuotaWorkersResult> {
  const transitionRefusal = await runQuotaRecoveryMutation(args.run.id, async () => {
    const refused = await refuseLateQuotaRecovery({ runId: args.run.id, now: new Date() });
    if (refused) return refused;
    await db.update(runs).set({
      status: "running",
      failedAt: null,
      lastError: null,
      updatedAt: new Date(),
    }).where(eq(runs.id, args.run.id));
    return null;
  });
  if (transitionRefusal) return transitionRefusal;

  const result = await resumeQuotaExhaustedWorkers({ run: args.run });
  if (result.state !== "none" || result.resumedCount !== 0) {
    return result;
  }

  const reason = MISSING_SESSION_REASONS[args.source];
  const missingSessionRefusal = await runQuotaRecoveryMutation(args.run.id, async () => {
    const refused = await refuseLateQuotaRecovery({ runId: args.run.id, now: new Date() });
    if (refused) return refused;
    await db.update(runs).set({
      status: "needs_recovery",
      lastError: reason,
      updatedAt: new Date(),
    }).where(eq(runs.id, args.run.id));
    await recordExecutionEvent({
      runId: args.run.id,
      eventType: "quota_resume_missing_session",
      details: { summary: reason, reason: MISSING_SESSION_EVENT_REASONS[args.source] },
    });
    emitNamedEvent({
      kind: "error.surfaced",
      code: "recovery.needs_user",
      message: reason,
      surface: "banner",
      runId: args.run.id,
    });
    return null;
  });
  if (missingSessionRefusal) return missingSessionRefusal;
  return result;
}

function incidentResumeAt(details: string | null | undefined) {
  if (!details) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(details);
    const value = parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as { resumeAt?: unknown }).resumeAt
      : null;
    if (typeof value !== "string") {
      return null;
    }
    const resumeAt = new Date(value);
    return Number.isNaN(resumeAt.getTime()) ? null : resumeAt;
  } catch {
    return null;
  }
}

export async function hasResumableQuotaIncident(runId: string) {
  const incident = await db.select().from(recoveryIncidents).where(and(
    eq(recoveryIncidents.runId, runId),
    eq(recoveryIncidents.kind, "quota_exhausted"),
    inArray(recoveryIncidents.status, [...RESUMABLE_QUOTA_INCIDENT_STATUSES]),
  )).limit(1).get();
  return Boolean(incident);
}

/**
 * Safety net for direct runs whose durable quota wake never delivered a resume
 * — the wake row is consumed before the handler decides what to do, so any bail
 * after the claim destroys the only retry record. Sweeps every open
 * `quota_exhausted` incident whose reset has already elapsed and resumes it.
 *
 * Runs with a future durable wake are left alone; that wake is still the
 * primary path. `claimRecoveryIncident` debounces re-entry for 60s, and a
 * failed resume moves the incident to `needs_user`, so repeated sweeps cannot
 * spin on the same run.
 */
export async function resumeElapsedQuotaWaits(options: { now?: Date } = {}) {
  const now = options.now ?? new Date();
  const incidents = await db.select().from(recoveryIncidents).where(and(
    eq(recoveryIncidents.kind, "quota_exhausted"),
    inArray(recoveryIncidents.status, [...RESUMABLE_QUOTA_INCIDENT_STATUSES]),
  ));

  const elapsedRunIds = Array.from(new Set<string>(incidents
    .filter((incident) => {
      const resumeAt = incidentResumeAt(incident.details);
      return resumeAt !== null && resumeAt.getTime() <= now.getTime();
    })
    .map((incident) => incident.runId)));

  let sweptCount = 0;
  let clearedCount = 0;
  for (const runId of elapsedRunIds) {
    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    if (!run || run.archivedAt) {
      continue;
    }
    if (normalizeRunStatus(run.status) === "cancelled" || normalizeRunStatus(run.status) === "canceled") {
      continue;
    }
    if (await hasFutureDurableSupervisorWake(runId, now.getTime())) {
      continue;
    }

    // Implementation runs park at `quota_waiting`, which the watchdog loop
    // below deliberately skips — so a lost wake strands them exactly like a
    // direct conversation. Re-arm a due wake rather than resuming here, so the
    // normal (well-tested) wake handler does the work. This converges: the
    // handler either resolves the incident or moves the run out of
    // `quota_waiting`, and either outcome stops matching on the next sweep.
    if (run.mode === "implementation") {
      if (isRunnableImplementationRun(run) && normalizeRunStatus(run.status) === "quota_waiting") {
        const sweepRefusal = await runQuotaRecoveryMutation(runId, async () => {
          const refused = await refuseLateQuotaRecovery({ runId, now });
          if (refused) return refused;
          await scheduleDurableSupervisorWakeAt({
            runId,
            wakeAt: now,
            reason: "quota_wait",
            source: "watchdog-sweep",
            force: true,
          });
          emitNamedEvent({ kind: "supervisor.quota_wake_swept", runId, status: run.status, action: "rescheduled" });
          return null;
        });
        if (!sweepRefusal) sweptCount += 1;
      }
      continue;
    }

    const runWorkers = await db.select().from(workers).where(eq(workers.runId, runId));
    const blockedWorker = runWorkers.find((worker) => (
      worker.status === "cred-exhausted" && Boolean(worker.bridgeSessionId?.trim())
    ));
    if (!blockedWorker) {
      // The worker already came back on its own (or has no resumable session),
      // so the incident is stale bookkeeping that only keeps the "waiting for
      // quota reset" banner up. Close it without touching the agent — resuming
      // a conversation the user considers finished would start unrequested work.
      const { resolvedCount } = await clearResolvedQuotaIncidents(runId, { now });
      if (resolvedCount > 0) {
        emitNamedEvent({ kind: "supervisor.quota_wake_swept", runId, status: run.status, action: "cleared" });
        clearedCount += 1;
      }
      continue;
    }

    const resumeResult = await resumeDirectRunAfterQuotaReset({ run, source: "watchdog_sweep" });
    if (resumeResult.state === "ignored") {
      continue;
    }
    emitNamedEvent({ kind: "supervisor.quota_wake_swept", runId, status: run.status, action: "resumed" });
    await recordExecutionEvent({
      runId,
      eventType: "quota_wait_swept",
      details: {
        summary: "Quota reset had elapsed with no scheduled wake; resumed from the open incident.",
        runStatus: run.status,
        workerId: blockedWorker.id,
        reason: "watchdog_sweep",
      },
    });
    sweptCount += 1;
  }

  return { sweptCount, clearedCount };
}
