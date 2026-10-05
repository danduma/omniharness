import { and, eq, inArray } from "drizzle-orm";
import { db, dbClient } from "@/server/db";
import { messages, queuedConversationMessages, runs, workers } from "@/server/db/schema";
import { emitNamedEvent } from "@/server/events/named-events";
import { redactGoalErrorMessage } from "@/server/runs/goal-errors";
import { isRuntimeAgentMissingError } from "@/server/workers/runtime-agent-adoption";

type RunRecord = typeof runs.$inferSelect;
type WorkerRecord = typeof workers.$inferSelect;

type ActiveGoalLease = { runId: string; goalId: string; workerId: string };

export type GoalContinuationDependencies = {
  listPursuedGoals(): Promise<ActiveGoalLease[]>;
  loadRun(runId: string): Promise<RunRecord | undefined>;
  loadWorker(workerId: string): Promise<WorkerRecord | undefined>;
  /** True while a message for the run is still on its way to the worker. */
  hasUndeliveredMessages(runId: string): Promise<boolean>;
  hasResumableQuotaIncident(runId: string): Promise<boolean>;
  /** Resolves with the runtime agent; rejects when the runtime has none. */
  getAgent(workerId: string): Promise<{ state: string }>;
  sendContinuation(runId: string, content: string): Promise<unknown>;
  now(): number;
};

/**
 * Sent to an agent whose process ended while its goal was still being pursued.
 * The resumed session has the transcript but none of the background state the
 * agent was waiting on, which is why it has to look again before continuing.
 */
export const GOAL_CONTINUATION_PROMPT = [
  "[OmniHarness] Your previous agent process stopped (a restart, crash or power loss) while your goal was still active, and this session was resumed automatically.",
  "Background tasks and monitors from before the stop are gone, so no notification from them will arrive. Detached processes you launched may still be running, or may have died with the machine.",
  "Check the real state of that work (processes, logs, git), restart or re-monitor whatever is still needed, and continue pursuing the goal.",
].join(" ");

/** One continuation per run in this window, so an agent that dies on every resume cannot loop. */
const CONTINUATION_COOLDOWN_MS = 10 * 60_000;
/**
 * Goals the agent finished without reporting it stay `pursuing`. Leaving
 * conversations idle this long alone keeps a restart from reviving them.
 */
const MAX_IDLE_MS = 24 * 60 * 60_000;
const BUSY_WORKER_STATUSES = new Set(["starting", "working", "running", "busy", "recovering", "stuck"]);
const SKIPPED_WORKER_STATUSES = new Set(["cancelled", "canceled", "cred-exhausted"]);

function normalizedStatus(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase().split(":")[0]?.trim() ?? "";
}

function lastActivityMs(run: RunRecord, worker: WorkerRecord) {
  const stamps = [run.lastActivityAt, worker.updatedAt]
    .map((value) => (value instanceof Date ? value.getTime() : NaN))
    .filter(Number.isFinite);
  return stamps.length > 0 ? Math.max(...stamps) : 0;
}

const defaultDependencies: GoalContinuationDependencies = {
  async listPursuedGoals() {
    const result = await dbClient.execute(
      `SELECT run_id, goal_id, worker_id FROM run_goals
       WHERE status = 'pursuing' AND visible = 1 AND worker_id IS NOT NULL`,
    );
    return result.rows.map((row) => ({
      runId: String(row.run_id),
      goalId: String(row.goal_id),
      workerId: String(row.worker_id),
    }));
  },
  loadRun: (runId) => db.select().from(runs).where(eq(runs.id, runId)).get(),
  loadWorker: (workerId) => db.select().from(workers).where(eq(workers.id, workerId)).get(),
  async hasUndeliveredMessages(runId) {
    const queued = await db.select({ id: queuedConversationMessages.id }).from(queuedConversationMessages).where(and(
      eq(queuedConversationMessages.runId, runId),
      eq(queuedConversationMessages.status, "pending"),
    )).limit(1).get();
    if (queued) return true;
    const accepted = await db.select({ id: messages.id }).from(messages).where(and(
      eq(messages.runId, runId),
      inArray(messages.deliveryStatus, ["accepted", "delivering"]),
    )).limit(1).get();
    return Boolean(accepted);
  },
  async hasResumableQuotaIncident(runId) {
    const { hasResumableQuotaIncident } = await import("@/server/quota/worker-resume");
    return hasResumableQuotaIncident(runId);
  },
  async getAgent(workerId) {
    const { getAgent } = await import("@/server/bridge-client");
    return getAgent(workerId, { retryIndefinitely: false });
  },
  async sendContinuation(runId, content) {
    const { sendConversationMessage } = await import("@/server/conversations/send-message");
    return sendConversationMessage({ runId, content, busyAction: "queue" });
  },
  now: () => Date.now(),
};

