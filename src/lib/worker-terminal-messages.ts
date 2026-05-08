import type { AgentSnapshot, SupervisorInterventionRecord } from "@/app/home/types";
import type { ConversationWorkerRecord } from "@/lib/conversation-workers";

export type WorkerTerminalUserMessage = {
  id: string;
  content: string;
  createdAt: string;
};

const PROMPT_OUTPUT_CONTEXT_TOLERANCE_MS = 15 * 60 * 1000;

type AgentOutputEntry = NonNullable<AgentSnapshot["outputEntries"]>[number];

function timestampMs(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function isLoadedWorkerOutputEntry(entry: AgentOutputEntry) {
  return entry.id !== "output-archive-marker" && !entry.id.startsWith("output-entries-omitted:");
}

function loadedWorkerOutputTimes(agent: AgentSnapshot | null | undefined) {
  return (agent?.outputEntries ?? [])
    .filter(isLoadedWorkerOutputEntry)
    .map((entry) => timestampMs(entry.timestamp))
    .filter((time): time is number => time !== null)
    .sort((left, right) => left - right);
}

function hasLoadedOutputContext(createdAt: string, outputTimes: number[]) {
  const promptTime = timestampMs(createdAt);
  if (promptTime === null || outputTimes.length === 0) {
    return false;
  }

  return outputTimes.some((outputTime) => (
    Math.abs(outputTime - promptTime) <= PROMPT_OUTPUT_CONTEXT_TOLERANCE_MS
  ));
}

export function buildWorkerTerminalUserMessages({
  worker,
  agent,
  supervisorInterventions = [],
}: {
  worker: ConversationWorkerRecord;
  agent?: AgentSnapshot | null;
  supervisorInterventions?: SupervisorInterventionRecord[];
}): WorkerTerminalUserMessage[] {
  const outputTimes = loadedWorkerOutputTimes(agent);
  const messages: WorkerTerminalUserMessage[] = [];
  const initialPrompt = worker.initialPrompt?.trim();

  if (initialPrompt && worker.createdAt && hasLoadedOutputContext(worker.createdAt, outputTimes)) {
    messages.push({
      id: `${worker.id}:initial-prompt`,
      content: initialPrompt,
      createdAt: worker.createdAt,
    });
  }

  for (const intervention of supervisorInterventions) {
    if (intervention.workerId !== worker.id || !intervention.prompt.trim()) {
      continue;
    }

    if (!hasLoadedOutputContext(intervention.createdAt, outputTimes)) {
      continue;
    }

    messages.push({
      id: intervention.id,
      content: intervention.prompt,
      createdAt: intervention.createdAt,
    });
  }

  return messages.sort((left, right) => {
    const timeDelta = (timestampMs(left.createdAt) ?? 0) - (timestampMs(right.createdAt) ?? 0);
    return timeDelta !== 0 ? timeDelta : left.id.localeCompare(right.id);
  });
}
