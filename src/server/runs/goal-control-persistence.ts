import { createHash } from "node:crypto";
import type { DbClient } from "@/server/db";
import {
  GOAL_SCHEMA_VERSION,
  normalizeGoalCapabilities,
  type GoalMutationResult,
  type GoalPlanItem,
  type GoalPlanSource,
  type GoalSnapshot,
  type GoalValidationState,
} from "@/shared/goal-plan";

export type GoalSqlExecutor = Pick<DbClient, "execute">;

export interface GoalOperationIdentity {
  runId: string;
  goalId: string;
  expectedRevision: number;
  operationId: string;
  principalId: string;
  endpoint: "goal.put" | "goal.actions";
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
    status: String(row.status) as GoalSnapshot["status"],
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

export function goalFailure(
  code: Extract<GoalMutationResult, { ok: false }>["code"],
  message: string,
  snapshot: GoalSnapshot | null,
): GoalMutationResult {
  return { ok: false, code, message, snapshot };
}

function isBusyError(error: unknown) {
  const candidate = error as { code?: unknown; message?: unknown } | null;
  return candidate?.code === "SQLITE_BUSY"
    || (typeof candidate?.message === "string" && candidate.message.includes("SQLITE_BUSY"));
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export async function selectGoal(executor: GoalSqlExecutor, runId: string) {
  const result = await executor.execute({
    sql: "SELECT * FROM run_goals WHERE run_id = ? LIMIT 1",
    args: [runId],
  });
  const row = result.rows[0] as GoalRow | undefined;
  return row ? rowToSnapshot(row) : null;
}

export async function retryGoalBusy<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isBusyError(error) || attempt === 7) throw error;
      await delay(4 * (2 ** attempt));
    }
  }
  throw new Error("Goal operation retry loop exited unexpectedly");
}

export async function enqueueGoalEvent(
  executor: GoalSqlExecutor,
  snapshot: GoalSnapshot,
  eventKind: string,
  now: number,
  randomId: () => string,
) {
  await executor.execute({
    sql: `INSERT INTO run_goal_outbox (
            id, run_id, goal_id, lease_generation, revision, event_key, event_kind,
            payload_json, status, attempt_count, next_attempt_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?)`,
    args: [
      randomId(), snapshot.runId, snapshot.goalId, snapshot.leaseGeneration, snapshot.revision,
      `${snapshot.runId}/${snapshot.revision}/${eventKind}`, eventKind,
      JSON.stringify({ eventKey: `${snapshot.runId}/${snapshot.revision}/${eventKind}`, ...snapshot }),
      now, now, now,
    ],
  });
}

export async function finalizeGoalOperation(
  client: DbClient,
  now: () => Date,
  runId: string,
  operationId: string,
  result: GoalMutationResult,
) {
  return retryGoalBusy(async () => {
    const updated = await client.execute({
      sql: `UPDATE run_goal_operations SET status = ?, result_json = ?, updated_at = ?
            WHERE run_id = ? AND operation_id = ?`,
      args: [result.ok ? "committed" : "rejected", JSON.stringify(result), now().getTime(), runId, operationId],
    });
    return updated.rowsAffected === 1;
  });
}

export async function runGoalOperation(
  client: DbClient,
  nowDate: () => Date,
  input: GoalOperationIdentity,
  action: string,
  payload: unknown,
  mutate: (
    transaction: Awaited<ReturnType<DbClient["transaction"]>>,
    current: GoalSnapshot | null,
    now: number,
  ) => Promise<GoalMutationResult>,
): Promise<GoalMutationResult> {
  return retryGoalBusy(async () => {
    const requestFingerprint = fingerprint({
      principalId: input.principalId,
      endpoint: input.endpoint,
      action,
      runId: input.runId,
      goalId: input.goalId,
      expectedRevision: input.expectedRevision,
      payload,
    });
    const transaction = await client.transaction("write");
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
          return goalFailure("operation_conflict", "The operation id was already used for a different request.", latest);
        }
        const stored = parseJson<GoalMutationResult>(
          operation.result_json,
          goalFailure("persistence_error", "The stored operation result is invalid.", latest),
        );
        await transaction.commit();
        return stored.ok ? { ...stored, replayed: true } : stored;
      }

      const current = await selectGoal(transaction, input.runId);
      const now = nowDate().getTime();
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
  });
}
