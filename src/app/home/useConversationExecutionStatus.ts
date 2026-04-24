import { useMemo } from "react";
import type { AgentSnapshot, ExecutionEventRecord, RunRecord } from "./types";
import { describeAgentActivity, parseExecutionEventDetails, summarizeExecutionEvent } from "./utils";

interface UseConversationExecutionStatusProps {
  selectedRun: RunRecord | null;
  latestExecutionEvent: ExecutionEventRecord | null;
  erroredAgent: AgentSnapshot | null;
  pendingPermissionAgent: AgentSnapshot | null;
  hasStuckWorker: boolean;
  latestStuckEvent: ExecutionEventRecord | null;
  showRecoverableRunningState: boolean;
  latestWaitEvent: ExecutionEventRecord | null;
  activeConversationAgents: AgentSnapshot[];
  liveThoughts: Array<{ agentName: string; snippet: string; isLive: boolean }>;
  conversationAgents: AgentSnapshot[];
  recentExecutionEvents: ExecutionEventRecord[];
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
  activeConversationAgents,
  liveThoughts,
  conversationAgents,
  recentExecutionEvents,
}: UseConversationExecutionStatusProps) {
  const liveExecutionStatus = useMemo(() => {
    if (selectedRun?.status === "failed") {
      return {
        label: "Bridge error",
        detail: selectedRun.lastError || (latestExecutionEvent ? summarizeExecutionEvent(latestExecutionEvent) : "The run failed."),
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
        detail: summarizeExecutionEvent(latestWaitEvent),
        tone: "muted" as const,
      };
    }

    if (activeConversationAgents.some((agent) => agent.state === "working" || Boolean(agent.currentText?.trim()))) {
      return {
        label: "Thinking",
        detail: liveThoughts[0]?.snippet || "The worker is actively reasoning.",
        tone: "active" as const,
      };
    }

    if (selectedRun?.status === "done") {
      return {
        label: "Completed",
        detail: latestExecutionEvent ? summarizeExecutionEvent(latestExecutionEvent) : "The run finished.",
        tone: "muted" as const,
      };
    }

    return {
      label: "Thinking",
      detail: latestExecutionEvent ? summarizeExecutionEvent(latestExecutionEvent) : "The supervisor is still checking the run.",
      tone: "active" as const,
    };
  }, [activeConversationAgents, erroredAgent, hasStuckWorker, latestExecutionEvent, latestStuckEvent, latestWaitEvent, liveThoughts, pendingPermissionAgent, selectedRun, showRecoverableRunningState]);
  const executionDetailLines = useMemo(() => {
    const lines: Array<{ text: string; createdAt?: string }> = [];

    const pushLine = (text: string, createdAt?: string) => {
      if (!text || lines.some((line) => line.text === text)) {
        return;
      }
      lines.push({ text, createdAt });
    };

    if (conversationAgents.length === 0 && selectedRun?.status === "running" && !showRecoverableRunningState) {
      pushLine("Connecting to ACP bridge");
    }

    for (const agent of conversationAgents) {
      pushLine(describeAgentActivity(agent));
    }

    for (const event of recentExecutionEvents) {
      pushLine(summarizeExecutionEvent(event), event.createdAt);
    }

    if (lines.length === 0 && selectedRun?.status === "failed" && selectedRun.lastError) {
      pushLine(selectedRun.lastError);
    }

    return lines.slice(0, 6);
  }, [conversationAgents, recentExecutionEvents, selectedRun, showRecoverableRunningState]);

  return { liveExecutionStatus, executionDetailLines };
}
