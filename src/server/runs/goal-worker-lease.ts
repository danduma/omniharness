import type { DbClient } from "@/server/db";
import { dbClient } from "@/server/db";
import { emitNamedEvent } from "@/server/events/named-events";
import { goalControl, type GoalControlService } from "@/server/runs/goal-control";
import type { GoalMutationResult } from "@/shared/goal-plan";

const ACTIVE_GOAL_WORKER_STATUSES = new Set([
  "starting",
  "working",
  "running",
  "idle",
  "stuck",
  "recovering",
]);

type GoalWorkerCandidate = {
  id: string;
  sessionId: string;
  status: string;
  workerNumber: number;
  createdAt: number;
};

function normalizeStatus(value: unknown) {
  return String(value ?? "").trim().toLowerCase().split(":")[0]?.trim() ?? "";
}

function rowToCandidate(row: Record<string, unknown>): GoalWorkerCandidate | null {
  const id = typeof row.id === "string" ? row.id.trim() : "";
  const sessionId = typeof row.bridge_session_id === "string" ? row.bridge_session_id.trim() : "";
  const status = normalizeStatus(row.status);
  if (!id || !sessionId || !ACTIVE_GOAL_WORKER_STATUSES.has(status)) return null;
  return {
    id,
    sessionId,
    status,
    workerNumber: Number.isFinite(Number(row.worker_number)) ? Number(row.worker_number) : 0,
    createdAt: Number.isFinite(Number(row.created_at)) ? Number(row.created_at) : 0,
  };
}

function compareCandidates(left: GoalWorkerCandidate, right: GoalWorkerCandidate) {
  return right.workerNumber - left.workerNumber
    || right.createdAt - left.createdAt
    || right.id.localeCompare(left.id);
}

/**
 * Which of these workers hold the lease of a goal that is still being pursued.
 *
 * An agent pursuing a goal routinely ends its turn while background work it
 * started (sub-agents, test suites, monitors) runs on, and relies on that
 * work's notification to start its next turn. Such an agent looks idle but is
 * not finished, so the runtime must not reap it.
 */
export async function listWorkersHoldingActiveGoals(
  workerIds: readonly string[],
  client: Pick<DbClient, "execute"> = dbClient,
) {
  if (workerIds.length === 0) return new Set<string>();
  const result = await client.execute({
    sql: `SELECT worker_id FROM run_goals
          WHERE status IN ('pending', 'pursuing') AND visible = 1
            AND worker_id IN (${workerIds.map(() => "?").join(", ")})`,
    args: [...workerIds],
  });
  return new Set(result.rows.map((row) => String(row.worker_id)));
}

export async function selectActiveGoalWorker(
  client: Pick<DbClient, "execute">,
  runId: string,
  currentWorkerId: string | null,
  currentSessionId: string | null,
) {
  const result = await client.execute({
    sql: `SELECT id, status, bridge_session_id, worker_number, created_at
          FROM workers
          WHERE run_id = ? AND bridge_session_id IS NOT NULL`,
    args: [runId],
  });
  const candidates = result.rows
    .map((row) => rowToCandidate(row as Record<string, unknown>))
    .filter((candidate): candidate is GoalWorkerCandidate => candidate !== null)
    .sort(compareCandidates);
  return candidates.find((candidate) => (
    candidate.id === currentWorkerId && candidate.sessionId === currentSessionId
  )) ?? candidates[0] ?? null;
}

export async function attachGoalMutationToActiveWorker(
  result: Extract<GoalMutationResult, { ok: true }>,
  options: {
    client?: DbClient;
    control?: GoalControlService;
  } = {},
): Promise<Extract<GoalMutationResult, { ok: true }>> {
  if (result.snapshot.status === "cleared") return result;
  const client = options.client ?? dbClient;
  const control = options.control ?? goalControl;
  const worker = await selectActiveGoalWorker(
    client,
    result.snapshot.runId,
    result.snapshot.workerId,
    result.snapshot.acpSessionId,
  );
  if (!worker) return result;
  if (
    result.snapshot.workerId === worker.id
    && result.snapshot.acpSessionId === worker.sessionId
  ) {
    return result;
  }

  const attached = await control.attachLease({
    runId: result.snapshot.runId,
    goalId: result.snapshot.goalId,
    expectedRevision: result.snapshot.revision,
    workerId: worker.id,
    acpSessionId: worker.sessionId,
  });
  if (!attached.ok) {
    emitNamedEvent({
      kind: "goal.reconciliation.refused",
      runId: result.snapshot.runId,
      goalId: result.snapshot.goalId,
      workerId: worker.id,
      reason: attached.code,
    });
    return result;
  }
  emitNamedEvent({
    kind: "goal.worker_transferred",
    runId: attached.snapshot.runId,
    goalId: attached.snapshot.goalId,
    previousWorkerId: result.snapshot.workerId,
    workerId: worker.id,
    leaseGeneration: attached.snapshot.leaseGeneration,
  });
  return { ok: true, snapshot: attached.snapshot, replayed: result.replayed };
}
