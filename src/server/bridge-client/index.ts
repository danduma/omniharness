import { isRecoverableConnectionSupervisorError, isTransientSupervisorError, retrySupervisorRequest } from "@/server/supervisor/retry";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";

export const BRIDGE_URL = process.env.OMNIHARNESS_BRIDGE_URL?.trim() || "http://127.0.0.1:7800";
const BRIDGE_CONNECTION_RESET_MAX_BACKOFF_MS = 15 * 60_000;

export interface AgentRecord {
  [key: string]: unknown;
  name: string;
  type: string;
  cwd: string;
  state: string; // 'idle' | 'working' | 'stopped' | 'error'
  sessionId?: string | null;
  requestedModel?: string | null;
  effectiveModel?: string | null;
  requestedEffort?: string | null;
  effectiveEffort?: string | null;
  credentialProfile?: {
    name: string;
    status: "loaded";
    source: "file" | "command";
    envKeys: string[];
    unsetKeys: string[];
    expiresAt: string | null;
  } | null;
  sessionMode?: string | null;
  lastError?: string | null;
  contextUsage?: {
    inputTokens?: number | null;
    outputTokens?: number | null;
    totalTokens?: number | null;
    maxTokens?: number | null;
    fullnessPercent?: number | null;
  } | null;
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
  outputArchive?: {
    totalEntries: number;
    byteSize: number;
    logPath: string;
    liveEntries: number;
    omittedLiveEntries: number;
  } | null;
  renderedOutput?: string | null;
  lastText: string;
  currentText: string;
  stderrBuffer: string[];
  stopReason: string | null;
}

export interface TaskRecord {
  id: string;
  name: string;
  state: string;
  subtasks: unknown[];
}

export interface AgentOutputPage {
  name: string;
  cursor: number;
  nextCursor: number | null;
  totalEntries: number;
  entries: NonNullable<AgentRecord["outputEntries"]>;
}

export type BridgeMcpServer =
  | {
      type: "stdio";
      name: string;
      command: string;
      args?: string[];
      env?: Array<{ name: string; value: string; _meta?: Record<string, unknown> | null }>;
      _meta?: Record<string, unknown> | null;
    }
  | {
      type: "http" | "sse";
      name: string;
      url: string;
      headers?: Array<{ name: string; value: string; _meta?: Record<string, unknown> | null }>;
      _meta?: Record<string, unknown> | null;
    };

function describeError(error: unknown, seen = new Set<unknown>()): string {
  if (error == null) {
    return "Unknown error";
  }

  if (seen.has(error)) {
    return "[circular cause]";
  }

  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    seen.add(error);
    const cause = "cause" in error ? describeError((error as Error & { cause?: unknown }).cause, seen) : "";
    return cause && cause !== error.message ? `${error.message} (caused by: ${cause})` : error.message;
  }

  return String(error);
}

function isBridgeConnectionRefused(error: unknown) {
  const details = describeError(error).toUpperCase();
  return details.includes("ECONNREFUSED") && (details.includes("127.0.0.1:7800") || details.includes("LOCALHOST:7800"));
}

function stripRepeatedActionPrefix(detail: string, action: string) {
  const prefixPattern = new RegExp(`^(?:${action}\\s+failed:\\s*)+`, "i");
  return detail.replace(prefixPattern, "").trimStart();
}

function isNonRetryableBridgeFailureDetail(detail: string) {
  return /\bAgent session did not include a session id\b/i.test(detail);
}

function isAgentBusyError(error: unknown) {
  return /\bagent is busy\b/i.test(describeError(error));
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asPermissionOptions(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is { optionId?: unknown; kind?: unknown; name?: unknown } => typeof item === "object" && item !== null)
    .map((item) => ({
      optionId: asString(item.optionId),
      kind: asString(item.kind),
      name: asString(item.name),
    }))
    .filter((item) => item.optionId && item.kind && item.name);
}

function asPermissionToolCall(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const item = value as Record<string, unknown>;
  return {
    toolCallId: asNullableString(item.toolCallId),
    kind: asNullableString(item.kind),
    title: asNullableString(item.title),
    status: asNullableString(item.status),
  };
}

