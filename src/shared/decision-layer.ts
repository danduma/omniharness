// Decision layer: a fast, cheap model (default TypeSafe AI's Jev via Vercel
// AI Gateway) answering typed questions so the heavy supervisor model is not
// spent on triage. See docs/superpowers/plans/2026-10-07-office-view-and-vercel-orchestration-research.md (Part B).

export const DECISION_SETTING_KEYS = {
  /** Global kill switch. Anything other than "true" disables every decision point. */
  enabled: "DECISION_LAYER_ENABLED",
  model: "DECISION_MODEL",
  /** Optional stronger model re-asked when an answer is uncertain (AI Gateway decision fallback). */
  escalationModel: "DECISION_ESCALATION_MODEL",
  /** Ask AI Gateway to route only to zero-data-retention providers. */
  zeroDataRetention: "DECISION_ZERO_DATA_RETENTION",
  /** JSON array of enabled decision point ids. Missing means none. Enabled points run in shadow mode. */
  points: "DECISION_POINTS",
  /**
   * JSON array of enabled points allowed to act on their answer, within that
   * point's guardrails. Missing means none: every point stays shadow-only.
   */
  actingPoints: "DECISION_ACTING_POINTS",
  /** Fast text model for short generation jobs (titles). Empty means the text lane is off. */
  textModel: "DECISION_TEXT_MODEL",
  /** JSON array of text tasks allowed to use the fast text model. Missing means none. */
  textTasks: "DECISION_TEXT_TASKS",
} as const;

/**
 * Secrets that must only come from the runner's environment. The settings
 * API refuses them so they never reach `sqlite.db`, and runtime settings
 * hydration ignores any stray row with these keys.
 */
export const ENV_ONLY_SECRET_KEYS = ["AI_GATEWAY_API_KEY"] as const;

export const DEFAULT_DECISION_MODEL = "typesafe-ai/jev";

/**
 * `workflow_triage` (specialist orchestration): classify a new task's
 * complexity/risk and recommend a token profile. Advisory only — it can
 * never pick a model, a stage plan, or override a user-selected profile.
 */
export const DECISION_POINT_IDS = ["supervisor_wake", "worker_activity", "workflow_triage"] as const;
export type DecisionPointId = (typeof DECISION_POINT_IDS)[number];

/** Short text-generation jobs the fast text model may take over. */
export const DECISION_TEXT_TASK_IDS = ["conversation_title"] as const;
export type DecisionTextTaskId = (typeof DECISION_TEXT_TASK_IDS)[number];

/** Anything the decision layer reports events for: a decision point or a text task. */
export type DecisionTarget = DecisionPointId | DecisionTextTaskId;

export function parseDecisionTextTasks(value: string | null | undefined): DecisionTextTaskId[] {
  if (!value?.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is DecisionTextTaskId => (DECISION_TEXT_TASK_IDS as readonly string[]).includes(entry as string));
  } catch {
    return [];
  }
}

export function isEnvOnlySecretKey(key: string) {
  return (ENV_ONLY_SECRET_KEYS as readonly string[]).includes(key);
}

export function parseDecisionPoints(value: string | null | undefined): DecisionPointId[] {
  if (!value?.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is DecisionPointId => (DECISION_POINT_IDS as readonly string[]).includes(entry as string));
  } catch {
    return [];
  }
}

/** Status the settings API reports to clients; never carries the key itself. */
export type DecisionLayerStatus = {
  gatewayKeyConfigured: boolean;
  gatewayKeySource: "env" | "none";
};
