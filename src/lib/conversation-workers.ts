export type ConversationWorkerRecord = {
  id: string;
  runId: string;
  type: string;
  status: string;
  workerNumber?: number | null;
  title?: string | null;
  initialPrompt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type ConversationWorkerAgent = {
  name: string;
  state: string;
  currentText?: string;
  lastText?: string;
  displayText?: string;
  lastError?: string | null;
  stopReason?: string | null;
  bridgeMissing?: boolean;
};

const ACTIVE_WORKER_STATES = new Set(["starting", "working", "idle", "stuck"]);
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

export function normalizeWorkerStatus(status: string | null | undefined) {
  return (status ?? "").trim().toLowerCase().split(":")[0]?.trim() ?? "";
}

function parseTimestampMs(value: string | Date | null | undefined) {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : null;
  }

  if (!value) {
    return null;
  }

  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function pluralize(value: number, unit: string) {
  return `${value} ${unit}${value === 1 ? "" : "s"}`;
}

export function formatHumanDuration(durationMs: number) {
  const normalizedMs = Math.max(0, Math.round(durationMs));

  if (normalizedMs < MINUTE_MS) {
    return pluralize(Math.max(1, Math.round(normalizedMs / 1000)), "second");
  }

  const hours = Math.floor(normalizedMs / HOUR_MS);
  const minutes = Math.floor((normalizedMs % HOUR_MS) / MINUTE_MS);

  if (hours > 0) {
    return minutes > 0
      ? `${pluralize(hours, "hour")}, ${pluralize(minutes, "minute")}`
      : pluralize(hours, "hour");
  }

  return pluralize(Math.max(1, minutes), "minute");
}

export function getWorkerRuntimeLabel(worker: ConversationWorkerRecord, now = Date.now()) {
  const startedAt = parseTimestampMs(worker.createdAt);
  if (startedAt === null) {
    return null;
  }

  const active = isWorkerActiveStatus(worker.status);
  const endedAt = active ? now : parseTimestampMs(worker.updatedAt) ?? now;
  const duration = formatHumanDuration(Math.max(0, endedAt - startedAt));
  return active ? `Working for ${duration}` : `Worked ${duration}`;
}

function summarizePreview(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 220);
}

export function isWorkerActiveStatus(status: string | null | undefined) {
  return ACTIVE_WORKER_STATES.has(normalizeWorkerStatus(status));
}

export function buildWorkerLists<T extends ConversationWorkerRecord>(workers: T[]) {
  return workers.reduce<{ active: T[]; finished: T[] }>((groups, worker) => {
    if (isWorkerActiveStatus(worker.status)) {
      groups.active.push(worker);
    } else {
      groups.finished.push(worker);
    }
    return groups;
  }, { active: [], finished: [] });
}

export function mergeWorkerLiveStatus<T extends ConversationWorkerRecord>(
  workers: T[],
  agents: ConversationWorkerAgent[],
) {
  const agentsByName = new Map(agents.map((agent) => [agent.name, agent]));

  return workers.map((worker) => {
    const agent = agentsByName.get(worker.id);
    if (!agent) {
      return worker;
    }

    const hasLiveOutput = !agent.bridgeMissing && Boolean(agent.currentText?.trim());
    if (!isWorkerActiveStatus(agent.state) && !hasLiveOutput) {
      return worker;
    }

    const status = isWorkerActiveStatus(agent.state) ? agent.state : "working";
    return status === worker.status ? worker : { ...worker, status };
  });
}

export function buildWorkerPreview(agent: ConversationWorkerAgent) {
  const previewSource = agent.currentText?.trim()
    || agent.displayText?.trim()
    || agent.lastText?.trim()
    || agent.lastError?.trim()
    || agent.stopReason?.trim()
    || `${agent.state} worker`;

  return summarizePreview(previewSource);
}