function asPendingPermissions(value: unknown): AgentRecord["pendingPermissions"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is {
      requestId?: unknown;
      requestedAt?: unknown;
      sessionId?: unknown;
      toolCall?: unknown;
      options?: unknown;
    } => typeof item === "object" && item !== null)
    .map((item) => ({
      requestId: typeof item.requestId === "number" ? item.requestId : -1,
      requestedAt: asString(item.requestedAt),
      sessionId: typeof item.sessionId === "string" ? item.sessionId : null,
      toolCall: asPermissionToolCall(item.toolCall),
      options: asPermissionOptions(item.options),
    }))
    .filter((item) => item.requestId >= 0 && item.requestedAt);
}

function asOutputEntries(value: unknown): NonNullable<AgentRecord["outputEntries"]> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      id: asString(item.id),
      type: asString(item.type) as NonNullable<AgentRecord["outputEntries"]>[number]["type"],
      text: asString(item.text),
      timestamp: asString(item.timestamp),
      toolCallId: asNullableString(item.toolCallId),
      toolKind: asNullableString(item.toolKind),
      status: asNullableString(item.status),
      raw: item.raw,
    }))
    .filter((item) => item.id && item.type && item.text);
}

function normalizeModelForWorkerType(type: string, model?: string) {
  if (!model?.trim()) {
    return model;
  }

  const trimmedModel = model.trim();
  const normalizedType = type.trim().toLowerCase();
  const normalizedModel = trimmedModel.toLowerCase();

  if (normalizedType === "codex") {
    if (normalizedModel.startsWith("openai/gpt-")) return normalizedModel.slice("openai/".length);
    if (normalizedModel === "anthropic/claude-sonnet-4") return "claude-sonnet-4";
  }

  if (normalizedType === "opencode") {
    if (normalizedModel.startsWith("gpt-")) return `openai/${normalizedModel}`;
    if (normalizedModel === "claude-sonnet-4") return "anthropic/claude-sonnet-4";
  }

  if (normalizedType === "gemini" && normalizedModel === "gemini-3") {
    return undefined;
  }

  return trimmedModel;
}

export function normalizeAgentRecord(value: unknown): AgentRecord {
  const record = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  const contextUsage =
    typeof record.contextUsage === "object" && record.contextUsage !== null
      ? record.contextUsage as AgentRecord["contextUsage"]
      : null;

  return {
    ...record,
    name: asString(record.name),
    type: asString(record.type),
    cwd: asString(record.cwd),
    state: asString(record.state, "unknown"),
    sessionId: asNullableString(record.sessionId),
    requestedModel: asNullableString(record.requestedModel),
    effectiveModel: asNullableString(record.effectiveModel),
    requestedEffort: asNullableString(record.requestedEffort),
    effectiveEffort: asNullableString(record.effectiveEffort),
    sessionMode: asNullableString(record.sessionMode),
    lastError: asNullableString(record.lastError),
    contextUsage,
    pendingPermissions: asPendingPermissions(record.pendingPermissions),
    outputEntries: asOutputEntries(record.outputEntries),
    outputArchive: typeof record.outputArchive === "object" && record.outputArchive !== null
      ? record.outputArchive as AgentRecord["outputArchive"]
      : null,
    renderedOutput: asNullableString(record.renderedOutput),
    lastText: asString(record.lastText),
    currentText: asString(record.currentText),
    stderrBuffer: asStringArray(record.stderrBuffer),
    stopReason: asNullableString(record.stopReason),
  };
}

