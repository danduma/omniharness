import { and, asc, eq, isNull, notInArray } from "drizzle-orm";
import path from "path";
import { db } from "@/server/db";
import { runs, workers } from "@/server/db/schema";
import { emitNamedEvent } from "@/server/events/named-events";
import { openRecoveryIncident, markRecoveryIncidentNeedsUser } from "@/server/runs/recovery-incidents";
import { setRunNeedsRecovery } from "@/server/runs/recovery-actions";
import { isTerminalRunStatus, normalizeRunStatus } from "@/server/runs/status";
import { resumeMissingDirectWorker } from "@/server/conversations/send-message";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
import { readWorkerSessionMetadata } from "@/server/workers/session-metadata";

const STARTING_WORKER_RELOAD_GRACE_MS = 30_000;
const ACTIVE_WORKER_RELOAD_GRACE_MS = 15_000;
const LOST_WORKER_REASON = "Worker was marked active but is not present in the bridge runtime.";

function normalizedWorkerStatus(worker: typeof workers.$inferSelect) {
  return normalizeRunStatus(worker.status).split(":")[0]?.trim() ?? "";
}

function isPastGrace(worker: typeof workers.$inferSelect, nowMs: number) {
  const status = normalizedWorkerStatus(worker);
  const graceMs = status === "starting"
    ? STARTING_WORKER_RELOAD_GRACE_MS
    : ACTIVE_WORKER_RELOAD_GRACE_MS;
  return nowMs - worker.updatedAt.getTime() >= graceMs;
}

function isPathInside(root: string, candidate: string) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function workerMatchesRunProject(run: typeof runs.$inferSelect, worker: typeof workers.$inferSelect) {
  if (!run.projectPath?.trim()) {
    return true;
  }
  const projectPath = path.resolve(run.projectPath);
  const workerCwd = path.resolve(worker.cwd);
  return isPathInside(projectPath, workerCwd);
}

function isRunEligible(status: string | null | undefined) {
  const normalized = normalizeRunStatus(status);
  return Boolean(normalized)
    && !isTerminalRunStatus(normalized)
    && normalized !== "awaiting_user"
    && normalized !== "needs_recovery"
    && normalized !== "recovering"
    && normalized !== "quota_waiting";
}

/**
 * SQL-side prefilter for the sweep below, kept in step with `isRunEligible`,
 * which stays the authority. Listing statuses rather than deriving them keeps
 * the query index-friendly; `isRunEligible` still re-checks every row, so a
 * status missing here costs a wasted read, never a wrong decision.
 */
const INELIGIBLE_SWEEP_STATUSES = [
  "done",
  "failed",
  "cancelled",
  "canceled",
  "promoting",
  "promoted",
  "awaiting_user",
  "needs_recovery",
  "recovering",
  "quota_waiting",
];

function isStaleStartingWorker(worker: typeof workers.$inferSelect, nowMs: number) {
  if (normalizedWorkerStatus(worker) !== "starting") {
    return false;
  }
  if (worker.bridgeSessionId?.trim()) {
    return false;
  }
  return isPastGrace(worker, nowMs);
}

// Workers that were actively producing output when the bridge died:
// `status="working"` in the DB but absent from the bridge's live agent
// list. Without this, the FE shows "running" in the sidebar and no
// "Thinking…" indicator forever, because the DB row never advances and
// the bridge has no agent to report state for. We auto-resume via the
// same spawn-with-saved-session path that the regular send-message
// flow uses.
function isOrphanedActiveWorker(
  worker: typeof workers.$inferSelect,
  bridgeAgentNames: ReadonlySet<string>,
  nowMs: number,
): boolean {
  const status = normalizedWorkerStatus(worker);
  if (status !== "starting" && status !== "working" && status !== "stuck" && status !== "recovering") {
    return false;
  }
  // The bridge knows about it — nothing for us to do.
  if (bridgeAgentNames.has(worker.id)) {
    return false;
  }
  return isPastGrace(worker, nowMs);
}

async function markWorkerLost(worker: typeof workers.$inferSelect) {
  if (normalizedWorkerStatus(worker) === "lost") {
    return;
  }
  await db.update(workers).set({
    status: "lost",
    currentText: "",
    updatedAt: new Date(),
  }).where(eq(workers.id, worker.id));
  emitNamedEvent({
    kind: "worker.status",
    runId: worker.runId,
    workerId: worker.id,
    prev: worker.status,
    next: "lost",
  });
}

