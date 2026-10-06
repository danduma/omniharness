import { dbClient } from "@/server/db";
import { emitNamedEvent } from "@/server/events/named-events";
import { goalAcpDispatcher, type GoalAcpDispatchResult } from "@/server/runs/goal-acp";
import { goalControl, type GoalControlMethod } from "@/server/runs/goal-control";
import { goalOutboxDispatcher } from "@/server/runs/goal-outbox";
import { redactGoalErrorMessage } from "@/server/runs/goal-errors";
import type { GoalMutationAction, GoalSnapshot } from "@/shared/goal-plan";

type DispatchDependencies = {
  getGoal(runId: string): Promise<GoalSnapshot | null>;
  isControlSettled(snapshot: GoalSnapshot): Promise<boolean>;
  dispatch(snapshot: GoalSnapshot, action: GoalMutationAction): Promise<GoalAcpDispatchResult>;
  markControlApplied(snapshot: GoalSnapshot, method: GoalControlMethod, action: GoalMutationAction): Promise<boolean>;
};

export type GoalControlDispatchOutcome =
  | (GoalAcpDispatchResult & { snapshot: GoalSnapshot; action: GoalMutationAction })
  | { kind: "already_applied"; snapshot: GoalSnapshot; action: GoalMutationAction }
  | { kind: "superseded"; snapshot: GoalSnapshot | null; action: GoalMutationAction; reason: "goal_absent" | "state_churn" };

function sameFence(left: GoalSnapshot, right: GoalSnapshot) {
  return left.goalId === right.goalId
    && left.revision === right.revision
    && left.leaseGeneration === right.leaseGeneration
    && left.workerId === right.workerId
    && left.acpSessionId === right.acpSessionId;
}

export function recoveryAction(snapshot: GoalSnapshot): GoalMutationAction {
  if (snapshot.status === "cleared") return "clear";
  if (snapshot.status === "paused") return "pause";
  return "set";
}

export class GoalControlDispatchCoordinator {
  private readonly tails = new Map<string, Promise<void>>();
  /**
   * Controls the agent refused because it was mid-turn, keyed by run.
   *
   * A busy agent is the one dispatch failure that resolves on its own, so the
   * request is parked here instead of being recorded as a failure, and replayed
   * once the turn settles. Losing the map on restart is safe: a deferred
   * control leaves `control_method` NULL, which is exactly what
   * `recoverPendingGoalControlsAtStartup` re-dispatches.
   */
  private readonly deferredByRun = new Map<string, { snapshot: GoalSnapshot; action: GoalMutationAction }>();

  constructor(private readonly dependencies: DispatchDependencies) {}

  dispatch(snapshot: GoalSnapshot, action: GoalMutationAction): Promise<GoalControlDispatchOutcome> {
    return this.enqueue(snapshot.runId, () => this.converge(snapshot, action));
  }

  hasDeferredControl(runId: string) {
    return this.deferredByRun.has(runId);
  }

  retryDeferredControl(runId: string): Promise<GoalControlDispatchOutcome> | null {
    const deferred = this.deferredByRun.get(runId);
    if (!deferred) return null;
    return this.dispatch(deferred.snapshot, deferred.action);
  }

  private async enqueue<T>(runId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(runId) ?? Promise.resolve();
    const result = previous.catch(() => undefined).then(operation);
    const tail = result.then(() => undefined, () => undefined);
    this.tails.set(runId, tail);
    try {
      return await result;
    } finally {
      if (this.tails.get(runId) === tail) this.tails.delete(runId);
    }
  }

  private async converge(
    requestedSnapshot: GoalSnapshot,
    requestedAction: GoalMutationAction,
  ): Promise<GoalControlDispatchOutcome> {
    let latest: GoalSnapshot | null = null;
    // This pass supersedes whatever was parked for the run; it re-parks below
    // only if the agent is still mid-turn.
    this.deferredByRun.delete(requestedSnapshot.runId);
    for (let attempt = 0; attempt < 8; attempt += 1) {
      latest = await this.dependencies.getGoal(requestedSnapshot.runId);
      if (!latest) {
        return { kind: "superseded", snapshot: null, action: requestedAction, reason: "goal_absent" };
      }
      const action = sameFence(latest, requestedSnapshot) ? requestedAction : recoveryAction(latest);
      if (await this.dependencies.isControlSettled(latest)) {
        return { kind: "already_applied", snapshot: latest, action };
      }
      const dispatched = await this.dependencies.dispatch(latest, action);
      const outcome = { ...dispatched, snapshot: latest, action } as GoalControlDispatchOutcome;
      if (dispatched.kind === "deferred" && dispatched.reason === "worker_busy") {
        this.deferredByRun.set(latest.runId, { snapshot: latest, action });
      }
      if (dispatched.kind !== "dispatched") return outcome;
      if (await this.dependencies.markControlApplied(latest, dispatched.method, action)) return outcome;
      // The canonical row changed while the provider call was in flight. Loop
      // under the same per-run queue and converge the provider to the newest
      // durable revision before a later request may dispatch.
    }
    return { kind: "superseded", snapshot: latest, action: recoveryAction(latest!), reason: "state_churn" };
  }
}

