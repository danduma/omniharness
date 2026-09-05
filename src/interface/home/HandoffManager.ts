import { StateManager } from "@/lib/state-manager";
import { getWorkerModelOptions } from "@/interface/home/utils";
import { runtimeErrorMessage } from "@/runtime-api/request";
import type { RuntimeAPIs } from "@/runtime-api/types";
import type { WorkerModelCatalog } from "@/shared/home-types";
import type { HandoffReason, HandoffRecordDto } from "@/shared/handoff";
import type { SupportedWorkerType } from "@/shared/worker-types";

type HandoffDialogRequest = {
  runId: string;
  workerId: string | null;
  sourceWorkerType: SupportedWorkerType | null;
  forkedFromMessageId: string | null;
  reason: HandoffReason;
};

type HandoffManagerState = {
  request: HandoffDialogRequest | null;
  targetWorkerType: SupportedWorkerType;
  model: string;
  effort: string;
  accountId: string;
  handoff: HandoffRecordDto | null;
  preparing: boolean;
  launching: boolean;
  revising: boolean;
  editObjective: string;
  editRemaining: string;
  error: string | null;
};

const INITIAL: HandoffManagerState = { request: null, targetWorkerType: "claude", model: "", effort: "", accountId: "", handoff: null, preparing: false, launching: false, revising: false, editObjective: "", editRemaining: "", error: null };

export class HandoffManager extends StateManager<HandoffManagerState> {
  private api: RuntimeAPIs["handoffs"] | null = null;
  private targetModels: Partial<WorkerModelCatalog> | undefined;
  private requestGeneration = 0;
  constructor() { super(INITIAL); }
  configure(api: RuntimeAPIs["handoffs"]) { this.api = api; }
  configureTargetModels(targetModels: Partial<WorkerModelCatalog> | undefined) { this.targetModels = targetModels; }
  private getTargetDefaults(targetWorkerType: SupportedWorkerType) {
    return {
      model: getWorkerModelOptions(this.targetModels, targetWorkerType)[0]?.value ?? "",
      effort: "High",
      accountId: "",
    };
  }
  open(request: HandoffDialogRequest) {
    const generation = ++this.requestGeneration;
    const targetWorkerType = request.sourceWorkerType === "claude" ? "codex" : "claude";
    this.update({ ...INITIAL, request, targetWorkerType, ...this.getTargetDefaults(targetWorkerType) });
    void this.api?.getActive({ runId: request.runId }).then((response) => {
      if (generation !== this.requestGeneration) return;
      const current = this.getSnapshot();
      if (current.request?.runId !== request.runId || !response.handoff) return;
      const handoff = response.handoff;
      this.patch({
        handoff,
        targetWorkerType: handoff.target.workerType,
        model: handoff.target.model ?? "",
        effort: handoff.target.effort ?? "",
        accountId: handoff.target.accountId ?? "",
        editObjective: handoff.packet?.task.currentObjective ?? "",
        editRemaining: handoff.packet?.state.remaining.join("\n") ?? "",
      });
    }).catch(() => undefined);
  }
  close() { if (!this.getSnapshot().preparing && !this.getSnapshot().launching) { this.requestGeneration += 1; this.update(INITIAL); } }
  setTargetWorkerType(value: SupportedWorkerType) {
    if (value === this.getSnapshot().targetWorkerType) return;
    this.patch({ targetWorkerType: value, ...this.getTargetDefaults(value), handoff: null, error: null });
  }
  setModel(value: string) { this.patch({ model: value, handoff: null }); }
  setEffort(value: string) { this.patch({ effort: value, handoff: null }); }
  setAccountId(value: string) { this.patch({ accountId: value, handoff: null }); }
  async prepare() {
    const state = this.getSnapshot();
    if (!state.request || !this.api) return;
    const generation = this.requestGeneration;
    this.patch({ preparing: true, error: null });
    try {
      const response = await this.api.prepare({ runId: state.request.runId, body: {
        sourceWorkerId: state.request.workerId,
        forkedFromMessageId: state.request.forkedFromMessageId,
        reason: state.request.reason,
        target: { workerType: state.targetWorkerType, model: state.model.trim() || null, effort: state.effort.trim() || null, accountId: state.accountId.trim() || null },
      } });
      if (generation !== this.requestGeneration) return;
      this.patch({ handoff: response.handoff, preparing: false, editObjective: response.handoff.packet?.task.currentObjective ?? "", editRemaining: response.handoff.packet?.state.remaining.join("\n") ?? "" });
    } catch (error) {
      if (generation !== this.requestGeneration) return;
      this.patch({ preparing: false, error: runtimeErrorMessage(error) });
    }
  }
  setEditObjective(value: string) { this.setKey("editObjective", value); }
  setEditRemaining(value: string) { this.setKey("editRemaining", value); }
  async saveRevision() {
    const state = this.getSnapshot();
    if (!state.handoff || !this.api) return;
    const generation = this.requestGeneration;
    this.patch({ revising: true, error: null });
    try {
      const response = await this.api.revise({ handoffId: state.handoff.id, sourceRunId: state.handoff.sourceRunId, body: { expectedRevision: state.handoff.revision, advisory: { currentObjective: state.editObjective, remaining: state.editRemaining.split(/\r?\n/).map((value) => value.trim()).filter(Boolean) } } });
      if (generation !== this.requestGeneration) return;
      this.patch({ handoff: response.handoff, revising: false });
    } catch (error) {
      if (generation !== this.requestGeneration) return;
      this.patch({ revising: false, error: runtimeErrorMessage(error) });
    }
  }
  async launch(): Promise<string | null> {
    const state = this.getSnapshot();
    if (!state.handoff || !this.api) return null;
    const generation = this.requestGeneration;
    this.patch({ launching: true, error: null });
    try {
      const operationId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `handoff-${Date.now()}`;
      const response = await this.api.launch({ handoffId: state.handoff.id, sourceRunId: state.handoff.sourceRunId, body: { expectedRevision: state.handoff.revision, operationId } });
      if (generation !== this.requestGeneration) return null;
      this.requestGeneration += 1;
      this.update(INITIAL);
      return response.handoff.targetRunId;
    } catch (error) {
      if (generation !== this.requestGeneration) return null;
      this.patch({ launching: false, error: runtimeErrorMessage(error) });
      return null;
    }
  }
  async cancel() {
    const handoff = this.getSnapshot().handoff;
    this.requestGeneration += 1;
    this.update(INITIAL);
    if (handoff && this.api) await this.api.cancel({ handoffId: handoff.id, sourceRunId: handoff.sourceRunId, body: { expectedRevision: handoff.revision } }).catch(() => undefined);
  }
}

export const handoffManager = new HandoffManager();
