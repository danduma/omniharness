export const BRIDGE_URL = 'http://127.0.0.1:7800';

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

export async function spawnAgent(params: { type: string; cwd: string; name: string; mode?: string; env?: Record<string, string> }) {
  const res = await fetch(`${BRIDGE_URL}/agents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Spawn failed: ${res.statusText}`);
  return res.json() as Promise<AgentRecord>;
}

export async function askAgent(name: string, prompt: string) {
  const res = await fetch(`${BRIDGE_URL}/agents/${name}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) throw new Error(`Ask failed: ${res.statusText}`);
  return res.json() as Promise<{ response: string; state: string }>;
}

export async function getAgent(name: string) {
  const res = await fetch(`${BRIDGE_URL}/agents/${name}`);
  if (!res.ok) throw new Error(`Get agent failed: ${res.statusText}`);
  return res.json() as Promise<AgentRecord>;
}

export async function cancelAgent(name: string) {
  const res = await fetch(`${BRIDGE_URL}/agents/${name}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Cancel failed: ${res.statusText}`);
  return res.json();
}

export async function createTask(body: { name: string, subtasks: unknown[] }) {
  const res = await fetch(`${BRIDGE_URL}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Create task failed: ${res.statusText}`);
  return res.json() as Promise<TaskRecord>;
}

export async function getTask(taskId: string) {
  const res = await fetch(`${BRIDGE_URL}/tasks/${taskId}`);
  if (!res.ok) throw new Error(`Get task failed: ${res.statusText}`);
  return res.json() as Promise<TaskRecord>;
}

export async function approvePermission(name: string) {
  const res = await fetch(`${BRIDGE_URL}/agents/${name}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`Approve failed: ${res.statusText}`);
  return res.json();
}

export async function denyPermission(name: string) {
  const res = await fetch(`${BRIDGE_URL}/agents/${name}/deny`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`Deny failed: ${res.statusText}`);
  return res.json();
}

export async function setWorkerMode(name: string, mode: string) {
  const res = await fetch(`${BRIDGE_URL}/agents/${name}/mode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode }),
  });
  if (!res.ok) throw new Error(`Set mode failed: ${res.statusText}`);
  return res.json();
}
