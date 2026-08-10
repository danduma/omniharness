import { createHash, randomUUID } from "node:crypto";
import type { DbClient } from "@/server/db";
import { dbClient } from "@/server/db";
import {
  GOAL_SCHEMA_VERSION,
  canTransitionGoalStatus,
  normalizeGoalCapabilities,
  validateGoalObjective,
  type GoalAction,
  type GoalCapabilities,
  type GoalMutationResult,
  type GoalPlanItem,
  type GoalPlanSource,
  type GoalSnapshot,
  type GoalStatus,
  type GoalValidationState,
} from "@/shared/goal-plan";

type SqlExecutor = Pick<DbClient, "execute">;

interface ServiceOptions {
  now?: () => Date;
  randomId?: () => string;
}

interface OperationIdentity {
  runId: string;
  goalId: string;
  expectedRevision: number;
  operationId: string;
  principalId: string;
  endpoint: "goal.put" | "goal.actions";
}

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

type GoalRow = Record<string, unknown>;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

function fingerprint(value: unknown) {
  return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || !value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function toIso(value: unknown) {
  const millis = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(millis)) throw new TypeError("Persisted goal timestamp is invalid");
  return new Date(millis).toISOString();
}

function nullableIso(value: unknown) {
  return value === null || value === undefined ? null : toIso(value);
}

function rowToSnapshot(row: GoalRow, eventCursor: number | null = null): GoalSnapshot {
  return {
    schemaVersion: GOAL_SCHEMA_VERSION,
    runId: String(row.run_id),
    goalId: String(row.goal_id),
    revision: Number(row.revision),
    leaseGeneration: Number(row.lease_generation ?? 0),
    objective: String(row.objective),
    status: String(row.status) as GoalStatus,
    startedAt: toIso(row.started_at),
    pausedAt: nullableIso(row.paused_at),
    resumedAt: nullableIso(row.resumed_at),
    completedAt: nullableIso(row.completed_at),
    clearedAt: nullableIso(row.cleared_at),
    updatedAt: toIso(row.updated_at),
    workerId: row.worker_id === null || row.worker_id === undefined ? null : String(row.worker_id),
    acpSessionId: row.acp_session_id === null || row.acp_session_id === undefined ? null : String(row.acp_session_id),
    plan: parseJson<GoalPlanItem[]>(row.plan_json, []),
    planSource: parseJson<GoalPlanSource>(row.plan_source_json, { kind: "none" }),
    capabilities: normalizeGoalCapabilities(parseJson(row.capabilities_json, {})),
    lastError: row.last_error === null || row.last_error === undefined ? null : String(row.last_error),
    validationState: parseJson<GoalValidationState | null>(row.validation_state_json, null),
    visible: Number(row.visible) === 1,
    provenance: { source: "server", complete: true, eventCursor },
  };
}

function failure(
  code: Extract<GoalMutationResult, { ok: false }>["code"],
  message: string,
  snapshot: GoalSnapshot | null,
): GoalMutationResult {
  return { ok: false, code, message, snapshot };
}

