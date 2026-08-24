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
  "Treat a user's request for an outcome as authorization for the normal, safe, in-scope steps required to complete it, including resolving routine blockers such as fetching and rebasing before an authorized push.",
  "Do not make unrelated workspace changes, perform destructive operations, or materially expand the requested scope without explicit authorization.",
  "If the user's latest message asks only for analysis, suggestions, advice, or a plan, or says not to make changes, answer without changing the workspace.",
  "Ask a clarifying question only when the user's intent is genuinely ambiguous or a required choice would materially change the result.",
].join("\n");

export const TRANSCRIPT_REPLAY_INSTRUCTION = [
  "You are continuing an OmniHarness direct-control worker turn after the provider ACP session could not be resumed.",
  "The authoritative conversation transcript captured by OmniHarness is below. Treat it as prior context, do not repeat completed work, and continue from the latest useful point.",
].join("\n");

export const HARNESS_PROMPT_PREAMBLES: readonly string[] = [
  DIRECT_WORKER_INSTRUCTION,
  TRANSCRIPT_REPLAY_INSTRUCTION,
];
