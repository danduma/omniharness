import type { AppErrorDescriptor } from "@/lib/app-errors";

type RunLike = {
  id: string;
  status: string;
  title?: string | null;
};

type MessageLike = {
  runId: string;
  role: string;
  kind?: string | null;
  content: string;
};

const AWAITING_USER_MESSAGE_KINDS = new Set(["clarification", "implementation_confirmation"]);

function hasAwaitingUserQuestion(messages: MessageLike[], runId: string) {
  return messages.some((message) => (
    message.runId === runId
    && message.role === "supervisor"
    && AWAITING_USER_MESSAGE_KINDS.has(message.kind ?? "")
    && message.content.trim().length > 0
  ));
}

export function buildAwaitingUserQuestionInvariantErrors({
  runs,
  messages,
  selectedRunId,
}: {
  runs: RunLike[];
  messages: MessageLike[];
  selectedRunId?: string | null;
}): AppErrorDescriptor[] {
  const runId = selectedRunId?.trim();
  if (!runId) {
    return [];
  }

  const run = runs.find((candidate) => candidate.id === runId);
  if (!run || run.status !== "awaiting_user" || hasAwaitingUserQuestion(messages, run.id)) {
    return [];
  }

  return [{
    message: `Conversation ${run.title || run.id} is awaiting user input but no supervisor question was included in the snapshot.`,
    source: "Lifecycle",
    action: "Load conversation state",
    suggestion: "Refresh the conversation. If this persists, inspect /api/events/log for the missing clarification or confirmation event.",
    details: [`runId: ${run.id}`],
  }];
}
