import type { ParsedPlanItem } from "../plans/parser";
import { createTask } from "../bridge-client";

export interface WorkItem {
  id: string;
  title: string;
  phase: string | null;
  status: string;
  dependsOn?: string | null;
}

export function runnableItems(items: WorkItem[]) {
  return items.filter((item) => item.status === "pending" || item.status === "blocked");
}

export async function createExecutionGraph(
  name: string,
  items: ParsedPlanItem[],
) {
  const subtasks = items.map((item) => ({
    id: item.id,
    prompt: item.title,
    workerType: "codex",
  }));

  return createTask({
    name,
    subtasks,
  });
}

export function deriveWorkerPrompt(item: ParsedPlanItem) {
  return `Implement: ${item.title}`;
}
