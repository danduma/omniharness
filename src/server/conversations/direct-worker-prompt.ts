import { DIRECT_WORKER_INSTRUCTION } from "@/server/conversations/harness-prompt-preambles";

export function buildDirectWorkerPrompt(userMessage: string) {
  return `${DIRECT_WORKER_INSTRUCTION}\n\nUser message:\n${userMessage}`;
}
