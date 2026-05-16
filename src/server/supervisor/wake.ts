import { randomUUID } from "crypto";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { executionEvents, runs, workers } from "@/server/db/schema";
import { persistRunFailure } from "@/server/runs/failures";
import { isActiveImplementationRun } from "@/server/runs/status";
import { Supervisor } from "@/server/supervisor";
import { isTransientSupervisorError } from "@/server/supervisor/retry";
import { resumeQuotaExhaustedWorkers } from "@/server/quota/worker-resume";
import { clearResolvedQuotaIncidents } from "@/server/quota/type-blocking";
import { isRunPendingFailover } from "@/server/supervisor/worker-failover";
import { stopRunObserver } from "./observer";
import { acquireSupervisorWakeLease, clearSupervisorWakeLease, releaseSupervisorWakeLease } from "./lease";
import {
  cancelDurableSupervisorWake,
  claimDueDurableSupervisorWake,
  hasFutureDurableSupervisorWake,
  scheduleDurableSupervisorWakeAt,
} from "./wake-schedule";

const wakeTimers = new Map<string, ReturnType<typeof setTimeout>>();
const wakeDeadlines = new Map<string, number>();
const inFlight = new Set<string>();
const LEASE_BLOCKED_RETRY_MS = 1_000;
const COMPLETION_EVENT_TYPES = new Set(["worker_turn_completed"]);
const COMPLETION_RESET_EVENT_TYPES = new Set(["worker_prompted", "worker_spawned", "worker_session_resumed"]);
const ACTIVE_WORKER_STATUS_PATTERN = /\b(working|stuck|starting|pending|busy|running)\b/i;

function scheduleDurableWakeBackup(runId: string, nextDeadline: number, delayMs: number) {
  if (delayMs <= 0) {
    return;
  }

  void scheduleDurableSupervisorWakeAt({
    runId,
    wakeAt: new Date(nextDeadline),
    reason: "supervisor_wait",
    source: "volatile-wake-backup",
    details: { delayMs },
  });
}

function clearWake(runId: string) {
  const existing = wakeTimers.get(runId);
  if (existing) {
    clearTimeout(existing);
    wakeTimers.delete(runId);
  }
  wakeDeadlines.delete(runId);
}

async function recoverCompletionBlockedByOrphanedLease(runId: string) {
  const runWorkers = await db.select().from(workers).where(eq(workers.runId, runId));
  if (runWorkers.length === 0) {
    return false;
  }

  if (runWorkers.some((worker) => ACTIVE_WORKER_STATUS_PATTERN.test(worker.status))) {
    return false;
  }

  const latestWorkerEvent = await db.select().from(executionEvents).where(
    inArray(executionEvents.workerId, runWorkers.map((worker) => worker.id)),
  ).orderBy(desc(executionEvents.createdAt)).limit(1).get();

  if (!latestWorkerEvent || COMPLETION_RESET_EVENT_TYPES.has(latestWorkerEvent.eventType)) {
    return false;
  }

  if (!COMPLETION_EVENT_TYPES.has(latestWorkerEvent.eventType)) {
    return false;
  }

  await clearSupervisorWakeLease(runId);
  await db.insert(executionEvents).values({
    id: randomUUID(),
    runId,
    eventType: "supervisor_wake_lease_recovered",
    details: JSON.stringify({
      summary: "Cleared an orphaned supervisor wake lease after all workers were idle with completion evidence.",
      latestWorkerEventType: latestWorkerEvent.eventType,
      latestWorkerEventId: latestWorkerEvent.id,
    }),
    createdAt: new Date(),
  });
  return true;
}

