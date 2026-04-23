export type ConversationWorkerRecord = {
  id: string;
  runId: string;
  type: string;
  status: string;
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
};

const ACTIVE_WORKER_STATES = new Set(["starting", "working", "idle", "stuck"]);

export function normalizeWorkerStatus(status: string | null | undefined) {
  return (status ?? "").trim().toLowerCase().split(":")[0]?.trim() ?? "";
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

export function buildWorkerPreview(agent: ConversationWorkerAgent) {
  const previewSource = agent.currentText?.trim()
    || agent.displayText?.trim()
    || agent.lastText?.trim()
    || agent.lastError?.trim()
    || agent.stopReason?.trim()
    || `${agent.state} worker`;

  return summarizePreview(previewSource);
}
