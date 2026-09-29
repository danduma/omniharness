import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { runs, workers } from "@/server/db/schema";
import { emitNamedEvent } from "@/server/events/named-events";
import { redactGoalErrorMessage } from "@/server/runs/goal-errors";
import type { GoalSnapshot } from "@/shared/goal-plan";

type RunRecord = typeof runs.$inferSelect;
type WorkerRecord = typeof workers.$inferSelect;

type RevivalDependencies = {
  loadRun(runId: string): Promise<RunRecord | undefined>;
  loadWorker(workerId: string): Promise<WorkerRecord | undefined>;
  resumeWorker(run: RunRecord, worker: WorkerRecord): Promise<unknown>;
};

const defaultDependencies: RevivalDependencies = {
  loadRun: (runId) => db.select().from(runs).where(eq(runs.id, runId)).get(),
  loadWorker: (workerId) => db.select().from(workers).where(eq(workers.id, workerId)).get(),
  resumeWorker: async (run, worker) => {
    const { resumeMissingDirectWorker } = await import("@/server/conversations/send-message");
    return resumeMissingDirectWorker(run, worker);
  },
};

const CANCELLED_STATUSES = new Set(["cancelled", "canceled"]);

function normalizedStatus(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase().split(":")[0]?.trim() ?? "";
}

const inFlight = new Map<string, Promise<void>>();

/**
 * Bring back the leased worker of a goal the runtime could not deliver.
 *
 * The runtime reaps idle agents, so a goal set on a conversation that sat idle
 * found no live worker and was parked as `no_active_lease` until the user sent
 * another message. That message is what used to resume the worker, and the
 * session initialization that follows is what delivers the goal. Resuming here
 * gives the goal the same path without waiting for the user.
 *
 * Runs in the background: the resumed session delivers the goal while it
 * initializes and the runtime holds that spawn open for the goal's first
 * turn, so the caller must not await it.
 */
export function reviveGoalWorker(
  snapshot: GoalSnapshot,
  dependencies: RevivalDependencies = defaultDependencies,
): Promise<void> {
  const pending = inFlight.get(snapshot.runId);
  if (pending) return pending;
  const revival = revive(snapshot, dependencies).finally(() => {
    inFlight.delete(snapshot.runId);
  });
  inFlight.set(snapshot.runId, revival);
  return revival;
}

async function revive(snapshot: GoalSnapshot, dependencies: RevivalDependencies) {
  const skip = (reason: string) => {
    emitNamedEvent({
      kind: "goal.worker_revival.skipped",
      runId: snapshot.runId,
      goalId: snapshot.goalId,
      workerId: snapshot.workerId,
      reason,
    });
  };
  if (snapshot.status !== "pending" && snapshot.status !== "pursuing") return skip(`goal_${snapshot.status}`);
  if (!snapshot.workerId) return skip("no_leased_worker");

  try {
    const [run, worker] = await Promise.all([
      dependencies.loadRun(snapshot.runId),
      dependencies.loadWorker(snapshot.workerId),
    ]);
    if (!run || !worker || worker.runId !== run.id) return skip("worker_absent");
    // Supervised runs own their workers' lifecycle; only a direct conversation
    // resumes its worker on behalf of the user.
    if (run.mode !== "direct" && run.mode !== "commit") return skip("not_direct_run");
    if (CANCELLED_STATUSES.has(normalizedStatus(run.status))) return skip("run_cancelled");
    if (CANCELLED_STATUSES.has(normalizedStatus(worker.status))) return skip("worker_cancelled");

    emitNamedEvent({
      kind: "goal.worker_revival.started",
      runId: snapshot.runId,
      goalId: snapshot.goalId,
      workerId: worker.id,
    });
    await dependencies.resumeWorker(run, worker);
    emitNamedEvent({
      kind: "goal.worker_revival.completed",
      runId: snapshot.runId,
      goalId: snapshot.goalId,
      workerId: worker.id,
    });
  } catch (error) {
    const reason = redactGoalErrorMessage(error);
    emitNamedEvent({
      kind: "goal.reconciliation.failed",
      runId: snapshot.runId,
      goalId: snapshot.goalId,
      workerId: snapshot.workerId,
      reason,
    });
    emitNamedEvent({
      kind: "error.surfaced",
      code: "goal.reconciliation.failed",
      message: reason,
      surface: "banner",
      runId: snapshot.runId,
      ...(snapshot.workerId ? { workerId: snapshot.workerId } : {}),
    });
  }
}
