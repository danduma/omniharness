export const CONVERSATION_MODES = ["implementation", "planning", "direct"] as const;

export type ConversationMode = (typeof CONVERSATION_MODES)[number];

export function normalizeConversationMode(value: unknown): ConversationMode {
  return typeof value === "string" && CONVERSATION_MODES.includes(value as ConversationMode)
    ? (value as ConversationMode)
    : "implementation";
}

export function isDirectConversationMode(mode: ConversationMode) {
  return mode === "planning" || mode === "direct";
}
