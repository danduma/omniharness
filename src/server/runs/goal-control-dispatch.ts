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

  constructor(private readonly dependencies: DispatchDependencies) {}

  dispatch(snapshot: GoalSnapshot, action: GoalMutationAction): Promise<GoalControlDispatchOutcome> {
    return this.enqueue(snapshot.runId, () => this.converge(snapshot, action));
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
