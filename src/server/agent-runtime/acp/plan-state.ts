import type { AcpPlanItem } from "@/shared/acp-plan";

export {
  isAcpCorePlanUpdate,
  measureAcpPlanJsonBytes,
  normalizeAcpCorePlan,
  reduceWorkerPlanEntries,
} from "@/shared/acp-plan";

export type AcpPlanUpdateClassification = "core" | "unsupported" | "not_plan";

export function classifyAcpPlanUpdate(update: unknown): AcpPlanUpdateClassification {
  if (!update || typeof update !== "object" || Array.isArray(update)) return "not_plan";
  const sessionUpdate = (update as { sessionUpdate?: unknown }).sessionUpdate;
  if (sessionUpdate === "plan") return "core";
  if (sessionUpdate === "plan_update" || sessionUpdate === "plan_removed") return "unsupported";
  return "not_plan";
}

export function createBoundaryScopedPlanItems(
  planBoundarySeq: number,
  items: readonly AcpPlanItem[],
): AcpPlanItem[] {
  return items.map((item, order) => ({
    ...item,
    id: `${planBoundarySeq}:${order}`,
    order,
  }));
}