async function selectGoal(executor: SqlExecutor, runId: string) {
  const result = await executor.execute({
    sql: "SELECT * FROM run_goals WHERE run_id = ? LIMIT 1",
    args: [runId],
  });
  const row = result.rows[0] as GoalRow | undefined;
  return row ? rowToSnapshot(row) : null;
}

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
    const validated = validateGoalObjective(input.objective);
    if (!validated.ok) {
      return failure("invalid_objective", `Goal objective is ${validated.code}.`, await this.getGoal(input.runId));
    }
    return this.runOperation(
      input,
      "set",
      { objective: validated.objective },
      async (transaction, current, now) => {
        if (!current) {
          if (input.expectedRevision !== 0) {
            return failure("revision_conflict", "The goal revision is stale.", null);
          }
          const run = await transaction.execute({ sql: "SELECT id FROM runs WHERE id = ? LIMIT 1", args: [input.runId] });
          if (!run.rows[0]) return failure("not_found", "The run does not exist.", null);
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
          await this.enqueue(transaction, snapshot, "goal.set.completed", now);
          return { ok: true, snapshot, replayed: false };
        }
        const conflict = this.validateMutationFence(current, input);
        if (conflict) return conflict;
        if (current.status === "cleared") {
          return failure("invalid_transition", "A cleared goal cannot be edited.", current);
        }
        if (current.objective === validated.objective) {
          return { ok: true, snapshot: current, replayed: false };
        }
        const nextRevision = current.revision + 1;
        await transaction.execute({
          sql: `UPDATE run_goals
                SET objective = ?, revision = ?, transition_source = 'api', updated_at = ?
                WHERE run_id = ? AND goal_id = ? AND revision = ? AND status != 'cleared'`,
          args: [validated.objective, nextRevision, now, input.runId, input.goalId, input.expectedRevision],
        });
        const snapshot = await selectGoal(transaction, input.runId);
        if (!snapshot || snapshot.revision !== nextRevision) {
          return failure("revision_conflict", "The goal changed before the edit was committed.", snapshot);
        }
        await this.enqueue(transaction, snapshot, "goal.updated", now);
        return { ok: true, snapshot, replayed: false };
      },
    );
  }

  async actionGoal(input: GoalActionRequest): Promise<GoalMutationResult> {
    return this.runOperation(input, input.action, { action: input.action }, async (transaction, current, now) => {
      if (!current) return failure("not_found", "The goal does not exist.", null);
      const conflict = this.validateMutationFence(current, input);
      if (conflict) return conflict;
      if (current.status === "cleared") return failure("invalid_transition", "The goal is already cleared.", current);

      let nextStatus: GoalStatus;
      let eventKind: string;
      if (input.action === "pause") {
        if (!current.capabilities.pause) return failure("unsupported_action", "The active agent cannot pause goals.", current);
        nextStatus = "paused";
        eventKind = "goal.paused";
      } else if (input.action === "resume" || input.action === "retry") {
        const supported = input.action === "retry" || current.capabilities.resume;
        if (!supported) return failure("unsupported_action", "The active agent cannot resume goals.", current);
        nextStatus = "pursuing";
        eventKind = input.action === "retry" ? "goal.reconciliation.started" : "goal.resumed";
      } else {
        nextStatus = "cleared";
        eventKind = "goal.cleared";
      }
      if (!canTransitionGoalStatus(current.status, nextStatus)) {
        return failure("invalid_transition", `Cannot ${input.action} a goal in ${current.status}.`, current);
      }

      const revision = current.revision + 1;
      await transaction.execute({
        sql: `UPDATE run_goals SET
                status = ?, revision = ?, transition_source = ?, visible = ?,
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
        return failure("revision_conflict", "The goal changed before the action was committed.", snapshot);
      }
      await this.enqueue(transaction, snapshot, eventKind, now);
      return { ok: true, snapshot, replayed: false };
    });
  }

  async attachLease(input: AttachGoalLeaseRequest): Promise<GoalMutationResult> {
    const transaction = await this.client.transaction("write");
    try {
      const current = await selectGoal(transaction, input.runId);
      if (!current) {
        await transaction.commit();
        return failure("not_found", "The goal does not exist.", null);
      }
      const conflict = this.validateMutationFence(current, input);
      if (conflict) {
        await transaction.commit();
        return conflict;
      }
      if (current.status === "cleared") {
        await transaction.commit();
        return failure("invalid_transition", "A cleared goal cannot acquire a lease.", current);
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
                transition_source = 'reconciliation', updated_at = ?
              WHERE run_id = ? AND goal_id = ? AND revision = ? AND status != 'cleared'`,
        args: [input.workerId, input.acpSessionId, leaseGeneration, revision, now, input.runId, input.goalId, input.expectedRevision],
      });
      const snapshot = await selectGoal(transaction, input.runId);
      if (!snapshot || snapshot.revision !== revision) {
        await transaction.rollback();
        return failure("revision_conflict", "The goal changed before the lease was attached.", snapshot);
      }
      await this.enqueue(transaction, snapshot, "goal.reconciled", now);
      await transaction.commit();
      return { ok: true, snapshot, replayed: false };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async applyProviderUpdate(input: ProviderGoalUpdateRequest): Promise<GoalMutationResult> {
    const transaction = await this.client.transaction("write");
    try {
      const current = await selectGoal(transaction, input.runId);
      if (!current) {
        await transaction.commit();
        return failure("not_found", "The goal does not exist.", null);
      }
      if (current.status === "cleared") {
        await transaction.commit();
        return failure("invalid_transition", "A cleared goal cannot be updated.", current);
      }
      if (
        current.goalId !== input.goalId
        || current.revision !== input.expectedRevision
        || current.workerId !== input.workerId
        || current.acpSessionId !== input.acpSessionId
        || current.leaseGeneration !== input.leaseGeneration
      ) {
        await transaction.commit();
        return failure("stale_lease", "The provider update belongs to a stale goal lease.", current);
      }
      const nextStatus = input.status ?? current.status;
      if (!canTransitionGoalStatus(current.status, nextStatus)) {
        await transaction.commit();
        return failure("invalid_transition", `Cannot move a goal from ${current.status} to ${nextStatus}.`, current);
      }
      const plan = input.plan ?? current.plan;
      const planSource = input.planSource ?? current.planSource;
      const capabilities = input.capabilities ?? current.capabilities;
      const validationState = input.validationState === undefined ? current.validationState : input.validationState;
      const lastError = input.lastError === undefined ? current.lastError : input.lastError;
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
        return failure("stale_lease", "The provider update lost its lease fence.", snapshot);
      }
      const eventKind = input.planSource?.kind === "none" ? "goal.plan.removed"
        : input.plan || input.planSource ? "goal.plan.updated"
          : nextStatus === "completed" ? "goal.completed" : "goal.updated";
      await this.enqueue(transaction, snapshot, eventKind, now);
      await transaction.commit();
      return { ok: true, snapshot, replayed: false };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  private validateMutationFence(current: GoalSnapshot, input: Pick<OperationIdentity, "goalId" | "expectedRevision">) {
    if (current.goalId !== input.goalId || current.revision !== input.expectedRevision) {
      return failure("revision_conflict", "The goal revision is stale.", current);
    }
    return null;
  }

  private async runOperation(
    input: OperationIdentity,
    action: string,
    payload: unknown,
    mutate: (transaction: Awaited<ReturnType<DbClient["transaction"]>>, current: GoalSnapshot | null, now: number) => Promise<GoalMutationResult>,
  ): Promise<GoalMutationResult> {
    const requestFingerprint = fingerprint({
      principalId: input.principalId,
      endpoint: input.endpoint,
      action,
      runId: input.runId,
      goalId: input.goalId,
      expectedRevision: input.expectedRevision,
      payload,
    });
    const transaction = await this.client.transaction("write");
    try {
      const existing = await transaction.execute({
        sql: "SELECT * FROM run_goal_operations WHERE run_id = ? AND operation_id = ? LIMIT 1",
        args: [input.runId, input.operationId],
      });
      const operation = existing.rows[0] as Record<string, unknown> | undefined;
      if (operation) {
        const same = operation.principal_id === input.principalId
          && operation.endpoint === input.endpoint
          && operation.action === action
          && operation.fingerprint === requestFingerprint;
        const latest = await selectGoal(transaction, input.runId);
        if (!same) {
          await transaction.commit();
          return failure("operation_conflict", "The operation id was already used for a different request.", latest);
        }
        const stored = parseJson<GoalMutationResult>(operation.result_json, failure("persistence_error", "The stored operation result is invalid.", latest));
        await transaction.commit();
        return stored.ok ? { ...stored, replayed: true } : stored;
      }

      const current = await selectGoal(transaction, input.runId);
      const now = this.now().getTime();
      const result = await mutate(transaction, current, now);
      await transaction.execute({
        sql: `INSERT INTO run_goal_operations (
                run_id, operation_id, principal_id, endpoint, action, fingerprint,
                status, result_json, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          input.runId, input.operationId, input.principalId, input.endpoint, action, requestFingerprint,
          result.ok ? "committed" : "rejected", JSON.stringify(result), now, now,
        ],
      });
      await transaction.commit();
      return result;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  private async enqueue(executor: SqlExecutor, snapshot: GoalSnapshot, eventKind: string, now: number) {
    await executor.execute({
      sql: `INSERT INTO run_goal_outbox (
              id, run_id, goal_id, lease_generation, revision, event_key, event_kind,
              payload_json, status, attempt_count, next_attempt_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?)`,
      args: [
        this.randomId(), snapshot.runId, snapshot.goalId, snapshot.leaseGeneration, snapshot.revision,
        `${snapshot.runId}/${snapshot.revision}/${eventKind}`, eventKind,
        JSON.stringify({ eventKey: `${snapshot.runId}/${snapshot.revision}/${eventKind}`, ...snapshot }),
        now, now, now,
      ],
    });
  }
}

export function createGoalControlService(client: DbClient, options: ServiceOptions = {}) {
  return new GoalControlService(client, options);
}

export const goalControl = createGoalControlService(dbClient);
