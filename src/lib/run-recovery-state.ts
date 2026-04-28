type RecoveryAction = "retry" | "edit" | "fork";

type RecoverableRun = {
  id: string;
  status: string;
  lastError?: string | null;
  failedAt?: string | null;
};

type RecoverableMessage = {
  id: string;
  runId: string;
  role: string;
  kind?: string | null;
  content: string;
  createdAt: string;
};

type RecoverableWorker = {
  id: string;
  runId: string;
  type: string;
  status: string;
};

type RecoverableAgent = {
  name: string;
  [key: string]: unknown;
};

type RecoverableRunScoped = {
  runId: string;
  [key: string]: unknown;
};

type RecoverableExecutionEvent = {
  id: string;
  runId: string;
  workerId?: string | null;
  eventType: string;
};

export type RecoverableConversationState = {
  runs: RecoverableRun[];
  messages: RecoverableMessage[];
  workers: RecoverableWorker[];
  agents: RecoverableAgent[];
  clarifications: RecoverableRunScoped[];
  validationRuns: RecoverableRunScoped[];
  executionEvents: RecoverableExecutionEvent[];
  supervisorInterventions: RecoverableRunScoped[];
};

export function applyRunRecoveryOptimisticUpdate(
  state: RecoverableConversationState,
  args: {
    runId: string;
    action: RecoveryAction;
    targetMessageId: string;
    content?: string;
  },
) {
  if (args.action === "fork") {
    return state;
  }

  const targetMessage = state.messages.find((message) => (
    message.runId === args.runId && message.id === args.targetMessageId
  ));
  if (!targetMessage) {
    return state;
  }

  const workerIds = state.workers
    .filter((worker) => worker.runId === args.runId)
    .map((worker) => worker.id);
  const targetTimestamp = new Date(targetMessage.createdAt).getTime();

  return {
    ...state,
    runs: state.runs.map((run) => (
      run.id === args.runId
        ? {
            ...run,
            status: "running",
            lastError: null,
            failedAt: null,
          }
        : run
    )),
    messages: state.messages
      .filter((message) => {
        if (message.runId !== args.runId) {
          return true;
        }
        return new Date(message.createdAt).getTime() <= targetTimestamp;
      })
      .map((message) => (
        args.action === "edit" && message.id === args.targetMessageId
          ? {
              ...message,
              content: args.content?.trim() || message.content,
            }
          : message
      )),
    workers: state.workers.map((worker) => (
      worker.runId === args.runId
        ? {
            ...worker,
            status: "cancelled",
          }
        : worker
    )),
    agents: state.agents.filter((agent) => !workerIds.includes(agent.name)),
    clarifications: state.clarifications.filter((item) => item.runId !== args.runId),
    validationRuns: state.validationRuns.filter((item) => item.runId !== args.runId),
    executionEvents: state.executionEvents.filter((item) => item.runId !== args.runId),
    supervisorInterventions: state.supervisorInterventions.filter((item) => item.runId !== args.runId),
  };
}