export async function executeSupervisorWake(runId: string) {
  clearWake(runId);
  if (inFlight.has(runId)) {
    return;
  }

  const leaseId = await acquireSupervisorWakeLease(runId);
  if (!leaseId) {
    if (await recoverCompletionBlockedByOrphanedLease(runId)) {
      scheduleSupervisorWake(runId, 0);
      return;
    }
    scheduleSupervisorWake(runId, LEASE_BLOCKED_RETRY_MS);
    return;
  }

  const dueDurableWake = await claimDueDurableSupervisorWake(runId);
  const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
  if (run?.status === "quota_waiting" && !dueDurableWake) {
    if (await hasFutureDurableSupervisorWake(runId)) {
      // Bypass the quota-wait short-circuit when a failover is pending,
      // so the observer-detected mid-run quota can be picked up on the
      // very next supervisor tick instead of waiting for the reset.
      const failoverPending = await isRunPendingFailover(runId);
      if (!failoverPending) {
        await releaseSupervisorWakeLease(runId, leaseId);
        return;
      }
    }
  }

  if (!run || !isActiveImplementationRun(run)) {
    stopRunObserver(runId);
    await releaseSupervisorWakeLease(runId, leaseId);
    return;
  }

  if (dueDurableWake?.reason === "quota_wait" && run.status !== "quota_waiting") {
    // Sweep any stale quota incidents whose reset has elapsed — covers
    // failover-success runs whose runs.status never transitioned to
    // quota_waiting and which therefore wouldn't be touched by the
    // resumeQuotaExhaustedWorkers path below.
    await clearResolvedQuotaIncidents(runId);
  }
  if (run.status === "quota_waiting" && dueDurableWake) {
    await db.update(runs).set({
      status: "running",
      failedAt: null,
      lastError: null,
      updatedAt: new Date(),
    }).where(eq(runs.id, runId));
    if (dueDurableWake.reason === "quota_wait") {
      const quotaResumeResult = await resumeQuotaExhaustedWorkers({ run });
      if (quotaResumeResult.state === "quota_wait" || quotaResumeResult.state === "needs_recovery") {
        await releaseSupervisorWakeLease(runId, leaseId);
        return;
      }
    }
  }

  inFlight.add(runId);
  try {
    const supervisor = new Supervisor({ runId });
    const result = await supervisor.run();
    const latestRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    if (!isActiveImplementationRun(latestRun)) {
      clearWake(runId);
      void cancelDurableSupervisorWake(runId);
      stopRunObserver(runId);
    } else if (result.state === "wait") {
      scheduleSupervisorWake(runId, result.delayMs);
    } else if (result.state === "quota_wait") {
      clearWake(runId);
      stopRunObserver(runId);
    } else if (result.state === "completed" || result.state === "failed" || result.state === "paused") {
      clearWake(runId);
      if (result.state === "completed" || result.state === "failed") {
        void cancelDurableSupervisorWake(runId);
      }
      if (result.state === "completed" || result.state === "failed") {
        stopRunObserver(runId);
      }
    }
  } catch (error) {
    if (isTransientSupervisorError(error)) {
      scheduleSupervisorWake(runId, 5_000);
      return;
    }
    stopRunObserver(runId);
    await persistRunFailure(runId, error);
  } finally {
    inFlight.delete(runId);
    await releaseSupervisorWakeLease(runId, leaseId);
  }
}

export function scheduleSupervisorWake(runId: string, delayMs = 0) {
  const nextDeadline = Date.now() + Math.max(0, delayMs);
  const currentDeadline = wakeDeadlines.get(runId);
  if (currentDeadline !== undefined && currentDeadline <= nextDeadline) {
    scheduleDurableWakeBackup(runId, currentDeadline, Math.max(0, currentDeadline - Date.now()));
    return;
  }

  scheduleDurableWakeBackup(runId, nextDeadline, delayMs);

  clearWake(runId);
  wakeDeadlines.set(runId, nextDeadline);
  wakeTimers.set(runId, setTimeout(() => {
    void executeSupervisorWake(runId);
  }, Math.max(0, delayMs)));
}

export function cancelSupervisorWake(runId: string) {
  clearWake(runId);
  inFlight.delete(runId);
  void cancelDurableSupervisorWake(runId);
}
