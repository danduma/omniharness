import { eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { codeReviews, orchestrationStages, planningReviewRuns, runs } from "@/server/db/schema";
import { emitNamedEvent, type NamedEvent } from "@/server/events/named-events";
import { ACTIVE_STAGE_STATUSES, type WorkflowStage } from "@/shared/orchestration-policy";
import { orchestrationService, type OrchestrationService, type StageRow } from "./service";
import { handleOrchestrationSignal } from "./stage-adapters";

/**
 * Startup reconciliation for orchestration stages (plan Task 7).
 *
 * For every stage that held the run's dispatch claim when the process
 * stopped, decide from durable facts only:
 *
 *  - adopt: the owner is durable and still running (planner phase,
 *    supervisor run) — keep waiting for its terminal event;
 *  - translate: the owner recorded a terminal result in its own table
 *    (planning review, code review, supervisor `done`/`failed`) — settle the
 *    stage from that record, as if the event had been observed;
 *  - needs_recovery: the claim was taken but launch cannot be proven
 *    (`preflight`/`dispatched`), or the owner was an in-process helper that
 *    died with the process — keep the reservation and surface an
 *    actionable error. A reattached session is never taken as proof that a
 *    provider turn finished.
 */

export type ReconcileAction = "adopted" | "translated" | "needs_recovery";

type Decision =
  | { action: "adopted" }
  | { action: "translated"; event: NamedEvent }
  | { action: "needs_recovery"; message: string };

async function decide(row: StageRow): Promise<Decision> {
  const stage = row.stageKey as WorkflowStage;
  const executionRunId = row.executionRunId ?? row.runId;
  if (row.status !== "waiting") {
    return { action: "needs_recovery", message: `The ${stage} stage was being launched when the server stopped; it is unknown whether its agent started.` };
  }
  switch (stage) {
    case "plan": {
      const run = await db.select().from(runs).where(eq(runs.id, executionRunId)).get();
      if (run?.mode === "implementation" && run.phase === "planning") return { action: "adopted" };
      return { action: "needs_recovery", message: "The planning phase ended while the server was stopped." };
    }
    case "implement": {
      const run = await db.select().from(runs).where(eq(runs.id, executionRunId)).get();
      if (run?.status === "done") return { action: "translated", event: { kind: "supervisor.run_finished", runId: executionRunId, outcome: "completed" } };
      if (run?.status === "failed") return { action: "translated", event: { kind: "supervisor.run_finished", runId: executionRunId, outcome: "failed" } };
      if (run) return { action: "adopted" };
      return { action: "needs_recovery", message: "The implementation run no longer exists." };
    }
    case "plan_review": {
      const review = row.externalRef ? await db.select().from(planningReviewRuns).where(eq(planningReviewRuns.id, row.externalRef)).get() : null;
      if (review && review.status !== "running") {
        return { action: "translated", event: { kind: "plan.review.finished", runId: executionRunId, reviewRunId: review.id, status: review.status } };
      }
      return { action: "needs_recovery", message: "The plan review was interrupted by a server restart." };
    }
    case "code_review": {
      const review = row.externalRef ? await db.select().from(codeReviews).where(eq(codeReviews.id, row.externalRef)).get() : null;
      if (review && review.status !== "running") {
        return {
          action: "translated",
          event: {
            kind: "code_review.finished",
            runId: executionRunId,
            reviewId: review.id,
            outcome: review.status as "approved" | "escalated" | "cap_reached" | "failed",
            reason: review.outcomeReason ?? "reconciled",
          },
        };
      }
      return { action: "needs_recovery", message: "The code review was interrupted by a server restart." };
    }
    default:
      // triage and validate run as in-process helpers; they die with the process.
      return { action: "needs_recovery", message: `The ${stage} stage was interrupted by a server restart.` };
  }
}

export async function reconcileOrchestrationStages(service: OrchestrationService = orchestrationService) {
  const rows = await db.select().from(orchestrationStages).where(inArray(orchestrationStages.status, [...ACTIVE_STAGE_STATUSES]));
  const results: Array<{ stageId: string; action: ReconcileAction }> = [];
  for (const row of rows) {
    const decision = await decide(row);
    const stage = row.stageKey as WorkflowStage;
    if (decision.action === "adopted") {
      emitNamedEvent({ kind: "orchestration.recovery_reconciled", runId: row.runId, stageId: row.id, stage, action: "adopted" });
    } else if (decision.action === "translated") {
      await handleOrchestrationSignal(decision.event, service);
      emitNamedEvent({ kind: "orchestration.recovery_reconciled", runId: row.runId, stageId: row.id, stage, action: "adopted" });
    } else {
      await service.failStage({ stageId: row.id, code: "interrupted_by_restart", message: decision.message, recoverable: true });
      emitNamedEvent({ kind: "orchestration.recovery_reconciled", runId: row.runId, stageId: row.id, stage, action: "needs_recovery" });
    }
    results.push({ stageId: row.id, action: decision.action });
  }
  return results;
}
