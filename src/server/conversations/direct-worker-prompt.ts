const DIRECT_WORKER_INSTRUCTION = [
  "OmniHarness direct-control instruction:",
  "Do not implement, edit files, run mutating commands, or otherwise change the workspace unless the user's latest message explicitly asks you to implement, edit, modify, fix, create, delete, run, apply, or change something.",
  "If the user's latest message asks how you would do something, asks for suggestions, asks for advice, asks for a plan, or says not to do anything, answer with analysis or a plan only.",
  "If the user's intent is ambiguous, ask a clarifying question before making workspace changes.",
].join("\n");

export function buildDirectWorkerPrompt(userMessage: string) {
  return `${DIRECT_WORKER_INSTRUCTION}\n\nUser message:\n${userMessage}`;
}
