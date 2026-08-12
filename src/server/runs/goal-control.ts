import { randomUUID } from "node:crypto";
import type { DbClient } from "@/server/db";
import { dbClient } from "@/server/db";
import { redactGoalErrorMessage } from "@/server/runs/goal-errors";
import {
  canTransitionGoalStatus,
  validateGoalObjective,
  type GoalAction,
  type GoalCapabilities,
  type GoalMutationAction,
  type GoalMutationResult,
  type GoalPlanItem,
  type GoalPlanSource,
  type GoalSnapshot,
  type GoalStatus,
  type GoalValidationState,
} from "@/shared/goal-plan";
import {
  enqueueGoalEvent,
  finalizeGoalOperation,
  goalFailure,
  retryGoalBusy,
  runGoalOperation,
  selectGoal,
  type GoalOperationIdentity,
} from "./goal-control-persistence";

interface ServiceOptions {
  now?: () => Date;
  randomId?: () => string;
}

type OperationIdentity = GoalOperationIdentity;

export interface PutGoalRequest extends OperationIdentity {
  endpoint: "goal.put";
  objective: string;
}

export interface GoalActionRequest extends OperationIdentity {
  endpoint: "goal.actions";
  action: GoalAction;
}

export interface AttachGoalLeaseRequest {
  runId: string;
  goalId: string;
  expectedRevision: number;
  workerId: string;
  acpSessionId: string;
}

export interface ProviderGoalUpdateRequest {
  runId: string;
  goalId: string;
  expectedRevision: number;
  workerId: string;
  acpSessionId: string;
  leaseGeneration: number;
  status?: GoalStatus;
  plan?: GoalPlanItem[];
  planSource?: GoalPlanSource;
  capabilities?: GoalCapabilities;
  validationState?: GoalValidationState | null;
  lastError?: string | null;
}

export type GoalControlMethod = "extension" | "slash";

export class GoalControlService {
  private readonly now: () => Date;
  private readonly randomId: () => string;

  constructor(private readonly client: DbClient, options: ServiceOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.randomId = options.randomId ?? randomUUID;
  }

  async getGoal(runId: string, eventCursor: number | null = null) {
    const snapshot = await selectGoal(this.client, runId);
    return snapshot ? { ...snapshot, provenance: { ...snapshot.provenance, eventCursor } } : null;
  }

