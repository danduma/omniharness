import type { ChildProcessWithoutNullStreams } from "child_process";
import type * as acp from "@agentclientprotocol/sdk";

export type AgentState = "starting" | "idle" | "working" | "stopped" | "error";

export type PendingPermission = {
  requestId: number;
  params: acp.RequestPermissionRequest;
  requestedAt: string;
  resolve: (response: acp.RequestPermissionResponse) => void;
};

// The SDK pinned here (@agentclientprotocol/sdk@0.14.1) predates the
// `elicitation/create` method, so its types don't model it. The
// claude-agent-acp adapter speaks it (to surface the built-in AskUserQuestion
// tool as a form), and reaches us through the `extMethod` escape hatch. These
// minimal shapes mirror the adapter's CreateElicitationRequest / Response.
export type ElicitationCreateParams = {
  mode?: string;
  sessionId?: string;
  toolCallId?: string;
  message?: string;
  requestedSchema?: {
    type?: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
};

export type ElicitationContentValue = string | number | boolean | string[];

export type ElicitationResponse =
  | { action: "accept"; content: Record<string, ElicitationContentValue> }
  | { action: "decline" }
  | { action: "cancel" };

export type PendingElicitation = {
  requestId: number;
  params: ElicitationCreateParams;
  requestedAt: string;
  resolve: (response: ElicitationResponse) => void;
};

export type OutputEntry = {
  id: string;
  type: "message" | "thought" | "tool_call" | "tool_call_update" | "permission" | "elicitation";
  text: string;
  timestamp: string;
  toolCallId?: string;
  toolKind?: string;
  status?: string;
  raw?: unknown;
};

export type OutputArchiveStats = {
  totalEntries: number;
  byteSize: number;
  logPath: string;
  liveEntries: number;
  omittedLiveEntries: number;
};

export type OutputArchivePage = {
  name: string;
  cursor: number;
  nextCursor: number | null;
  totalEntries: number;
  entries: OutputEntry[];
};

export type AgentOutputArchiveHandle = {
  readonly filePath: string;
  append(input: Omit<OutputEntry, "id" | "timestamp"> & { timestamp?: string }): OutputEntry;
  stats(liveEntries?: number): OutputArchiveStats;
  readPage(input?: { cursor?: number; limit?: number }): Promise<OutputArchivePage>;
};

export type AgentRecord = {
  name: string;
  type: string;
  cwd: string;
  child: ChildProcessWithoutNullStreams;
  connection: acp.ClientSideConnection;
  sessionId: string;
  state: AgentState;
  lastError: string | null;
  stderrBuffer: string[];
  protocolVersion: string | number | null;
  requestedModel: string | null;
  effectiveModel: string | null;
  requestedEffort: string | null;
  effectiveEffort: string | null;
  credentialProfile: {
    name: string;
    status: "loaded";
    source: "file" | "command";
    envKeys: string[];
    unsetKeys: string[];
    expiresAt: string | null;
  } | null;
  sessionMode: string | null;
  contextUsage: {
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
    maxTokens: number | null;
    fullnessPercent: number | null;
  } | null;
  lastText: string;
  currentText: string;
  activeOutputEntryId: string | null;
  outputEntries: OutputEntry[];
  outputArchive: AgentOutputArchiveHandle;
  stopReason: string | null;
  pendingPermissions: PendingPermission[];
  pendingElicitations: PendingElicitation[];
  activeTask: { taskId: string; subtaskId: string } | null;
  managedSkillLinks: string[];
  createdAt: string;
  updatedAt: string;
};

export type AgentRuntimeConfig = {
  agents?: Record<string, {
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    credentialProfile?: string;
    mode?: string;
    skillRoots?: string[];
    mcpServers?: acp.McpServer[];
  }>;
};

export type StartAgentInput = {
  type?: string;
  name: string;
  cwd?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  credentialProfile?: string;
  mode?: string;
  model?: string;
  effort?: string;
  skillRoots?: string[];
  mcpServers?: acp.McpServer[];
  resumeSessionId?: string;
};

export type AskResult = {
  name: string;
  state: AgentState;
  stopReason: string | null;
  response: string;
};

export type CancelTerminalProcessResult = {
  ok: true;
  name: string;
  processId: string;
  toolCallId: string | null;
  signal: NodeJS.Signals;
};

export type DoctorResult = {
  type: string;
  status: "ok" | "warning" | "error";
  binary: boolean;
  apiKey: boolean | null;
  endpoint: boolean | null;
  tools?: import("./tool-env").ToolDiagnostics;
  message?: string;
};

export class RuntimeHttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "RuntimeHttpError";
  }
}
