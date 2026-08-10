/**
 * The preambles OmniHarness prepends to a worker prompt.
 *
 * Codex reports its ACP session title as the verbatim prompt text it was sent
 * rather than a summary of it, so every one of these arrives back as a
 * candidate conversation title. They live here, once, so a prompt builder
 * cannot introduce a preamble the title guard has never heard of — that is
 * exactly how the transcript-replay preamble ended up as a 4KB sidebar title.
 */

export const DIRECT_WORKER_INSTRUCTION = [
  "OmniHarness direct-control instruction:",
  "Do not implement, edit files, run mutating commands, or otherwise change the workspace unless the user's latest message explicitly asks you to implement, edit, modify, fix, create, delete, run, apply, or change something.",
  "If the user's latest message asks how you would do something, asks for suggestions, asks for advice, asks for a plan, or says not to do anything, answer with analysis or a plan only.",
  "If the user's intent is ambiguous, ask a clarifying question before making workspace changes.",
].join("\n");

export const TRANSCRIPT_REPLAY_INSTRUCTION = [
  "You are continuing an OmniHarness direct-control worker turn after the provider ACP session could not be resumed.",
  "The authoritative conversation transcript captured by OmniHarness is below. Treat it as prior context, do not repeat completed work, and continue from the latest useful point.",
].join("\n");

export const HARNESS_PROMPT_PREAMBLES: readonly string[] = [
  DIRECT_WORKER_INSTRUCTION,
  TRANSCRIPT_REPLAY_INSTRUCTION,
];
