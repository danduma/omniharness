export type ConversationVisualKind = "supervisor" | "direct" | "commit";

export const AUTO_COMMIT_PROJECT_PROMPT = "Group all currently modified files into logical git commits. Do not run tests. Do not modify files or do anything else. Only inspect the modified files as needed, create commits, and stop.";

type ConversationVisualRun = {
  id: string;
  mode?: string | null;
  title?: string | null;
};

type ConversationVisualMessage = {
  runId: string;
  role?: string | null;
  kind?: string | null;
  content?: string | null;
  createdAt?: string | null;
};

function getInitialUserMessage(runId: string, messages: ConversationVisualMessage[]) {
  return messages
    .filter((message) => (
      message.runId === runId
      && message.role === "user"
      && message.content?.trim()
    ))
    .sort((left, right) => (left.createdAt ?? "").localeCompare(right.createdAt ?? ""))[0] ?? null;
}

export function isCommitConversation(run: ConversationVisualRun, messages: ConversationVisualMessage[] = []) {
  if (run.mode !== "direct") {
    return false;
  }

  const initialMessage = getInitialUserMessage(run.id, messages);
  if (initialMessage?.content?.trim() === AUTO_COMMIT_PROJECT_PROMPT) {
    return true;
  }

  return /\bcommit\b/i.test(run.title ?? "");
}

export function getConversationVisualKind(run: ConversationVisualRun, messages: ConversationVisualMessage[] = []): ConversationVisualKind {
  if (isCommitConversation(run, messages)) {
    return "commit";
  }

  return run.mode === "direct" ? "direct" : "supervisor";
}
