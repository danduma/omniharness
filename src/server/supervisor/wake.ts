import { recordExecutionEvent } from "@/server/events/execution-event-store";
import { and, desc, eq, gt, inArray, like } from "drizzle-orm";
import { db } from "@/server/db";
import { clarifications, executionEvents, runs, workers } from "@/server/db/schema";
import { persistRunFailure } from "@/server/runs/failures";
import { emitNamedEvent } from "@/server/events/named-events";
import { isActiveImplementationRun, isRunnableImplementationRun } from "@/server/runs/status";
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
const TRANSIENT_SUPERVISOR_RETRY_MS = 5_000;
const PRE_WORKER_LEASE_ORPHAN_GRACE_MS = 90_000;
const COMPLETION_EVENT_TYPES = new Set(["worker_turn_completed"]);
const COMPLETION_RESET_EVENT_TYPES = new Set(["worker_prompted", "worker_spawned", "worker_session_resumed", "worker_session_recreated"]);
const SESSION_RECREATED_RECOVERY_EVENT_TYPES = new Set(["worker_session_recreated", "worker_idle"]);
const PRE_WORKER_RECOVERY_EVENT_TYPES = new Set([
  "clarification_resolved",
  "supervisor_model_request_started",
  "supervisor_wake_retry_scheduled",
  "supervisor_wake_lease_recovered",
  "supervisor_turn_step_limit_reached",
  "supervisor_turn_stopped",
  "worker_selection_changed",
]);
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
  }).catch((error) => {
    emitNamedEvent({
      kind: "supervisor.durable_wake_schedule_failed",
      runId,
      reason: "supervisor_wait",
      source: "volatile-wake-backup",
      error: error instanceof Error ? error.message : String(error),
    });
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
  ).orderBy(desc(executionEvents.createdAt), desc(executionEvents.id)).limit(1).get();

  if (!latestWorkerEvent || COMPLETION_RESET_EVENT_TYPES.has(latestWorkerEvent.eventType)) {
    return false;
  }

  if (!COMPLETION_EVENT_TYPES.has(latestWorkerEvent.eventType)) {
    return false;
  }

  await clearSupervisorWakeLease(runId);
  emitNamedEvent({
    kind: "supervisor.wake_lease_recovered",
    runId,
    reason: "orphaned_completion",
  });
  await recordExecutionEvent({
    runId,
    eventType: "supervisor_wake_lease_recovered",
    details: {
      summary: "Cleared an orphaned supervisor wake lease after all workers were idle with completion evidence.",
      latestWorkerEventType: latestWorkerEvent.eventType,
      latestWorkerEventId: latestWorkerEvent.id,
    },
  });
  return true;
}

async function recoverRecreatedWorkerBlockedByOrphanedLease(runId: string) {
  const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
  if (!run || run.mode !== "implementation" || run.status !== "running") {
    return false;
  }

  const runWorkers = await db.select().from(workers).where(eq(workers.runId, runId));
  if (runWorkers.length === 0) {
    return false;
  }

  if (runWorkers.some((worker) => ACTIVE_WORKER_STATUS_PATTERN.test(worker.status))) {
    return false;
  }

  const workerIds = runWorkers.map((worker) => worker.id);
  const latestWorkerEvent = await db.select().from(executionEvents).where(
    inArray(executionEvents.workerId, workerIds),
  ).orderBy(desc(executionEvents.createdAt), desc(executionEvents.id)).limit(1).get();

  if (!latestWorkerEvent || !SESSION_RECREATED_RECOVERY_EVENT_TYPES.has(latestWorkerEvent.eventType)) {
    return false;
  }

  const latestSessionRecreatedEvent = latestWorkerEvent.eventType === "worker_session_recreated"
    ? latestWorkerEvent
    : await db.select().from(executionEvents).where(and(
      inArray(executionEvents.workerId, workerIds),
      eq(executionEvents.eventType, "worker_session_recreated"),
    )).orderBy(desc(executionEvents.createdAt), desc(executionEvents.id)).limit(1).get();

  if (!latestSessionRecreatedEvent) {
    return false;
  }

  const supervisorAfterRecreate = await db.select().from(executionEvents).where(and(
    eq(executionEvents.runId, runId),
    like(executionEvents.eventType, "supervisor_%"),
    gt(executionEvents.createdAt, latestSessionRecreatedEvent.createdAt),
  )).orderBy(desc(executionEvents.createdAt), desc(executionEvents.id)).limit(1).get();
  if (supervisorAfterRecreate) {
    return false;
  }

  await clearSupervisorWakeLease(runId);
  emitNamedEvent({
    kind: "supervisor.wake_lease_recovered",
    runId,
    reason: "orphaned_worker_session_recreated",
  });
  await recordExecutionEvent({
    runId,
    eventType: "supervisor_wake_lease_recovered",
    details: {
      summary: "Cleared an orphaned supervisor wake lease after a worker session was recreated and left idle.",
      latestWorkerEventType: latestWorkerEvent.eventType,
      latestWorkerEventId: latestWorkerEvent.id,
      latestSessionRecreatedEventId: latestSessionRecreatedEvent.id,
    },
  });
  return true;
}

