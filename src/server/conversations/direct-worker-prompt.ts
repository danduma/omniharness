import { DIRECT_WORKER_INSTRUCTION, STEER_INSTRUCTION } from "@/server/conversations/harness-prompt-preambles";

export function buildDirectWorkerPrompt(userMessage: string) {
  return `${DIRECT_WORKER_INSTRUCTION}\n\nUser message:\n${userMessage}`;
}

/**
 * A steer reaches the worker as a fresh prompt after its turn was cancelled, so
 * it carries a notice that the interruption was the harness, not the user.
 */
export function buildSteerWorkerPrompt(userMessage: string, options: { direct: boolean }) {
  const body = options.direct ? buildDirectWorkerPrompt(userMessage) : `User message:\n${userMessage}`;
  return `${STEER_INSTRUCTION}\n\n${body}`;
}