async function markStaleWorkerNeedsUser(args: {
  run: typeof runs.$inferSelect;
  worker: typeof workers.$inferSelect;
  source?: string;
  reason: string;
  autoRecoveryError?: string | null;
}) {
  await markWorkerLost(args.worker);
  await setRunNeedsRecovery({
    runId: args.run.id,
    reason: args.reason,
  });
  const incident = await openRecoveryIncident({
    runId: args.run.id,
    workerId: args.worker.id,
    queuedMessageId: null,
    kind: "worker_lost",
    lastError: args.reason,
    details: {
      source: args.source ?? "persisted-reload-bootstrap",
      recoveryState: "needs_recovery",
      recommendedAction: "manual_resume",
      reason: args.reason,
      ...(args.autoRecoveryError ? { autoRecoveryError: args.autoRecoveryError } : {}),
    },
  });
  await markRecoveryIncidentNeedsUser({
    incidentId: incident.id,
    runId: args.run.id,
    workerId: args.worker.id,
    reason: args.reason,
    details: {
      recoveryState: "needs_recovery",
      recommendedAction: "manual_resume",
      reason: args.reason,
    },
  });

  return {
    action: "needs_user" as const,
    runId: args.run.id,
    workerId: args.worker.id,
    incidentId: incident.id,
  };
}

/**
 * Settle orphaned workers on every run the user is *not* currently watching.
 *
 * The per-run pass below only ever looked at `selectedRunId`, so a conversation
 * whose worker died while the user was reading a different one was never
 * reconciled at all — and nothing else closes that gap. `syncConversationSessions`
 * skips a worker the bridge has forgotten outright (`if (!agent) continue`), and
 * its persisted branch reaches no verdict either: it returns early for planning
 * runs, derives a status equal to the one already stored for the rest, and defers
 * the interesting case to `reconcileRunRecovery` — which is itself gated on the
 * run being selected.
 *
 * So `runs.updatedAt` never advances, the complete-catalog checksum never
 * changes, and the client's 60s validation poll keeps answering `notModified`.
 * The sidebar spinner keys off `run.status === "running"`, so it spins forever.
 * Rows have been observed stuck that way for months.
 *
 * Deliberately settle-only: no auto-resume. Respawning an agent is what the
 * user wants for the conversation in front of them, not for every stale row in
 * the catalog — a sweep that resumed would resurrect months-old conversations
 * en masse. Here we only record what is already true (the worker is gone) and
 * hand the user a Resume button.
 */
async function settleUnwatchedOrphanedWorkers(args: {
  bridgeAgentNames: ReadonlySet<string>;
  selectedRunId: string | null;
  source?: string;
  nowMs: number;
}) {
  const settledRunIds: string[] = [];
  // This runs on every snapshot build, so keep it off the full runs table.
  // Settled and resting states can never hold an orphan worth reporting, and
  // they are the overwhelming majority of rows.
  const candidateRuns = await db
    .select()
    .from(runs)
    .where(and(
      isNull(runs.archivedAt),
      notInArray(runs.status, INELIGIBLE_SWEEP_STATUSES),
    ));

  for (const run of candidateRuns) {
    if (run.id === args.selectedRunId || !isRunEligible(run.status) || run.mode === "implementation") {
      continue;
    }

    const runWorkers = await db
      .select()
      .from(workers)
      .where(eq(workers.runId, run.id))
      .orderBy(asc(workers.createdAt), asc(workers.id));
    const orphan = runWorkers.find((worker) => isOrphanedActiveWorker(worker, args.bridgeAgentNames, args.nowMs));
    if (!orphan || !workerMatchesRunProject(run, orphan)) {
      continue;
    }

    emitNamedEvent({
      kind: "worker.orphan_settled",
      runId: run.id,
      workerId: orphan.id,
      workerStatus: orphan.status,
      runStatus: run.status,
      source: args.source ?? "unwatched-run-sweep",
    });
    await markStaleWorkerNeedsUser({
      run,
      worker: orphan,
      source: args.source ?? "unwatched-run-sweep",
      reason: LOST_WORKER_REASON,
    });
    settledRunIds.push(run.id);
  }

  if (settledRunIds.length > 0) {
    notifyEventStreamSubscribers();
  }
  return settledRunIds;
}

