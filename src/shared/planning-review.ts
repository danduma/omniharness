import { z } from "zod";

export const PLANNING_REVIEW_AGENT_SELECTION_SETTING = "PLANNING_REVIEW_AGENT_SELECTION";
export const PLANNING_REVIEW_ROUNDS_SETTING = "PLANNING_REVIEW_ROUNDS";

export const ALLOWED_PLANNING_REVIEW_AGENTS = [
  "auto",
  "same",
  "codex",
  "claude",
  "gemini",
  "opencode",
] as const;

export type PlanningReviewAgentSelection = (typeof ALLOWED_PLANNING_REVIEW_AGENTS)[number];

export const PlanningReviewPreferencesSchema = z.object({
  agentSelection: z.enum(ALLOWED_PLANNING_REVIEW_AGENTS).default("auto"),
  rounds: z.number().int().min(1).max(5).default(1),
});

export type PlanningReviewPreferences = z.infer<typeof PlanningReviewPreferencesSchema>;

export function parsePlanningReviewPreferences(payload: unknown): PlanningReviewPreferences {
  const result = PlanningReviewPreferencesSchema.safeParse(payload);
  if (result.success) {
    return result.data;
  }
  return {
    agentSelection: "auto",
    rounds: 1,
  };
}

export function normalizePlanningReviewAgentSelection(value: string | null | undefined): PlanningReviewAgentSelection {
  if (value && (ALLOWED_PLANNING_REVIEW_AGENTS as readonly string[]).includes(value)) {
    return value as PlanningReviewAgentSelection;
  }
  return "auto";
}

export function normalizePlanningReviewRounds(value: string | number | null | undefined): number {
  const num = typeof value === "string" ? parseInt(value, 10) : typeof value === "number" ? value : 1;
  if (isNaN(num) || num < 1) return 1;
  if (num > 5) return 5;
  return num;
}
