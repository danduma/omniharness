export interface ParsedPlanItem {
  id: string;
  phase: string | null;
  title: string;
  sourceLine: number;
  /** True when the source line is a ticked checkbox (`- [x]`). */
  completed: boolean;
  details?: string;
}

export interface ParsedPlan {
  markdown: string;
  items: ParsedPlanItem[];
}

const ITEM_PATTERN = /^(?:- \[( |x|X)\]|\d+\.)\s+(.+)$/;

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

    const itemMatch = line.match(ITEM_PATTERN);
    if (itemMatch) {
      items.push({
        id: `item-${index + 1}`,
        phase: currentPhase,
        title: itemMatch[2].trim(),
        sourceLine: index + 1,
        completed: itemMatch[1] === "x" || itemMatch[1] === "X",
        details: collectItemDetails(lines, index),
      });
    }
  }

  return { markdown, items };
}

function collectItemDetails(lines: string[], itemIndex: number) {
  const details: string[] = [];

  for (let index = itemIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^#{1,6}\s+(.+)$/.test(line) || ITEM_PATTERN.test(line)) {
      break;
    }
    if (line.trim().length > 0) {
      details.push(line.trim());
    }
  }

  return details.join("\n");
}