async function requestBridge<T>(path: string, init: RequestInit, action: string, options: { retryIndefinitely?: boolean } = {}) {
  try {
    return await retrySupervisorRequest(async () => {
      const res = await fetch(`${BRIDGE_URL}${path}`, init);
      if (!res.ok) {
        let detail = `${res.status} ${res.statusText}`;
        let detailFromPayload = false;
        try {
          const payload = await res.json() as { error?: unknown };
          if (typeof payload.error === "string" && payload.error.trim()) {
            detail = payload.error.trim();
            detailFromPayload = true;
          }
        } catch {
          // ignore malformed/non-json bodies and fall back to status text
        }

        const retryable =
          detailFromPayload
            ? (isNonRetryableBridgeFailureDetail(detail)
              ? false
              : res.status === 500
                ? isTransientSupervisorError(new Error(detail))
                : isTransientSupervisorError(Object.assign(new Error(detail), { status: res.status })))
            : undefined;

        throw Object.assign(new Error(`${action} failed: ${detail}`), {
          status: res.status,
          retryable,
        });
      }
      return res.json() as Promise<T>;
    }, {
      attempts: options.retryIndefinitely === false ? 1 : 3,
      maxDelayMs: BRIDGE_CONNECTION_RESET_MAX_BACKOFF_MS,
      operationLabel: `${action} ${path}`,
      retryIndefinitelyWhen: options.retryIndefinitely === false
        ? undefined
        : (error) => isRecoverableConnectionSupervisorError(error) && !isBridgeConnectionRefused(error),
    });
  } catch (error) {
    if (isBridgeConnectionRefused(error)) {
      throw new Error(
        `OmniHarness agent runtime is not running at ${BRIDGE_URL}. Start it with pnpm dev or ` +
        `pnpm exec tsx scripts/agent-runtime.ts. Original error: ${describeError(error)}`,
      );
    }

    const detail = describeError(error);
    const normalizedDetail = stripRepeatedActionPrefix(detail, action);

    throw new Error(`${action} failed: ${normalizedDetail}`);
  }
}

type AskStreamEvent = {
  event: string;
  data: string;
};

function parseServerSentEventBlock(block: string): AskStreamEvent | null {
  let event = "message";
  const dataLines: string[] = [];

  for (const line of block.split(/\r?\n/g)) {
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart());
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  return {
    event,
    data: dataLines.join("\n"),
  };
}

async function readAskStream(response: Response): Promise<{ response: string; state: string; stopReason?: string | null }> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Ask stream response did not include a readable body.");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let completed: { response: string; state: string; stopReason?: string | null } | null = null;

  const handleEvent = (streamEvent: AskStreamEvent) => {
    if (streamEvent.event === "progress" || streamEvent.event === "chunk") {
      notifyEventStreamSubscribers();
      return;
    }

    if (streamEvent.event === "done") {
      notifyEventStreamSubscribers();
      completed = JSON.parse(streamEvent.data) as typeof completed;
      return;
    }

    if (streamEvent.event === "error") {
      let message = streamEvent.data;
      let status: number | undefined;
      try {
        const payload = JSON.parse(streamEvent.data) as { error?: unknown; statusCode?: unknown };
        if (typeof payload.error === "string" && payload.error.trim()) {
          message = payload.error.trim();
        }
        if (typeof payload.statusCode === "number") {
          status = payload.statusCode;
        }
      } catch {
        // Fall back to the raw SSE data.
      }
      throw Object.assign(new Error(message), { status });
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (value) {
      buffer += decoder.decode(value, { stream: !done });
    }

    let separatorIndex = buffer.search(/\r?\n\r?\n/);
    while (separatorIndex >= 0) {
      const block = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(buffer[separatorIndex] === "\r" ? separatorIndex + 4 : separatorIndex + 2);
      const streamEvent = parseServerSentEventBlock(block);
      if (streamEvent) {
        handleEvent(streamEvent);
      }
      separatorIndex = buffer.search(/\r?\n\r?\n/);
    }

    if (done) {
      break;
    }
  }

  const trailingEvent = parseServerSentEventBlock(buffer.trim());
  if (trailingEvent) {
    handleEvent(trailingEvent);
  }

  if (!completed) {
    throw new Error("Ask stream ended before the agent returned a result.");
  }

  return completed;
}

