import { randomUUID } from "node:crypto";
import { and, asc, eq, gte, isNull, notInArray, or } from "drizzle-orm";
import { askAgent, cancelAgent, spawnAgent } from "@/server/bridge-client";
import { db } from "@/server/db";
import { codeReviewFindings, messages, planningReviewFindings, runs, workerTokenUsage, workers } from "@/server/db/schema";
import { decisionService } from "@/server/decisions/service";
import { emitNamedEvent, registerNamedEventListener, type NamedEvent } from "@/server/events/named-events";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
import { redactHandoffText } from "@/server/handoff/redaction";
import { startPlanningReview } from "@/server/planning/review";
import { startImplementationPhase } from "@/server/planning/transition";
import { CodeReviewRefusedError, startCodeReview } from "@/server/review/code-review";
import { collectReviewDiff } from "@/server/review/diff";
import { parseGitBaselineJson } from "@/server/git/auto-commit";
import { startSupervisorRun } from "@/server/supervisor/start";
import { readRuntimeEnvFromSettings } from "@/server/supervisor/runtime-settings";
import type { WorkerModelBinding } from "@/shared/orchestration-policy";
import type { StageUsage } from "./budget-ledger";
import { buildStageKickoffPrompt, buildValidationPrompt, parseValidationVerdict, runWorkflowTriage } from "./prompts";
import {
  OrchestrationStageError,
  orchestrationService,
  type OrchestrationService,
  type StageExecutionContext,
  type StageExecutors,
} from "./service";

/**
 * Stage adapters (plan Task 6): each workflow stage is delegated to the
 * module that already owns that kind of work — the planner phase, planning
 * review, the supervisor, code cross-review — rather than a parallel launch
 * path. Adapters only (a) apply the stage's exact binding to the existing
 * owner and (b) translate the owner's terminal named event back into a
 * stage completion.
 *
 * Orchestrated workflows run in Omni runs (`mode: "implementation"`). Those
 * runs may mix CLIs — the direct-conversation CLI invariant
 * (HANDOFF_REQUIRED) only applies to `direct`/`commit` runs — so a CLI
 * switch between planner and implementer needs no handoff here; reviewers
 * and validators are independent helper agents, as in code cross-review.
 * A `direct` run is refused at workflow creation instead of being mutated.
 */

const HELPER_ROLES = ["plan_review", "code_review"];
const VALIDATION_REPLY_CHARS = 8_000;

function requireWorkerBinding(context: StageExecutionContext): WorkerModelBinding {
  if (context.binding.kind !== "worker") {
    throw new OrchestrationStageError("binding_unavailable", `Stage ${context.stage.stageKey} needs a coding-agent binding.`);
  }
  return context.binding;
}

async function conversationWorkers(runId: string) {
  // `worker_role` is NULL for ordinary conversation workers; NOT IN alone would drop them.
  return db.select().from(workers).where(and(
    eq(workers.runId, runId),
    or(isNull(workers.workerRole), notInArray(workers.workerRole, HELPER_ROLES)),
  ));
}

async function firstUserMessage(runId: string) {
  const row = await db.select().from(messages)
    .where(and(eq(messages.runId, runId), eq(messages.role, "user")))
    .orderBy(asc(messages.createdAt), asc(messages.id))
    .get();
  return row?.content ?? "";
}

/** Provider-reported usage of a run since a stage was claimed; null when nothing was reported. */
export async function reportedUsageSince(runId: string, since: Date | null): Promise<StageUsage | null> {
  if (!since) return null;
  const rows = await db.select().from(workerTokenUsage).where(and(eq(workerTokenUsage.runId, runId), gte(workerTokenUsage.occurredAt, since)));
  if (rows.length === 0) return null;
  return (rows as Array<typeof workerTokenUsage.$inferSelect>).reduce((sum: StageUsage, row) => ({
    inputTokens: (sum.inputTokens ?? 0) + row.inputTokens,
    outputTokens: (sum.outputTokens ?? 0) + row.outputTokens,
    costUsd: (sum.costUsd ?? 0) + row.costUsd,
  }), { inputTokens: 0, outputTokens: 0, costUsd: 0 });
}

