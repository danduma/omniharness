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

function isSmallSingleFileConfigEdit(item: ParsedPlan["items"][number], details: string) {
  const text = `${item.title}\n${details}`;
  const configFilePattern =
    /(?:^|[\s`"'(])((?:package|tsconfig|components)\.json|(?:vite|vitest|next|nuxt|playwright|eslint|prettier|tailwind|postcss)\.config\.[a-z0-9.]+)/gi;
  const configFileMatches = Array.from(
    text.matchAll(configFilePattern),
  ).map((match) => match[1].toLowerCase());
  const configFiles = new Set(configFileMatches);

  return configFiles.size === 1 && /\b(add|remove|rename|update|set|change|enable|disable)\b/i.test(text);
}

function hasConcreteChecklistSupport(item: ParsedPlan["items"][number]) {
  const details = item.details?.trim() ?? "";
  if (details.length === 0) {
    return false;
  }

  return /(^|\n)\s*- /m.test(details) && (
    /(^|\n)\s*-?\s*verify:/im.test(details) || isSmallSingleFileConfigEdit(item, details)
  );
}

export async function assessPlanReadiness(plan: ParsedPlan): Promise<PlanReadinessAssessment> {
  const questions: string[] = [];
  const gaps: string[] = [];

  if (plan.items.length === 0) {
    gaps.push("No checklist items were found in the plan.");
    questions.push("Please add concrete checklist items with observable outcomes.");
  }

  for (const item of plan.items) {
    if (looksVague(item.title) && !hasConcreteChecklistSupport(item)) {
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