export async function reconcilePersistedReloadZombies(args: {
  selectedRunId?: string | null;
  source?: string;
  nowMs?: number;
  // Set of worker ids the bridge has live agent records for. When
  // provided, we additionally detect workers whose DB status is
  // "working"/"stuck" but who aren't in the bridge — usually because
  // the bridge crashed/restarted while they were mid-turn. When
  // undefined, we skip this check (we don't know what the bridge
  // sees yet).
  bridgeAgentNames?: ReadonlySet<string>;
}) {
  const runId = args.selectedRunId?.trim() || null;
  const nowMs = args.nowMs ?? Date.now();

  // Only meaningful once the caller knows what the bridge actually holds;
  // without that list an absent agent is indistinguishable from one we simply
  // have not looked up yet.
  //
  // The sweep deliberately stays out of the return value: callers read that as
  // the verdict on the run they asked about, and an unrelated run being settled
  // must not masquerade as one. It reports through `worker.orphan_settled` and
  // its recovery incidents instead.
  if (args.bridgeAgentNames) {
    await settleUnwatchedOrphanedWorkers({
      bridgeAgentNames: args.bridgeAgentNames,
      selectedRunId: runId,
      source: args.source,
      nowMs,
    });
  }

  if (!runId) {
    return { action: "none" as const };
  }

  const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
  if (!run || !isRunEligible(run.status)) {
    return { action: "none" as const };
  }

  const runWorkers = await db
    .select()
    .from(workers)
    .where(eq(workers.runId, run.id))
    .orderBy(asc(workers.createdAt), asc(workers.id));

  // Prefer the orphaned-working case when the caller has told us what
  // the bridge sees: a "working" row with no live agent is the more
  // urgent failure (UI hangs forever) than a "starting" row past its
  // grace window.
  const orphanedActiveWorker = args.bridgeAgentNames && run.mode !== "implementation"
    ? runWorkers.find((worker) => isOrphanedActiveWorker(worker, args.bridgeAgentNames!, nowMs))
    : undefined;
  const staleWorker = orphanedActiveWorker
    ?? runWorkers.find((worker) => isStaleStartingWorker(worker, nowMs));

  if (!staleWorker) {
    return { action: "none" as const };
  }
  if (!workerMatchesRunProject(run, staleWorker)) {
    return { action: "none" as const };
  }

  // The worker is alive in DB but its bridge session is gone. Instead of
  // surfacing a "needs recovery" incident with a manual Resume button —
  // which is the exact button the user keeps having to press after every
  // crash/restart — try to auto-respawn via the same primitive on-send
  // recovery uses. The runtime gets a fresh agent record (with the saved
  // session resumed when the agent CLI supports it), and the user just
  // sees the conversation come back to life.
  const hasSavedSession = Boolean(
    staleWorker.bridgeSessionId?.trim()
    || await readWorkerSessionMetadata(staleWorker.runId, staleWorker.id),
  );
  if (!hasSavedSession) {
    return markStaleWorkerNeedsUser({
      run,
      worker: staleWorker,
      source: args.source,
      reason: `${LOST_WORKER_REASON} (missing persisted ACP session metadata)`,
    });
  }

  try {
    await resumeMissingDirectWorker(run, staleWorker);
    notifyEventStreamSubscribers();
    return {
      action: "recovered" as const,
      runId: run.id,
      workerId: staleWorker.id,
    };
  } catch (error) {
    // Auto-recovery failed — fall through to the original needs_user path so
    // the user has at least a button to fall back to. Most likely cause: the
    // agent CLI is unavailable (PATH issue) or its session resume is rejected
    // AND a fresh spawn fails. Both are genuinely user-actionable.
    const fallbackReason = error instanceof Error && error.message
      ? `${LOST_WORKER_REASON} (auto-recovery failed: ${error.message})`
      : LOST_WORKER_REASON;

    return markStaleWorkerNeedsUser({
      run,
      worker: staleWorker,
      source: args.source,
      reason: fallbackReason,
      autoRecoveryError: error instanceof Error ? error.message : String(error),
    });
  }
}
