import { db } from "@/server/db";
import {
  runs,
  workers,
  messages,
  planningReviewRuns,
  planningReviewRounds,
  planningReviewFindings,
} from "@/server/db/schema";
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
import { hasReadyPlannerArtifact } from "./status";

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
  const run = await db.select().from(runs).where(eq(runs.id, args.runId)).get();
  if (!run || run.mode !== "planning") {
    throw new Error("Invalid run for planning review.");
  }

  const artifacts = run.plannerArtifactsJson ? JSON.parse(run.plannerArtifactsJson) : null;
  if (!artifacts || !hasReadyPlannerArtifact(artifacts)) {
    throw new Error("No ready plan artifacts found for review.");
  }

  // Check if already reviewing
  if (run.status === "reviewing_plan" || run.status === "revising_plan") {
    throw new Error("A review is already in progress for this plan.");
  }

  const existingReview = await db.select()
    .from(planningReviewRuns)
    .where(and(eq(planningReviewRuns.runId, run.id), eq(planningReviewRuns.status, "running")))
    .get();
  if (existingReview) {
    throw new Error("A review run is already active.");
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

      const reviewerName = `reviewer-${roundId}`;
      const artifacts = JSON.parse(run.plannerArtifactsJson!);
      const specContent = fs.readFileSync(artifacts.specPath, "utf8");
      const planContent = fs.readFileSync(artifacts.planPath, "utf8");
      
      const userMessages = await db.select().from(messages)
        .where(and(eq(messages.runId, run.id), eq(messages.role, "user")))
        .orderBy(desc(messages.createdAt));
      const userIntent = userMessages.map(m => m.content).join("\n\n");

      await spawnAgent({
        type: workerType,
        cwd: run.projectPath || process.cwd(),
        name: reviewerName,
        mode: "slim",
      });

      const prompt = buildReviewerPrompt({
        userIntent,
        specPath: artifacts.specPath!,
        specContent,
        planPath: artifacts.planPath!,
        planContent,
      });

      const response = await askAgent(reviewerName, prompt);
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
        } catch {
          await spawnAgent({
            type: plannerWorker.type,
            cwd: plannerWorker.cwd,
            name: plannerName,
            resumeSessionId: plannerWorker.bridgeSessionId || undefined,
          });
        }

        const revisionPrompt = buildPlannerRevisionPrompt({ findings, roundNumber });
        await askAgent(plannerName, revisionPrompt);

        // Update run status back to revising_plan because askAgent might have changed it to working?
        // Actually, askAgent doesn't update the DB. refreshPlanningArtifacts will update it.
        await refreshPlanningArtifactsForRun({ run, status: "revising_plan" });
      }

      await cancelAgent(reviewerName);

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

    // Final refresh to return to 'ready'
    await refreshPlanningArtifactsForRun({ run });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await db.update(planningReviewRuns).set({
      status: "failed",
      lastError: message,
      updatedAt: new Date(),
    }).where(eq(planningReviewRuns.id, reviewRunId));

    await db.update(runs).set({
      status: "failed",
      lastError: `Planning review failed: ${message}`,
      updatedAt: new Date(),
    }).where(eq(runs.id, run.id));
  }
}
