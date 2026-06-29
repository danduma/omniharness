import { and, eq, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { withSqliteBusyRetry } from "@/server/db/retry";
import { runs, supervisorScheduledWakes } from "@/server/db/schema";
import { isTerminalRunStatus } from "@/server/runs/status";

const MAX_TIMER_DELAY_MS = 2_147_483_647;

type DurableWakeExecutor = (runId: string) => Promise<void>;

export type DurableSupervisorWakeArgs = {
  runId: string;
  wakeAt: Date;
  reason: string;
  source?: string | null;
  incidentId?: string | null;
  details?: Record<string, unknown> | null;
  force?: boolean;
};

let durableWakeExecutor: DurableWakeExecutor = async (runId) => {
  const wake = await import("./wake");
  await wake.executeSupervisorWake(runId);
};

const durableTimers = new Map<string, ReturnType<typeof setTimeout>>();

function serializeDetails(details: Record<string, unknown> | null | undefined) {
  return details ? JSON.stringify(details) : null;
}

function clearDurableTimer(runId: string) {
  const existing = durableTimers.get(runId);
  if (existing) {
    clearTimeout(existing);
    durableTimers.delete(runId);
  }
}

function armDurableTimer(runId: string, wakeAt: Date) {
  clearDurableTimer(runId);
  const delayMs = Math.max(0, wakeAt.getTime() - Date.now());
  const chunkMs = Math.min(delayMs, MAX_TIMER_DELAY_MS);
  durableTimers.set(runId, setTimeout(() => {
    durableTimers.delete(runId);
    if (delayMs > MAX_TIMER_DELAY_MS) {
      void rearmDurableSupervisorWake(runId);
      return;
    }
    void durableWakeExecutor(runId);
  }, chunkMs));
}

async function rearmDurableSupervisorWake(runId: string) {
  const row = await db.select().from(supervisorScheduledWakes).where(eq(supervisorScheduledWakes.runId, runId)).get();
  if (row) {
    armDurableTimer(runId, row.wakeAt);
  }
}

export async function scheduleDurableSupervisorWakeAt(args: DurableSupervisorWakeArgs) {
  const now = new Date();
  const record = {
    runId: args.runId,
    wakeAt: args.wakeAt,
    reason: args.reason,
    source: args.source ?? null,
    incidentId: args.incidentId ?? null,
    details: serializeDetails(args.details),
    createdAt: now,
    updatedAt: now,
  };

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

  const scheduled = await db
    .select()
    .from(supervisorScheduledWakes)
    .where(eq(supervisorScheduledWakes.runId, args.runId))
    .get();

  if (!scheduled) {
    throw new Error(`Failed to schedule durable supervisor wake for run ${args.runId}`);
  }

  armDurableTimer(args.runId, scheduled.wakeAt);
  return scheduled;
}

export async function cancelDurableSupervisorWake(runId: string, reason?: string) {
  clearDurableTimer(runId);
  await withSqliteBusyRetry(() => db.delete(supervisorScheduledWakes).where(
    reason
      ? and(eq(supervisorScheduledWakes.runId, runId), eq(supervisorScheduledWakes.reason, reason))
      : eq(supervisorScheduledWakes.runId, runId),
  ));
}

export async function claimDueDurableSupervisorWake(runId: string, nowMs = Date.now()) {
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

  clearDurableTimer(runId);
  return claimed[0];
}

export async function getDurableSupervisorWake(runId: string) {
  return db.select().from(supervisorScheduledWakes).where(eq(supervisorScheduledWakes.runId, runId)).get();
}

export async function hasFutureDurableSupervisorWake(runId: string, nowMs = Date.now()) {
  const row = await getDurableSupervisorWake(runId);
  return Boolean(row && row.wakeAt.getTime() > nowMs);
}

export async function rehydrateDurableSupervisorWakes() {
  const rows = await db.select().from(supervisorScheduledWakes);
  for (const row of rows) {
    const run = await db.select().from(runs).where(eq(runs.id, row.runId)).get();
    if (!run || isTerminalRunStatus(run.status) || run.archivedAt) {
      await cancelDurableSupervisorWake(row.runId);
      continue;
    }
    armDurableTimer(row.runId, row.wakeAt);
  }
}

export async function cancelDurableSupervisorWakesForTerminalRuns() {
  const terminalRuns = await db.select({ id: runs.id }).from(runs).where(inArray(runs.status, [
    "done",
    "failed",
    "cancelled",
    "canceled",
    "promoting",
    "promoted",
  ]));
  for (const run of terminalRuns) {
    await cancelDurableSupervisorWake(run.id);
  }
}

export function setDurableSupervisorWakeExecutorForTests(executor: DurableWakeExecutor) {
  durableWakeExecutor = executor;
}

export function resetDurableSupervisorWakeSchedulerForTests() {
  for (const runId of durableTimers.keys()) {
    clearDurableTimer(runId);
  }
  durableWakeExecutor = async (runId) => {
    const wake = await import("./wake");
    await wake.executeSupervisorWake(runId);
  };
}