export function createGoalControlDispatchCoordinator(
  dependencies: DispatchDependencies = {
    getGoal: (runId) => goalControl.getGoal(runId),
    isControlSettled: (snapshot) => goalControl.isControlSettled(snapshot),
    dispatch: (snapshot, action) => goalAcpDispatcher.dispatch(snapshot, action),
    markControlApplied: (snapshot, method, action) => goalControl.markControlApplied(snapshot, method, action),
  },
) {
  return new GoalControlDispatchCoordinator(dependencies);
}

export const goalControlDispatchCoordinator = createGoalControlDispatchCoordinator();

/**
 * Replay a goal control the agent refused because it was mid-turn.
 *
 * Called when a turn settles, which is the moment the refusal stops being true.
 * A no-op for every run that has nothing parked, so it is safe on the live-sync
 * path that walks the whole catalog.
 */
export async function retryDeferredGoalControl(
  runId: string,
  coordinator: GoalControlDispatchCoordinator = goalControlDispatchCoordinator,
) {
  const pending = coordinator.retryDeferredControl(runId);
  if (!pending) return null;
  let outcome: GoalControlDispatchOutcome;
  try {
    outcome = await pending;
  } catch (error) {
    const reason = redactGoalErrorMessage(error);
    const snapshot = await goalControl.getGoal(runId);
    if (snapshot) await goalControl.recordControlFailure(snapshot, "transport", reason);
    emitNamedEvent({
      kind: "goal.reconciliation.failed",
      runId,
      goalId: snapshot?.goalId ?? runId,
      workerId: snapshot?.workerId ?? null,
      reason,
    });
    emitNamedEvent({
      kind: "error.surfaced",
      code: "goal.reconciliation.failed",
      message: reason,
      surface: "banner",
      runId,
      ...(snapshot?.workerId ? { workerId: snapshot.workerId } : {}),
    });
    await goalOutboxDispatcher.drainPending();
    return null;
  }

  if (outcome.kind === "dispatched") {
    emitNamedEvent({
      kind: "goal.reconciliation.completed",
      runId,
      goalId: outcome.snapshot.goalId,
      // A dispatched control always holds a lease; `goal-acp` defers otherwise.
      workerId: outcome.snapshot.workerId ?? "",
      revision: outcome.snapshot.revision,
      leaseGeneration: outcome.snapshot.leaseGeneration,
    });
  } else if (outcome.kind !== "already_applied") {
    if (outcome.kind === "unsupported" && outcome.snapshot.status !== "cleared") {
      await goalControl.recordControlFailure(outcome.snapshot, "unsupported", outcome.reason);
    }
    emitNamedEvent({
      kind: "goal.reconciliation.refused",
      runId,
      goalId: outcome.snapshot?.goalId ?? runId,
      workerId: outcome.snapshot?.workerId ?? null,
      reason: outcome.reason,
    });
  }
  await goalOutboxDispatcher.drainPending();
  return outcome;
}

export async function recoverPendingGoalControlsAtStartup() {
  const pending = await dbClient.execute(
    `SELECT run_id FROM run_goals
     WHERE control_method IS NULL AND worker_id IS NOT NULL AND acp_session_id IS NOT NULL
     ORDER BY updated_at ASC, run_id ASC`,
  );
  for (const row of pending.rows) {
    const runId = String(row.run_id);
    const snapshot = await goalControl.getGoal(runId);
    if (!snapshot) continue;
    try {
      const result = await goalControlDispatchCoordinator.dispatch(snapshot, recoveryAction(snapshot));
      if (result.kind === "unsupported" && result.snapshot.status !== "cleared") {
        await goalControl.recordControlFailure(result.snapshot, "unsupported", result.reason);
      }
    } catch (error) {
      const reason = redactGoalErrorMessage(error);
      emitNamedEvent({
        kind: "goal.reconciliation.failed",
        runId,
        goalId: snapshot.goalId,
        workerId: snapshot.workerId,
        reason,
      });
      emitNamedEvent({
        kind: "error.surfaced",
        code: "goal.reconciliation.failed",
        message: reason,
        surface: "log",
        runId,
        workerId: snapshot.workerId ?? undefined,
      });
    }
  }
  await goalOutboxDispatcher.drainPending();
}
