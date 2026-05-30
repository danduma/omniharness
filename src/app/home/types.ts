import type { AppErrorDescriptor } from "@/lib/app-errors";
import type { ConversationModeOption } from "@/components/ConversationModePicker";
import type { ConversationWorkerRecord } from "@/lib/conversation-workers";
import type { ChatAttachment } from "@/lib/chat-attachments";
import type { AgentOutputEntry } from "@/lib/agent-output";
import type { WorkerEntry } from "@/server/workers/entries-types";
import type { BusyMessageAction } from "./busy-message-behavior";

export type { ConversationModeOption };

export type RunMode = ConversationModeOption | "commit";

export type SessionType = "omni" | "process";
export type SessionCapability =
  | "send_input"
  | "stop"
  | "retry_from_message"
  | "edit_message"
  | "fork_session"
  | "fork_message"
  | "queue_input"
  | "approve_permission"
  | "open_project_file"
  | "use_git_workspace";

export type SessionRecord = {
  id: string;
  runId: string;
  sessionType: SessionType;
  status: string;
  capabilities: SessionCapability[];
  primaryActorId: string | null;
  title: string | null;
  projectPath: string | null;
  providerMetadata?: Record<string, unknown> | null;
};

export type PlanRecord = { id: string; path: string };
export type RunRecord = {
  id: string;
  planId: string;
  sessionType?: SessionType | null;
  mode?: RunMode | null;
  status: string;
  createdAt: string;
  updatedAt?: string | null;
  failedAt?: string | null;
  lastError?: string | null;
  archivedAt?: string | null;
  parentRunId?: string | null;
  projectPath: string | null;
  title: string | null;
  preferredWorkerType?: string | null;
  preferredWorkerModel?: string | null;
  preferredWorkerEffort?: string | null;
  allowedWorkerTypes?: string | null;
  specPath?: string | null;
  artifactPlanPath?: string | null;
  plannerArtifactsJson?: string | null;
  autoCommitMilestones?: boolean | null;
  pushOnCommit?: boolean | null;
  gitBaselineJson?: string | null;
  gitWorkspaceJson?: string | null;
  completionCommitSha?: string | null;
};
export type PlanItemRecord = { id: string; planId: string; title: string; phase: string | null; status: string };
export type ClarificationRecord = {
  id: string;
  runId: string;
  question: string;
  answer: string | null;
  status: string;
  createdAt?: string | null;
  updatedAt?: string | null;
};
export type MessageRecord = {
  id: string;
  runId: string;
  role: string;
  kind?: string | null;
  content: string;
  workerId?: string | null;
  attachments?: ChatAttachment[];
  attachmentsJson?: string | null;
  createdAt: string;
};
export type ExecutionEventRecord = {
  id: string;
  runId: string;
  workerId?: string | null;
  planItemId?: string | null;
  eventType: string;
  details?: string | null;
  createdAt: string;
};
export type SupervisorInterventionRecord = {
  id: string;
  runId: string;
  workerId?: string | null;
  interventionType: string;
  prompt: string;
  summary?: string | null;
  createdAt: string;
};
export type QueuedConversationMessageRecord = {
  id: string;
  runId: string;
  targetWorkerId?: string | null;
  action: BusyMessageAction;
  content: string;
  status: "pending" | "delivering" | "delivered" | "cancelled" | "failed";
  lastError?: string | null;
  attachments?: ChatAttachment[];
  createdAt: string;
  updatedAt: string;
  deliveredAt?: string | null;
};
export type RecoveryIncidentRecord = {
  id: string;
  runId: string;
  workerId?: string | null;
  queuedMessageId?: string | null;
  kind: string;
  status: string;
  autoAttemptCount: number;
  lastError?: string | null;
  details?: string | null;
  detectedAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
};
export type PlanningReviewRunRecord = {
  id: string;
  runId: string;
  status: string;
  agentSelection: string;
  resolvedWorkerType?: string | null;
  roundsRequested: number;
  roundsCompleted: number;
  startedAt: string;
  completedAt?: string | null;
  lastError?: string | null;
  createdAt: string;
  updatedAt: string;
};
export type PlanningReviewRoundRecord = {
  id: string;
  reviewRunId: string;
  runId: string;
  roundNumber: number;
  status: string;
  workerId?: string | null;
  resolvedWorkerType?: string | null;
  selectionReason?: string | null;
  findingsSummary?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  lastError?: string | null;
  createdAt: string;
  updatedAt: string;
};
export type PlanningReviewFindingRecord = {
  id: string;
  reviewRunId: string;
  roundId: string;
  runId: string;
  severity: string;
  category: string;
  title: string;
  details: string;
  recommendation: string;
  sourcePath?: string | null;
  createdAt: string;
};
export type RunRecoveryState = {
  kind: string;
  status: string;
  workerId?: string | null;
  queuedMessageId?: string | null;
  message?: string | null;
  recommendedAction?: string | null;
  lastError?: string | null;
  attemptCount?: number | null;
  nextAttemptAt?: string | null;
  resumeAt?: string | null;
  quotaResetSource?: string | null;
  quotaResetConfidence?: string | null;
  policyDecision?: string | null;
};
export type AgentSnapshot = {
  name: string;
  type?: string;
  cwd?: string;
  state: string;
  requestedModel?: string | null;
  effectiveModel?: string | null;
  requestedEffort?: string | null;
  effectiveEffort?: string | null;
  sessionMode?: string | null;
  sessionId?: string | null;
  protocolVersion?: string | number | null;
  lastError?: string | null;
  recentStderr?: string[];
  pendingPermissions?: Array<{
    requestId: number;
    requestedAt: string;
    sessionId?: string | null;
    toolCall?: {
      toolCallId?: string | null;
      kind?: string | null;
      title?: string | null;
      status?: string | null;
    } | null;
    options?: Array<{ optionId: string; kind: string; name: string }>;
  }>;
  createdAt?: string;
  updatedAt?: string;
  contextUsage?: {
    inputTokens?: number | null;
    outputTokens?: number | null;
    totalTokens?: number | null;
    maxTokens?: number | null;
    fullnessPercent?: number | null;
  } | null;
  outputEntries?: AgentOutputEntry[];
  lastText?: string;
  currentText?: string;
  displayText?: string;
  outputLog?: string;
  bridgeLastError?: string | null;
  runLastError?: string | null;
  stderrBuffer?: string[];
  stopReason?: string | null;
  bridgeMissing?: boolean;
};
export type ProjectFilesResponse = { root: string; files: string[] };
export type ProjectFileContentResponse = { root: string; path: string; content: string; size: number; truncated: boolean };
export type WorkerType = "codex" | "claude" | "gemini" | "opencode";
export type ComposerWorkerOption = WorkerType | "auto";
export type WorkerAuthentication = {
  status: "authenticated" | "not_authenticated" | "unknown" | "not_applicable";
  method: "api_key" | "session_file" | "status_command" | "missing" | "unknown" | "not_applicable";
  message: string;
  setupCommand: string | null;
};
export type WorkerTokenQuota = {
  status: "reported" | "usage_only" | "unavailable" | "unknown";
  source: string;
  message: string;
  remainingTokens: number | null;
  monthlyLimitTokens: number | null;
  usedTokens: number | null;
  resetAt: string | null;
};
export type WorkerAvailability = {
  type: WorkerType;
  label: string;
  installation?: {
    command: string;
    path: string | null;
    dir: string | null;
  };
  availability: {
    status: "ok" | "warning" | "error";
    binary: boolean;
    apiKey: boolean | null;
    endpoint: boolean | null;
    message?: string;
  };
  authentication?: WorkerAuthentication;
  tokenQuota?: WorkerTokenQuota;
};
export type WorkerModelOption = { value: string; label: string };
export type WorkerModelCatalog = Record<WorkerType, WorkerModelOption[]>;
export type WorkerCatalogResponse = {
  workers: WorkerAvailability[];
  workerModels?: Partial<WorkerModelCatalog>;
  workerModelsRefreshing?: boolean;
};
export type SettingsResponse = {
  values: Record<string, string>;
  secrets?: Record<string, { configured: boolean; updatedAt: string; preview?: string }>;
  diagnostics?: AppErrorDescriptor[];
};
export type AuthSessionRecord = {
  id: string;
  label: string | null;
  userAgent: string | null;
  authMethod: string;
  createdBySessionId: string | null;
  lastSeenAt: string;
  expiresAt: string;
  absoluteExpiresAt: string;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
export type AuthSessionResponse = {
  enabled: boolean;
  authenticated: boolean;
  currentSession: AuthSessionRecord | null;
  sessions: AuthSessionRecord[];
  configurationError?: string | null;
  publicOrigin?: string | null;
};
export type EventStreamState = {
  messages: MessageRecord[];
  readMarkers?: Record<string, string>;
  plans: PlanRecord[];
  runs: RunRecord[];
  sessions?: SessionRecord[];
  accounts: unknown[];
  agents: AgentSnapshot[];
  workers: ConversationWorkerRecord[];
  planItems: PlanItemRecord[];
  clarifications: ClarificationRecord[];
  executionEvents: ExecutionEventRecord[];
  supervisorInterventions: SupervisorInterventionRecord[];
  queuedMessages?: QueuedConversationMessageRecord[];
  recoveryIncidents?: RecoveryIncidentRecord[];
  recoveryState?: RunRecoveryState | null;
  reviewRuns?: PlanningReviewRunRecord[];
  reviewRounds?: PlanningReviewRoundRecord[];
  reviewFindings?: PlanningReviewFindingRecord[];
  frontendErrors?: AppErrorDescriptor[];
  snapshotRunId?: string | null;
  snapshotChecksum?: string;
  snapshotSource?: "cache" | "optimistic" | "server";
  messageScope?: {
    runIds: string[];
    complete: boolean;
  };
  snapshotScope?: {
    catalog?: {
      complete: boolean;
    };
    executionEvents?: {
      limit: number;
      complete: boolean;
      oldestCreatedAt: string | null;
    };
    supervisorInterventions?: {
      limit: number;
      complete: boolean;
      oldestCreatedAt: string | null;
    };
  };
  workerEntrySeqs?: Record<string, number>;
  workerEntries?: Record<string, WorkerEntry[]>;
};
export type SettingsTab = "general" | "models" | "credentials" | "agents" | "runtime" | "memory";

export type ConversationSidebarTab = "projects" | "recent";

export type SidebarRun = {
  id: string;
  title: string;
  path: string;
  mode?: RunMode | null;
  status: string;
  createdAt: string;
  updatedAt?: string | null;
  preferredWorkerType?: WorkerType | null;
};
export type SidebarGroup = { path: string; name: string; runs: SidebarRun[] };

export type NoticeTone = "error" | "warning" | "success" | "progress";
export type NoticeDescriptor = AppErrorDescriptor & { tone?: NoticeTone };

export type LlmProfileTab = "supervisor" | "fallback" | "memory";
export type LlmFieldPrefix = "SUPERVISOR_LLM" | "SUPERVISOR_FALLBACK_LLM" | "SUPERVISOR_MEMORY_LLM";
