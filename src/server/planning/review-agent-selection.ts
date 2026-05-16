import {
  SUPPORTED_WORKER_TYPES,
  type SupportedWorkerType,
  normalizeWorkerType,
} from "@/server/supervisor/worker-types";
import { isSpawnableWorkerType } from "@/server/supervisor/worker-availability";
import { isWorkerTypeQuotaBlocked } from "@/server/quota/type-blocking";
import { type PlanningReviewAgentSelection } from "./review-preferences";

export { isWorkerTypeQuotaBlocked };

export async function resolvePlanningReviewWorkerType(args: {
  agentSelection: PlanningReviewAgentSelection;
  allowedWorkerTypes: SupportedWorkerType[];
  plannerWorkerType?: string;
}): Promise<{
  workerType: SupportedWorkerType;
  reason: string;
}> {
  const { agentSelection, allowedWorkerTypes, plannerWorkerType } = args;
  const normalizedPlannerType = plannerWorkerType ? normalizeWorkerType(plannerWorkerType) as SupportedWorkerType : null;

  async function getHealthyWorkerType(type: SupportedWorkerType): Promise<{ ok: boolean; reason?: string }> {
    if (!allowedWorkerTypes.includes(type)) {
      return { ok: false, reason: "not allowed for this run" };
    }
    const spawnable = isSpawnableWorkerType(type);
    if (!spawnable.ok) {
      return { ok: false, reason: spawnable.reason };
    }
    if (await isWorkerTypeQuotaBlocked(type)) {
      return { ok: false, reason: "quota exhausted" };
    }
    return { ok: true };
  }

  // 1. Concrete selection
  if ((SUPPORTED_WORKER_TYPES as readonly string[]).includes(agentSelection)) {
    const type = agentSelection as SupportedWorkerType;
    const health = await getHealthyWorkerType(type);
    if (health.ok) {
      return { workerType: type, reason: "explicit selection" };
    }
    throw new Error(`Selected reviewer "${type}" is not available: ${health.reason}`);
  }

  // 2. "same" selection
  if (agentSelection === "same") {
    if (!normalizedPlannerType) {
      throw new Error("Cannot use \"same\" agent selection: planner worker type is unknown.");
    }
    const health = await getHealthyWorkerType(normalizedPlannerType);
    if (health.ok) {
      return { workerType: normalizedPlannerType, reason: "same as planner" };
    }
    throw new Error(`Planner worker "${normalizedPlannerType}" is not available for review: ${health.reason}`);
  }

  // 3. "auto" selection
  if (agentSelection === "auto") {
    // Prefer a different healthy worker
    const otherTypes = allowedWorkerTypes.filter(t => t !== normalizedPlannerType);
    for (const type of otherTypes) {
      const health = await getHealthyWorkerType(type);
      if (health.ok) {
        return { workerType: type, reason: `auto selection: preferred different healthy worker "${type}"` };
      }
    }

    // Fallback to planner worker if healthy
    if (normalizedPlannerType) {
      const health = await getHealthyWorkerType(normalizedPlannerType);
      if (health.ok) {
        return { workerType: normalizedPlannerType, reason: "auto selection: fallback to planner worker (no other healthy options)" };
      }
    }

    throw new Error("No healthy reviewer worker is available (checked all allowed types).");
  }

  throw new Error(`Invalid agent selection: ${agentSelection}`);
}
