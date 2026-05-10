import type { AppErrorDescriptor } from "@/lib/app-errors";
import type { ConversationModeOption } from "@/components/ConversationModePicker";
import type { ConversationWorkerRecord } from "@/lib/conversation-workers";
import type { ChatAttachment } from "@/lib/chat-attachments";
import type { BusyMessageAction } from "./busy-message-behavior";

export type { ConversationModeOption };

export type PlanRecord = { id: string; path: string };
export type RunRecord = {
  id: string;
  planId: string;
  mode?: ConversationModeOption | null;
  status: string;
  createdAt: string;
  updatedAt?: string | null;
  failedAt?: string | null;
  lastError?: string | null;
  archivedAt?: string | null;
  projectPath: string | null;
  title: string | null;
  preferredWorkerType?: string | null;
  preferredWorkerModel?: string | null;
  preferredWorkerEffort?: string | null;
  allowedWorkerTypes?: string | null;
  specPath?: string | null;
  artifactPlanPath?: string | null;
  plannerArtifactsJson?: string | null;
};
export type PlanItemRecord = { id: string; planId: string; title: string; phase: string | null; status: string };
export type ClarificationRecord = { id: string; runId: string; question: string; answer: string | null; status: string };
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
  pendingPermissions?: Array<{ requestId: number; requestedAt: string; sessionId?: string | null; options?: Array<{ optionId: string; kind: string; name: string }> }>;
  createdAt?: string;
  updatedAt?: string;
  contextUsage?: {
    inputTokens?: number | null;
    outputTokens?: number | null;
    totalTokens?: number | null;
    maxTokens?: number | null;
    fullnessPercent?: number | null;
  } | null;
  outputEntries?: Array<{
    id: string;
    type: "message" | "thought" | "tool_call" | "tool_call_update" | "permission";
    text: string;
    timestamp: string;
    toolCallId?: string | null;
    toolKind?: string | null;
    status?: string | null;
    raw?: unknown;
  }>;
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
export type WorkerAvailability = {
  type: WorkerType;
  label: string;
  installation?: {
    command: string;
    path: string | null;
    dir: string | null;
    version: string | null;
  };
  availability: {
    status: "ok" | "warning" | "error";
    binary: boolean;
    apiKey: boolean | null;
    endpoint: boolean | null;
    message?: string;
  };
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
  secrets?: Record<string, { configured: boolean; updatedAt: string }>;
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
  plans: PlanRecord[];
  runs: RunRecord[];
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
  frontendErrors?: AppErrorDescriptor[];
};
export type SettingsTab = "general" | "models" | "agents" | "runtime";

export type SidebarRun = { id: string; title: string; path: string; mode?: ConversationModeOption | null; status: string; createdAt: string };
export type SidebarGroup = { path: string; name: string; runs: SidebarRun[] };

export type NoticeTone = "error" | "warning" | "success";
export type NoticeDescriptor = AppErrorDescriptor & { tone?: NoticeTone };

export type LlmProfileTab = "supervisor" | "fallback";
export type LlmFieldPrefix = "SUPERVISOR_LLM" | "SUPERVISOR_FALLBACK_LLM";
