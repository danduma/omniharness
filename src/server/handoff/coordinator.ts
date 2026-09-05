import type { NamedEvent } from "@/server/events/named-events";
import type { GatheredHandoffCandidates } from "./candidates";
import type { CompileHybridHandoffInput } from "./compiler";
import type {
  HandoffReason,
  HandoffRecordDto,
  HandoffTargetSelection,
  HybridHandoffPacketV1,
} from "@/shared/handoff";

export class HandoffCoordinatorError extends Error {
  constructor(
    readonly code:
      | "handoff_not_found"
      | "handoff_source_changed"
      | "handoff_source_not_stopped"
      | "handoff_summary_failed"
      | "handoff_target_unavailable"
      | "handoff_invalid_state"
      | "handoff_launch_failed",
    message: string,
    readonly status = 409,
  ) {
    super(message);
    this.name = "HandoffCoordinatorError";
  }
}

export type HandoffSource = {
  run: {
    id: string;
    mode: string | null;
    projectPath: string | null;
    status: string;
    gitBaselineJson: string | null;
  };
  worker: {
    id: string;
    type: string;
    status: string;
    bridgeSessionId: string | null;
    cwd?: string;
  } | null;
};

export type PrepareHandoffInput = {
  sourceRunId: string;
  sourceWorkerId: string | null;
  forkedFromMessageId: string | null;
  reason: HandoffReason;
  target: HandoffTargetSelection;
};

export type LaunchHandoffInput = {
  handoffId: string;
  expectedRevision: number;
  operationId: string;
};

export type HandoffCoordinatorDependencies = {
  now(): Date;
  randomId(): string;
  getSource(input: PrepareHandoffInput): Promise<HandoffSource>;
  validateTarget(source: HandoffSource, target: HandoffTargetSelection, context: { reason: HandoffReason; phase: "prepare" | "launch" }): Promise<void>;
  createDraft(input: PrepareHandoffInput, source: HandoffSource): Promise<HandoffRecordDto>;
  terminateSource(source: HandoffSource, handoff: HandoffRecordDto): Promise<{ confirmed: boolean }>;
  gatherCandidates(source: HandoffSource, input: PrepareHandoffInput): Promise<GatheredHandoffCandidates>;
  summarizePacket(source: HandoffSource, input: PrepareHandoffInput, handoff: HandoffRecordDto, packet: HybridHandoffPacketV1): Promise<CompileHybridHandoffInput["advisory"]>;
  compilePacket(input: CompileHybridHandoffInput): HybridHandoffPacketV1;
  savePacket(handoff: HandoffRecordDto, packet: HybridHandoffPacketV1, candidates: GatheredHandoffCandidates): Promise<HandoffRecordDto>;
  markSourcePrepared(source: HandoffSource, handoff: HandoffRecordDto): Promise<void>;
  getHandoff(handoffId: string): Promise<HandoffRecordDto | null>;
  getSourceFence(handoff: HandoffRecordDto): Promise<{ sourceSeq: number | null; workspaceFingerprint: string | null }>;
  claimLaunch(handoff: HandoffRecordDto, operationId: string, claimToken: string): Promise<HandoffRecordDto>;
  launchTarget(handoff: HandoffRecordDto, claimToken: string): Promise<{ runId: string; workerId: string | null }>;
  completeLaunch(handoff: HandoffRecordDto, target: { runId: string; workerId: string | null }): Promise<HandoffRecordDto>;
  settleFailure(handoff: HandoffRecordDto, code: string, message: string): Promise<HandoffRecordDto | null | void>;
  cancelHandoff(handoff: HandoffRecordDto, reason: string): Promise<HandoffRecordDto>;
  emit(event: NamedEvent): void;
};

function fallbackAdvisory(candidates: GatheredHandoffCandidates): CompileHybridHandoffInput["advisory"] {
  return {
    currentObjective: candidates.currentObjective,
    completed: [],
    remaining: [],
    blockers: [],
    openQuestions: [],
    decisions: [],
    relevantFiles: [],
    summarySource: candidates.recentAssistantSummary ? "recent_assistant" : "synthetic",
  };
}

function surfacedCode(error: HandoffCoordinatorError) {
  if (error.code === "handoff_target_unavailable") return "handoff.target_unavailable" as const;
  if (error.code === "handoff_source_changed") return "handoff.source_changed" as const;
  if (error.code === "handoff_summary_failed") return "handoff.summary_failed" as const;
  if (error.code === "handoff_launch_failed") return "handoff.launch_failed" as const;
  return "handoff.capture_failed" as const;
}

