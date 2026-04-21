import { retrySupervisorRequest } from "@/server/supervisor/retry";

export const BRIDGE_URL = process.env.OMNIHARNESS_BRIDGE_URL?.trim() || "http://127.0.0.1:7800";

export interface AgentRecord {
  name: string;
  type: string;
  cwd: string;
  state: string; // 'idle' | 'working' | 'stopped' | 'error'
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

async function requestBridge<T>(path: string, init: RequestInit, action: string) {
  try {
    return await retrySupervisorRequest(async () => {
      const res = await fetch(`${BRIDGE_URL}${path}`, init);
      if (!res.ok) {
        throw Object.assign(new Error(`${action} failed: ${res.status} ${res.statusText}`), { status: res.status });
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

    throw new Error(`${action} failed: ${describeError(error)}`);
  }
}

export async function spawnAgent(params: { type: string; cwd: string; name: string; mode?: string; env?: Record<string, string> }) {
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
  return requestBridge<AgentRecord>(`/agents/${name}`, {}, "Get agent");
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

export async function approvePermission(name: string) {
  return requestBridge<unknown>(
    `/agents/${name}/approve`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    },
    "Approve",
  );
}

export async function denyPermission(name: string) {
  return requestBridge<unknown>(
    `/agents/${name}/deny`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
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
