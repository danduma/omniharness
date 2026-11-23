import { and, eq, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { withSqliteBusyRetry } from "@/server/db/retry";
import { runs, supervisorScheduledWakes } from "@/server/db/schema";
import { isTerminalRunStatus } from "@/server/runs/status";
import { persistRunFailure } from "@/server/runs/failures";
import { emitNamedEvent } from "@/server/events/named-events";
import { withRunWorkspaceMutationLock } from "@/server/handoff/workspace-lock";

/**
 * Durable quota-reset timers.
 *
 * When a worker runs out of quota, the run is parked and a row records when to
 * try again. The row outlives the process: `rehydrateQuotaWakes` re-arms every
 * timer at boot, and `resumeElapsedQuotaWaits` sweeps any reset whose timer was
 * lost. The table keeps its historical `supervisor_scheduled_wakes` name so
 * existing rows still fire.
 */

const MAX_TIMER_DELAY_MS = 2_147_483_647;

type QuotaWakeExecutor = (runId: string) => Promise<void>;

export type QuotaWakeArgs = {
  runId: string;
  wakeAt: Date;
  reason: string;
  source?: string | null;
  incidentId?: string | null;
  details?: Record<string, unknown> | null;
  force?: boolean;
};

export async function executeQuotaWake(runId: string) {
  await withRunWorkspaceMutationLock(runId, async () => {
    const wake = await claimDueQuotaWake(runId);
    if (!wake) return;
    emitNamedEvent({ kind: "quota.wake_claimed", runId, reason: wake.reason, source: wake.source });
    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    if (!run) {
      emitNamedEvent({ kind: "quota.wake_dropped", runId, reason: "run_missing", status: null });
      return;
    }
    // Imported lazily: worker-resume pulls in the bridge client and the
    // conversation graph, which import this module.
    const { hasResumableQuotaIncident, resumeDirectRunAfterQuotaReset } = await import("./worker-resume");
    if (run.status !== "quota_waiting" && !(wake.reason === "quota_wait" && await hasResumableQuotaIncident(runId))) {
      emitNamedEvent({ kind: "quota.wake_dropped", runId, reason: "no_open_incident", status: run.status });
      return;
    }
    await resumeDirectRunAfterQuotaReset({ run, source: "durable_wake" });
  });
}

let quotaWakeExecutor: QuotaWakeExecutor = executeQuotaWake;

const timers = new Map<string, ReturnType<typeof setTimeout>>();

function runDetachedQuotaWakeTask(runId: string, task: () => Promise<void>) {
  void Promise.resolve().then(task).catch((error) => {
    void persistRunFailure(runId, error, {
      surface: { code: "quota.wake.failed" },
    }).catch((persistenceError) => {
      console.error("[quota-wake] Failed to record a detached wake failure", {
        runId,
        error: error instanceof Error ? error.message : String(error),
        persistenceError: persistenceError instanceof Error ? persistenceError.message : String(persistenceError),
      });
    });
  });
}

function clearTimer(runId: string) {
  const existing = timers.get(runId);
  if (existing) {
    clearTimeout(existing);
    timers.delete(runId);
  }
}

function armTimer(runId: string, wakeAt: Date) {
  clearTimer(runId);
  const delayMs = Math.max(0, wakeAt.getTime() - Date.now());
  const chunkMs = Math.min(delayMs, MAX_TIMER_DELAY_MS);
  timers.set(runId, setTimeout(() => {
    timers.delete(runId);
    if (delayMs > MAX_TIMER_DELAY_MS) {
      runDetachedQuotaWakeTask(runId, () => rearmQuotaWake(runId));
      return;
    }
    runDetachedQuotaWakeTask(runId, () => quotaWakeExecutor(runId));
  }, chunkMs));
}

async function rearmQuotaWake(runId: string) {
  const row = await getQuotaWake(runId);
  if (row) {
    armTimer(runId, row.wakeAt);
  }
}

export async function scheduleQuotaWakeAt(args: QuotaWakeArgs) {
  const now = new Date();
  const record = {
    runId: args.runId,
    wakeAt: args.wakeAt,
    reason: args.reason,
    source: args.source ?? null,
    incidentId: args.incidentId ?? null,
    details: args.details ? JSON.stringify(args.details) : null,
    createdAt: now,
    updatedAt: now,
  };

  // A quota wait outranks any other pending wake; within the same rank the
  // earlier wake wins unless the caller forces a replacement.
  const incomingPriority = sql`case when excluded.reason = 'quota_wait' then 2 else 1 end`;
  const existingPriority = sql`case when ${supervisorScheduledWakes.reason} = 'quota_wait' then 2 else 1 end`;
  const nonForcedReplacement = sql`
    ${incomingPriority} > ${existingPriority}
    or (
      ${incomingPriority} = ${existingPriority}
      and excluded.wake_at < ${supervisorScheduledWakes.wakeAt}
    )
  `;

  await withSqliteBusyRetry(() => db.insert(supervisorScheduledWakes)
    .values(record)
    .onConflictDoUpdate({
      target: supervisorScheduledWakes.runId,
      set: {
        wakeAt: sql`excluded.wake_at`,
        reason: sql`excluded.reason`,
        source: sql`excluded.source`,
        incidentId: sql`excluded.incident_id`,
        details: sql`excluded.details`,
        updatedAt: sql`excluded.updated_at`,
      },
      ...(args.force ? {} : { setWhere: nonForcedReplacement }),
    }));

  const scheduled = await getQuotaWake(args.runId);
  if (!scheduled) {
    throw new Error(`Failed to schedule quota wake for run ${args.runId}`);
  }

  armTimer(args.runId, scheduled.wakeAt);
  return scheduled;
}

export async function cancelQuotaWake(runId: string, reason?: string) {
  clearTimer(runId);
  await withSqliteBusyRetry(() => db.delete(supervisorScheduledWakes).where(
    reason
      ? and(eq(supervisorScheduledWakes.runId, runId), eq(supervisorScheduledWakes.reason, reason))
      : eq(supervisorScheduledWakes.runId, runId),
  ));
}

export async function claimDueQuotaWake(runId: string, nowMs = Date.now()) {
  const claimed = await withSqliteBusyRetry(() => db
    .delete(supervisorScheduledWakes)
    .where(and(
      eq(supervisorScheduledWakes.runId, runId),
      lte(supervisorScheduledWakes.wakeAt, new Date(nowMs)),
    ))
    .returning());

  if (!claimed[0]) {
    return null;
  }

  clearTimer(runId);
  return claimed[0];
}

export async function getQuotaWake(runId: string) {
  return db.select().from(supervisorScheduledWakes).where(eq(supervisorScheduledWakes.runId, runId)).get();
}

export async function hasFutureQuotaWake(runId: string, nowMs = Date.now()) {
  const row = await getQuotaWake(runId);
  return Boolean(row && row.wakeAt.getTime() > nowMs);
}

export async function rehydrateQuotaWakes() {
  const rows = await db.select().from(supervisorScheduledWakes);
  for (const row of rows) {
    const run = await db.select().from(runs).where(eq(runs.id, row.runId)).get();
    if (!run || isTerminalRunStatus(run.status) || run.archivedAt) {
      await cancelQuotaWake(row.runId);
      continue;
    }
    armTimer(row.runId, row.wakeAt);
  }
}

export async function cancelQuotaWakesForTerminalRuns() {
  const terminalRuns = await db.select({ id: runs.id }).from(runs).where(inArray(runs.status, [
    "done",
    "failed",
    "cancelled",
    "canceled",
  ]));
  for (const run of terminalRuns) {
    await cancelQuotaWake(run.id);
  }
}

export function setQuotaWakeExecutorForTests(executor: QuotaWakeExecutor) {
  quotaWakeExecutor = executor;
}

export function resetQuotaWakeSchedulerForTests() {
  for (const runId of timers.keys()) {
    clearTimer(runId);
  }
  quotaWakeExecutor = executeQuotaWake;
}
