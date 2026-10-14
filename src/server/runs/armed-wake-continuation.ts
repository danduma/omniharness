import { eq, isNotNull } from "drizzle-orm";
import { db } from "@/server/db";
import { withSqliteBusyRetry } from "@/server/db/retry";
import { workers } from "@/server/db/schema";
import { emitNamedEvent } from "@/server/events/named-events";
import { redactGoalErrorMessage } from "@/server/runs/goal-errors";
import {
  defaultContinuationDependencies,
  findContinuableStoppedWorker,
  markWorkerContinued,
  type GoalContinuationDependencies,
} from "@/server/runs/goal-worker-continuation";

type ArmedWakeLease = { runId: string; workerId: string; wakeAt: number };

export type ArmedWakeContinuationDependencies = Omit<GoalContinuationDependencies, "listPursuedGoals"> & {
  listArmedWakes(): Promise<ArmedWakeLease[]>;
  /** Workers whose goal the goal sweep already continues. */
  listGoalHolders(workerIds: readonly string[]): Promise<Set<string>>;
  clearArmedWake(workerId: string): Promise<void>;
};

/**
 * Sent to an agent whose process ended before a wake it armed could run. The
 * resumed session has the transcript but not the monitors, which is why it has
 * to look again instead of waiting for a notification.
 */
export const ARMED_WAKE_CONTINUATION_PROMPT = [
  "[OmniHarness] Your previous agent process stopped (a restart, crash or power loss) while you were waiting on a wake you had armed (a Monitor or ScheduleWakeup), and this session was resumed automatically.",
  "That wake and every other background task or monitor from before the stop are gone, so no notification from them will arrive. Detached processes you launched may still be running, or may have finished while you were stopped.",
  "Check the real state of that work (processes, logs, git), act on whatever finished, re-arm any monitoring that is still needed, and continue.",
].join(" ");

export async function persistWorkerArmedWake(workerId: string, wakeAt: number | null) {
  await withSqliteBusyRetry(() => db.update(workers).set({ armedWakeAt: wakeAt }).where(eq(workers.id, workerId)));
}

export const defaultArmedWakeContinuationDependencies: ArmedWakeContinuationDependencies = {
  ...defaultContinuationDependencies,
  async listArmedWakes() {
    const rows = await db
      .select({ runId: workers.runId, workerId: workers.id, wakeAt: workers.armedWakeAt })
      .from(workers)
      .where(isNotNull(workers.armedWakeAt));
    return rows.flatMap((row) => (row.wakeAt === null ? [] : [{ ...row, wakeAt: row.wakeAt }]));
  },
  async listGoalHolders(workerIds) {
    const { listWorkersHoldingActiveGoals } = await import("@/server/runs/goal-worker-lease");
    return listWorkersHoldingActiveGoals(workerIds);
  },
  clearArmedWake: (workerId) => persistWorkerArmedWake(workerId, null),
};

/**
 * Resume agents whose process died before a wake they armed could run.
 *
 * An agent coordinating background work ends its turn after arming a Monitor
 * or ScheduleWakeup and relies on it to start the next turn. Both live inside
 * the agent process, so when the runtime restarted, or reaped the agent, the
 * wake died with it and the conversation sat idle until the user asked why.
 * This sweep starts that turn instead. The goal sweep owns agents holding a
 * goal, so they are left to it.
 */
export async function continueArmedWakeWorkers(
  dependencies: ArmedWakeContinuationDependencies = defaultArmedWakeContinuationDependencies,
) {
  const leases = await dependencies.listArmedWakes();
  if (leases.length === 0) return { continued: 0 };
  const goalHolders = await dependencies.listGoalHolders(leases.map((lease) => lease.workerId));
  let continued = 0;
  for (const lease of leases) {
    if (goalHolders.has(lease.workerId)) continue;
    if (await continueArmedWakeWorker(lease, dependencies)) continued += 1;
  }
  return { continued };
}

async function continueArmedWakeWorker(lease: ArmedWakeLease, dependencies: ArmedWakeContinuationDependencies) {
  const worker = await findContinuableStoppedWorker(lease, dependencies);
  if (!worker) return false;

  markWorkerContinued(lease.runId, dependencies.now());
  emitNamedEvent({ kind: "worker.armed_wake_continuation.started", ...lease });
  try {
    await dependencies.sendContinuation(lease.runId, ARMED_WAKE_CONTINUATION_PROMPT);
    // The continuation is the turn the wake would have started.
    await dependencies.clearArmedWake(lease.workerId);
    emitNamedEvent({ kind: "worker.armed_wake_continuation.completed", ...lease });
    return true;
  } catch (error) {
    const reason = redactGoalErrorMessage(error);
    emitNamedEvent({ kind: "worker.armed_wake_continuation.failed", ...lease, reason });
    emitNamedEvent({
      kind: "error.surfaced",
      code: "worker.armed_wake_continuation.failed",
      message: `The agent stopped while waiting on a wake it armed and could not be resumed automatically: ${reason}`,
      surface: "banner",
      runId: lease.runId,
      workerId: lease.workerId,
    });
    return false;
  }
}
