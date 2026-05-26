export type ConversationWorkerRecord = {
  id: string;
  runId: string;
  type: string;
  status: string;
  workerNumber?: number | null;
  title?: string | null;
  initialPrompt?: string | null;
  activeWorkStartedAt?: string | Date | null;
  activeWorkDurationMs?: number | null;
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

const ACTIVE_WORKER_STATES = new Set(["starting", "working", "idle", "stuck", "recovering"]);
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

function formatCompactWorkerDuration(durationMs: number) {
  const normalizedMs = Math.max(0, Math.round(durationMs));

  if (normalizedMs < MINUTE_MS) {
    return `${Math.max(1, Math.round(normalizedMs / 1000))} sec`;
  }

  const hours = Math.floor(normalizedMs / HOUR_MS);
  const minutes = Math.floor((normalizedMs % HOUR_MS) / MINUTE_MS);

  if (hours > 0) {
    return minutes > 0 ? `${hours} hr ${minutes} min` : `${hours} hr`;
  }

  return `${Math.max(1, minutes)} min`;
}

export function getWorkerRuntimeLabel(worker: ConversationWorkerRecord, now = Date.now()) {
  const persistedWorkMs = worker.activeWorkDurationMs;
  if (typeof persistedWorkMs === "number") {
    const activeWorkStartedAt = parseTimestampMs(worker.activeWorkStartedAt);
    const activeWorkMs = normalizeWorkerStatus(worker.status) === "working" && activeWorkStartedAt !== null
      ? Math.max(0, now - activeWorkStartedAt)
      : 0;

    return formatCompactWorkerDuration(Math.max(0, persistedWorkMs + activeWorkMs));
  }

  const startedAt = parseTimestampMs(worker.createdAt);
  if (startedAt === null) {
    return null;
  }

  const lastActivityAt = parseTimestampMs(worker.updatedAt);
  const endedAt = lastActivityAt ?? now;
  return formatCompactWorkerDuration(Math.max(0, endedAt - startedAt));
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
    const agentIsActive = isWorkerActiveStatus(agent.state);
    if (!agentIsActive && !hasLiveOutput) {
      if (!isWorkerActiveStatus(worker.status)) {
        return worker;
      }

      const agentStatus = normalizeWorkerStatus(agent.state);
      if (!agentStatus) {
        return worker;
      }

      return agentStatus === worker.status ? worker : { ...worker, status: agentStatus };
    }

    const status = agentIsActive ? agent.state : "working";
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

function isCancelledAgent(agent: ConversationWorkerAgent) {
  const state = normalizeWorkerStatus(agent.state);
  return state === "cancelled" || state === "canceled";
}

function hasActiveAgentOutput(agent: ConversationWorkerAgent) {
  return isWorkerActiveStatus(agent.state) || Boolean(agent.currentText?.trim());
}

function hasReadableAgentOutput(agent: ConversationWorkerAgent) {
  return Boolean(
    agent.currentText?.trim()
      || agent.displayText?.trim()
      || agent.lastText?.trim()
  );
}

function hasActiveReadableAgentOutput(agent: ConversationWorkerAgent) {
  return isWorkerActiveStatus(agent.state) && hasReadableAgentOutput(agent);
}

export function selectPrimaryConversationAgent<T extends ConversationWorkerAgent>(agents: T[], directConversation: boolean) {
  if (!directConversation) {
    return agents[0] ?? null;
  }

  return (
    agents.find((agent) => !isCancelledAgent(agent) && hasActiveReadableAgentOutput(agent))
    ?? [...agents].reverse().find(hasReadableAgentOutput)
    ?? agents.find((agent) => !isCancelledAgent(agent) && hasActiveAgentOutput(agent))
    ?? agents.find((agent) => !isCancelledAgent(agent))
    ?? [...agents].reverse().find(hasReadableAgentOutput)
    ?? agents.at(-1)
    ?? null
  );
}