  async putGoal(input: PutGoalRequest): Promise<GoalMutationResult> {
    return runGoalOperation(
      this.client,
      this.now,
      input,
      "set",
      { objective: input.objective },
      async (transaction, current, now) => {
        const validated = validateGoalObjective(input.objective);
        if (!validated.ok) {
          return goalFailure("invalid_objective", `Goal objective is ${validated.code}.`, current);
        }
        if (!current) {
          if (input.expectedRevision !== 0) {
            return goalFailure("revision_conflict", "The goal revision is stale.", null);
          }
          const run = await transaction.execute({ sql: "SELECT id FROM runs WHERE id = ? LIMIT 1", args: [input.runId] });
          if (!run.rows[0]) return goalFailure("not_found", "The run does not exist.", null);
          await transaction.execute({
            sql: `INSERT INTO run_goals (
              run_id, goal_id, objective, status, revision, lease_generation,
              plan_json, plan_source_json, capabilities_json, transition_source,
              visible, started_at, updated_at
            ) VALUES (?, ?, ?, 'pending', 1, 0, '[]', '{"kind":"none"}', '{}', 'api', 1, ?, ?)`,
            args: [input.runId, input.goalId, validated.objective, now, now],
          });
          const snapshot = await selectGoal(transaction, input.runId);
          if (!snapshot) throw new Error("Goal insert did not produce a snapshot");
          await enqueueGoalEvent(transaction, snapshot, "goal.set.completed", now, this.randomId);
          return { ok: true, snapshot, replayed: false };
        }
        if (current.status === "cleared") {
          if (current.revision !== input.expectedRevision) {
            return goalFailure("revision_conflict", "The goal revision is stale.", current);
          }
          if (current.goalId === input.goalId) {
            return goalFailure("invalid_transition", "A cleared goal id cannot be revived.", current);
          }
          const nextRevision = current.revision + 1;
          await transaction.execute({
            sql: `UPDATE run_goals SET
                    goal_id = ?, objective = ?, status = 'pending', revision = ?,
                    plan_json = '[]', plan_source_json = '{"kind":"none"}',
                    validation_state_json = NULL, last_error = NULL, control_method = NULL,
                    transition_source = 'api', visible = 1, started_at = ?,
                    paused_at = NULL, resumed_at = NULL, completed_at = NULL, cleared_at = NULL,
                    updated_at = ?
                  WHERE run_id = ? AND goal_id = ? AND revision = ? AND status = 'cleared'`,
            args: [
              input.goalId,
              validated.objective,
              nextRevision,
              now,
              now,
              input.runId,
              current.goalId,
              input.expectedRevision,
            ],
          });
          const snapshot = await selectGoal(transaction, input.runId);
          if (!snapshot || snapshot.revision !== nextRevision || snapshot.goalId !== input.goalId) {
            return goalFailure("revision_conflict", "The cleared goal changed before replacement was committed.", snapshot);
          }
          await enqueueGoalEvent(transaction, snapshot, "goal.set.completed", now, this.randomId);
          return { ok: true, snapshot, replayed: false };
        }
        const conflict = this.validateMutationFence(current, input);
        if (conflict) return conflict;
        if (current.objective === validated.objective) {
          return { ok: true, snapshot: current, replayed: true };
        }
        const nextRevision = current.revision + 1;
        await transaction.execute({
          sql: `UPDATE run_goals
                SET objective = ?, revision = ?, control_method = NULL, transition_source = 'api', updated_at = ?
                WHERE run_id = ? AND goal_id = ? AND revision = ? AND status != 'cleared'`,
          args: [validated.objective, nextRevision, now, input.runId, input.goalId, input.expectedRevision],
        });
        const snapshot = await selectGoal(transaction, input.runId);
        if (!snapshot || snapshot.revision !== nextRevision) {
          return goalFailure("revision_conflict", "The goal changed before the edit was committed.", snapshot);
        }
        await enqueueGoalEvent(transaction, snapshot, "goal.updated", now, this.randomId);
        return { ok: true, snapshot, replayed: false };
      },
    );
  }

  async actionGoal(input: GoalActionRequest): Promise<GoalMutationResult> {
    return runGoalOperation(this.client, this.now, input, input.action, { action: input.action }, async (transaction, current, now) => {
      if (!current) return goalFailure("not_found", "The goal does not exist.", null);
      const conflict = this.validateMutationFence(current, input);
      if (conflict) return conflict;
      if (current.status === "cleared") return goalFailure("invalid_transition", "The goal is already cleared.", current);

      let nextStatus: GoalStatus;
      let eventKind: string;
      if (input.action === "pause") {
        if (!current.capabilities.pause) return goalFailure("unsupported_action", "The active agent cannot pause goals.", current);
        nextStatus = "paused";
        eventKind = "goal.paused";
      } else if (input.action === "resume" || input.action === "retry") {
        const supported = input.action === "retry" || current.capabilities.resume;
        if (!supported) return goalFailure("unsupported_action", "The active agent cannot resume goals.", current);
        nextStatus = "pursuing";
        eventKind = input.action === "retry" ? "goal.reconciliation.started" : "goal.resumed";
      } else {
        nextStatus = "cleared";
        eventKind = "goal.cleared";
      }
      if (!canTransitionGoalStatus(current.status, nextStatus)) {
        return goalFailure("invalid_transition", `Cannot ${input.action} a goal in ${current.status}.`, current);
      }

      const revision = current.revision + 1;
      await transaction.execute({
        sql: `UPDATE run_goals SET
                status = ?, revision = ?, transition_source = ?, visible = ?,
                control_method = NULL,
                paused_at = CASE WHEN ? = 'paused' THEN ? ELSE paused_at END,
                resumed_at = CASE WHEN ? = 'pursuing' THEN ? ELSE resumed_at END,
                cleared_at = CASE WHEN ? = 'cleared' THEN ? ELSE cleared_at END,
                updated_at = ?
              WHERE run_id = ? AND goal_id = ? AND revision = ? AND status != 'cleared'`,
        args: [
          nextStatus, revision, input.action === "retry" ? "recovery" : "api",
          nextStatus === "cleared" ? 0 : 1,
          nextStatus, now, nextStatus, now, nextStatus, now, now,
          input.runId, input.goalId, input.expectedRevision,
        ],
      });
      const snapshot = await selectGoal(transaction, input.runId);
      if (!snapshot || snapshot.revision !== revision) {
        return goalFailure("revision_conflict", "The goal changed before the action was committed.", snapshot);
      }
      await enqueueGoalEvent(transaction, snapshot, eventKind, now, this.randomId);
      return { ok: true, snapshot, replayed: false };
    });
  }

