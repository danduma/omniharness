import { omniRequestIsPlanReady } from "@/lib/plan-path";

// Persisted run modes (stored in `runs.mode`). "omni" is NOT here — an Omni
// request is stored as an `implementation`-mode run whose `phase` distinguishes
// the planning vs implementing stage.
export const CONVERSATION_MODES = ["implementation", "planning", "direct", "commit"] as const;

export type ConversationMode = (typeof CONVERSATION_MODES)[number];

// Phase for an implementation-mode (Omni) run. null = legacy / non-phased run.
export type RunPhase = "planning" | "implementing" | null;

// Modes a client (UI / CLI / ACP) may request. "omni" is a request-time alias
// resolved by `resolveOmniRequest` into a stored mode + phase.
export const REQUESTED_CONVERSATION_MODES = ["omni", ...CONVERSATION_MODES] as const;

export type RequestedConversationMode = (typeof REQUESTED_CONVERSATION_MODES)[number];

export function normalizeConversationMode(value: unknown): ConversationMode {
  if (value === "omni") return "implementation";
  return typeof value === "string" && CONVERSATION_MODES.includes(value as ConversationMode)
    ? (value as ConversationMode)
    : "implementation";
}

export function normalizeRequestedConversationMode(value: unknown): RequestedConversationMode {
  return typeof value === "string" && REQUESTED_CONVERSATION_MODES.includes(value as RequestedConversationMode)
    ? (value as RequestedConversationMode)
    : "omni";
}

/**
 * Resolve a client-requested mode + command into the stored run mode and phase.
 *
 * - `omni` + plan-ready command  → implementation run, implementing phase
 * - `omni` + free-text request   → implementation run, planning phase
 * - `implementation` (explicit)  → implementation run, implementing phase
 * - `planning` / `direct` / `commit` → legacy mode-based behavior, no phase
 */
export function resolveOmniRequest(value: unknown, command: string): { runMode: ConversationMode; phase: RunPhase } {
  const requested = normalizeRequestedConversationMode(value);
  if (requested === "omni") {
    return omniRequestIsPlanReady(command)
      ? { runMode: "implementation", phase: "implementing" }
      : { runMode: "implementation", phase: "planning" };
  }
  if (requested === "implementation") {
    return { runMode: "implementation", phase: "implementing" };
  }
  return { runMode: requested, phase: null };
}

export function isDirectConversationMode(mode: ConversationMode) {
  return mode === "planning" || mode === "direct" || mode === "commit";
}
