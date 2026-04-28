import { useMemo } from "react";
import type { AgentSnapshot, ExecutionEventRecord, RunRecord } from "./types";
import { getRunDurationLabel, parseExecutionEventDetails, summarizeExecutionEvent } from "./utils";

interface UseConversationExecutionStatusProps {
  selectedRun: RunRecord | null;
  latestExecutionEvent: ExecutionEventRecord | null;
  erroredAgent: AgentSnapshot | null;
  pendingPermissionAgent: AgentSnapshot | null;
  hasStuckWorker: boolean;
  latestStuckEvent: ExecutionEventRecord | null;
  showRecoverableRunningState: boolean;
  latestWaitEvent: ExecutionEventRecord | null;
  completionEvent: ExecutionEventRecord | null;
  activeConversationAgents: AgentSnapshot[];
  liveThoughts: Array<{ agentName: string; snippet: string; isLive: boolean }>;
}

export function useConversationExecutionStatus({
  selectedRun,
  latestExecutionEvent,
  erroredAgent,
  pendingPermissionAgent,
  hasStuckWorker,
  latestStuckEvent,
  showRecoverableRunningState,
  latestWaitEvent,
  completionEvent,
  activeConversationAgents,
  liveThoughts,
}: UseConversationExecutionStatusProps) {
  const liveExecutionStatus = useMemo(() => {
    const durationLabel = getRunDurationLabel(selectedRun, completionEvent?.createdAt);

    if (selectedRun?.status === "failed") {
      return {
        label: "Bridge error",
        detail: [durationLabel, selectedRun.lastError || (latestExecutionEvent ? summarizeExecutionEvent(latestExecutionEvent) : "The run failed.")]
          .filter(Boolean)
          .join(". "),
        tone: "error" as const,
      };
    }

    if (erroredAgent) {
      return {
        label: "Bridge error",
        detail: erroredAgent.lastError || erroredAgent.stopReason || "A worker reported an error.",
        tone: "error" as const,
      };
    }

    if (pendingPermissionAgent) {
      const requestCount = pendingPermissionAgent.pendingPermissions?.length ?? 0;
      return {
        label: "Awaiting permission",
        detail: `${pendingPermissionAgent.name} is waiting on ${requestCount} permission ${requestCount === 1 ? "decision" : "decisions"}.`,
        tone: "warning" as const,
      };
    }

    if (selectedRun?.status === "awaiting_user") {
      return {
        label: "Awaiting input",
        detail: "The supervisor asked for clarification before continuing.",
        tone: "warning" as const,
      };
    }

    if (hasStuckWorker) {
      return {
        label: "Stuck",
        detail: latestStuckEvent
          ? summarizeExecutionEvent(latestStuckEvent)
          : "The worker stopped making progress. Retry the latest message to restart the turn.",
        tone: "warning" as const,
      };
    }

    if (showRecoverableRunningState) {
      return {
        label: "Needs recovery",
        detail: "This conversation is still marked running, but nothing active is attached to it. Retry the latest message to unstick it.",
        tone: "warning" as const,
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
        label: "Thinking",
        detail: [durationLabel, liveThoughts[0]?.snippet || "The worker is actively reasoning."].filter(Boolean).join(". "),
        tone: "active" as const,
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

    return {
      label: "Thinking",
      detail: [durationLabel, latestExecutionEvent ? summarizeExecutionEvent(latestExecutionEvent) : "The supervisor is still checking the run."].filter(Boolean).join(". "),
      tone: "active" as const,
    };
  }, [activeConversationAgents, completionEvent, erroredAgent, hasStuckWorker, latestExecutionEvent, latestStuckEvent, latestWaitEvent, liveThoughts, pendingPermissionAgent, selectedRun, showRecoverableRunningState]);
  return { liveExecutionStatus };
}
