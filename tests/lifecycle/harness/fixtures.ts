/**
 * DB-seeding helpers for lifecycle scenarios. These mutate the shared
 * test sqlite via the same drizzle handle the routes use, so the
 * harness server sees them.
 */
import { db } from "@/server/db";
import { plans, runs, workers, planningReviewRuns } from "@/server/db/schema";

export interface SeededRun {
  planId: string;
  runId: string;
  workerId?: string;
}

export async function seedDirectRun(overrides: Partial<SeededRun> = {}): Promise<SeededRun> {
  const planId = overrides.planId ?? `plan-${Math.random().toString(36).slice(2, 10)}`;
  const runId = overrides.runId ?? `run-${Math.random().toString(36).slice(2, 10)}`;
  const now = new Date();
  await db.insert(plans).values({
    id: planId,
    path: `/tmp/${planId}.md`,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(runs).values({
    id: runId,
    planId,
    mode: "direct",
    title: "Lifecycle scenario",
    status: "ready",
    createdAt: now,
    updatedAt: now,
  });
  return { planId, runId };
}

export async function seedPlanningRunWithLeftoverReview(): Promise<SeededRun & { leftoverReviewId: string }> {
  const planId = `plan-${Math.random().toString(36).slice(2, 10)}`;
  const runId = `run-${Math.random().toString(36).slice(2, 10)}`;
  const leftoverReviewId = `review-${Math.random().toString(36).slice(2, 10)}`;
  const now = new Date();
  await db.insert(plans).values({
    id: planId,
    path: `/tmp/${planId}.md`,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(runs).values({
    id: runId,
    planId,
    mode: "planning",
    title: "Lifecycle planning",
    status: "ready",
    plannerArtifactsJson: JSON.stringify({
      planPath: `/tmp/${planId}.md`,
      specPath: null,
      candidates: [{ kind: "plan", path: `/tmp/${planId}.md`, exists: true }],
    }),
    artifactPlanPath: `/tmp/${planId}.md`,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(planningReviewRuns).values({
    id: leftoverReviewId,
    runId,
    status: "running",
    agentSelection: "auto",
    roundsRequested: 1,
    startedAt: new Date(Date.now() + 60_000),
    createdAt: now,
    updatedAt: new Date(Date.now() + 60_000),
  });
  return { planId, runId, leftoverReviewId };
}

export async function clearLifecycleSchema(): Promise<void> {
  // Order matters for the FK graph.
  const tables: Array<() => Promise<unknown>> = [];
  // Pull in only tables we touch in scenarios; other tables (messages,
  // executionEvents, etc.) are cleared by individual scenario beforeEach.
  tables.push(() => db.delete(planningReviewRuns));
  tables.push(() => db.delete(workers));
  tables.push(() => db.delete(runs));
  tables.push(() => db.delete(plans));
  for (const fn of tables) {
    await fn();
  }
}