async function recoverPreWorkerBlockedByOrphanedLease(runId: string) {
  const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
  if (!run || run.mode !== "implementation" || run.status !== "running") {
    return false;
  }

  const runWorkers = await db.select().from(workers).where(eq(workers.runId, runId));
  if (runWorkers.length > 0) {
    return false;
  }

  const pendingClarification = await db.select().from(clarifications).where(and(
    eq(clarifications.runId, runId),
    eq(clarifications.status, "pending"),
  )).limit(1).get();
  if (pendingClarification) {
    return false;
  }

  const latestEvent = await db.select().from(executionEvents)
    .where(eq(executionEvents.runId, runId))
    .orderBy(desc(executionEvents.createdAt), desc(executionEvents.id))
    .limit(1)
    .get();
  if (!latestEvent || !PRE_WORKER_RECOVERY_EVENT_TYPES.has(latestEvent.eventType)) {
    if (latestEvent?.eventType === "run_failed") {
      let error = "Supervisor wake failed before the first worker was attached.";
      try {
        const details = JSON.parse(latestEvent.details || "{}") as { error?: unknown; summary?: unknown };
        const parsed = typeof details.error === "string"
          ? details.error
          : typeof details.summary === "string"
            ? details.summary
            : "";
        if (parsed) {
          error = parsed;
        }
      } catch {
        // Keep the generic failure text when legacy event details are malformed.
      }
      await clearSupervisorWakeLease(runId);
      await persistRunFailure(runId, new Error(error), {
        surface: { code: "supervisor.wake.failed" },
      });
      emitNamedEvent({
        kind: "supervisor.wake_lease_recovered",
        runId,
        reason: "orphaned_pre_worker",
      });
      return true;
    }
    return false;
  }
  if (Date.now() - latestEvent.createdAt.getTime() < PRE_WORKER_LEASE_ORPHAN_GRACE_MS) {
    return false;
  }

  await clearSupervisorWakeLease(runId);
  emitNamedEvent({
    kind: "supervisor.wake_lease_recovered",
    runId,
    reason: "orphaned_pre_worker",
  });
  await recordExecutionEvent({
    runId,
    eventType: "supervisor_wake_lease_recovered",
    details: {
      summary: "Cleared an orphaned supervisor wake lease before the first worker was attached.",
      latestEventType: latestEvent.eventType,
      latestEventId: latestEvent.id,
    },
  });
  return true;
}

export async function executeSupervisorWake(runId: string) {
  clearWake(runId);
  if (inFlight.has(runId)) {
    emitNamedEvent({ kind: "supervisor.wake_skipped", runId, reason: "in_flight" });
    return;
  }

  const leaseId = await acquireSupervisorWakeLease(runId);
  if (!leaseId) {
    if (
      await recoverCompletionBlockedByOrphanedLease(runId)
      || await recoverRecreatedWorkerBlockedByOrphanedLease(runId)
      || await recoverPreWorkerBlockedByOrphanedLease(runId)
    ) {
      scheduleSupervisorWake(runId, 0);
      return;
    }
    emitNamedEvent({ kind: "supervisor.wake_skipped", runId, reason: "lease_blocked" });
    scheduleSupervisorWake(runId, LEASE_BLOCKED_RETRY_MS);
    return;
  }

  const dueDurableWake = await claimDueDurableSupervisorWake(runId);
  if (dueDurableWake) {
    emitNamedEvent({
      kind: "supervisor.durable_wake_claimed",
      runId,
      reason: dueDurableWake.reason,
      source: dueDurableWake.source,
    });
  }
  const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
  if (run?.status === "quota_waiting" && !dueDurableWake) {
    if (await hasFutureDurableSupervisorWake(runId)) {
      // Bypass the quota-wait short-circuit when a failover is pending,
      // so the observer-detected mid-run quota can be picked up on the
      // very next supervisor tick instead of waiting for the reset.
      const failoverPending = await isRunPendingFailover(runId);
      if (!failoverPending) {
        emitNamedEvent({ kind: "supervisor.wake_skipped", runId, reason: "quota_wait_future_wake" });
        await releaseSupervisorWakeLease(runId, leaseId);
        return;
      }
    }
  }

  if (!run || !isRunnableImplementationRun(run)) {
    emitNamedEvent({ kind: "supervisor.wake_skipped", runId, reason: "run_not_runnable" });
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
      await recordExecutionEvent({
        runId,
        eventType: "supervisor_wake_retry_scheduled",
        details: {
          summary: "Supervisor wake hit a transient error; retrying shortly.",
          delayMs: TRANSIENT_SUPERVISOR_RETRY_MS,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      scheduleSupervisorWake(runId, TRANSIENT_SUPERVISOR_RETRY_MS);
      return;
    }
    stopRunObserver(runId);
    await persistRunFailure(runId, error, {
      surface: { code: "supervisor.wake.failed" },
    });
  } finally {
    inFlight.delete(runId);
    await releaseSupervisorWakeLease(runId, leaseId);
  }
}

export function scheduleSupervisorWake(runId: string, delayMs = 0) {
  const nextDeadline = Date.now() + Math.max(0, delayMs);
  const currentDeadline = wakeDeadlines.get(runId);
  if (currentDeadline !== undefined && currentDeadline <= nextDeadline) {
    if (currentDeadline <= Date.now()) {
      clearWake(runId);
    } else {
      scheduleDurableWakeBackup(runId, currentDeadline, Math.max(0, currentDeadline - Date.now()));
      return;
    }
  }

  scheduleDurableWakeBackup(runId, nextDeadline, delayMs);

  clearWake(runId);
  wakeDeadlines.set(runId, nextDeadline);
  emitNamedEvent({
    kind: "supervisor.wake_scheduled",
    runId,
    delayMs: Math.max(0, delayMs),
    source: delayMs === LEASE_BLOCKED_RETRY_MS ? "lease_retry" : "volatile",
  });
  wakeTimers.set(runId, setTimeout(() => {
    void executeSupervisorWake(runId);
  }, Math.max(0, delayMs)));
}

export function cancelSupervisorWake(runId: string) {
  clearWake(runId);
  inFlight.delete(runId);
  void cancelDurableSupervisorWake(runId);
}
