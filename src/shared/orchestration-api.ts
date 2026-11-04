// Wire shapes for the orchestration HTTP API (shared by server and interface).

import type {
  ModelBinding,
  NextStageDecision,
  OrchestrationPolicyV1,
  PolicyValidationIssue,
  ProfilePolicy,
  StageOutcome,
  StageStatus,
  TokenProfile,
  WorkflowStage,
} from "./orchestration-policy";

export type OrchestrationAction = "create" | "select_profile" | "preflight" | "dispatch" | "retry" | "cancel";

export type BindingPreflightStatusDto = "ready" | "unavailable" | "identity_mismatch" | "quota_blocked" | "credential_missing";

export type StagePreflightReportDto = {
  stage: WorkflowStage;
  status: BindingPreflightStatusDto;
  selected: { binding: ModelBinding; canonicalModel: string | null; usedFallback: boolean } | null;
  attempts: Array<{ status: BindingPreflightStatusDto; model: string; workerType: string | null; diagnostics: string[] }>;
};

export type WorkflowPreflightReportDto = {
  runId: string;
  profile: TokenProfile;
  ready: boolean;
  stages: StagePreflightReportDto[];
};

export type RunBudgetSummaryDto = {
  reservedTokens: number;
  reservedCostUsd: number;
  settledTokens: number;
  settledCostUsd: number;
  committedTokens: number;
  committedCostUsd: number;
  unsettledStages: number;
  unknownUsageStages: number;
};

export type WorkflowStageDto = {
  id: string;
  stage: WorkflowStage;
  attempt: number;
  seq: number;
  status: StageStatus;
  outcome: StageOutcome | null;
  requestedWorkerType: string | null;
  requestedModel: string | null;
  effectiveModel: string | null;
  usedFallback: boolean;
  workerId: string | null;
  executionRunId: string | null;
  handoffId: string | null;
  failureCode: string | null;
  lastError: string | null;
  reservedTokens: number | null;
  reservedCostUsd: number | null;
  settled: boolean;
  usageUnknown: boolean;
  settledTokens: number | null;
  settledCostUsd: number | null;
  createdAt: string;
  completedAt: string | null;
};

export type WorkflowSnapshotDto = {
  runId: string;
  profile: TokenProfile;
  profileSource: "default" | "user" | "triage";
  locked: boolean;
  cancelled: boolean;
  policyVersion: number;
  profilePolicy: ProfilePolicy;
  stages: WorkflowStageDto[];
  budget: RunBudgetSummaryDto;
  next: NextStageDecision;
  triage: unknown;
};

export type OrchestrationPolicyResponse = { policy: OrchestrationPolicyV1; defaults: OrchestrationPolicyV1 };
export type OrchestrationPolicySaveResponse = { ok: true; policy: OrchestrationPolicyV1 } | { ok: false; issues: PolicyValidationIssue[] };
export type OrchestrationPreflightResponse = { ok: true; report: WorkflowPreflightReportDto } | { ok: false; issues: PolicyValidationIssue[] };
export type RunOrchestrationResponse = { workflow: WorkflowSnapshotDto | null };
export type RunOrchestrationActionResponse =
  | { ok: true; [key: string]: unknown }
  | { ok: false; refused?: string; result?: unknown; error?: { code: string; message: string } };

/** Named events after which a client refreshes a run's workflow snapshot. */
export const ORCHESTRATION_EVENT_TYPES = [
  "orchestration.workflow_created",
  "orchestration.profile_selected",
  "orchestration.refused",
  "orchestration.stage_claimed",
  "orchestration.stage_dispatched",
  "orchestration.stage_waiting",
  "orchestration.stage_completed",
  "orchestration.stage_failed",
  "orchestration.stage_blocked",
  "orchestration.stage_retried",
  "orchestration.workflow_blocked",
  "orchestration.workflow_completed",
  "orchestration.workflow_cancelled",
  "orchestration.recovery_reconciled",
  "orchestration.triage_recommended",
] as const;
