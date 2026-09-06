import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { runs } from "@/server/db/schema";
import { emitNamedEvent } from "@/server/events/named-events";
import { parsePlan } from "@/server/plans/parser";
import { goalControl } from "@/server/runs/goal-control";
import { redactGoalErrorMessage } from "@/server/runs/goal-errors";
import { goalOutboxDispatcher } from "@/server/runs/goal-outbox";
import {
  GOAL_PLAN_ITEM_MAX_LENGTH,
  GOAL_PLAN_MARKDOWN_MAX_LENGTH,
  GOAL_PLAN_MAX_ITEMS,
  createDerivedGoalPlanItemId,
  type GoalPlanItem,
  type GoalSnapshot,
} from "@/shared/goal-plan";

/**
 * Goal plans normally arrive from the agent as ACP `plan` session updates. Many
 * agents never send one — Codex in particular runs a whole implementation
 * without emitting a single plan update — and the goal card then renders "No
 * plan items yet" for a run whose entire objective was "implement <plan>.md".
 *
 * When the objective names a markdown plan file inside the project, that file
 * *is* the plan, so the server derives the checklist from it. A derived plan is
 * always superseded by a real provider plan: derivation only ever runs while
 * the goal has no provider-owned plan, and its ticked checkboxes are the source
 * of item status.
 */

export type GoalPlanDerivationSkipReason =
  | "goal_absent"
  | "goal_not_visible"
  | "provider_owns_plan"
  | "run_missing"
  | "project_path_unknown"
  | "no_plan_reference"
  | "reference_outside_project"
  | "reference_missing"
  | "reference_too_large"
  | "no_checklist_items"
  | "unchanged";

export type GoalPlanDerivationResult =
  | { kind: "derived"; itemCount: number; source: string; revision: number }
  | { kind: "skipped"; reason: GoalPlanDerivationSkipReason }
  | { kind: "refused"; reason: string }
  | { kind: "failed"; reason: string };

const MARKDOWN_REFERENCE_PATTERN = /(?:[A-Za-z]:)?[\w./\\~-]*\.md\b/g;

function skip(runId: string, goalId: string | null, reason: GoalPlanDerivationSkipReason): GoalPlanDerivationResult {
  emitNamedEvent({ kind: "goal.plan.derivation_skipped", runId, goalId, reason });
  return { kind: "skipped", reason };
}

function isInside(parent: string, candidate: string) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

/**
 * Candidate markdown paths named by a goal objective, in the order they appear.
 * Quoting, trailing punctuation and backticks are stripped; resolution against
 * the project root is the caller's job.
 */
export function extractPlanReferencesFromObjective(objective: string): string[] {
  const references: string[] = [];
  for (const match of objective.matchAll(MARKDOWN_REFERENCE_PATTERN)) {
    const raw = match[0].replace(/^["'`(<]+/, "").replace(/["'`)>,.]+$/, "");
    if (raw && !references.includes(raw)) references.push(raw);
  }
  return references;
}

function resolvePlanReference(objective: string, projectPath: string) {
  for (const reference of extractPlanReferencesFromObjective(objective)) {
    const absolute = path.resolve(projectPath, reference.replace(/\\/g, path.sep));
    if (!isInside(projectPath, absolute)) return { kind: "outside" as const };
    let stats: fs.Stats;
    try {
      stats = fs.statSync(absolute);
    } catch {
      continue;
    }
    if (!stats.isFile()) continue;
    return { kind: "found" as const, absolute, size: stats.size };
  }
  return { kind: "missing" as const };
}

function buildDerivedPlanItems(goalId: string, source: string, markdown: string): GoalPlanItem[] {
  return parsePlan(markdown).items.slice(0, GOAL_PLAN_MAX_ITEMS).map((item, order) => {
    const title = Array.from(item.title).slice(0, GOAL_PLAN_ITEM_MAX_LENGTH).join("");
    return {
      id: createDerivedGoalPlanItemId({ goalId, source, sourceLine: item.sourceLine, title }),
      title,
      phase: item.phase,
      status: item.completed ? "completed" : "pending",
      order,
      providerId: null,
    } satisfies GoalPlanItem;
  });
}

/**
 * A goal plan is derivable while nothing provider-owned occupies the slot:
 * either the plan is empty, or the goal already carries a plan this same
 * derivation produced from the same file.
 */
function isDerivable(goal: GoalSnapshot, derivedUri: string | null) {
  if (goal.plan.length === 0 && goal.planSource.kind === "none") return true;
  return goal.planSource.kind === "uri"
    && goal.planSource.uri === derivedUri
    && goal.plan.every((item) => item.providerId === null);
}

export async function refreshDerivedGoalPlan(
  runId: string,
  trigger: "goal_created" | "session_initialized" | "turn_settled",
): Promise<GoalPlanDerivationResult> {
  try {
    const goal = await goalControl.getGoal(runId);
    if (!goal) return skip(runId, null, "goal_absent");
    if (!goal.visible || goal.status === "cleared") return skip(runId, goal.goalId, "goal_not_visible");

    const run = await db.select({ projectPath: runs.projectPath }).from(runs).where(eq(runs.id, runId)).get();
    if (!run) return skip(runId, goal.goalId, "run_missing");
    const projectPath = run.projectPath?.trim();
    if (!projectPath) return skip(runId, goal.goalId, "project_path_unknown");

    const reference = resolvePlanReference(goal.objective, path.resolve(projectPath));
    if (reference.kind === "outside") return skip(runId, goal.goalId, "reference_outside_project");
    if (reference.kind === "missing") {
      return skip(
        runId,
        goal.goalId,
        extractPlanReferencesFromObjective(goal.objective).length > 0 ? "reference_missing" : "no_plan_reference",
      );
    }
    if (reference.size > GOAL_PLAN_MARKDOWN_MAX_LENGTH) return skip(runId, goal.goalId, "reference_too_large");

    const uri = pathToFileURL(reference.absolute).toString();
    if (!isDerivable(goal, uri)) return skip(runId, goal.goalId, "provider_owns_plan");

    const plan = buildDerivedPlanItems(goal.goalId, uri, fs.readFileSync(reference.absolute, "utf8"));
    if (plan.length === 0) return skip(runId, goal.goalId, "no_checklist_items");

    const applied = await goalControl.applyDerivedPlan({
      runId,
      goalId: goal.goalId,
      expectedRevision: goal.revision,
      plan,
      planSource: { kind: "uri", uri },
    });
    if (!applied.ok) {
      emitNamedEvent({ kind: "goal.plan.derivation_refused", runId, goalId: goal.goalId, reason: applied.code });
      return { kind: "refused", reason: applied.code };
    }
    if (applied.replayed) return skip(runId, goal.goalId, "unchanged");

    await goalOutboxDispatcher.drainPending();
    emitNamedEvent({
      kind: "goal.plan.derived",
      runId,
      goalId: goal.goalId,
      source: uri,
      itemCount: plan.length,
      completedCount: plan.filter((item) => item.status === "completed").length,
      revision: applied.snapshot.revision,
      trigger,
    });
    return { kind: "derived", itemCount: plan.length, source: uri, revision: applied.snapshot.revision };
  } catch (error) {
    const reason = redactGoalErrorMessage(error);
    emitNamedEvent({ kind: "goal.plan.derivation_failed", runId, reason });
    emitNamedEvent({
      kind: "error.surfaced",
      code: "goal.plan.derivation_failed",
      message: `The plan referenced by this goal could not be read: ${reason}`,
      surface: "log",
      runId,
    });
    return { kind: "failed", reason };
  }
}
