import type { RuntimeAPIs } from "@/runtime-api/types";
import type { PlanSurfaceOwner, WorkerPlanScope } from "@/shared/acp-plan";
import { StateManager } from "@/lib/state-manager";

export type AcpPlanManagerState = {
  scope: WorkerPlanScope | null;
  status: "idle" | "loading" | "ready" | "error";
  lastError: string | null;
};

function sameWorkerIds(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((workerId, index) => workerId === right[index]);
}

export function selectAcpPlanSurfaceOwner(args: {
  runId: string | null;
  workerIds: readonly string[];
  primaryWorkerId: string | null;
  eligibleConversationMode: boolean;
  workerIsTerminal: boolean;
  planState: AcpPlanManagerState;
}): PlanSurfaceOwner {
  const workerId = args.workerIds.length === 1 ? args.workerIds[0]! : null;
  const scope = args.planState.scope;
  const ready = Boolean(
    args.runId
      && workerId
      && args.planState.status === "ready"
      && scope?.complete
      && scope.runId === args.runId
      && scope.workerIds.length === 1
      && scope.workerIds[0] === workerId,
  );
  const ownsWidget = Boolean(
    ready
      && args.eligibleConversationMode
      && !args.workerIsTerminal
      && args.primaryWorkerId === workerId,
  );
  const plan = ownsWidget && workerId ? scope?.plansByWorkerId[workerId] ?? null : null;
  return {
    runId: args.runId,
    workerId,
    ready,
    ownsWidget,
    suppressAcceptedPlanRows: ownsWidget && plan !== null,
    plan,
  };
}

export class AcpPlanManager extends StateManager<AcpPlanManagerState> {
  private getPlan: RuntimeAPIs["workers"]["getPlan"] | null = null;
  private scopeGeneration = 0;
  private readonly requestVersions = new Map<string, number>();
  private coveredWorkerIds = new Set<string>();
  private readonly latestSeqByWorkerId = new Map<string, number>();
  private readonly pendingSeqByWorkerId = new Map<string, number>();
  private readonly conflictingTokens = new Set<string>();

  constructor() {
    super({ scope: null, status: "idle", lastError: null });
  }

  configure(getPlan: RuntimeAPIs["workers"]["getPlan"]) {
    this.getPlan = getPlan;
  }

  getState(): AcpPlanManagerState {
    return this.getSnapshot();
  }

  private publish(state: AcpPlanManagerState) {
    this.update(state);
  }

  setScope(runId: string | null, workerIds: readonly string[], complete = true) {
    if (!runId) {
      this.scopeGeneration += 1;
      this.requestVersions.clear();
      this.coveredWorkerIds.clear();
      this.latestSeqByWorkerId.clear();
      this.pendingSeqByWorkerId.clear();
      this.conflictingTokens.clear();
      this.publish({ scope: null, status: "idle", lastError: null });
      return;
    }

    const normalizedWorkerIds = [...new Set(workerIds.filter(Boolean))];
    const current = this.getSnapshot().scope;
    const sameScope = current
      && current.runId === runId
      && sameWorkerIds(current.workerIds, normalizedWorkerIds)
      && current.complete === complete;
    if (sameScope) return;

    this.scopeGeneration += 1;
    const generation = this.scopeGeneration;
    const sameRun = current?.runId === runId;
    const previousPlans = sameRun ? current.plansByWorkerId : {};
    this.coveredWorkerIds = new Set(
      sameRun ? normalizedWorkerIds.filter((workerId) => this.coveredWorkerIds.has(workerId)) : [],
    );
    if (!sameRun) {
      this.latestSeqByWorkerId.clear();
      this.pendingSeqByWorkerId.clear();
      this.conflictingTokens.clear();
    } else {
      for (const workerId of [...this.latestSeqByWorkerId.keys()]) {
        if (!normalizedWorkerIds.includes(workerId)) this.latestSeqByWorkerId.delete(workerId);
      }
      for (const workerId of [...this.pendingSeqByWorkerId.keys()]) {
        if (!normalizedWorkerIds.includes(workerId)) this.pendingSeqByWorkerId.delete(workerId);
      }
    }
    const plansByWorkerId = Object.fromEntries(
      normalizedWorkerIds
        .filter((workerId) => previousPlans[workerId])
        .map((workerId) => [workerId, previousPlans[workerId]!]),
    );
    this.publish({
      scope: { runId, workerIds: normalizedWorkerIds, complete, plansByWorkerId },
      status: normalizedWorkerIds.every((workerId) => this.coveredWorkerIds.has(workerId)) ? "ready" : "loading",
      lastError: null,
    });

    for (const workerId of normalizedWorkerIds) {
      void this.refreshWorker(runId, workerId, generation);
    }
  }

