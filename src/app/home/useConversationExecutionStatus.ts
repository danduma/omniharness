import { useMemo } from "react";
import { t } from "@/lib/i18n";
import type { AgentSnapshot, ExecutionEventRecord, MessageRecord, RunRecord } from "./types";
import { getRunDurationLabel, parseExecutionEventDetails, summarizeExecutionEvent } from "./utils";

interface UseConversationExecutionStatusProps {
  selectedRun: RunRecord | null;
  latestExecutionEvent: ExecutionEventRecord | null;
  erroredAgent: AgentSnapshot | null;
  pendingPermissionAgent: AgentSnapshot | null;
  pendingElicitationAgent?: AgentSnapshot | null;
  hasStuckWorker: boolean;
  latestStuckEvent: ExecutionEventRecord | null;
  showRecoverableRunningState: boolean;
  latestWaitEvent: ExecutionEventRecord | null;
  latestPromptDeferredEvent: ExecutionEventRecord | null;
  completionEvent: ExecutionEventRecord | null;
  queuedMessageCount: number;
  activeConversationAgents: AgentSnapshot[];
  liveThoughts: Array<{ agentName: string; text: string; snippet: string; isLive: boolean }>;
  awaitingUserQuestionMessage: MessageRecord | null;
  isSelectedConversationLoaded: boolean;
}

function pendingPermissionEntryCount(agent: AgentSnapshot | null | undefined) {
  return agent?.outputEntries?.filter((entry) => (
    entry.type === "permission"
    && !["approved", "cancelled", "canceled", "completed", "denied", "failed", "rejected"].includes(
      (entry.status ?? "pending").trim().toLowerCase(),
    )
  )).length ?? 0;
}

function pendingPermissionCount(agent: AgentSnapshot | null | undefined) {
  const liveCount = agent?.pendingPermissions?.length ?? 0;
  return liveCount > 0 ? liveCount : pendingPermissionEntryCount(agent);
}

function pendingElicitationEntryCount(agent: AgentSnapshot | null | undefined) {
  return agent?.outputEntries?.filter((entry) => (
    entry.type === "elicitation"
    && !["answered", "cancelled", "canceled", "completed", "declined", "failed", "rejected"].includes(
      (entry.status ?? "pending").trim().toLowerCase(),
    )
  )).length ?? 0;
}

function pendingElicitationCount(agent: AgentSnapshot | null | undefined) {
  const liveCount = agent?.pendingElicitations?.length ?? 0;
  return liveCount > 0 ? liveCount : pendingElicitationEntryCount(agent);
}

