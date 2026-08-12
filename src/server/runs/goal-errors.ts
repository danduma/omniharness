const MAX_GOAL_ERROR_MESSAGE_LENGTH = 1_000;

export function redactGoalErrorMessage(error: unknown) {
  let message = error instanceof Error ? error.message : String(error);
  message = message
    .replace(/(https?:\/\/)([^/\s:@]+):([^@\s/]+)@/giu, "$1[redacted]:[redacted]@")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/giu, "Bearer [redacted]")
    .replace(/\b(?:sk|pk)[-_][A-Za-z0-9_-]{8,}\b/giu, "[redacted]")
    .replace(/(["']?(?:api[-_]?key|access[-_]?token|refresh[-_]?token|token|password|secret)["']?\s*[:=]\s*["']?)([^"',\s}]+)/giu, "$1[redacted]");
  if (message.length <= MAX_GOAL_ERROR_MESSAGE_LENGTH) return message;
  return `${message.slice(0, MAX_GOAL_ERROR_MESSAGE_LENGTH - 1)}…`;
}