export async function spawnAgent(params: {
  type: string;
  cwd: string;
  name: string;
  mode?: string;
  env?: Record<string, string>;
  credentialProfile?: string;
  model?: string;
  effort?: string;
  skillRoots?: string[];
  mcpServers?: BridgeMcpServer[];
  resumeSessionId?: string;
}) {
  const normalizedModel = params.model ? normalizeModelForWorkerType(params.type, params.model) : undefined;
  const { model: _model, ...restParams } = params;
  const normalizedParams = {
    ...restParams,
    ...(normalizedModel ? { model: normalizedModel } : {}),
  };

  return requestBridge<AgentRecord>(
    "/agents",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(normalizedParams),
    },
    "Spawn",
  );
}

export async function askAgent(name: string, prompt: string) {
  try {
    return await retrySupervisorRequest(async () => {
      const path = `/agents/${name}/ask?stream=true`;
      const res = await fetch(`${BRIDGE_URL}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) {
        let detail = `${res.status} ${res.statusText}`;
        try {
          const payload = await res.json() as { error?: unknown };
          if (typeof payload.error === "string" && payload.error.trim()) {
            detail = payload.error.trim();
          }
        } catch {
          // ignore malformed/non-json bodies and fall back to status text
        }
        throw Object.assign(new Error(`Ask failed: ${detail}`), {
          status: res.status,
          retryable: isAgentBusyError(detail) ? false : undefined,
        });
      }
      return readAskStream(res);
    }, {
      maxDelayMs: BRIDGE_CONNECTION_RESET_MAX_BACKOFF_MS,
      operationLabel: `Ask /agents/${name}/ask`,
      retryIndefinitelyWhen: (error) =>
        isRecoverableConnectionSupervisorError(error) && !isBridgeConnectionRefused(error),
    });
  } catch (error) {
    if (isBridgeConnectionRefused(error)) {
      throw new Error(
        `OmniHarness agent runtime is not running at ${BRIDGE_URL}. Start it with pnpm dev or ` +
        `pnpm exec tsx scripts/agent-runtime.ts. Original error: ${describeError(error)}`,
      );
    }

    const detail = describeError(error);
    const normalizedDetail = stripRepeatedActionPrefix(detail, "Ask");

    throw new Error(`Ask failed: ${normalizedDetail}`);
  }
}

export async function getAgent(name: string, options: { retryIndefinitely?: boolean } = {}) {
  const agent = await requestBridge<unknown>(`/agents/${name}`, {}, "Get agent", options);
  return normalizeAgentRecord(agent);
}

export async function getAgentOutput(name: string, options: { cursor?: number; limit?: number } = {}) {
  const params = new URLSearchParams();
  if (options.cursor !== undefined) {
    params.set("cursor", String(options.cursor));
  }
  if (options.limit !== undefined) {
    params.set("limit", String(options.limit));
  }
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return requestBridge<AgentOutputPage>(`/agents/${name}/output${suffix}`, {}, "Get agent output");
}

export async function cancelAgent(name: string) {
  return requestBridge<unknown>(
    `/agents/${name}`,
    {
      method: "DELETE",
    },
    "Cancel",
  );
}

export async function cancelAgentTerminalProcess(name: string, processId: string, toolCallId?: string | null) {
  return requestBridge<unknown>(
    `/agents/${name}/terminals/${encodeURIComponent(processId)}/cancel`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toolCallId }),
    },
    "Cancel terminal",
  );
}

export async function createTask(body: { name: string, subtasks: unknown[] }) {
  return requestBridge<TaskRecord>(
    "/tasks",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    "Create task",
  );
}

export async function getTask(taskId: string) {
  return requestBridge<TaskRecord>(`/tasks/${taskId}`, {}, "Get task");
}

export async function approvePermission(name: string, optionId?: string) {
  return requestBridge<unknown>(
    `/agents/${name}/approve`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(optionId ? { optionId } : {}),
    },
    "Approve",
  );
}

export async function denyPermission(name: string, optionId?: string) {
  return requestBridge<unknown>(
    `/agents/${name}/deny`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(optionId ? { optionId } : {}),
    },
    "Deny",
  );
}

export async function setWorkerMode(name: string, mode: string) {
  return requestBridge<unknown>(
    `/agents/${name}/mode`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    },
    "Set mode",
  );
}