export function useConversationExecutionStatus({
  selectedRun,
  latestExecutionEvent,
  erroredAgent,
  pendingPermissionAgent,
  pendingElicitationAgent = null,
  hasStuckWorker,
  latestStuckEvent,
  showRecoverableRunningState,
  latestWaitEvent,
  latestPromptDeferredEvent,
  completionEvent,
  queuedMessageCount,
  activeConversationAgents,
  liveThoughts,
  awaitingUserQuestionMessage,
  isSelectedConversationLoaded,
}: UseConversationExecutionStatusProps) {
  const liveExecutionStatus = useMemo(() => {
    const durationLabel = getRunDurationLabel(selectedRun, completionEvent?.createdAt);
    const permissionAgent = pendingPermissionAgent
      ?? activeConversationAgents.find((agent) => pendingPermissionEntryCount(agent) > 0)
      ?? null;
    const elicitationAgent = pendingElicitationAgent
      ?? activeConversationAgents.find((agent) => pendingElicitationEntryCount(agent) > 0)
      ?? null;

    if (selectedRun && !isSelectedConversationLoaded) {
      return {
        label: "Loading",
        detail: "Loading the latest conversation state…",
        tone: "active" as const,
      };
    }

    if (selectedRun?.status === "failed") {
      return {
        label: "Runtime error",
        detail: [durationLabel, selectedRun.lastError || (latestExecutionEvent ? summarizeExecutionEvent(latestExecutionEvent) : "The run failed.")]
          .filter(Boolean)
          .join(". "),
        tone: "error" as const,
      };
    }

    if (erroredAgent) {
      return {
        label: "Runtime error",
        detail: erroredAgent.lastError || erroredAgent.stopReason || "A worker reported an error.",
        tone: "error" as const,
      };
    }

    if (permissionAgent) {
      const requestCount = pendingPermissionCount(permissionAgent);
      return {
        label: "Awaiting permission",
        detail: `${permissionAgent.name} is waiting on ${requestCount} permission ${requestCount === 1 ? "decision" : "decisions"}.`,
        tone: "warning" as const,
      };
    }

    if (elicitationAgent) {
      const requestCount = pendingElicitationCount(elicitationAgent);
      return {
        label: t("conversation.status.awaitingInput"),
        detail: t("conversation.status.workerAwaitingAnswer", { worker: elicitationAgent.name, count: requestCount }),
        tone: "warning" as const,
      };
    }

    if (selectedRun?.status === "awaiting_user") {
      if (
        (selectedRun.mode === "direct" || selectedRun.mode === "commit")
        && latestExecutionEvent?.eventType === "direct_worker_awaiting_user"
      ) {
        return {
          label: t("conversation.status.awaitingInput"),
          detail: t("conversation.status.awaitingWorkerInput"),
          tone: "warning" as const,
        };
      }
      if (!awaitingUserQuestionMessage) {
        return {
          label: "Loading",
          detail: "Loading Omni's question…",
          tone: "active" as const,
        };
      }
      return {
        label: t("conversation.status.awaitingInput"),
        detail: "Omni asked for clarification before continuing.",
        tone: "warning" as const,
      };
    }

    if (selectedRun?.status === "needs_recovery") {
      return {
        label: t("recovery.notice.title.needsRecovery"),
        detail: [durationLabel, selectedRun.lastError || (latestExecutionEvent ? summarizeExecutionEvent(latestExecutionEvent) : t("recovery.notice.description.needsRecovery"))]
          .filter(Boolean)
          .join(". "),
        tone: "warning" as const,
      };
    }

    if (selectedRun?.status === "cancelled") {
      return {
        label: "Stopped",
        detail: [durationLabel, latestExecutionEvent ? summarizeExecutionEvent(latestExecutionEvent) : "The run was stopped by the user."]
          .filter(Boolean)
          .join(". "),
        tone: "muted" as const,
      };
    }

    if (hasStuckWorker) {
      return {
        label: "Stuck",
        detail: latestStuckEvent
          ? summarizeExecutionEvent(latestStuckEvent)
          : "The worker stopped making progress. Resume the worker to continue the turn.",
        tone: "warning" as const,
      };
    }

    if (showRecoverableRunningState) {
      return {
        label: "Needs recovery",
        detail: "This conversation is still marked running, but nothing active is attached to it. Reconnect to the existing worker session to continue.",
        tone: "warning" as const,
      };
    }

    if (queuedMessageCount > 0) {
      return {
        label: queuedMessageCount === 1 ? "Queued follow-up" : "Queued follow-ups",
        detail: `${queuedMessageCount} user ${queuedMessageCount === 1 ? "message is" : "messages are"} waiting for delivery.`,
        tone: "warning" as const,
      };
    }

    if (selectedRun?.status === "done") {
      const completionSummary = completionEvent
        ? summarizeExecutionEvent(completionEvent).replace(/^Completed:?\s*/i, "").trim()
        : "";
      return {
        label: "Completed",
        detail: durationLabel
          ? `${durationLabel}${completionSummary ? `: ${completionSummary}` : "."}`
          : latestExecutionEvent ? summarizeExecutionEvent(latestExecutionEvent) : "The run finished.",
        tone: "muted" as const,
      };
    }

    if (latestPromptDeferredEvent && latestPromptDeferredEvent.id === latestExecutionEvent?.id) {
      return {
        label: "Retry queued",
        detail: [durationLabel, summarizeExecutionEvent(latestPromptDeferredEvent)].filter(Boolean).join(". "),
        tone: "active" as const,
      };
    }

    if (latestWaitEvent && !activeConversationAgents.some((agent) => agent.state === "working")) {
      const details = parseExecutionEventDetails(latestWaitEvent.details);
      const seconds = typeof details.seconds === "number" ? details.seconds : null;
      return {
        label: seconds ? `Waiting ${seconds}s` : "Waiting",
        detail: [durationLabel, summarizeExecutionEvent(latestWaitEvent)].filter(Boolean).join(". "),
        tone: "muted" as const,
      };
    }

    if (activeConversationAgents.some((agent) => agent.state === "working" || Boolean(agent.currentText?.trim()))) {
      return {
        label: "Working",
        detail: [durationLabel, liveThoughts[0]?.snippet || "The worker is active."].filter(Boolean).join(". "),
        tone: "active" as const,
      };
    }

    return {
      label: "Working",
      detail: [durationLabel, latestExecutionEvent ? summarizeExecutionEvent(latestExecutionEvent) : "Omni is still checking the run."].filter(Boolean).join(". "),
      tone: "active" as const,
    };
  }, [activeConversationAgents, awaitingUserQuestionMessage, completionEvent, erroredAgent, hasStuckWorker, isSelectedConversationLoaded, latestExecutionEvent, latestPromptDeferredEvent, latestStuckEvent, latestWaitEvent, liveThoughts, pendingElicitationAgent, pendingPermissionAgent, queuedMessageCount, selectedRun, showRecoverableRunningState]);
  return { liveExecutionStatus };
}
