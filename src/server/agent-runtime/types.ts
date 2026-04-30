import type { ChildProcessWithoutNullStreams } from "child_process";
import type * as acp from "@agentclientprotocol/sdk";

export type AgentState = "starting" | "idle" | "working" | "stopped" | "error";

export type PendingPermission = {
  requestId: number;
  params: acp.RequestPermissionRequest;
  requestedAt: string;
  resolve: (response: acp.RequestPermissionResponse) => void;
};

export type OutputEntry = {
  id: string;
  type: "message" | "thought" | "tool_call" | "tool_call_update" | "permission";
  text: string;
  timestamp: string;
  toolCallId?: string;
  toolKind?: string;
  status?: string;
  raw?: unknown;
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
  stopReason: string | null;
  pendingPermissions: PendingPermission[];
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
