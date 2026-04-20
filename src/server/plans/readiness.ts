import type { ParsedPlan } from "./parser";

export interface PlanReadinessAssessment {
  ready: boolean;
  questions: string[];
  gaps: string[];
}

const VAGUE_PREFIXES = [
  "improve ",
  "fix ",
  "update ",
  "make ",
  "enhance ",
  "optimize ",
  "refactor ",
  "support ",
];

function looksVague(title: string) {
  const lower = title.trim().toLowerCase();
  return VAGUE_PREFIXES.some((prefix) => lower.startsWith(prefix)) && lower.split(" ").length <= 3;
}

export async function assessPlanReadiness(plan: ParsedPlan): Promise<PlanReadinessAssessment> {
  const questions: string[] = [];
  const gaps: string[] = [];

  if (plan.items.length === 0) {
    gaps.push("No checklist items were found in the plan.");
    questions.push("Please add concrete checklist items with observable outcomes.");
  }

  for (const item of plan.items) {
    if (looksVague(item.title)) {
      gaps.push(`Item "${item.title}" is too vague.`);
      questions.push(`What concrete deliverable should satisfy "${item.title}"?`);
      questions.push(`How will we verify that "${item.title}" is complete?`);
    }
  }

  return {
    ready: questions.length === 0,
    questions: Array.from(new Set(questions)),
    gaps,
  };
}