const lastContinuationAt = new Map<string, number>();

/**
 * Continue goals whose agent process is gone.
 *
 * A goal is pursued by an agent process the runtime owns. When that process
 * ends without the user stopping it (a runner restart, a crash, the machine
 * losing power) nothing else ever starts the agent's next turn: the resumed
 * session only runs when someone sends it a message, so the goal sat stalled
 * until the user came back and asked why it stopped. This sweep sends that
 * message instead.
 *
 * Only a missing agent counts as stopped. An agent that is alive and idle is
 * waiting for its own background work, and the runtime keeps it alive for
 * exactly that reason, so it is left alone.
 */
export async function continueStalledGoals(
  dependencies: GoalContinuationDependencies = defaultDependencies,
) {
  const goals = await dependencies.listPursuedGoals();
  let continued = 0;
  for (const goal of goals) {
    if (await continueStalledGoal(goal, dependencies)) continued += 1;
  }
  return { continued };
}

async function continueStalledGoal(goal: ActiveGoalLease, dependencies: GoalContinuationDependencies) {
  const now = dependencies.now();
  const lastAttempt = lastContinuationAt.get(goal.runId);
  if (lastAttempt !== undefined && now - lastAttempt < CONTINUATION_COOLDOWN_MS) return false;

  const [run, worker] = await Promise.all([
    dependencies.loadRun(goal.runId),
    dependencies.loadWorker(goal.workerId),
  ]);
  if (!run || !worker || worker.runId !== run.id) return false;
  if (run.archivedAt) return false;
  if (run.mode !== "direct" && run.mode !== "commit") return false;
  const runStatus = normalizedStatus(run.status);
  if (runStatus === "cancelled" || runStatus === "canceled" || runStatus === "quota_waiting") return false;
  const workerStatus = normalizedStatus(worker.status);
  if (BUSY_WORKER_STATUSES.has(workerStatus) || SKIPPED_WORKER_STATUSES.has(workerStatus)) return false;
  if (!worker.bridgeSessionId?.trim()) return false;
  if (now - lastActivityMs(run, worker) > MAX_IDLE_MS) return false;
  if (await dependencies.hasUndeliveredMessages(run.id)) return false;
  if (await dependencies.hasResumableQuotaIncident(run.id)) return false;

  try {
    const agent = await dependencies.getAgent(worker.id);
    const agentState = normalizedStatus(agent.state);
    if (agentState !== "stopped" && agentState !== "error") return false;
  } catch (error) {
    // Anything but a definite "no such agent" (the runtime still starting, a
    // dropped connection) is retried on the next sweep.
    if (!isRuntimeAgentMissingError(error)) return false;
  }

  lastContinuationAt.set(goal.runId, now);
  emitNamedEvent({
    kind: "goal.worker_continuation.started",
    runId: goal.runId,
    goalId: goal.goalId,
    workerId: worker.id,
  });
  try {
    await dependencies.sendContinuation(run.id, GOAL_CONTINUATION_PROMPT);
    emitNamedEvent({
      kind: "goal.worker_continuation.completed",
      runId: goal.runId,
      goalId: goal.goalId,
      workerId: worker.id,
    });
    return true;
  } catch (error) {
    const reason = redactGoalErrorMessage(error);
    emitNamedEvent({
      kind: "goal.worker_continuation.failed",
      runId: goal.runId,
      goalId: goal.goalId,
      workerId: worker.id,
      reason,
    });
    emitNamedEvent({
      kind: "error.surfaced",
      code: "goal.continuation.failed",
      message: `The goal's agent stopped and could not be resumed automatically: ${reason}`,
      surface: "banner",
      runId: goal.runId,
      workerId: worker.id,
    });
    return false;
  }
}

export function __resetGoalContinuationForTests() {
  lastContinuationAt.clear();
}