function isPlanningPhase(run: StageExecutionContext["run"]) {
  return run.mode === "implementation" && run.phase === "planning";
}

function planArtifactsReady(run: StageExecutionContext["run"]) {
  return run.status === "ready" && Boolean(run.plannerArtifactsJson);
}

export function createDefaultStageExecutors(service: OrchestrationService = orchestrationService): StageExecutors {
  return {
    triage: {
      async dispatch(context) {
        const task = await firstUserMessage(context.runId);
        const { outcome, recommendation } = await runWorkflowTriage(decisionService, { runId: context.runId, task });
        await service.applyTriageRecommendation(context.runId, recommendation);
        const result = outcome.status === "answered" ? outcome.result : null;
        return {
          kind: "completed",
          outcome: "advisory",
          usage: result ? { inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, costUsd: result.costUsd } : { inputTokens: 0, outputTokens: 0, costUsd: 0 },
          effectiveModel: result?.model ?? null,
          findings: recommendation ?? { status: outcome.status },
        };
      },
    },

    plan: {
      async dispatch(context) {
        const binding = requireWorkerBinding(context);
        if (!isPlanningPhase(context.run)) {
          throw new OrchestrationStageError("gate_unmet", "Planning can only run while the conversation is in its planning phase.");
        }
        const planners = await conversationWorkers(context.runId);
        const mismatched = planners.find((worker) => worker.type !== binding.workerType);
        if (mismatched) {
          // Never swap the planner's CLI under a live conversation.
          throw new OrchestrationStageError("identity_mismatch", `The planner already runs on ${mismatched.type}; the policy binds planning to ${binding.workerType}.`);
        }
        if (planners.length === 0) {
          await db.update(runs).set({
            preferredWorkerType: binding.workerType,
            preferredWorkerModel: context.canonicalModel,
            preferredWorkerEffort: binding.effort,
            ...(binding.accountId ? { preferredWorkerAccountId: binding.accountId } : {}),
            updatedAt: new Date(),
          }).where(eq(runs.id, context.runId));
        }
        // A revision is already requested from the planner by the plan review
        // itself; if its artifacts are back, the attempt is complete.
        if (planArtifactsReady(context.run) && (context.reason === "revision" || context.stage.attempt === 1)) {
          return { kind: "completed", outcome: "passed", usage: await reportedUsageSince(context.runId, context.stage.claimedAt), findings: null };
        }
        return { kind: "waiting", workerId: planners[0]?.id ?? null, executionRunId: context.runId };
      },
    },

    plan_review: {
      async dispatch(context) {
        const binding = requireWorkerBinding(context);
        try {
          const { reviewRunId } = await startPlanningReview({
            runId: context.runId,
            agentSelection: binding.workerType,
            rounds: 1,
            reviewerLaunch: { model: context.canonicalModel, effort: binding.effort },
          });
          return { kind: "waiting", externalRef: reviewRunId, executionRunId: context.runId };
        } catch (error) {
          throw new OrchestrationStageError("agent_failed", error instanceof Error ? error.message : String(error));
        }
      },
    },

    implement: {
      async dispatch(context) {
        const binding = requireWorkerBinding(context);
        await db.update(runs).set({
          preferredWorkerType: binding.workerType,
          preferredWorkerModel: context.canonicalModel,
          preferredWorkerEffort: binding.effort,
          ...(binding.accountId ? { preferredWorkerAccountId: binding.accountId } : {}),
          // The implementer CLI is pinned: the supervisor may only delegate to it.
          allowedWorkerTypes: JSON.stringify([binding.workerType]),
          updatedAt: new Date(),
        }).where(eq(runs.id, context.runId));
        if (isPlanningPhase(context.run)) {
          try {
            await startImplementationPhase({ runId: context.runId });
          } catch (error) {
            throw new OrchestrationStageError("agent_failed", error instanceof Error ? error.message : String(error));
          }
          return { kind: "waiting", executionRunId: context.runId };
        }
        // Repair (or retry) in the implementing phase: hand the supervisor the
        // findings as a user-visible message and wake it.
        const prompt = buildStageKickoffPrompt({ stage: "implement", reason: context.reason, findings: context.previousFindings });
        await db.insert(messages).values({
          id: randomUUID(),
          runId: context.runId,
          role: "user",
          kind: "orchestration_stage",
          content: prompt,
          createdAt: new Date(),
        });
        await db.update(runs).set({ status: "running", failedAt: null, lastError: null, updatedAt: new Date() }).where(eq(runs.id, context.runId));
        notifyEventStreamSubscribers();
        startSupervisorRun(context.runId);
        return { kind: "waiting", executionRunId: context.runId };
      },
    },

    code_review: {
      async dispatch(context) {
        const binding = requireWorkerBinding(context);
        try {
          const started = await startCodeReview({
            runId: context.runId,
            maxRounds: 1,
            reviewer: { workerType: binding.workerType, model: context.canonicalModel, effort: binding.effort },
          });
          return { kind: "waiting", externalRef: started.reviewId, executionRunId: context.runId };
        } catch (error) {
          if (error instanceof CodeReviewRefusedError && error.reason === "no_changes") {
            // Nothing changed: there is nothing to review. Record that honestly.
            return { kind: "completed", outcome: "approved", usage: null, findings: { refused: "no_changes" } };
          }
          throw new OrchestrationStageError("agent_failed", error instanceof Error ? error.message : String(error));
        }
      },
    },

    validate: {
      async dispatch(context) {
        const binding = requireWorkerBinding(context);
        const helperId = `orchestration-validate-${context.stage.id}`;
        const cwd = context.run.projectPath || process.cwd();
        const baseline = parseGitBaselineJson(context.run.gitBaselineJson);
        const diff = collectReviewDiff(cwd, baseline?.status === "ok" ? baseline.headSha : null);
        const statFiles = diff.ok
          ? diff.stat.split(/\r?\n/).map((line) => line.split("|")[0]?.trim() ?? "").filter((line) => line && !/files? changed/.test(line))
          : [];
        const changedFiles = diff.ok ? [...statFiles, ...diff.untracked] : [];
        const prompt = buildValidationPrompt({
          task: await firstUserMessage(context.runId),
          acceptanceCriteria: context.run.plannerReadinessVerdictJson ?? "",
          changedFiles,
        });
        const { env } = await readRuntimeEnvFromSettings();
        await spawnAgent({
          type: binding.workerType,
          cwd,
          name: helperId,
          mode: "read-only",
          env,
          model: context.canonicalModel,
          ...(binding.effort ? { effort: binding.effort } : {}),
        });
        // The validator's reply settles the stage asynchronously.
        void (async () => {
          try {
            const answer = await askAgent(helperId, prompt);
            const parsed = parseValidationVerdict(answer.response);
            if (!parsed.ok) {
              await service.failStage({ stageId: context.stage.id, code: "agent_failed", message: "The validator did not return a verdict with evidence.", recoverable: false });
              return;
            }
            await service.completeStage({
              stageId: context.stage.id,
              outcome: parsed.verdict.verdict,
              usage: null,
              findings: { ...parsed.verdict, reply: redactHandoffText(answer.response, VALIDATION_REPLY_CHARS) },
            });
          } catch (error) {
            await service.failStage({ stageId: context.stage.id, code: "agent_failed", message: error instanceof Error ? error.message : String(error), recoverable: false });
          } finally {
            await cancelAgent(helperId).catch((error) => {
              emitNamedEvent({ kind: "orchestration.adapter_failed", runId: context.runId, stageId: context.stage.id, reason: `validator cleanup: ${error instanceof Error ? error.message : String(error)}` });
            });
          }
        })();
        return { kind: "waiting", externalRef: helperId, executionRunId: context.runId };
      },
      async cancel({ stage }) {
        if (stage.externalRef) await cancelAgent(stage.externalRef);
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Terminal-event → stage-signal translation
// ---------------------------------------------------------------------------

async function planReviewFindings(reviewRunId: string) {
  return db.select({ severity: planningReviewFindings.severity, title: planningReviewFindings.title, recommendation: planningReviewFindings.recommendationPreview })
    .from(planningReviewFindings).where(eq(planningReviewFindings.reviewRunId, reviewRunId));
}

async function openCodeReviewFindings(reviewId: string) {
  const rows = await db.select().from(codeReviewFindings).where(eq(codeReviewFindings.reviewId, reviewId));
  return rows
    .filter((row) => row.status !== "resolved" && row.status !== "withdrawn")
    .map((row) => ({ severity: row.severity, file: row.file, line: row.line, claim: row.claim, suggestedFix: row.suggestedFix }));
}

export async function handleOrchestrationSignal(event: NamedEvent, service: OrchestrationService = orchestrationService) {
  switch (event.kind) {
    case "plan.ready":
      return service.signalStage({ runId: event.runId, stage: "plan", result: { kind: "completed", outcome: "passed" } });
    case "plan.review.finished": {
      if (event.status !== "completed") {
        return service.signalStage({ runId: event.runId, stage: "plan_review", externalRef: event.reviewRunId, result: { kind: "failed", code: "agent_failed", message: `Plan review ${event.status}.` } });
      }
      const findings = await planReviewFindings(event.reviewRunId);
      return service.signalStage({
        runId: event.runId,
        stage: "plan_review",
        externalRef: event.reviewRunId,
        result: { kind: "completed", outcome: findings.length > 0 ? "changes_requested" : "approved", findings },
      });
    }
    case "code_review.finished": {
      if (event.outcome === "failed") {
        return service.signalStage({ runId: event.runId, stage: "code_review", externalRef: event.reviewId, result: { kind: "failed", code: "agent_failed", message: `Code review failed: ${event.reason}` } });
      }
      const findings = event.outcome === "approved" ? [] : await openCodeReviewFindings(event.reviewId);
      return service.signalStage({
        runId: event.runId,
        stage: "code_review",
        externalRef: event.reviewId,
        result: { kind: "completed", outcome: event.outcome === "approved" ? "approved" : "changes_requested", findings },
      });
    }
    case "supervisor.run_finished": {
      if (event.outcome === "failed") {
        return service.signalStage({ runId: event.runId, stage: "implement", result: { kind: "failed", code: "agent_failed", message: "The supervisor marked the implementation as failed." } });
      }
      const stage = (await service.listStages(event.runId)).find((row) => row.stageKey === "implement" && (row.status === "waiting" || row.status === "dispatched"));
      return service.signalStage({
        runId: event.runId,
        stage: "implement",
        result: { kind: "completed", outcome: "passed", usage: stage ? await reportedUsageSince(event.runId, stage.claimedAt) : null },
      });
    }
    default:
      return null;
  }
}

const SIGNAL_KINDS = new Set(["plan.ready", "plan.review.finished", "code_review.finished", "supervisor.run_finished"]);

/** Register the single in-process owner that turns terminal events into stage signals. */
export function registerOrchestrationSignalListener(service: OrchestrationService = orchestrationService) {
  return registerNamedEventListener("orchestration.stage_signals", (event) => {
    if (!SIGNAL_KINDS.has(event.kind)) return;
    void handleOrchestrationSignal(event, service).catch((error) => {
      const runId = "runId" in event && typeof event.runId === "string" ? event.runId : "";
      emitNamedEvent({ kind: "orchestration.adapter_failed", runId, stageId: null, reason: redactHandoffText(error instanceof Error ? error.message : String(error), 300) });
    });
  });
}
