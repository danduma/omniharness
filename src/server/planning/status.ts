import type { PlannerArtifacts } from "@/server/planning/artifacts";

const FAILED_WORKER_STATES = new Set(["error", "failed"]);

export type PlanningConversationStatus =
  | "starting"
  | "working"
  | "awaiting_user"
  | "ready"
  | "promoting"
  | "promoted"
  | "failed";

export function hasReadyPlannerArtifact(artifacts: PlannerArtifacts) {
  if (!artifacts.planPath) {
    return false;
  }

  const selectedPlan = artifacts.candidates.find(
    (candidate) => candidate.kind === "plan" && candidate.path === artifacts.planPath,
  );

  return Boolean(selectedPlan?.exists && selectedPlan.readiness?.ready);
}

export function derivePlanningStatus(args: {
  workerState?: string | null;
  lastError?: string | null;
  artifacts: PlannerArtifacts;
}): PlanningConversationStatus {
  const workerState = args.workerState?.trim().toLowerCase() ?? "";
  if (args.lastError?.trim() || FAILED_WORKER_STATES.has(workerState)) {
    return "failed";
  }

  return hasReadyPlannerArtifact(args.artifacts) ? "ready" : "awaiting_user";
}
