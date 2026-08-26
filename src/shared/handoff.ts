import type { SupportedWorkerType } from "@/shared/worker-types";

export const HANDOFF_PACKET_VERSION = 1 as const;
export const HANDOFF_PACKET_MAX_CHARACTERS = 36_000;
export const HANDOFF_STREAM_SETTLE_TIMEOUT_MS = 5_000;
export const HANDOFF_READY_MAX_LIFETIME_MS = 15 * 60 * 1_000;
export const MAX_AUTOMATIC_HANDOFF_DEPTH = 3;
export const AUTOMATIC_HANDOFF_COOLDOWN_MS = 60_000;

export type HandoffReason = "manual_session" | "manual_message" | "quota_exhausted";
export type HandoffStatus = "capturing" | "ready" | "launching" | "needs_recovery" | "completed" | "failed" | "cancelled";
export type HandoffSummarySource = "outgoing_worker" | "target_summarizer" | "recent_assistant" | "synthetic" | "hybrid";
export type HandoffErrorCode =
  | "handoff.capture_failed"
  | "handoff.summary_failed"
  | "handoff.revision_conflict"
  | "handoff.target_unavailable"
  | "handoff.source_changed"
  | "handoff.launch_failed"
  | "handoff.fork_required"
  | "handoff.packet_version_unsupported";

export type HandoffTargetSelection = {
  workerType: SupportedWorkerType;
  model: string | null;
  effort: string | null;
  accountId: string | null;
};

export type HandoffModifiedFile = {
  path: string;
  changeType: "added" | "modified" | "deleted" | "renamed" | "unmerged";
  ownership: "session" | "probable_session" | "preexisting" | "external" | "unknown";
  summary: string | null;
  evidence: string[];
};

export type HandoffVerification = {
  command: string;
  result: "passed" | "failed" | "unknown";
  exitCode: number | null;
  importantOutput: string | null;
};

export type HybridHandoffPacketV1 = {
  handoffVersion: typeof HANDOFF_PACKET_VERSION;
  contentHash: string;
  source: {
    runId: string;
    workerId: string | null;
    workerType: SupportedWorkerType | null;
    forkedFromMessageId: string | null;
    sourceSeq: number | null;
    interruptionReason: HandoffReason;
    generatedAt: string;
  };
  target: HandoffTargetSelection;
  task: {
    originalRequest: string | null;
    currentObjective: string | null;
    acceptanceCriteria: string[];
    userConstraints: string[];
  };
  state: {
    completed: string[];
    inProgress: string[];
    remaining: string[];
    blockers: string[];
    openQuestions: string[];
    rejectedApproaches: Array<{ approach: string; reason: string }>;
  };
  decisions: Array<{ decision: string; reason: string | null; evidence: string[] }>;
  workspace: {
    projectRootLabel: string;
    baselineCommit: string | null;
    currentHead: string | null;
    dirtyBeforeSession: boolean | null;
    modifiedFiles: HandoffModifiedFile[];
    untrackedFiles: string[];
    relevantUnchangedFiles: string[];
    commitsCreated: string[];
  };
  verification: HandoffVerification[];
  artifacts: { plans: string[]; specs: string[]; generatedOutputs: string[] };
  continuity: {
    recentUserMessages: string[];
    recentAssistantSummary: string | null;
    pendingUserInput: string | null;
    queuedMessages: string[];
  };
  provenance: {
    summarySource: HandoffSummarySource;
    omittedSections: string[];
    confidenceWarnings: string[];
    truncatedFields: string[];
  };
};

export type HandoffAdvisoryPatch = {
  expectedRevision: number;
  advisory: {
    currentObjective?: string | null;
    completed?: string[];
    remaining?: string[];
    blockers?: string[];
    openQuestions?: string[];
    rejectedApproaches?: Array<{ approach: string; reason: string }>;
    decisions?: Array<{ decision: string; reason: string | null; evidence: string[] }>;
    relevantFiles?: string[];
  };
};

export type CreateHandoffRequest = {
  sourceWorkerId?: string | null;
  forkedFromMessageId?: string | null;
  reason: HandoffReason;
  target: HandoffTargetSelection;
};
export type LaunchHandoffRequest = { expectedRevision: number; operationId: string };
export type CancelHandoffRequest = { expectedRevision: number; reason?: string };
export type HandoffResponse = { handoff: HandoffRecordDto };
export type ActiveHandoffResponse = { handoff: HandoffRecordDto | null };

export type HandoffRecordDto = {
  id: string;
  sourceRunId: string;
  sourceWorkerId: string | null;
  targetRunId: string | null;
  forkedFromMessageId: string | null;
  reason: HandoffReason;
  status: HandoffStatus;
  revision: number;
  sourceSeq: number | null;
  workspaceFingerprint: string | null;
  operationId: string | null;
  target: HandoffTargetSelection;
  packet: HybridHandoffPacketV1 | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};
