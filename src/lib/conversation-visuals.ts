export type ConversationVisualKind = "direct" | "commit";

type ConversationVisualRun = {
  id: string;
  mode?: string | null;
  title?: string | null;
};

export function isCommitConversation(run: ConversationVisualRun) {
  return run.mode === "commit";
}

export function getConversationVisualKind(run: ConversationVisualRun): ConversationVisualKind {
  return isCommitConversation(run) ? "commit" : "direct";
}
