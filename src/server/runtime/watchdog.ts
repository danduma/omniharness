import { compactStaleWorkerOutputs } from "@/server/workers/output-store";
import { compactStaleArtifactStreams } from "@/server/artifacts/compaction";
import { reapStuckDirectWorkers } from "@/server/workers/stuck-worker-reaper";
import { syncConversationSessionsFromBridge } from "@/server/conversations/sync";
import { resumeElapsedQuotaWaits } from "@/server/quota/worker-resume";
import { continueStalledGoals } from "@/server/runs/goal-worker-continuation";
import { continueArmedWakeWorkers } from "@/server/runs/armed-wake-continuation";
import { emitNamedEvent } from "@/server/events/named-events";
import { reconcileExpiredHandoffs } from "@/server/handoff/reconciler";
import { cancelQuotaWakesForTerminalRuns, rehydrateQuotaWakes } from "@/server/quota/wake-schedule";

const WATCHDOG_INTERVAL_MS = 15_000;

let startupPromise: Promise<void> | null = null;
let watchdogInterval: ReturnType<typeof setInterval> | null = null;

/**
 * One pass of the background sweeps that keep conversations moving when no
 * request is in flight: bridge reconciliation, stuck-worker recovery, quota
 * resumes, goal and armed-wake continuation, and output compaction.
 */
export async function runRuntimeSweeps() {
  await reconcileExpiredHandoffs();
  await cancelQuotaWakesForTerminalRuns();
  await rehydrateQuotaWakes();
  void compactStaleWorkerOutputs().catch((error) => {
    console.warn("Worker output compaction sweep failed:", error);
  });
  void compactStaleArtifactStreams().catch((error) => {
    console.warn("Artifact stream compaction sweep failed:", error);
  });
  // Reconcile bridge state into the DB BEFORE the stuck-worker sweep. A turn
  // whose completion was lost (server restart, dropped ask roundtrip, no
  // connected client) leaves the worker at status='working' even though the
  // bridge agent finished; reconciling first turns those into idle/done so
  // the reaper never cancels and re-delivers already-completed work.
  void syncConversationSessionsFromBridge().catch((error) => {
    process.stderr.write(`[bridge-sync] sweep failed: ${error instanceof Error ? error.message : String(error)}\n`);
  }).then(() => reapStuckDirectWorkers()).then((result) => {
    if (result.ok && result.recovered > 0) {
      process.stderr.write(`[stuck-reaper] recovered ${result.recovered} stuck direct worker(s)\n`);
    } else if (!result.ok) {
      process.stderr.write(`[stuck-reaper] sweep failed: ${result.error}\n`);
    }
  }).catch((error) => {
    process.stderr.write(`[stuck-reaper] sweep threw: ${error instanceof Error ? error.message : String(error)}\n`);
  });
  // A quota wake that never delivered leaves a conversation stranded with an
  // open incident and a cred-exhausted worker; this is the only sweep that can
  // recover it.
  await resumeElapsedQuotaWaits().catch((error) => {
    process.stderr.write(`[quota-sweep] sweep failed: ${error instanceof Error ? error.message : String(error)}\n`);
  });
  // A goal outlives the agent process pursuing it. After a restart or crash
  // nothing else starts that agent's next turn, so the goal would sit stalled
  // until the user noticed.
  await continueStalledGoals().catch((error) => {
    process.stderr.write(`[goal-continuation] sweep failed: ${error instanceof Error ? error.message : String(error)}\n`);
  });
  // The same holds for an agent waiting on a wake it armed (a Monitor or
  // ScheduleWakeup): the wake lived in the process that died.
  await continueArmedWakeWorkers().catch((error) => {
    process.stderr.write(`[armed-wake-continuation] sweep failed: ${error instanceof Error ? error.message : String(error)}\n`);
  });
}

export function createRuntimeWatchdogSweepRunner(sweep: () => Promise<void>) {
  let inFlight: Promise<void> | null = null;

  return () => {
    if (inFlight) {
      return inFlight;
    }

    const sweepPromise = Promise.resolve()
      .then(sweep)
      .catch((error) => {
        const reason = error instanceof Error ? error.message : String(error);
        emitNamedEvent({ kind: "runtime.watchdog_sweep_failed", reason });
        process.stderr.write(`[runtime-watchdog] sweep failed: ${reason}\n`);
      })
      .finally(() => {
        if (inFlight === sweepPromise) {
          inFlight = null;
        }
      });

    inFlight = sweepPromise;
    return sweepPromise;
  };
}

const runRuntimeWatchdogSweep = createRuntimeWatchdogSweepRunner(runRuntimeSweeps);

export async function ensureRuntimeWatchdogStarted() {
  if (!startupPromise) {
    startupPromise = runRuntimeSweeps().then(() => {
      if (!watchdogInterval) {
        watchdogInterval = setInterval(() => {
          void runRuntimeWatchdogSweep();
        }, WATCHDOG_INTERVAL_MS);
      }
    }).catch((error) => {
      startupPromise = null;
      throw error;
    });
  }

  await startupPromise;
}
