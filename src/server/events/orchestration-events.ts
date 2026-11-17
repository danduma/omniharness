import type { StageOutcome, TokenProfile, WorkflowStage } from "@/shared/orchestration-policy";

/** Stable failure codes recorded on stage rows and carried by events. */
export type OrchestrationFailureCode =
  | "binding_unavailable"
  | "identity_mismatch"
  | "quota_blocked"
  | "credential_missing"
  | "budget_exceeded"
  | "dispatch_conflict"
  | "handoff_failed"
  | "adapter_failed"
  | "agent_failed"
  | "interrupted_by_restart"
  | "gate_unmet"
  | "cancelled";

export type OrchestrationRefusalReason =
  | "no_workflow"
  | "unsupported_run"
  | "invalid_profile"
  | "profile_locked"
  | "workflow_cancelled"
  | "workflow_done"
  | "stage_active"
  | "stage_blocked"
  | "gate_unmet"
  | "nothing_to_retry";

/**
 * Specialist orchestration lifecycle (docs/architecture/specialist-orchestration.md).
 * Every decision of the orchestration service — dispatch, refusal, retry,
 * fallback, completion, recovery — is one of these.
 */
export type OrchestrationEvent =
  | { kind: "orchestration.workflow_created"; runId: string; profile: TokenProfile; policyVersion: number }
  | { kind: "orchestration.profile_selected"; runId: string; profile: TokenProfile; source: "user" | "triage" }
  | { kind: "orchestration.refused"; runId: string; action: "select_profile" | "dispatch" | "retry" | "cancel" | "create"; reason: OrchestrationRefusalReason }
  | { kind: "orchestration.preflight_completed"; runId: string; profile: TokenProfile; ready: boolean; blockedStages: WorkflowStage[] }
  | { kind: "orchestration.fallback_selected"; runId: string; stage: WorkflowStage; fromModel: string; toModel: string }
  | { kind: "orchestration.stage_claimed"; runId: string; stageId: string; stage: WorkflowStage; attempt: number; reason: string }
  | {
      kind: "orchestration.stage_dispatched";
      runId: string;
      stageId: string;
      stage: WorkflowStage;
      attempt: number;
      workerType: string | null;
      requestedModel: string;
      usedFallback: boolean;
      executionRunId: string | null;
    }
  | { kind: "orchestration.stage_waiting"; runId: string; stageId: string; stage: WorkflowStage; externalRef: string | null }
  | { kind: "orchestration.stage_completed"; runId: string; stageId: string; stage: WorkflowStage; attempt: number; outcome: StageOutcome; effectiveModel: string | null }
  | { kind: "orchestration.stage_failed"; runId: string; stageId: string; stage: WorkflowStage; attempt: number; code: OrchestrationFailureCode; recoverable: boolean }
  | { kind: "orchestration.stage_blocked"; runId: string; stageId: string; stage: WorkflowStage; attempt: number; code: OrchestrationFailureCode }
  | { kind: "orchestration.stage_retried"; runId: string; stageId: string; stage: WorkflowStage; attempt: number }
  | { kind: "orchestration.stage_signal_ignored"; runId: string; stage: WorkflowStage; reason: "no_matching_stage" | "already_terminal" | "stale_ref" }
  | { kind: "orchestration.budget_reserved"; runId: string; stageId: string; tokens: number | null; costUsd: number | null; duplicate: boolean }
  | { kind: "orchestration.budget_settled"; runId: string; stageId: string; usageUnknown: boolean; duplicate: boolean }
  | { kind: "orchestration.handoff_started"; runId: string; stageId: string; handoffId: string; targetWorkerType: string }
  | { kind: "orchestration.workflow_blocked"; runId: string; stage: WorkflowStage; reason: string }
  | { kind: "orchestration.workflow_completed"; runId: string }
  | { kind: "orchestration.workflow_cancelled"; runId: string; cancelledStages: number }
  | { kind: "orchestration.recovery_reconciled"; runId: string; stageId: string; stage: WorkflowStage; action: "adopted" | "needs_recovery" | "left_blocked" }
  | { kind: "orchestration.triage_recommended"; runId: string; requestId: string; profile: TokenProfile; confidence: number; applied: boolean; reason: string }
  | { kind: "orchestration.triage_ignored"; runId: string; requestId: string | null; reason: string }
  | { kind: "orchestration.adapter_failed"; runId: string; stageId: string | null; reason: string }
  | { kind: "orchestration.policy_saved"; source: "settings" }
  | { kind: "orchestration.policy_rejected"; source: "settings" | "run"; issueCount: number };

/** In-process named-event listener failed (the listener owns its own events). */
export type EventListenerFailedEvent = { kind: "events.listener_failed"; listener: string; reason: string };
