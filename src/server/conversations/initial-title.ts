/**
 * The title a conversation carries until the agent reports one of its own.
 *
 * Shared with the leaked-title repair in `agent-session-title`, which has to
 * rebuild this exact value: a run whose title was overwritten by an echoed
 * prompt has to fall back to what it would have shown had the echo never
 * arrived.
 */
export function buildInitialConversationTitle(command: string) {
  const firstLine = command
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .find(Boolean);

  if (!firstLine) {
    return "New conversation";
  }

  const maxLength = 80;
  if (firstLine.length <= maxLength) {
    return firstLine;
  }

  return `${firstLine.slice(0, maxLength - 3).trimEnd()}...`;
}
