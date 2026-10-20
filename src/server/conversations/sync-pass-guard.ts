import { emitNamedEvent } from "@/server/events/named-events";

/**
 * Stall guard for conversation sync passes.
 *
 * Sync passes run one at a time on a single queue, and none of their awaits
 * carry a timeout. On 2026-10-20 one pass stopped resolving: for an hour the
 * runner served pages but persisted no worker output for any conversation,
 * the stuck-worker reaper (chained after the sweep) never ran, and nothing
 * recorded which await had hung.
 *
 * A pass that outlives the stall window now releases the queue so later
 * passes run, and the stall is reported with the step the pass was in. The
 * abandoned pass is not cancelled — its awaits cannot be interrupted from
 * here — so it may still finish and overlap a later pass. Worker writes stay
 * serialized per worker and DB updates are turn-generation fenced, which is
 * what makes the overlap safe.
 */

const DEFAULT_SYNC_PASS_STALL_MS = 60_000;

function readSyncPassStallMs() {
  const parsed = Number.parseInt(process.env.OMNIHARNESS_SYNC_PASS_STALL_MS ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SYNC_PASS_STALL_MS;
}

/** Where a pass is right now; updated at each await worth naming. */
export class SyncPassProgress {
  readonly startedAt = Date.now();
  step = "load_state";
  runId: string | null = null;
  workerId: string | null = null;
  stepStartedAt = this.startedAt;

  at(step: string, runId: string | null = null, workerId: string | null = null) {
    this.step = step;
    this.runId = runId;
    this.workerId = workerId;
    this.stepStartedAt = Date.now();
  }
}

export function runSyncPassWithStallGuard(
  pass: (progress: SyncPassProgress) => Promise<void>,
  options: { stallMs?: number } = {},
): Promise<void> {
  const stallMs = options.stallMs ?? readSyncPassStallMs();
  const progress = new SyncPassProgress();
  return new Promise<void>((resolve, reject) => {
    let stalled = false;
    const timer = setTimeout(() => {
      stalled = true;
      const now = Date.now();
      const where = progress.runId
        ? ` (run ${progress.runId}${progress.workerId ? `, worker ${progress.workerId}` : ""})`
        : "";
      const message = `Conversation sync pass stalled for ${Math.round((now - progress.startedAt) / 1000)}s `
        + `at step "${progress.step}"${where}; releasing the sync queue.`;
      emitNamedEvent({
        kind: "sync.pass_stalled",
        step: progress.step,
        runId: progress.runId,
        workerId: progress.workerId,
        stepElapsedMs: now - progress.stepStartedAt,
        passElapsedMs: now - progress.startedAt,
      });
      emitNamedEvent({
        kind: "error.surfaced",
        code: "sync.pass_stalled",
        message,
        surface: "log",
        ...(progress.runId ? { runId: progress.runId } : {}),
        ...(progress.workerId ? { workerId: progress.workerId } : {}),
        cause: null,
      });
      process.stderr.write(`[sync] ${message}\n`);
      resolve();
    }, stallMs);
    timer.unref?.();

    const settleStalled = (outcome: "resolved" | "rejected") => {
      emitNamedEvent({
        kind: "sync.stalled_pass_settled",
        step: progress.step,
        runId: progress.runId,
        workerId: progress.workerId,
        passElapsedMs: Date.now() - progress.startedAt,
        outcome,
      });
    };

    let running: Promise<void>;
    try {
      running = pass(progress);
    } catch (error) {
      clearTimeout(timer);
      reject(error);
      return;
    }
    running.then(
      () => {
        clearTimeout(timer);
        if (stalled) settleStalled("resolved");
        else resolve();
      },
      (error: unknown) => {
        clearTimeout(timer);
        if (stalled) settleStalled("rejected");
        else reject(error);
      },
    );
  });
}
