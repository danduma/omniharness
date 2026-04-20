export interface ParsedPlanItem {
  id: string;
  phase: string | null;
  title: string;
  sourceLine: number;
}

export interface ParsedPlan {
  markdown: string;
  items: ParsedPlanItem[];
}

export function parsePlan(markdown: string): ParsedPlan {
  const lines = markdown.split("\n");
  const items: ParsedPlanItem[] = [];
  let currentPhase: string | null = null;

  for (const [index, line] of lines.entries()) {
    const phaseMatch = line.match(/^##\s+(.+)$/);
    if (phaseMatch) {
      currentPhase = phaseMatch[1].trim();
      continue;
    }

    const itemMatch = line.match(/^- \[ \] (.+)$/);
    if (itemMatch) {
      items.push({
        id: `item-${index + 1}`,
        phase: currentPhase,
        title: itemMatch[1].trim(),
        sourceLine: index + 1,
      });
    }
  }

  return { markdown, items };
}
