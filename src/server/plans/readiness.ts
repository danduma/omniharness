import type { ParsedPlan, ParsedPlanItem } from "./parser";

export interface PlanStructuralFacts {
  itemCount: number;
  hasAcceptanceCriteria: boolean;
  hasGoalSection: boolean;
  itemsMissingDetails: number[];
  itemsMissingVerify: number[];
  itemsWithEmptyVerify: number[];
  itemsWithVagueTitle: number[];
  itemsWithStubTitle: number[];
}

export interface PlanReadinessAssessment {
  ready: boolean;
  questions: string[];
  gaps: string[];
  structure: PlanStructuralFacts;
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

const STUB_TITLES = new Set(["todo", "wip", "tbd", "fixme", "???", "?", "n/a"]);

function looksVague(title: string) {
  const lower = title.trim().toLowerCase();
  return VAGUE_PREFIXES.some((prefix) => lower.startsWith(prefix)) && lower.split(" ").length <= 3;
}

function looksStub(title: string) {
  const lower = title.trim().toLowerCase().replace(/[.:;,!]+$/, "");
  return STUB_TITLES.has(lower) || lower.length === 0;
}

function hasAnyDetails(item: ParsedPlanItem) {
  return Boolean(item.details && item.details.trim().length > 0);
}

function hasVerifyLine(item: ParsedPlanItem) {
  const details = item.details ?? "";
  return /(^|\n)\s*-?\s*verify:/im.test(details);
}

function hasEmptyVerifyLine(item: ParsedPlanItem) {
  const details = item.details ?? "";
  const match = details.match(/(^|\n)\s*-?\s*verify:\s*(.*)$/im);
  return Boolean(match && match[2].trim().length === 0);
}

function hasGlobalAcceptanceCriteria(plan: ParsedPlan) {
  const headerIndex = plan.markdown.search(/^##\s+Acceptance Criteria\s*$/im);
  if (headerIndex < 0) return false;
  const rest = plan.markdown.slice(headerIndex);
  return /(^|\n)\s*- /m.test(rest);
}

function hasGoalSection(plan: ParsedPlan) {
  return /^##?\s+Goal\b/im.test(plan.markdown) || /^\*\*Goal:\*\*/im.test(plan.markdown);
}

export function assessPlanStructure(plan: ParsedPlan): PlanStructuralFacts {
  const itemsMissingDetails: number[] = [];
  const itemsMissingVerify: number[] = [];
  const itemsWithEmptyVerify: number[] = [];
  const itemsWithVagueTitle: number[] = [];
  const itemsWithStubTitle: number[] = [];

  plan.items.forEach((item, index) => {
    if (!hasAnyDetails(item)) {
      itemsMissingDetails.push(index);
    }
    if (!hasVerifyLine(item)) {
      itemsMissingVerify.push(index);
    } else if (hasEmptyVerifyLine(item)) {
      itemsWithEmptyVerify.push(index);
    }
    if (looksVague(item.title)) {
      itemsWithVagueTitle.push(index);
    }
    if (looksStub(item.title)) {
      itemsWithStubTitle.push(index);
    }
  });

  return {
    itemCount: plan.items.length,
    hasAcceptanceCriteria: hasGlobalAcceptanceCriteria(plan),
    hasGoalSection: hasGoalSection(plan),
    itemsMissingDetails,
    itemsMissingVerify,
    itemsWithEmptyVerify,
    itemsWithVagueTitle,
    itemsWithStubTitle,
  };
}

export function structureHasBlockingGaps(structure: PlanStructuralFacts): boolean {
  if (structure.itemCount === 0) return true;
  if (structure.itemsWithStubTitle.length > 0) return true;

  const allItemsMissingDetails = structure.itemsMissingDetails.length === structure.itemCount;
  if (allItemsMissingDetails && !structure.hasAcceptanceCriteria) return true;

  if (structure.itemsWithVagueTitle.length > 0
    && !structure.hasAcceptanceCriteria
    && structure.itemsMissingVerify.length === structure.itemCount
    && structure.itemsMissingDetails.length === structure.itemCount) {
    return true;
  }

  return false;
}

export function describeStructuralGaps(plan: ParsedPlan, structure: PlanStructuralFacts): string[] {
  const gaps: string[] = [];

  if (structure.itemCount === 0) {
    gaps.push("No checklist items were found in the plan.");
  }

  for (const index of structure.itemsWithStubTitle) {
    const item = plan.items[index];
    if (item) {
      gaps.push(`Item "${item.title || "(empty)"}" is a stub.`);
    }
  }

  for (const index of structure.itemsWithVagueTitle) {
    const item = plan.items[index];
    if (!item) continue;
    if (!structure.hasAcceptanceCriteria
      && structure.itemsMissingVerify.includes(index)
      && structure.itemsMissingDetails.includes(index)) {
      gaps.push(`Item "${item.title}" is too vague.`);
    }
  }

  return Array.from(new Set(gaps));
}

export async function assessPlanReadiness(plan: ParsedPlan): Promise<PlanReadinessAssessment> {
  const structure = assessPlanStructure(plan);
  const gaps = describeStructuralGaps(plan, structure);
  const blocking = structureHasBlockingGaps(structure);

  const questions: string[] = [];
  if (structure.itemCount === 0) {
    questions.push("Please add concrete checklist items with observable outcomes.");
  }
  for (const index of structure.itemsWithVagueTitle) {
    const item = plan.items[index];
    if (!item) continue;
    if (!structure.hasAcceptanceCriteria
      && structure.itemsMissingVerify.includes(index)
      && structure.itemsMissingDetails.includes(index)) {
      questions.push(`What concrete deliverable should satisfy "${item.title}"?`);
      questions.push(`How will we verify that "${item.title}" is complete?`);
    }
  }

  return {
    ready: !blocking,
    questions: Array.from(new Set(questions)),
    gaps,
    structure,
  };
}
