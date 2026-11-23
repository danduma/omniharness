// Persisted run modes (stored in `runs.mode`). Every conversation is a direct
// conversation with a CLI agent; `commit` is the same thing started from a
// commit preset. Rows written by the removed supervisor modes
// ("implementation", "planning") read back as direct.
export const CONVERSATION_MODES = ["direct", "commit"] as const;

export type ConversationMode = (typeof CONVERSATION_MODES)[number];

export function normalizeConversationMode(value: unknown): ConversationMode {
  return value === "commit" ? "commit" : "direct";
}
