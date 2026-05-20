import { db } from "@/server/db";
import {
  runs,
  workers,
  messages,
  planningReviewRuns,
  planningReviewRounds,
  planningReviewFindings,
} from "@/server/db/schema";
import { recordExecutionEvent } from "@/server/events/execution-event-store";
import { eq, and, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import fs from "fs";
import {
  spawnAgent,
  askAgent,
  getAgent,
  cancelAgent,
} from "@/server/bridge-client";
import { resolvePlanningReviewWorkerType } from "./review-agent-selection";
import {
  buildReviewerPrompt,
  buildPlannerRevisionPrompt,
  type ReviewerFinding,
} from "./review-prompts";
import { refreshPlanningArtifactsForRun } from "./refresh";
import { type PlanningReviewAgentSelection } from "./review-preferences";
import { parseAllowedWorkerTypes } from "@/server/supervisor/worker-types";
import { allocateWorkerIdentity } from "@/server/workers/ids";
import { persistWorkerSnapshot } from "@/server/workers/snapshots";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
import { emitNamedEvent } from "@/server/events/named-events";
import { readRuntimeEnvFromSettings } from "@/server/supervisor/runtime-settings";

const processBootTime = new Date();

const ORPHAN_STALE_MS = 10 * 60 * 1000;

function isRecoverablePlannerAgentMissingError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /\b(agent not found|not_found|session not found|invalid session identifier|failed to load resumed session data from file|404)\b/i.test(message);
}

async function insertPlannerSessionEvent(args: {
  runId: string;
  workerId: string;
  eventType: "worker_session_resumed" | "worker_session_recreated";
  details: Record<string, unknown>;
}) {
  await recordExecutionEvent({
    runId: args.runId,
    workerId: args.workerId,
    planItemId: null,
    eventType: args.eventType,
    details: args.details,
  });
}

async function reconcileOrphanedReviewsForRun(runId: string) {
  const orphans = await db
    .select()
    .from(planningReviewRuns)
    .where(and(eq(planningReviewRuns.runId, runId), eq(planningReviewRuns.status, "running")));
  const now = new Date();
  let reconciledAny = false;
  for (const orphan of orphans) {
    const acrossRestart = !orphan.startedAt || orphan.startedAt < processBootTime;
    const staleInProcess = orphan.updatedAt && now.getTime() - orphan.updatedAt.getTime() > ORPHAN_STALE_MS;
    if (!acrossRestart && !staleInProcess) {
      continue;
    }
    console.warn("[planning/review] reconciling orphaned review run", {
      id: orphan.id,
      runId,
      reason: acrossRestart ? "process_restart" : "stale_in_process",
    });
    await db
      .update(planningReviewRuns)
      .set({
        status: "failed",
        lastError: acrossRestart
          ? "Orphaned by process restart before completion."
          : "Review orchestration stalled; reconciled as failed.",
        updatedAt: now,
      })
      .where(eq(planningReviewRuns.id, orphan.id));
    reconciledAny = true;
  }
  const current = await db.select().from(runs).where(eq(runs.id, runId)).get();
  if (!current) return;
  const hasRunningReview = await db
    .select()
    .from(planningReviewRuns)
    .where(and(eq(planningReviewRuns.runId, runId), eq(planningReviewRuns.status, "running")))
    .get();
  if (
    !hasRunningReview &&
    (current.status === "reviewing_plan" || current.status === "revising_plan" || reconciledAny)
  ) {
    if (current.status === "reviewing_plan" || current.status === "revising_plan") {
      await db
        .update(runs)
        .set({ status: "ready", updatedAt: now })
        .where(eq(runs.id, runId));
    }
  }
}

