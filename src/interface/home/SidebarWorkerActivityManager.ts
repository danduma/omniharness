// Non-persistent live worker-output observation timestamps derived from
// worker-entry cursor increases. Only seq increases after the initial baseline
// are counted as recent activity; historical entries never make a run look active.

export interface SidebarWorkerObservation {
  runId: string | null;
  seq: number;
  observedAt: string;
}

export class SidebarWorkerActivityManager {
  // Baseline seqs from the initial snapshot; these are NOT counted as recent.
  private readonly baselineSeqs = new Map<string, number>();
  // Live observations: workerId -> { runId, seq, observedAt }
  private readonly observations = new Map<string, SidebarWorkerObservation>();
  // Derived view: runId -> latest observed worker-output timestamp
  private readonly runOutputAt = new Map<string, string>();

  // Called with workerEntrySeqs from every snapshot/update to establish baselines.
  // Does NOT record an observation — only sets the floor for future seq comparisons.
  onKnownSeqs(seqs: Record<string, number> | undefined): void {
    if (!seqs) return;
    for (const [workerId, seq] of Object.entries(seqs)) {
      if (typeof seq !== "number") continue;
      // Set baseline only if we have not yet seen a live increase for this worker.
      if (!this.observations.has(workerId) && !this.baselineSeqs.has(workerId)) {
        this.baselineSeqs.set(workerId, seq);
      }
    }
  }

  // Called when a worker.entry_appended SSE frame arrives.
  // Only records an observation when seq strictly exceeds the known baseline.
  onWakeUp(args: { workerId: string; seq: number; runId?: string | null }): void {
    const { workerId, seq, runId } = args;
    const baseline = this.baselineSeqs.get(workerId);

    if (baseline === undefined) {
      // First time seeing this worker — treat this as the baseline.
      this.baselineSeqs.set(workerId, seq);
      return;
    }

    if (seq <= baseline) {
      // Not a new entry after page load; ignore.
      return;
    }

    const existing = this.observations.get(workerId);
    if (existing && existing.seq >= seq) {
      // No-op: already recorded this seq or a later one.
      return;
    }

    const observedAt = new Date().toISOString();
    const resolvedRunId = runId ?? existing?.runId ?? null;

    this.observations.set(workerId, { runId: resolvedRunId, seq, observedAt });

    if (resolvedRunId) {
      const current = this.runOutputAt.get(resolvedRunId);
      if (!current || new Date(observedAt).getTime() > new Date(current).getTime()) {
        this.runOutputAt.set(resolvedRunId, observedAt);
      }
    }
  }

  getRunOutputAt(runId: string): string | null {
    return this.runOutputAt.get(runId) ?? null;
  }

  getRunOutputAtRecord(): Record<string, string> {
    return Object.fromEntries(this.runOutputAt);
  }
}

export const sidebarWorkerActivityManager = new SidebarWorkerActivityManager();
