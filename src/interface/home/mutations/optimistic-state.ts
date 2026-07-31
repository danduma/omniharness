import type { PendingChatAttachment } from "@/lib/chat-attachments";
import type {
  AgentSnapshot,
  EventStreamState,
  ExecutionEventRecord,
} from "../types";
import { buildConversationPath, buildInlineError } from "../utils";

function isOptimisticallyStoppableWorkerStatus(status: string | null | undefined) {
  const normalized = (status ?? "").trim().toLowerCase().split(":")[0]?.trim() ?? "";
  return normalized === "starting"
    || normalized === "working"
    || normalized === "idle"
    || normalized === "stuck"
    || normalized === "recovering";
}

function createOptimisticExecutionEvent(args: {
  runId: string;
  workerId?: string | null;
  eventType: string;
  details: Record<string, unknown>;
}) {
  const now = new Date().toISOString();
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `optimistic-${now}-${Math.random().toString(16).slice(2)}`,
    runId: args.runId,
    workerId: args.workerId ?? null,
    planItemId: null,
    eventType: args.eventType,
    details: JSON.stringify(args.details),
    createdAt: now,
  } satisfies ExecutionEventRecord;
}

export function replaceBrowserConversationPath(
  selectedRunId: string | null,
  draftProjectPath: string | null,
) {
  if (typeof window === "undefined") {
    return;
  }

  const nextPath = buildConversationPath(selectedRunId, draftProjectPath);
  const currentPath = `${window.location.pathname}${window.location.search}`;
  if (currentPath !== nextPath) {
    window.history.replaceState(window.history.state, "", nextPath);
  }
}

export function ownsOptimisticRunSelection(args: {
  requestedRunId: string;
  currentSelectedRunId: string | null;
}) {
  return args.currentSelectedRunId === args.requestedRunId;
}

export function ownsSelectionFromMutationStart(args: {
  selectedRunIdAtStart: string | null;
  currentSelectedRunId: string | null;
}) {
  return args.currentSelectedRunId === args.selectedRunIdAtStart;
}

export function shouldSelectProjectMutationResult(args: {
  selectedRunIdAtStart: string | null;
  currentSelectedRunId: string | null;
  resultRunId: string | null | undefined;
}) {
  return Boolean(args.resultRunId) && ownsSelectionFromMutationStart(args);
}

export function shouldSelectSourceRunMutationResult(args: {
  sourceRunId: string;
  selectedRunIdAtStart: string | null;
  currentSelectedRunId: string | null;
  resultRunId: string | null | undefined;
}) {
  return Boolean(args.resultRunId)
    && args.selectedRunIdAtStart === args.sourceRunId
    && args.currentSelectedRunId === args.sourceRunId;
}

export function shouldRestoreSelectionAfterOptimisticRemovalError(args: {
  removedRunId: string;
  selectedRunIdAtStart: string | null;
  currentSelectedRunId: string | null;
}) {
  return args.selectedRunIdAtStart === args.removedRunId
    && args.currentSelectedRunId === null;
}

export function ownsConversationSideEffects(args: {
  runId: string;
  currentSelectedRunId: string | null;
}) {
  return args.currentSelectedRunId === args.runId;
}

export function shouldClearSubmittedComposer(args: {
  submittedContent: string;
  commandAtStart: string;
  currentCommand: string;
  attachmentsAtStart: PendingChatAttachment[];
  currentAttachments: PendingChatAttachment[];
}) {
  return args.commandAtStart === args.submittedContent
    && args.currentCommand === args.submittedContent
    && args.currentAttachments === args.attachmentsAtStart;
}

