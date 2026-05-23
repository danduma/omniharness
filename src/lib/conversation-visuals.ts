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

export function isCommitConversation(run: ConversationVisualRun) {
  return run.mode === "commit";
}

export function getConversationVisualKind(run: ConversationVisualRun): ConversationVisualKind {
  if (isCommitConversation(run)) {
    return "commit";
  }

  return run.mode === "direct" ? "direct" : "supervisor";
}
