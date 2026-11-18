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
  "During authorized implementation of a referenced plan, keep the plan's original checklist current: mark an item complete only when its requirements and required verification are satisfied. Update checkboxes as work completes, not only in a final summary or appended execution notes. Keep partial work and failed gates unchecked, and record their remaining work and evidence in the plan. Respect explicit user overrides of the plan's procedure.",
].join("\n");

export const TRANSCRIPT_REPLAY_INSTRUCTION = [
  "You are continuing an OmniHarness direct-control worker turn after the provider ACP session could not be resumed.",
  "The authoritative conversation transcript captured by OmniHarness is below. Treat it as prior context, do not repeat completed work, and continue from the latest useful point.",
].join("\n");

/**
 * Prepended to a steer delivery. Steer is cancel-and-replace at the transport
 * level, so the provider shows the model an interruption marker on its previous
 * turn ("[Request interrupted by user]", a rejected tool call). Without this
 * notice the model reads that as the user cancelling or rejecting its work.
 */
export const STEER_INSTRUCTION = [
  "OmniHarness steer notice:",
  "The user sent the message below while you were still working, as a steer. They did not cancel, stop, or reject anything.",
  "Any interruption, cancellation, or rejected tool call on your previous turn was caused by OmniHarness delivering this message, not by the user. Do not treat it as the user declining a command or tool use.",
  "Treat the message as added guidance for the work in progress: continue the task, adjusted to it, unless the message itself tells you to stop or change course. Re-run any command that was cut off if it is still needed.",
].join("\n");

export const HARNESS_PROMPT_PREAMBLES: readonly string[] = [
  STEER_INSTRUCTION,
  DIRECT_WORKER_INSTRUCTION,
  TRANSCRIPT_REPLAY_INSTRUCTION,
];
