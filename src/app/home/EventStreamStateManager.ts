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

function mergeAgentSnapshots(current: EventStreamState, incoming: EventStreamState) {
  const currentAgentsByName = new Map((current.agents || []).map((agent) => [agent.name, agent]));
  const incomingWorkersById = new Map((incoming.workers || []).map((worker) => [worker.id, worker]));
  let changed = false;

  const agents = (incoming.agents || []).map((incomingAgent) => {
    const currentAgent = currentAgentsByName.get(incomingAgent.name);
    const incomingWorker = incomingWorkersById.get(incomingAgent.name);

    if (
      currentAgent
      && isPersistedOnlyAgent(incomingAgent)
      && !isPersistedOnlyAgent(currentAgent)
      && isWorkerActiveStatus(incomingWorker?.status ?? incomingAgent.state)
      && hasRenderableAgentOutput(currentAgent)
    ) {
      changed = true;
      return {
        ...incomingAgent,
        ...currentAgent,
        state: currentAgent.state || incomingAgent.state,
        bridgeMissing: false,
        bridgeLastError: incomingAgent.bridgeLastError ?? currentAgent.bridgeLastError,
        updatedAt: incomingAgent.updatedAt ?? currentAgent.updatedAt,
        runLastError: incomingAgent.runLastError ?? currentAgent.runLastError,
      };
    }

    return incomingAgent;
  });

  return changed ? { ...incoming, agents } : incoming;
}

export class EventStreamStateManager {
  private state: EventStreamState;
  private readonly listeners = new Set<EventStreamStateListener>();

  constructor(initialState: EventStreamState) {
    this.state = initialState;
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
    const nextState = mergeAgentSnapshots(this.state, incoming);

    if (Object.is(nextState, this.state)) {
      return this.state;
    }

    this.state = nextState;
    this.listeners.forEach((listener) => listener(this.state));
    return this.state;
  }
}