  onWakeUp(args: { runId?: string | null; workerId: string; seq: number }) {
    const scope = this.getSnapshot().scope;
    if (!scope || (args.runId && args.runId !== scope.runId) || !scope.workerIds.includes(args.workerId)) return;
    const knownSeq = Math.max(
      this.latestSeqByWorkerId.get(args.workerId) ?? 0,
      this.pendingSeqByWorkerId.get(args.workerId) ?? 0,
    );
    if (args.seq <= knownSeq) return;
    this.pendingSeqByWorkerId.set(args.workerId, args.seq);
    void this.refreshWorker(scope.runId, args.workerId, this.scopeGeneration);
  }

  onKnownSeqs(seqs: Record<string, number> | null | undefined) {
    const scope = this.getSnapshot().scope;
    if (!scope || !seqs) return;
    for (const [workerId, seq] of Object.entries(seqs)) {
      if (typeof seq === "number") this.onWakeUp({ runId: scope.runId, workerId, seq });
    }
  }

  onStreamResync() {
    const scope = this.getSnapshot().scope;
    if (!scope) return;
    this.pendingSeqByWorkerId.clear();
    for (const workerId of scope.workerIds) {
      void this.refreshWorker(scope.runId, workerId, this.scopeGeneration);
    }
  }

  private async refreshWorker(runId: string, workerId: string, generation: number) {
    if (!this.getPlan || generation !== this.scopeGeneration) return;
    const requestKey = `${runId}/${workerId}`;
    const requestVersion = (this.requestVersions.get(requestKey) ?? 0) + 1;
    this.requestVersions.set(requestKey, requestVersion);
    try {
      const response = await this.getPlan({ runId, workerId });
      if (generation !== this.scopeGeneration || this.requestVersions.get(requestKey) !== requestVersion) return;
      const current = this.getSnapshot().scope;
      if (!current || current.runId !== runId || !current.workerIds.includes(workerId)) return;
      if (response.plan && (response.plan.runId !== runId || response.plan.workerId !== workerId)) {
        throw new Error(`Worker plan response identity did not match ${runId}/${workerId}.`);
      }
      const knownLatestSeq = this.latestSeqByWorkerId.get(workerId) ?? 0;
      if (response.latestSeq < knownLatestSeq) return;
      const currentPlan = current.plansByWorkerId[workerId];
      let acceptResponsePlan = true;
      if (currentPlan && response.plan) {
        const staleBoundary = response.plan.planBoundarySeq < currentPlan.planBoundarySeq;
        const sameBoundary = response.plan.planBoundarySeq === currentPlan.planBoundarySeq;
        const staleEntry = sameBoundary
          && response.plan.acpSessionId === currentPlan.acpSessionId
          && response.plan.lastEntrySeq < currentPlan.lastEntrySeq;
        if (staleBoundary || staleEntry) return;

        const equalToken = sameBoundary
          && response.plan.acpSessionId === currentPlan.acpSessionId
          && response.plan.lastEntrySeq === currentPlan.lastEntrySeq;
        if (equalToken) {
          acceptResponsePlan = false;
          if (JSON.stringify(response.plan) !== JSON.stringify(currentPlan)) {
            const conflictToken = `${runId}/${workerId}/${currentPlan.acpSessionId}/${currentPlan.planBoundarySeq}/${currentPlan.lastEntrySeq}`;
            if (!this.conflictingTokens.has(conflictToken)) {
              this.conflictingTokens.add(conflictToken);
              queueMicrotask(() => {
                if (generation === this.scopeGeneration) {
                  void this.refreshWorker(runId, workerId, generation);
                }
              });
            }
          }
        } else if (sameBoundary && response.plan.acpSessionId !== currentPlan.acpSessionId) {
          // One durable boundary sequence cannot identify two ACP sessions.
          // Preserve known state and perform one bounded resync read.
          acceptResponsePlan = false;
          const conflictToken = `${runId}/${workerId}/boundary/${currentPlan.planBoundarySeq}`;
          if (!this.conflictingTokens.has(conflictToken)) {
            this.conflictingTokens.add(conflictToken);
            queueMicrotask(() => {
              if (generation === this.scopeGeneration) void this.refreshWorker(runId, workerId, generation);
            });
          }
        }
      }
      const plansByWorkerId = { ...current.plansByWorkerId };
      if (response.plan && acceptResponsePlan) plansByWorkerId[workerId] = response.plan;
      else if (!response.plan && current.complete) delete plansByWorkerId[workerId];
      this.latestSeqByWorkerId.set(workerId, response.latestSeq);
      this.coveredWorkerIds.add(workerId);
      const ready = current.workerIds.every((id) => this.coveredWorkerIds.has(id));
      this.publish({
        scope: { ...current, plansByWorkerId },
        status: ready ? "ready" : "loading",
        lastError: null,
      });
    } catch (error) {
      if (generation !== this.scopeGeneration || this.requestVersions.get(requestKey) !== requestVersion) return;
      this.publish({
        scope: this.getSnapshot().scope,
        status: "error",
        lastError: error instanceof Error ? error.message : String(error),
      });
    } finally {
      if (generation === this.scopeGeneration && this.requestVersions.get(requestKey) === requestVersion) {
        this.pendingSeqByWorkerId.delete(workerId);
      }
    }
  }
}

export const acpPlanManager = new AcpPlanManager();
