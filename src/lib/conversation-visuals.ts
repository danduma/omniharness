import { MANUAL_COMMIT_PROJECT_PROMPT, MANUAL_COMMIT_PROJECT_PUSH_PROMPT } from "@/lib/commit-workflow";

export type ConversationVisualKind = "supervisor" | "direct" | "commit";

export const AUTO_COMMIT_PROJECT_PROMPT = MANUAL_COMMIT_PROJECT_PROMPT;
export const MANUAL_COMMIT_PROJECT_PROMPTS = new Set([
  MANUAL_COMMIT_PROJECT_PROMPT,
  MANUAL_COMMIT_PROJECT_PUSH_PROMPT,
]);

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
  if (MANUAL_COMMIT_PROJECT_PROMPTS.has(initialMessage?.content?.trim() ?? "")) {
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