function timestampMs(value: string | undefined | null) {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function mergeOutputEntries(
  current: AgentSnapshot["outputEntries"],
  loaded: AgentSnapshot["outputEntries"],
) {
  const byId = new Map<string, NonNullable<AgentSnapshot["outputEntries"]>[number]>();
  for (const entry of loaded ?? []) {
    byId.set(entry.id, entry);
  }
  for (const entry of current ?? []) {
    byId.set(entry.id, entry);
  }
  return Array.from(byId.values()).sort((first, second) => {
    const timeDelta = timestampMs(first.timestamp) - timestampMs(second.timestamp);
    return timeDelta !== 0 ? timeDelta : first.id.localeCompare(second.id);
  });
}

export function mergeLoadedWorkerHistoryAgent(
  current: AgentSnapshot | undefined,
  loaded: AgentSnapshot,
): AgentSnapshot {
  if (!current) {
    return loaded;
  }

  const currentIsNewer = timestampMs(current.updatedAt) > timestampMs(loaded.updatedAt);
  const outputEntries = mergeOutputEntries(current.outputEntries, loaded.outputEntries);
  if (!currentIsNewer) {
    return {
      ...loaded,
      outputEntries,
    };
  }

  return {
    ...loaded,
    state: current.state,
    currentText: current.currentText,
    lastText: current.lastText,
    displayText: current.displayText,
    lastError: current.lastError,
    recentStderr: current.recentStderr,
    pendingPermissions: current.pendingPermissions,
    pendingElicitations: current.pendingElicitations,
    contextUsage: current.contextUsage,
    bridgeLastError: current.bridgeLastError,
    runLastError: current.runLastError,
    stderrBuffer: current.stderrBuffer,
    stopReason: current.stopReason,
    bridgeMissing: current.bridgeMissing,
    updatedAt: current.updatedAt,
    outputEntries,
  };
}

export function applyStopWorkerOptimisticUpdate(
  current: EventStreamState,
  runId: string,
  workerId: string,
) {
  const now = new Date().toISOString();
  const run = current.runs.find((candidate) => candidate.id === runId) ?? null;
  const isImplementationRun = run?.mode === "implementation" && run?.phase !== "planning";
  const stoppedWorkerIds = new Set<string>();

  const workers = (current.workers || []).map((worker) => {
    if (worker.runId !== runId) {
      return worker;
    }
    if (
      worker.id === workerId
      || (isImplementationRun && isOptimisticallyStoppableWorkerStatus(worker.status))
    ) {
      stoppedWorkerIds.add(worker.id);
      return { ...worker, status: "cancelled", updatedAt: now };
    }
    return worker;
  });

  const hasActiveWorker = workers.some((worker) =>
    worker.runId === runId && isOptimisticallyStoppableWorkerStatus(worker.status));
  const nextRunStatus = isImplementationRun
    ? "awaiting_user"
    : hasActiveWorker
      ? run?.status
      : "cancelled";

  return {
    ...current,
    runs: (current.runs || []).map((candidate) =>
      candidate.id === runId && nextRunStatus
        ? { ...candidate, status: nextRunStatus, updatedAt: now, failedAt: null, lastError: null }
        : candidate),
    workers,
    agents: (current.agents || []).map((agent) =>
      stoppedWorkerIds.has(agent.name)
        ? { ...agent, state: "cancelled", currentText: "", updatedAt: now }
        : agent),
    executionEvents: [
      createOptimisticExecutionEvent({
        runId,
        workerId,
        eventType: isImplementationRun ? "worker_stop_requested" : "worker_cancelled",
        details: {
          summary: isImplementationRun
            ? `Paused work because ${workerId} was stopped by the user.`
            : `Stopped ${workerId}`,
          reason: isImplementationRun ? "User stopped a worker." : "User stopped this worker.",
          userInitiated: true,
          stoppedWorkerId: workerId,
          optimistic: true,
        },
      }),
      ...(current.executionEvents || []),
    ],
  };
}

export function applyStopSupervisorOptimisticUpdate(current: EventStreamState, runId: string) {
  const now = new Date().toISOString();
  const stoppedWorkerIds = new Set<string>();
  const workers = (current.workers || []).map((worker) => {
    if (worker.runId !== runId || !isOptimisticallyStoppableWorkerStatus(worker.status)) {
      return worker;
    }
    stoppedWorkerIds.add(worker.id);
    return { ...worker, status: "cancelled", updatedAt: now };
  });

  return {
    ...current,
    runs: (current.runs || []).map((run) =>
      run.id === runId
        ? { ...run, status: "cancelled", updatedAt: now, failedAt: null, lastError: null }
        : run),
    workers,
    agents: (current.agents || []).map((agent) =>
      stoppedWorkerIds.has(agent.name)
        ? { ...agent, state: "cancelled", currentText: "", updatedAt: now }
        : agent),
    executionEvents: [
      createOptimisticExecutionEvent({
        runId,
        eventType: "supervisor_stopped",
        details: {
          summary: "Stopped supervisor and cancelled active workers.",
          reason: "User stopped the supervisor.",
          userInitiated: true,
          optimistic: true,
        },
      }),
      ...(current.executionEvents || []),
    ],
  };
}

export function applyElicitationOptimisticUpdate(
  current: EventStreamState,
  workerId: string,
  requestId: number,
) {
  return {
    ...current,
    agents: (current.agents || []).map((agent) =>
      agent.name === workerId
        ? {
            ...agent,
            pendingElicitations: (agent.pendingElicitations || [])
              .filter((elicitation) => elicitation.requestId !== requestId),
          }
        : agent),
  };
}

export function isAlreadyResolvedHumanInputError(error: unknown) {
  const descriptor = buildInlineError(error);
  return descriptor.status === 409
    || /\bno_pending_(?:elicitations|permissions)\b/i.test(descriptor.message);
}

export function applyPermissionOptimisticUpdate(
  current: EventStreamState,
  workerId: string,
  requestId: number,
) {
  return {
    ...current,
    agents: (current.agents || []).map((agent) =>
      agent.name === workerId
        ? {
            ...agent,
            pendingPermissions: (agent.pendingPermissions || [])
              .filter((permission) => permission.requestId !== requestId),
          }
        : agent),
  };
}
