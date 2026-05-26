import { asc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { runs, workers } from "@/server/db/schema";
import { openRecoveryIncident, markRecoveryIncidentNeedsUser } from "@/server/runs/recovery-incidents";
import { setRunNeedsRecovery } from "@/server/runs/recovery-actions";
import { isTerminalRunStatus, normalizeRunStatus } from "@/server/runs/status";
import { resumeMissingDirectWorker } from "@/server/conversations/send-message";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";

const STARTING_WORKER_RELOAD_GRACE_MS = 30_000;
const LOST_WORKER_REASON = "Worker was marked active but is not present in the bridge runtime.";

function isRunEligible(status: string | null | undefined) {
  const normalized = normalizeRunStatus(status);
  return Boolean(normalized)
    && !isTerminalRunStatus(normalized)
    && normalized !== "awaiting_user"
    && normalized !== "needs_recovery"
    && normalized !== "recovering"
    && normalized !== "quota_waiting";
}

function isStaleStartingWorker(worker: typeof workers.$inferSelect, nowMs: number) {
  if (normalizeRunStatus(worker.status).split(":")[0]?.trim() !== "starting") {
    return false;
  }
  if (worker.bridgeSessionId?.trim()) {
    return false;
  }
  return nowMs - worker.updatedAt.getTime() >= STARTING_WORKER_RELOAD_GRACE_MS;
}

// Workers that were actively producing output when the bridge died:
// `status="working"` in the DB but absent from the bridge's live agent
// list. Without this, the FE shows "running" in the sidebar and no
// "Thinking…" indicator forever, because the DB row never advances and
// the bridge has no agent to report state for. We auto-resume via the
// same spawn-with-saved-session path that the regular send-message
// flow uses.
function isOrphanedWorkingWorker(
  worker: typeof workers.$inferSelect,
  bridgeAgentNames: ReadonlySet<string>,
): boolean {
  const status = normalizeRunStatus(worker.status).split(":")[0]?.trim();
  if (status !== "working" && status !== "stuck") {
    return false;
  }
  // No saved session → resume can't help; the manual recovery flow is
  // the right surface there.
  if (!worker.bridgeSessionId?.trim()) {
    return false;
  }
  // The bridge knows about it — nothing for us to do.
  if (bridgeAgentNames.has(worker.id)) {
    return false;
  }
  return true;
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
  const runId = args.selectedRunId?.trim();
  if (!runId) {
    return { action: "none" as const };
  }

  const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
  if (!run || !isRunEligible(run.status)) {
    return { action: "none" as const };
  }

  const nowMs = args.nowMs ?? Date.now();
  const runWorkers = await db
    .select()
    .from(workers)
    .where(eq(workers.runId, run.id))
    .orderBy(asc(workers.createdAt), asc(workers.id));

  // Prefer the orphaned-working case when the caller has told us what
  // the bridge sees: a "working" row with no live agent is the more
  // urgent failure (UI hangs forever) than a "starting" row past its
  // grace window.
  const orphanedWorkingWorker = args.bridgeAgentNames
    ? runWorkers.find((worker) => isOrphanedWorkingWorker(worker, args.bridgeAgentNames!))
    : undefined;
  const staleWorker = orphanedWorkingWorker
    ?? runWorkers.find((worker) => isStaleStartingWorker(worker, nowMs));

  if (!staleWorker) {
    return { action: "none" as const };
  }

  // The worker is alive in DB but its bridge session is gone. Instead of
  // surfacing a "needs recovery" incident with a manual Resume button —
  // which is the exact button the user keeps having to press after every
  // crash/restart — try to auto-respawn via the same primitive on-send
  // recovery uses. The runtime gets a fresh agent record (with the saved
  // session resumed when the agent CLI supports it), and the user just
  // sees the conversation come back to life.
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

    await setRunNeedsRecovery({
      runId: run.id,
      reason: fallbackReason,
    });
    const incident = await openRecoveryIncident({
      runId: run.id,
      workerId: staleWorker.id,
      queuedMessageId: null,
      kind: "worker_lost",
      lastError: fallbackReason,
      details: {
        source: args.source ?? "persisted-reload-bootstrap",
        recoveryState: "needs_recovery",
        recommendedAction: "manual_resume",
        reason: fallbackReason,
        autoRecoveryError: error instanceof Error ? error.message : String(error),
      },
    });
    await markRecoveryIncidentNeedsUser({
      incidentId: incident.id,
      runId: run.id,
      workerId: staleWorker.id,
      reason: fallbackReason,
      details: {
        recoveryState: "needs_recovery",
        recommendedAction: "manual_resume",
        reason: fallbackReason,
      },
    });

    return {
      action: "needs_user" as const,
      runId: run.id,
      workerId: staleWorker.id,
      incidentId: incident.id,
    };
  }
}