function parseReviewerFindings(text: string): ReviewerFinding[] {
  const jsonBlock = text.match(/\`\`\`json\s*([\s\S]*?)\s*\`\`\`/);
  if (!jsonBlock) return [];
  try {
    const parsed = JSON.parse(jsonBlock[1]);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function startPlanningReview(args: {
  runId: string;
  agentSelection: PlanningReviewAgentSelection;
  rounds: number;
}) {
  console.log("[planning/review] start", { runId: args.runId, agentSelection: args.agentSelection, rounds: args.rounds });
  const initialRun = await db.select().from(runs).where(eq(runs.id, args.runId)).get();
  console.log("[planning/review] initialRun", { found: Boolean(initialRun), mode: initialRun?.mode, status: initialRun?.status });
  if (!initialRun || initialRun.mode !== "planning") {
    throw new Error("Invalid run for planning review.");
  }

  await reconcileOrphanedReviewsForRun(args.runId);

  await refreshPlanningArtifactsForRun({ run: initialRun });
  const run = await db.select().from(runs).where(eq(runs.id, args.runId)).get();
  console.log("[planning/review] post-refresh", { status: run?.status, specPath: run?.specPath, artifactPlanPath: run?.artifactPlanPath });
  if (!run) {
    throw new Error("Invalid run for planning review.");
  }

  const artifacts = run.plannerArtifactsJson ? JSON.parse(run.plannerArtifactsJson) : null;
  console.log("[planning/review] artifacts", {
    hasArtifacts: Boolean(artifacts),
    specPath: artifacts?.specPath,
    planPath: artifacts?.planPath,
    candidateCount: artifacts?.candidates?.length,
    candidates: artifacts?.candidates,
  });
  if (!artifacts) {
    throw new Error("No plan artifacts found for review.");
  }
  const candidates: Array<{ kind?: string; path?: string; exists?: boolean }> = artifacts.candidates ?? [];
  if (!artifacts.planPath) {
    const firstPlanCandidate = candidates.find(
      (c) => c.kind === "plan" && c.path && c.exists !== false,
    );
    if (firstPlanCandidate?.path) {
      artifacts.planPath = firstPlanCandidate.path;
      console.log("[planning/review] fallback planPath", firstPlanCandidate.path);
    }
  }
  if (!artifacts.specPath) {
    const firstSpecCandidate = candidates.find(
      (c) => c.kind === "spec" && c.path && c.exists !== false,
    );
    if (firstSpecCandidate?.path) {
      artifacts.specPath = firstSpecCandidate.path;
      console.log("[planning/review] fallback specPath", firstSpecCandidate.path);
    }
  }
  if (!artifacts.planPath) {
    throw new Error("No plan artifacts found for review.");
  }
  await db
    .update(runs)
    .set({ plannerArtifactsJson: JSON.stringify(artifacts) })
    .where(eq(runs.id, run.id));
  run.plannerArtifactsJson = JSON.stringify(artifacts);

  console.log("[planning/review] resolved", { status: run.status, specPath: artifacts.specPath, planPath: artifacts.planPath });

  const existingReview = await db.select()
    .from(planningReviewRuns)
    .where(and(eq(planningReviewRuns.runId, run.id), eq(planningReviewRuns.status, "running")))
    .get();
  console.log("[planning/review] existingReview", { found: Boolean(existingReview), id: existingReview?.id });
  if (existingReview) {
    emitNamedEvent({
      kind: "plan.review.blocked",
      runId: run.id,
      reason: "leftover_state",
    });
    emitNamedEvent({
      kind: "error.surfaced",
      code: "plan.review.leftover_state",
      message: "A previous plan review is still active and is blocking a new one. Resolve or cancel the existing review before retrying.",
      surface: "banner",
      runId: run.id,
    });
    throw new Error("A review run is already active.");
  }

  if (run.status === "reviewing_plan" || run.status === "revising_plan") {
    console.warn("[planning/review] resetting stale run status with no active review", { runId: run.id, status: run.status });
    await db.update(runs).set({ status: "ready", updatedAt: new Date() }).where(eq(runs.id, run.id));
    run.status = "ready";
  }

  const reviewRunId = randomUUID();
  const now = new Date();
  await db.insert(planningReviewRuns).values({
    id: reviewRunId,
    runId: run.id,
    status: "running",
    agentSelection: args.agentSelection,
    roundsRequested: args.rounds,
    startedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  emitNamedEvent({
    kind: "plan.review.started",
    runId: run.id,
    reviewRunId,
  });

  // Orchestrate review
  orchestratePlanningReview(reviewRunId).catch((err) => {
    console.error(`Review orchestration failed for ${reviewRunId}:`, err);
  });

  return { reviewRunId, status: "running" };
}

async function orchestratePlanningReview(reviewRunId: string) {
  const reviewRun = await db.select().from(planningReviewRuns).where(eq(planningReviewRuns.id, reviewRunId)).get();
  if (!reviewRun) return;

  const run = await db.select().from(runs).where(eq(runs.id, reviewRun.runId)).get();
  if (!run) return;

  try {
    for (let i = 0; i < reviewRun.roundsRequested; i++) {
      const roundNumber = i + 1;
      
      // Update status to reviewing_plan
      await db.update(runs).set({ status: "reviewing_plan" }).where(eq(runs.id, run.id));
      
      const allowedWorkerTypes = parseAllowedWorkerTypes(run.allowedWorkerTypes);
      const plannerWorker = await db.select().from(workers).where(eq(workers.runId, run.id)).get();
      
      const { workerType, reason } = await resolvePlanningReviewWorkerType({
        agentSelection: reviewRun.agentSelection as PlanningReviewAgentSelection,
        allowedWorkerTypes,
        plannerWorkerType: plannerWorker?.type,
      });

      const roundId = randomUUID();
      await db.insert(planningReviewRounds).values({
        id: roundId,
        reviewRunId,
        runId: run.id,
        roundNumber,
        status: "reviewing",
        resolvedWorkerType: workerType,
        selectionReason: reason,
        startedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const artifacts = JSON.parse(run.plannerArtifactsJson!);
      const specContent = artifacts.specPath ? fs.readFileSync(artifacts.specPath, "utf8") : "";
      const planContent = fs.readFileSync(artifacts.planPath, "utf8");

      const userMessages = await db.select().from(messages)
        .where(and(eq(messages.runId, run.id), eq(messages.role, "user")))
        .orderBy(desc(messages.createdAt), desc(messages.id));
      const userIntent = userMessages.map(m => m.content).join("\n\n");

      const prompt = buildReviewerPrompt({
        userIntent,
        specPath: artifacts.specPath ?? "(no spec available)",
        specContent,
        planPath: artifacts.planPath!,
        planContent,
      });

      const reviewerCwd = run.projectPath || process.cwd();
      const { workerId: reviewerName, workerNumber: reviewerWorkerNumber } =
        await allocateWorkerIdentity(run.id);
      const reviewerCreatedAt = new Date();
      await db.insert(workers).values({
        id: reviewerName,
        runId: run.id,
        type: workerType,
        status: "starting",
        cwd: reviewerCwd,
        workerNumber: reviewerWorkerNumber,
        title: `Plan reviewer · round ${roundNumber}`,
        initialPrompt: prompt,
        outputLog: "",
        outputEntriesJson: "",
        currentText: "",
        lastText: "",
        createdAt: reviewerCreatedAt,
        updatedAt: reviewerCreatedAt,
      });
      emitNamedEvent({ kind: "worker.spawned", runId: run.id, workerId: reviewerName, workerType });
      notifyEventStreamSubscribers();

      const { env: envParams } = await readRuntimeEnvFromSettings();
      const reviewerAgent = await spawnAgent({
        type: workerType,
        cwd: reviewerCwd,
        name: reviewerName,
        mode: "slim",
        env: envParams,
      });

      await db.update(workers).set({
        status: "working",
        type: reviewerAgent.type || workerType,
        cwd: reviewerAgent.cwd || reviewerCwd,
        bridgeSessionId: reviewerAgent.sessionId ?? null,
        bridgeSessionMode: reviewerAgent.sessionMode ?? null,
        updatedAt: new Date(),
      }).where(eq(workers.id, reviewerName));
      notifyEventStreamSubscribers();

      const response = await askAgent(reviewerName, prompt);

      let reviewerSnapshot: Awaited<ReturnType<typeof getAgent>> | null = null;
      try {
        reviewerSnapshot = await getAgent(reviewerName);
        await persistWorkerSnapshot(reviewerName, reviewerSnapshot);
      } catch {
        // Bridge may have already dropped the agent; the response still drives findings.
      }

      await db.update(workers).set({
        status: response.state || "idle",
        outputLog: response.response.trim() ? response.response : "",
        bridgeSessionId: reviewerSnapshot?.sessionId ?? reviewerAgent.sessionId ?? null,
        bridgeSessionMode: reviewerSnapshot?.sessionMode ?? reviewerAgent.sessionMode ?? null,
        updatedAt: new Date(),
      }).where(eq(workers.id, reviewerName));
      notifyEventStreamSubscribers();

      const findings = parseReviewerFindings(response.response);

      await db.update(planningReviewRounds).set({
        status: findings.length > 0 ? "revising" : "completed",
        findingsSummary: findings.length > 0 ? `Found ${findings.length} issues.` : "No findings.",
        completedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(planningReviewRounds.id, roundId));

      if (findings.length > 0) {
        for (const f of findings) {
          await db.insert(planningReviewFindings).values({
            id: randomUUID(),
            reviewRunId,
            roundId,
            runId: run.id,
            severity: f.severity,
            category: f.category,
            title: f.title,
            details: f.details,
            recommendation: f.recommendation,
            sourcePath: f.sourcePath,
            createdAt: new Date(),
          });
        }

        await db.update(runs).set({ status: "revising_plan" }).where(eq(runs.id, run.id));

        if (!plannerWorker) throw new Error("Planner worker not found.");
        
        const plannerName = plannerWorker.id;
        try {
          await getAgent(plannerName);
        } catch (error) {
          if (!isRecoverablePlannerAgentMissingError(error)) {
            throw error;
          }
          const spawnParams = {
            type: plannerWorker.type,
            cwd: plannerWorker.cwd,
            name: plannerName,
            env: envParams,
          };
          const savedSessionId = plannerWorker.bridgeSessionId?.trim() || null;
          let resumed = false;
          if (savedSessionId) {
            try {
              const agent = await spawnAgent({ ...spawnParams, resumeSessionId: savedSessionId });
              await db.update(workers).set({
                bridgeSessionId: agent.sessionId ?? savedSessionId,
                bridgeSessionMode: agent.sessionMode ?? plannerWorker.bridgeSessionMode ?? null,
                updatedAt: new Date(),
              }).where(eq(workers.id, plannerName));
              await insertPlannerSessionEvent({
                runId: run.id,
                workerId: plannerName,
                eventType: "worker_session_resumed",
                details: {
                  summary: `Resumed ${plannerName} from saved session before planning revision.`,
                  sessionId: savedSessionId,
                  reason: "planning_review_revision",
                },
              });
              resumed = true;
            } catch (error) {
              if (!isRecoverablePlannerAgentMissingError(error)) {
                throw error;
              }
              const message = error instanceof Error ? error.message : String(error);
              console.warn("[planning/review] planner session no longer resumable; starting a fresh session", {
                plannerName,
                savedSessionId,
                error: message,
              });
              await db.update(workers).set({
                bridgeSessionId: null,
                updatedAt: new Date(),
              }).where(eq(workers.id, plannerName));
            }
          }
          if (!resumed) {
            const agent = await spawnAgent(spawnParams);
            await db.update(workers).set({
              bridgeSessionId: agent.sessionId ?? null,
              bridgeSessionMode: agent.sessionMode ?? null,
              updatedAt: new Date(),
            }).where(eq(workers.id, plannerName));
            await insertPlannerSessionEvent({
              runId: run.id,
              workerId: plannerName,
              eventType: "worker_session_recreated",
              details: {
                summary: `Started a fresh runtime worker for ${plannerName} during planning revision.`,
                rejectedSessionId: savedSessionId,
                newSessionId: agent.sessionId ?? null,
                reason: "planning_review_revision",
              },
            });
            emitNamedEvent({
              kind: "worker.recreated",
              runId: run.id,
              workerId: plannerName,
            });
          } else {
            emitNamedEvent({
              kind: "worker.reattached",
              runId: run.id,
              workerId: plannerName,
            });
          }
        }

        const revisionPrompt = buildPlannerRevisionPrompt({ findings, roundNumber });
        await askAgent(plannerName, revisionPrompt);

        // Update run status back to revising_plan because askAgent might have changed it to working?
        // Actually, askAgent doesn't update the DB. refreshPlanningArtifacts will update it.
        const latestRun = await db.select().from(runs).where(eq(runs.id, run.id)).get();
        await refreshPlanningArtifactsForRun({ run: latestRun || run, status: "revising_plan" });
      }

      await cancelAgent(reviewerName);
      await db.update(workers).set({
        status: "cancelled",
        updatedAt: new Date(),
      }).where(eq(workers.id, reviewerName));
      notifyEventStreamSubscribers();

      await db.update(planningReviewRuns).set({
        roundsCompleted: roundNumber,
        updatedAt: new Date(),
      }).where(eq(planningReviewRuns.id, reviewRunId));

      if (findings.length === 0) {
        break;
      }
    }

    await db.update(planningReviewRuns).set({
      status: "completed",
      completedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(planningReviewRuns.id, reviewRunId));
    emitNamedEvent({
      kind: "plan.review.finished",
      runId: run.id,
      reviewRunId,
      status: "completed",
    });

    // Final refresh to return to 'ready'
    const finalRun = await db.select().from(runs).where(eq(runs.id, run.id)).get();
    await refreshPlanningArtifactsForRun({ run: finalRun || run });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[planning/review] orchestration failed", { reviewRunId, runId: run.id, error: message });
    await db.update(planningReviewRuns).set({
      status: "failed",
      lastError: message || "Review failed with no error message.",
      updatedAt: new Date(),
    }).where(eq(planningReviewRuns.id, reviewRunId));

    await db.update(runs).set({
      status: "ready",
      updatedAt: new Date(),
    }).where(eq(runs.id, run.id));
    notifyEventStreamSubscribers();
    emitNamedEvent({
      kind: "plan.review.finished",
      runId: run.id,
      reviewRunId,
      status: "failed",
    });
    emitNamedEvent({
      kind: "error.surfaced",
      code: "plan.review.failed",
      message: message || "Plan review failed.",
      surface: "banner",
      runId: run.id,
    });
  }
}