  async attachLease(input: AttachGoalLeaseRequest): Promise<GoalMutationResult> {
    return retryGoalBusy(() => this.attachLeaseOnce(input));
  }

  private async attachLeaseOnce(input: AttachGoalLeaseRequest): Promise<GoalMutationResult> {
    const transaction = await this.client.transaction("write");
    try {
      const current = await selectGoal(transaction, input.runId);
      if (!current) {
        await transaction.commit();
        return goalFailure("not_found", "The goal does not exist.", null);
      }
      const conflict = this.validateMutationFence(current, input);
      if (conflict) {
        await transaction.commit();
        return conflict;
      }
      if (current.status === "cleared") {
        await transaction.commit();
        return goalFailure("invalid_transition", "A cleared goal cannot acquire a lease.", current);
      }
      if (current.workerId === input.workerId && current.acpSessionId === input.acpSessionId) {
        await transaction.commit();
        return { ok: true, snapshot: current, replayed: true };
      }
      const now = this.now().getTime();
      const revision = current.revision + 1;
      const leaseGeneration = current.leaseGeneration + 1;
      await transaction.execute({
        sql: `UPDATE run_goals SET worker_id = ?, acp_session_id = ?, lease_generation = ?, revision = ?,
                control_method = NULL, transition_source = 'reconciliation', updated_at = ?
              WHERE run_id = ? AND goal_id = ? AND revision = ? AND status != 'cleared'`,
        args: [input.workerId, input.acpSessionId, leaseGeneration, revision, now, input.runId, input.goalId, input.expectedRevision],
      });
      const snapshot = await selectGoal(transaction, input.runId);
      if (!snapshot || snapshot.revision !== revision) {
        await transaction.rollback();
        return goalFailure("revision_conflict", "The goal changed before the lease was attached.", snapshot);
      }
      await enqueueGoalEvent(transaction, snapshot, "goal.reconciled", now, this.randomId);
      await transaction.commit();
      return { ok: true, snapshot, replayed: false };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async applyProviderUpdate(input: ProviderGoalUpdateRequest): Promise<GoalMutationResult> {
    return retryGoalBusy(() => this.applyProviderUpdateOnce(input));
  }

  private async applyProviderUpdateOnce(input: ProviderGoalUpdateRequest): Promise<GoalMutationResult> {
    const transaction = await this.client.transaction("write");
    try {
      const current = await selectGoal(transaction, input.runId);
      if (!current) {
        await transaction.commit();
        return goalFailure("not_found", "The goal does not exist.", null);
      }
      if (current.status === "cleared") {
        await transaction.commit();
        return goalFailure("invalid_transition", "A cleared goal cannot be updated.", current);
      }
      if (
        current.goalId !== input.goalId
        || current.revision !== input.expectedRevision
        || current.workerId !== input.workerId
        || current.acpSessionId !== input.acpSessionId
        || current.leaseGeneration !== input.leaseGeneration
      ) {
        await transaction.commit();
        return goalFailure("stale_lease", "The provider update belongs to a stale goal lease.", current);
      }
      const nextStatus = input.status ?? current.status;
      const validationState = input.validationState === undefined ? current.validationState : input.validationState;
      if (!canTransitionGoalStatus(current.status, nextStatus)) {
        await transaction.commit();
        return goalFailure("invalid_transition", `Cannot move a goal from ${current.status} to ${nextStatus}.`, current);
      }
      if (nextStatus === "completed" && validationState?.status !== "passed") {
        await transaction.commit();
        return goalFailure("invalid_transition", "A goal must pass validation before completion.", current);
      }
      const plan = input.plan ?? current.plan;
      const planSource = input.planSource ?? current.planSource;
      const capabilities = input.capabilities ?? current.capabilities;
      const lastError = input.lastError === undefined
        ? validationState?.status === "failed"
          ? validationState.message ?? "Goal validation failed."
          : input.validationState !== undefined && (validationState?.status === "validating" || validationState?.status === "passed")
            ? null
            : current.lastError
        : input.lastError;
      const unchanged = nextStatus === current.status
        && JSON.stringify(plan) === JSON.stringify(current.plan)
        && JSON.stringify(planSource) === JSON.stringify(current.planSource)
        && JSON.stringify(capabilities) === JSON.stringify(current.capabilities)
        && JSON.stringify(validationState) === JSON.stringify(current.validationState)
        && lastError === current.lastError;
      if (unchanged) {
        await transaction.commit();
        return { ok: true, snapshot: current, replayed: true };
      }
      const now = this.now().getTime();
      const revision = current.revision + 1;
      await transaction.execute({
        sql: `UPDATE run_goals SET status = ?, revision = ?, plan_json = ?, plan_source_json = ?,
                capabilities_json = ?, validation_state_json = ?, last_error = ?, transition_source = 'acp',
                completed_at = CASE WHEN ? = 'completed' THEN ? ELSE completed_at END,
                updated_at = ?
              WHERE run_id = ? AND goal_id = ? AND revision = ? AND lease_generation = ?
                AND worker_id = ? AND acp_session_id = ? AND status != 'cleared'`,
        args: [
          nextStatus, revision, JSON.stringify(plan), JSON.stringify(planSource), JSON.stringify(capabilities),
          validationState === null ? null : JSON.stringify(validationState), lastError,
          nextStatus, now, now, input.runId, input.goalId, input.expectedRevision, input.leaseGeneration,
          input.workerId, input.acpSessionId,
        ],
      });
      const snapshot = await selectGoal(transaction, input.runId);
      if (!snapshot || snapshot.revision !== revision) {
        await transaction.rollback();
        return goalFailure("stale_lease", "The provider update lost its lease fence.", snapshot);
      }
      const validationChanged = JSON.stringify(validationState) !== JSON.stringify(current.validationState);
      const eventKind = input.planSource?.kind === "none" ? "goal.plan.removed"
        : input.plan || input.planSource ? "goal.plan.updated"
          : nextStatus === "completed" ? "goal.completed"
            : validationChanged && validationState?.status === "validating" ? "goal.validation.started"
              : validationChanged && validationState?.status === "passed" ? "goal.validation.completed"
                : validationChanged && validationState?.status === "failed" ? "goal.validation.failed"
                  : "goal.updated";
      await enqueueGoalEvent(transaction, snapshot, eventKind, now, this.randomId);
      await transaction.commit();
      return { ok: true, snapshot, replayed: false };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async isControlSettled(snapshot: GoalSnapshot) {
    const result = await this.client.execute({
      sql: `SELECT control_method FROM run_goals
            WHERE run_id = ? AND goal_id = ? AND revision = ? AND lease_generation = ?
              AND worker_id = ? AND acp_session_id = ? LIMIT 1`,
      args: [
        snapshot.runId,
        snapshot.goalId,
        snapshot.revision,
        snapshot.leaseGeneration,
        snapshot.workerId,
        snapshot.acpSessionId,
      ],
    });
    return typeof result.rows[0]?.control_method === "string" && Boolean(result.rows[0].control_method);
  }

  async markControlApplied(snapshot: GoalSnapshot, method: GoalControlMethod, action: GoalMutationAction = "set") {
    const marker = `${method}:${snapshot.acpSessionId}:${snapshot.leaseGeneration}:${snapshot.revision}`;
    const result = await this.client.execute({
      sql: `UPDATE run_goals SET control_method = ?, updated_at = ?
            WHERE run_id = ? AND goal_id = ? AND revision = ? AND lease_generation = ?
              AND worker_id = ? AND acp_session_id = ? AND control_method IS NULL
              AND (status != 'cleared' OR ? = 'clear')`,
      args: [
        marker,
        this.now().getTime(),
        snapshot.runId,
        snapshot.goalId,
        snapshot.revision,
        snapshot.leaseGeneration,
        snapshot.workerId,
        snapshot.acpSessionId,
        action,
      ],
    });
    return result.rowsAffected === 1;
  }

  async recordControlFailure(
    snapshot: GoalSnapshot,
    kind: "unsupported" | "transport",
    message: string,
  ): Promise<GoalMutationResult> {
    const safeMessage = redactGoalErrorMessage(message);
    return retryGoalBusy(() => this.recordControlFailureOnce(snapshot, kind, safeMessage));
  }

  private async recordControlFailureOnce(
    snapshot: GoalSnapshot,
    kind: "unsupported" | "transport",
    message: string,
  ): Promise<GoalMutationResult> {
    const transaction = await this.client.transaction("write");
    try {
      const current = await selectGoal(transaction, snapshot.runId);
      if (!current) {
        await transaction.commit();
        return goalFailure("not_found", "The goal does not exist.", null);
      }
      if (
        current.goalId !== snapshot.goalId
        || current.revision !== snapshot.revision
        || current.leaseGeneration !== snapshot.leaseGeneration
        || current.workerId !== snapshot.workerId
        || current.acpSessionId !== snapshot.acpSessionId
      ) {
        await transaction.commit();
        return goalFailure("stale_lease", "The failed control belongs to a stale goal lease.", current);
      }
      if (current.status === "cleared") {
        await transaction.commit();
        return goalFailure("invalid_transition", "A cleared goal cannot record a control failure.", current);
      }
      const nextStatus: GoalStatus = kind === "unsupported" ? "limited" : "error";
      if (!canTransitionGoalStatus(current.status, nextStatus)) {
        await transaction.commit();
        return goalFailure("invalid_transition", `Cannot mark a ${current.status} goal as ${nextStatus}.`, current);
      }
      const revision = current.revision + 1;
      const now = this.now().getTime();
      await transaction.execute({
        sql: `UPDATE run_goals SET status = ?, revision = ?, last_error = ?, control_method = ?,
                transition_source = 'reconciliation', updated_at = ?
              WHERE run_id = ? AND goal_id = ? AND revision = ? AND lease_generation = ?
                AND worker_id = ? AND acp_session_id = ? AND status != 'cleared'`,
        args: [
          nextStatus,
          revision,
          message,
          kind,
          now,
          snapshot.runId,
          snapshot.goalId,
          snapshot.revision,
          snapshot.leaseGeneration,
          snapshot.workerId,
          snapshot.acpSessionId,
        ],
      });
      const next = await selectGoal(transaction, snapshot.runId);
      if (!next || next.revision !== revision) {
        await transaction.rollback();
        return goalFailure("stale_lease", "The goal changed before the control failure was recorded.", next);
      }
      await enqueueGoalEvent(transaction, next, kind === "unsupported" ? "goal.limited" : "goal.updated", now, this.randomId);
      await transaction.commit();
      return { ok: true, snapshot: next, replayed: false };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async finalizeOperation(runId: string, operationId: string, result: GoalMutationResult) {
    return finalizeGoalOperation(this.client, this.now, runId, operationId, result);
  }

  private validateMutationFence(current: GoalSnapshot, input: Pick<OperationIdentity, "goalId" | "expectedRevision">) {
    if (current.goalId !== input.goalId || current.revision !== input.expectedRevision) {
      return goalFailure("revision_conflict", "The goal revision is stale.", current);
    }
    return null;
  }
}
export function createGoalControlService(client: DbClient, options: ServiceOptions = {}) {
  return new GoalControlService(client, options);
}

export const goalControl = createGoalControlService(dbClient);
