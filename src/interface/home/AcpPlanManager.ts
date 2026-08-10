import type { RuntimeAPIs } from "@/runtime-api/types";
import type { WorkerPlanScope } from "@/shared/acp-plan";

export type AcpPlanManagerState = {
  scope: WorkerPlanScope | null;
  status: "idle" | "loading" | "ready" | "error";
  lastError: string | null;
};

type Listener = (state: AcpPlanManagerState) => void;

function sameWorkerIds(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((workerId, index) => workerId === right[index]);
}

export class AcpPlanManager {
  private state: AcpPlanManagerState = { scope: null, status: "idle", lastError: null };
  private readonly listeners = new Set<Listener>();
  private getPlan: RuntimeAPIs["workers"]["getPlan"] | null = null;
  private scopeGeneration = 0;
  private readonly requestVersions = new Map<string, number>();

  configure(getPlan: RuntimeAPIs["workers"]["getPlan"]) {
    this.getPlan = getPlan;
  }

  getState(): AcpPlanManagerState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private publish(state: AcpPlanManagerState) {
    this.state = state;
    for (const listener of this.listeners) listener(state);
  }

  setScope(runId: string | null, workerIds: readonly string[], complete = true) {
    if (!runId) {
      this.scopeGeneration += 1;
      this.requestVersions.clear();
      this.publish({ scope: null, status: "idle", lastError: null });
      return;
    }

    const normalizedWorkerIds = [...new Set(workerIds.filter(Boolean))];
    const current = this.state.scope;
    const sameScope = current
      && current.runId === runId
      && sameWorkerIds(current.workerIds, normalizedWorkerIds)
      && current.complete === complete;
    if (sameScope) return;

    this.scopeGeneration += 1;
    const generation = this.scopeGeneration;
    const previousPlans = current?.runId === runId ? current.plansByWorkerId : {};
    const plansByWorkerId = Object.fromEntries(
      normalizedWorkerIds
        .filter((workerId) => previousPlans[workerId])
        .map((workerId) => [workerId, previousPlans[workerId]!]),
    );
    this.publish({
      scope: { runId, workerIds: normalizedWorkerIds, complete, plansByWorkerId },
      status: "loading",
      lastError: null,
    });

    for (const workerId of normalizedWorkerIds) {
      void this.refreshWorker(runId, workerId, generation);
    }
  }

  onWakeUp(args: { runId?: string | null; workerId: string; seq: number }) {
    const scope = this.state.scope;
    if (!scope || (args.runId && args.runId !== scope.runId) || !scope.workerIds.includes(args.workerId)) return;
    const known = scope.plansByWorkerId[args.workerId];
    if (known && args.seq <= known.lastEntrySeq) return;
    void this.refreshWorker(scope.runId, args.workerId, this.scopeGeneration);
  }

  onKnownSeqs(seqs: Record<string, number> | null | undefined) {
    const scope = this.state.scope;
    if (!scope || !seqs) return;
    for (const [workerId, seq] of Object.entries(seqs)) {
      if (typeof seq === "number") this.onWakeUp({ runId: scope.runId, workerId, seq });
    }
  }

  onStreamResync() {
    const scope = this.state.scope;
    if (!scope) return;
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
      const current = this.state.scope;
      if (!current || current.runId !== runId || !current.workerIds.includes(workerId)) return;
      const currentPlan = current.plansByWorkerId[workerId];
      if (
        currentPlan
        && response.plan
        && response.plan.lastEntrySeq < currentPlan.lastEntrySeq
      ) {
        return;
      }
      const plansByWorkerId = { ...current.plansByWorkerId };
      if (response.plan) plansByWorkerId[workerId] = response.plan;
      else delete plansByWorkerId[workerId];
      const complete = current.complete && current.workerIds.every((id) => id === workerId || plansByWorkerId[id] !== undefined);
      this.publish({
        scope: { ...current, plansByWorkerId },
        status: complete ? "ready" : "loading",
        lastError: null,
      });
    } catch (error) {
      if (generation !== this.scopeGeneration || this.requestVersions.get(requestKey) !== requestVersion) return;
      this.publish({
        scope: this.state.scope,
        status: "error",
        lastError: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export const acpPlanManager = new AcpPlanManager();
