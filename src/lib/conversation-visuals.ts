export type ConversationVisualKind = "supervisor" | "direct" | "commit";

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
