import { normalizeWorkerStatus } from "@/lib/conversation-workers";
import { isTerminalRunStatus } from "@/lib/run-status";
import type { AgentOutputEntry } from "@/lib/agent-output";

const DIRECT_WORKING_STATUSES = new Set(["starting", "working", "stuck", "recovering"]);
const TERMINAL_HUMAN_INPUT_STATUSES = new Set([
  "answered",
  "approved",
  "cancelled",
  "canceled",
  "completed",
  "declined",
  "denied",
  "failed",
  "rejected",
  "skipped",
]);

export type DirectControlPendingAssistantStatus = "connecting" | "thinking" | "working";

function hasWorkingStatus(statuses: readonly (string | null | undefined)[]) {
  return statuses.some((status) => DIRECT_WORKING_STATUSES.has(normalizeWorkerStatus(status)));
}

function isOpenInputEntry(entry: AgentOutputEntry) {
  if (entry.type !== "permission" && entry.type !== "elicitation") {
    return false;
  }
  const status = (entry.status ?? "pending").trim().toLowerCase();
  return !TERMINAL_HUMAN_INPUT_STATUSES.has(status);
}

function entryRequestKey(entry: AgentOutputEntry) {
  const raw = entry.raw;
  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  const requestId = (raw as { requestId?: unknown }).requestId;
  return typeof requestId === "number" && Number.isFinite(requestId)
    ? `${entry.type}:${requestId}`
    : null;
}

export function countOpenHumanInputEntries(
  entries: readonly AgentOutputEntry[] | null | undefined,
  inputType?: "permission" | "elicitation",
) {
  const openByRequestKey = new Map<string, boolean>();
  let unkeyedOpenCount = 0;

  for (const entry of entries ?? []) {
    if (entry.type !== "permission" && entry.type !== "elicitation") {
      continue;
    }
    if (inputType && entry.type !== inputType) {
      continue;
    }

    const open = isOpenInputEntry(entry);
    const requestKey = entryRequestKey(entry);
    if (!requestKey) {
      if (open) {
        unkeyedOpenCount += 1;
      }
      continue;
    }

    openByRequestKey.set(requestKey, open);
  }

  return unkeyedOpenCount + [...openByRequestKey.values()].filter(Boolean).length;
}

export function hasPendingHumanInputSignal(agent: {
  pendingPermissions?: unknown[] | null;
  pendingElicitations?: unknown[] | null;
  outputEntries?: AgentOutputEntry[] | null;
}) {
  return (
    (agent.pendingPermissions?.length ?? 0) > 0
    || (agent.pendingElicitations?.length ?? 0) > 0
    || countOpenHumanInputEntries(agent.outputEntries) > 0
  );
}

export function resolveDirectControlPendingAssistantStatus(args: {
  isDirectConversation: boolean;
  pendingConversationWorkerId: string | null | undefined;
  busyConversationWorkerId: string | null | undefined;
  selectedRunStatus: string | null | undefined;
  workerStatuses: readonly (string | null | undefined)[];
  agentStates: readonly (string | null | undefined)[];
  hasAgentCurrentText: boolean;
  hasPendingHumanInput?: boolean;
}) {
  if (!args.isDirectConversation) {
    return null;
  }

  if (isTerminalRunStatus(args.selectedRunStatus)) {
    return null;
  }

  if (args.hasPendingHumanInput) {
    return null;
  }

  if (args.busyConversationWorkerId || hasWorkingStatus(args.workerStatuses) || hasWorkingStatus(args.agentStates)) {
    return "working";
  }

  if (args.hasAgentCurrentText) {
    return "thinking";
  }

  if (args.pendingConversationWorkerId) {
    return "connecting";
  }

  return null;
}

export function shouldShowDirectControlPendingAssistant(args: Parameters<typeof resolveDirectControlPendingAssistantStatus>[0]) {
  return resolveDirectControlPendingAssistantStatus(args) !== null;
}

export function isMutationPendingForSelectedRun(args: {
  isPending: boolean;
  mutationRunId: string | null | undefined;
  selectedRunId: string | null | undefined;
}) {
  return Boolean(
    args.isPending
      && args.selectedRunId
      && args.mutationRunId === args.selectedRunId,
  );
}

export function resolvePendingConversationWorkerId(args: {
  isPending: boolean;
  mutationRunId: string | null | undefined;
  selectedRunId: string | null | undefined;
  isImplementationConversation: boolean;
  selectedWorkerIds: readonly string[];
}) {
  if (args.isImplementationConversation) {
    return null;
  }

  if (!isMutationPendingForSelectedRun({
    isPending: args.isPending,
    mutationRunId: args.mutationRunId,
    selectedRunId: args.selectedRunId,
  })) {
    return null;
  }

  return args.selectedWorkerIds[0] ?? null;
}