export function createHandoffCoordinator(dependencies: HandoffCoordinatorDependencies) {
  return {
    async prepare(input: PrepareHandoffInput): Promise<HandoffRecordDto> {
      const source = await dependencies.getSource(input);
      try {
        await dependencies.validateTarget(source, input.target, { reason: input.reason, phase: "prepare" });
      } catch (cause) {
        const error = cause instanceof HandoffCoordinatorError ? cause : new HandoffCoordinatorError("handoff_target_unavailable", cause instanceof Error ? cause.message : String(cause));
        dependencies.emit({ kind: "handoff.refused", runId: source.run.id, stage: "capture", code: error.code, reason: error.message });
        dependencies.emit({ kind: "error.surfaced", code: surfacedCode(error), message: error.message, surface: "toast", runId: source.run.id });
        throw cause;
      }
      const draft = await dependencies.createDraft(input, source);
      dependencies.emit({
        kind: "handoff.capture_started",
        runId: source.run.id,
        handoffId: draft.id,
        workerId: source.worker?.id ?? null,
        reason: input.reason,
        targetWorkerType: input.target.workerType,
      });
      try {
      const termination = await dependencies.terminateSource(source, draft);
      if (!termination.confirmed) {
        const error = new HandoffCoordinatorError("handoff_source_not_stopped", "The source CLI could not be confirmed stopped.");
        throw error;
      }
      const candidates = await dependencies.gatherCandidates(source, input);
      const compileInput = (advisory: CompileHybridHandoffInput["advisory"]): CompileHybridHandoffInput => ({
        source: {
          runId: source.run.id,
          workerId: source.worker?.id ?? null,
          workerType: (source.worker?.type ?? null) as CompileHybridHandoffInput["source"]["workerType"],
          forkedFromMessageId: input.forkedFromMessageId,
          sourceSeq: candidates.sourceSeq,
          interruptionReason: input.reason,
          generatedAt: dependencies.now().toISOString(),
        },
        target: input.target,
        projectRootLabel: candidates.workspace.projectRootLabel,
        authoritative: {
          originalRequest: candidates.originalRequest,
          currentObjective: candidates.currentObjective,
          // The current objective is not evidence that work is actively in
          // progress. Only persist explicitly observed progress here.
          inProgress: [],
          modifiedFiles: candidates.workspace.modifiedFiles,
          verification: candidates.verification,
          recentUserMessages: candidates.recentUserMessages,
          recentAssistantSummary: candidates.recentAssistantSummary,
          queuedMessages: candidates.queuedMessages,
          baselineCommit: candidates.workspace.baselineCommit,
          currentHead: candidates.workspace.currentHead,
          dirtyBeforeSession: candidates.workspace.dirtyBeforeSession,
          untrackedFiles: candidates.workspace.untrackedFiles,
          commitsCreated: candidates.workspace.commitsCreated,
          plans: candidates.plans,
          specs: candidates.specs,
          generatedOutputs: candidates.generatedOutputs,
        },
        advisory,
      });
      const evidencePacket = dependencies.compilePacket(compileInput(fallbackAdvisory(candidates)));
      dependencies.emit({ kind: "handoff.summary_started", runId: source.run.id, handoffId: draft.id, targetWorkerType: input.target.workerType });
      let selectedAdvisory: CompileHybridHandoffInput["advisory"];
      try {
        selectedAdvisory = await dependencies.summarizePacket(source, input, draft, evidencePacket);
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        dependencies.emit({ kind: "handoff.summary_failed", runId: source.run.id, handoffId: draft.id, targetWorkerType: input.target.workerType, reason: message });
        throw new HandoffCoordinatorError("handoff_summary_failed", `The target CLI could not prepare the continuation brief: ${message}`);
      }
      dependencies.emit({ kind: "handoff.summary_completed", runId: source.run.id, handoffId: draft.id, targetWorkerType: input.target.workerType });
      selectedAdvisory.blockers = [...selectedAdvisory.blockers, ...(candidates.workspace.warnings ?? [])];
      const packet = dependencies.compilePacket(compileInput(selectedAdvisory));
      const ready = await dependencies.savePacket(draft, packet, candidates);
      await dependencies.markSourcePrepared(source, ready);
      dependencies.emit({ kind: "handoff.packet_ready", runId: source.run.id, handoffId: ready.id, revision: ready.revision, sourceSeq: candidates.sourceSeq });
      return ready;
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        await dependencies.settleFailure(draft, cause instanceof HandoffCoordinatorError ? cause.code : "handoff_capture_failed", message);
        dependencies.emit({ kind: "handoff.failed", runId: source.run.id, handoffId: draft.id, stage: "capture", code: cause instanceof HandoffCoordinatorError ? cause.code : "handoff_capture_failed", reason: message });
        throw cause;
      }
    },

    async launch(input: LaunchHandoffInput): Promise<HandoffRecordDto> {
      const handoff = await dependencies.getHandoff(input.handoffId);
      if (!handoff) throw new HandoffCoordinatorError("handoff_not_found", "Handoff not found.", 404);
      if (handoff.status === "completed" && handoff.operationId === input.operationId) return handoff;
      if (handoff.status !== "ready" || handoff.revision !== input.expectedRevision || !handoff.packet) {
        throw new HandoffCoordinatorError("handoff_invalid_state", "The handoff is no longer ready to launch.");
      }
      const source = await dependencies.getSource({
        sourceRunId: handoff.sourceRunId,
        sourceWorkerId: handoff.sourceWorkerId,
        forkedFromMessageId: handoff.forkedFromMessageId,
        reason: handoff.reason,
        target: handoff.target,
      });
      try {
        await dependencies.validateTarget(source, handoff.target, { reason: handoff.reason, phase: "launch" });
      } catch (cause) {
        const error = cause instanceof HandoffCoordinatorError ? cause : new HandoffCoordinatorError("handoff_target_unavailable", cause instanceof Error ? cause.message : String(cause));
        await dependencies.settleFailure(handoff, error.code, error.message);
        dependencies.emit({ kind: "handoff.refused", runId: handoff.sourceRunId, handoffId: handoff.id, stage: "launch", code: error.code, reason: error.message });
        throw cause;
      }
      const fence = await dependencies.getSourceFence(handoff);
      if (fence.sourceSeq !== handoff.sourceSeq || fence.workspaceFingerprint !== handoff.workspaceFingerprint) {
        const error = new HandoffCoordinatorError("handoff_source_changed", "The source conversation or workspace changed after the packet was prepared.");
        await dependencies.settleFailure(handoff, error.code, error.message);
        dependencies.emit({ kind: "handoff.refused", runId: handoff.sourceRunId, handoffId: handoff.id, stage: "launch", code: error.code, reason: error.message });
        throw error;
      }
      const claimToken = dependencies.randomId();
      const claimed = await dependencies.claimLaunch(handoff, input.operationId, claimToken);
      dependencies.emit({ kind: "handoff.launch_started", runId: handoff.sourceRunId, handoffId: handoff.id, revision: claimed.revision, targetWorkerType: handoff.target.workerType });
      try {
        const target = await dependencies.launchTarget(claimed, claimToken);
        const completed = await dependencies.completeLaunch(claimed, target);
        dependencies.emit({ kind: "handoff.completed", runId: handoff.sourceRunId, handoffId: handoff.id, targetRunId: target.runId, targetWorkerType: handoff.target.workerType });
        return completed;
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        const settled = await dependencies.settleFailure(claimed, "handoff_launch_failed", message);
        if (settled?.status === "completed") return settled;
        dependencies.emit({ kind: "handoff.failed", runId: handoff.sourceRunId, handoffId: handoff.id, stage: "launch", code: "handoff_launch_failed", reason: message });
        throw new HandoffCoordinatorError("handoff_launch_failed", message);
      }
    },

    async cancel(handoffId: string, reason = "user_cancelled", expectedRevision?: number): Promise<HandoffRecordDto> {
      const handoff = await dependencies.getHandoff(handoffId);
      if (!handoff) throw new HandoffCoordinatorError("handoff_not_found", "Handoff not found.", 404);
      if (expectedRevision !== undefined && handoff.revision !== expectedRevision) throw new HandoffCoordinatorError("handoff_invalid_state", "The handoff revision changed before cancellation.");
      if (handoff.status !== "capturing" && handoff.status !== "ready") throw new HandoffCoordinatorError("handoff_invalid_state", "This handoff can no longer be cancelled.");
      const cancelled = await dependencies.cancelHandoff(handoff, reason);
      dependencies.emit({ kind: "handoff.cancelled", runId: handoff.sourceRunId, handoffId, previousStatus: handoff.status, reason });
      return cancelled;
    },
  };
}
