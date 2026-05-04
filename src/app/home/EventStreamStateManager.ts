import { isWorkerActiveStatus } from "@/lib/conversation-workers";
import type { AgentSnapshot, EventStreamState } from "./types";

type EventStreamStateListener = (state: EventStreamState) => void;
type EventStreamStateAction = EventStreamState | ((current: EventStreamState) => EventStreamState);

function hasRenderableAgentOutput(agent: AgentSnapshot | null | undefined) {
  return Boolean(
    agent?.currentText?.trim()
    || agent?.displayText?.trim()
    || agent?.lastText?.trim()
    || agent?.outputLog?.trim()
    || agent?.outputEntries?.some((entry) => entry.text.trim()),
  );
}

function isPersistedOnlyAgent(agent: AgentSnapshot | null | undefined) {
  return Boolean(agent?.bridgeMissing);
}

type AgentOutputEntry = NonNullable<AgentSnapshot["outputEntries"]>[number];

function isOmittedOutputEntriesMarker(entry: AgentOutputEntry) {
  return entry.id.startsWith("output-entries-omitted:");
}

function omittedOutputEntriesCount(entry: AgentOutputEntry) {
  if (!isOmittedOutputEntriesMarker(entry)) {
    return 0;
  }

  const match = entry.text.match(/^(\d+)\s+earlier output entries omitted from this live payload\./);
  return match ? Number.parseInt(match[1], 10) || 0 : 0;
}

function withOmittedOutputEntriesCount(entry: AgentOutputEntry, omittedCount: number): AgentOutputEntry {
  return {
    ...entry,
    text: `${omittedCount} earlier output entries omitted from this live payload. Open the worker detail again as it updates to see the current tail.`,
  };
}

function outputEntryTimestampMs(entry: AgentOutputEntry) {
  const value = new Date(entry.timestamp).getTime();
  return Number.isFinite(value) ? value : 0;
}

function sortedOutputEntries(entries: Iterable<AgentOutputEntry>) {
  return Array.from(entries).sort((a, b) => {
    const timeDelta = outputEntryTimestampMs(a) - outputEntryTimestampMs(b);
    return timeDelta || a.id.localeCompare(b.id);
  });
}

function mergeOutputEntries(
  currentEntries: AgentSnapshot["outputEntries"],
  incomingEntries: AgentSnapshot["outputEntries"],
  cachedEntries: Map<string, AgentOutputEntry>,
) {
  for (const entry of currentEntries ?? []) {
    if (!isOmittedOutputEntriesMarker(entry)) {
      cachedEntries.set(entry.id, entry);
    }
  }

  for (const entry of incomingEntries ?? []) {
    if (!isOmittedOutputEntriesMarker(entry)) {
      cachedEntries.set(entry.id, entry);
    }
  }

  if (!currentEntries?.length) {
    return mergeCachedOutputEntriesWithIncomingMarkers(incomingEntries, cachedEntries);
  }

  if (!incomingEntries?.length) {
    return sortedOutputEntries(cachedEntries.values());
  }

  return mergeCachedOutputEntriesWithIncomingMarkers(incomingEntries, cachedEntries);
}

function mergeCachedOutputEntriesWithIncomingMarkers(
  incomingEntries: AgentSnapshot["outputEntries"],
  cachedEntries: Map<string, AgentOutputEntry>,
) {
  const actualEntries = sortedOutputEntries(cachedEntries.values());
  const incomingMarkers = (incomingEntries ?? []).filter(isOmittedOutputEntriesMarker);
  if (incomingMarkers.length === 0) {
    return actualEntries;
  }

  const latestMarker = incomingMarkers[incomingMarkers.length - 1];
  const incomingActualCount = (incomingEntries ?? []).filter((entry) => !isOmittedOutputEntriesMarker(entry)).length;
  const omittedCount = omittedOutputEntriesCount(latestMarker);
  const impliedSnapshotEntryCount = incomingActualCount + omittedCount;
  if (actualEntries.length >= impliedSnapshotEntryCount) {
    return actualEntries;
  }

  const missingCount = Math.max(1, impliedSnapshotEntryCount - actualEntries.length);
  const displayedMissingCount = omittedCount > 0 ? Math.min(omittedCount, missingCount) : missingCount;
  return sortedOutputEntries([
    ...actualEntries,
    withOmittedOutputEntriesCount(latestMarker, displayedMissingCount),
  ]);
}

