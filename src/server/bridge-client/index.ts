import { retrySupervisorRequest } from "@/server/supervisor/retry";

export const BRIDGE_URL = process.env.OMNIHARNESS_BRIDGE_URL?.trim() || "http://127.0.0.1:7800";

export interface AgentRecord {
  name: string;
  type: string;
  cwd: string;
  state: string; // 'idle' | 'working' | 'stopped' | 'error'
  requestedModel?: string | null;
  effectiveModel?: string | null;
  requestedEffort?: string | null;
  effectiveEffort?: string | null;
  sessionMode?: string | null;
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
    options?: Array<{ optionId: string; kind: string; name: string }>;
  }>;
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

function asPendingPermissions(value: unknown): AgentRecord["pendingPermissions"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is {
      requestId?: unknown;
      requestedAt?: unknown;
      sessionId?: unknown;
      options?: unknown;
    } => typeof item === "object" && item !== null)
    .map((item) => ({
      requestId: typeof item.requestId === "number" ? item.requestId : -1,
      requestedAt: asString(item.requestedAt),
      sessionId: typeof item.sessionId === "string" ? item.sessionId : null,
      options: asPermissionOptions(item.options),
    }))
    .filter((item) => item.requestId >= 0 && item.requestedAt);
}

export function normalizeAgentRecord(value: unknown): AgentRecord {
  const record = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  const contextUsage =
    typeof record.contextUsage === "object" && record.contextUsage !== null
      ? record.contextUsage as AgentRecord["contextUsage"]
      : null;

  return {
    name: asString(record.name),
    type: asString(record.type),
    cwd: asString(record.cwd),
    state: asString(record.state, "unknown"),
    requestedModel: asNullableString(record.requestedModel),
    effectiveModel: asNullableString(record.effectiveModel),
    requestedEffort: asNullableString(record.requestedEffort),
    effectiveEffort: asNullableString(record.effectiveEffort),
    sessionMode: asNullableString(record.sessionMode),
    contextUsage,
    pendingPermissions: asPendingPermissions(record.pendingPermissions),
    lastText: asString(record.lastText),
    currentText: asString(record.currentText),
    stderrBuffer: asStringArray(record.stderrBuffer),
    stopReason: asNullableString(record.stopReason),
  };
}

async function requestBridge<T>(path: string, init: RequestInit, action: string) {
  try {
    return await retrySupervisorRequest(async () => {
      const res = await fetch(`${BRIDGE_URL}${path}`, init);
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
        throw Object.assign(new Error(`${action} failed: ${detail}`), { status: res.status });
      }
      return res.json() as Promise<T>;
    });
  } catch (error) {
    if (isBridgeConnectionRefused(error)) {
      throw new Error(
        `ACP bridge is not running at ${BRIDGE_URL}. Start it first ` +
        `(for example: cd ../acp-bridge && pnpm run daemon). Original error: ${describeError(error)}`,
      );
    }

    const detail = describeError(error);
    const normalizedDetail = stripRepeatedActionPrefix(detail, action);

    throw new Error(`${action} failed: ${normalizedDetail}`);
  }
}

export async function spawnAgent(params: {
  type: string;
  cwd: string;
  name: string;
  mode?: string;
  env?: Record<string, string>;
  model?: string;
  effort?: string;
}) {
  return requestBridge<AgentRecord>(
    "/agents",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    },
    "Spawn",
  );
}

export async function askAgent(name: string, prompt: string) {
  return requestBridge<{ response: string; state: string }>(
    `/agents/${name}/ask`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    },
    "Ask",
  );
}

export async function getAgent(name: string) {
  const agent = await requestBridge<unknown>(`/agents/${name}`, {}, "Get agent");
  return normalizeAgentRecord(agent);
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