function mergeAgentOutputHistory(
  currentAgent: AgentSnapshot | undefined,
  incomingAgent: AgentSnapshot,
  cachedEntries: Map<string, AgentOutputEntry>,
) {
  if (!currentAgent) {
    const mergedOutputEntries = mergeOutputEntries(undefined, incomingAgent.outputEntries, cachedEntries);
    return mergedOutputEntries === incomingAgent.outputEntries ? incomingAgent : {
      ...incomingAgent,
      outputEntries: mergedOutputEntries,
    };
  }

  const mergedOutputEntries = mergeOutputEntries(currentAgent.outputEntries, incomingAgent.outputEntries, cachedEntries);
  if (mergedOutputEntries === incomingAgent.outputEntries) {
    return incomingAgent;
  }

  return {
    ...incomingAgent,
    outputEntries: mergedOutputEntries,
  };
}

function mergeAgentSnapshots(
  current: EventStreamState,
  incoming: EventStreamState,
  outputEntriesByAgentName: Map<string, Map<string, AgentOutputEntry>>,
) {
  const currentAgentsByName = new Map((current.agents || []).map((agent) => [agent.name, agent]));
  const incomingWorkersById = new Map((incoming.workers || []).map((worker) => [worker.id, worker]));
  let changed = false;

  const agents = (incoming.agents || []).map((incomingAgent) => {
    const currentAgent = currentAgentsByName.get(incomingAgent.name);
    const incomingWorker = incomingWorkersById.get(incomingAgent.name);
    const cachedEntries = outputEntriesByAgentName.get(incomingAgent.name) ?? new Map<string, AgentOutputEntry>();
    outputEntriesByAgentName.set(incomingAgent.name, cachedEntries);
    const incomingAgentWithHistory = mergeAgentOutputHistory(currentAgent, incomingAgent, cachedEntries);

    if (incomingAgentWithHistory !== incomingAgent) {
      changed = true;
    }

    if (
      currentAgent
      && isPersistedOnlyAgent(incomingAgentWithHistory)
      && !isPersistedOnlyAgent(currentAgent)
      && isWorkerActiveStatus(incomingWorker?.status ?? incomingAgentWithHistory.state)
      && hasRenderableAgentOutput(currentAgent)
    ) {
      changed = true;
      return {
        ...incomingAgentWithHistory,
        ...currentAgent,
        state: currentAgent.state || incomingAgent.state,
        outputEntries: incomingAgentWithHistory.outputEntries,
        bridgeMissing: false,
        bridgeLastError: incomingAgentWithHistory.bridgeLastError ?? currentAgent.bridgeLastError,
        updatedAt: incomingAgentWithHistory.updatedAt ?? currentAgent.updatedAt,
        runLastError: incomingAgentWithHistory.runLastError ?? currentAgent.runLastError,
      };
    }

    return incomingAgentWithHistory;
  });

  return changed ? { ...incoming, agents } : incoming;
}

export class EventStreamStateManager {
  private state: EventStreamState;
  private readonly listeners = new Set<EventStreamStateListener>();
  private readonly outputEntriesByAgentName = new Map<string, Map<string, AgentOutputEntry>>();

  constructor(initialState: EventStreamState) {
    this.state = initialState;
    this.rememberOutputEntries(initialState);
  }

  getSnapshot() {
    return this.state;
  }

  subscribe(listener: EventStreamStateListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  update(action: EventStreamStateAction) {
    const incoming = typeof action === "function" ? action(this.state) : action;
    this.rememberOutputEntries(incoming);
    const nextState = mergeAgentSnapshots(this.state, incoming, this.outputEntriesByAgentName);

    if (Object.is(nextState, this.state)) {
      return this.state;
    }

    this.state = nextState;
    this.rememberOutputEntries(nextState);
    this.listeners.forEach((listener) => listener(this.state));
    return this.state;
  }

  private rememberOutputEntries(state: EventStreamState) {
    for (const agent of state.agents ?? []) {
      if (!agent.outputEntries?.length) {
        continue;
      }

      const cachedEntries = this.outputEntriesByAgentName.get(agent.name) ?? new Map<string, AgentOutputEntry>();
      for (const entry of agent.outputEntries) {
        if (!isOmittedOutputEntriesMarker(entry)) {
          cachedEntries.set(entry.id, entry);
        }
      }
      this.outputEntriesByAgentName.set(agent.name, cachedEntries);
    }
  }
}
