/**
 * Plan review must publish who reviews whom, so the office view can draw the
 * review relationship without guessing from worker titles:
 *   worker.review_started (reviewer -> planner) ... worker.review_finished.
 * The reviewer is persisted with workerRole "plan_review" so clients can
 * group it into the review room.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
  executionEvents,
  messages,
  planningReviewFindings,
  planningReviewRounds,
  planningReviewRuns,
  plans,
  runs,
  workerCounters,
  workers,
} from "@/server/db/schema";
import { eventsRouteModule as eventsRoute, planningReviewRouteModule as reviewRoute } from "@/../tests/helpers/runtime-routes";
import { startLifecycleHarness, type LifecycleServer } from "../harness/server";
import { LifecycleClient } from "../harness/client";
import { Chaos, NO_CHAOS } from "../harness/chaos";
import { __resetNamedEventsForTests } from "@/server/events/named-events";

vi.mock("@/server/plans/readiness-pipeline", () => ({
  ensureReadinessVerdict: vi.fn().mockResolvedValue({ verdict: "ready", planHash: "h" }),
  loadCachedReadinessRecord: vi.fn().mockResolvedValue(null),
  hashPlanMarkdown: () => "h",
}));

vi.mock("@/server/planning/refresh", () => ({
  refreshPlanningArtifactsForRun: vi.fn().mockResolvedValue({ status: "ready" }),
}));

vi.mock("@/server/bridge-client", () => ({
  spawnAgent: vi.fn().mockResolvedValue({
    name: "reviewer",
    type: "codex",
    state: "working",
    sessionId: "review-session",
    sessionMode: null,
    cwd: os.tmpdir(),
  }),
  askAgent: vi.fn().mockResolvedValue({ response: "No findings. The plan is ready.", state: "idle" }),
  getAgent: vi.fn().mockResolvedValue({ state: "idle", sessionId: "review-session", sessionMode: null }),
  cancelAgent: vi.fn().mockResolvedValue(undefined),
  BRIDGE_URL: "http://localhost:0",
}));

// Reviewer selection checks that the agent CLI is installed on this host;
// that is environment, not what this scenario covers.
vi.mock("@/server/supervisor/worker-availability", async () => ({
  ...(await vi.importActual<typeof import("@/server/supervisor/worker-availability")>("@/server/supervisor/worker-availability")),
  isSpawnableWorkerType: () => ({ ok: true }),
}));

vi.mock("@/server/quota/type-blocking", async () => ({
  ...(await vi.importActual<typeof import("@/server/quota/type-blocking")>("@/server/quota/type-blocking")),
  isWorkerTypeQuotaBlocked: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/server/workers/snapshots", () => ({
  persistWorkerSnapshot: vi.fn().mockResolvedValue(undefined),
}));

const PLAN_ID = "plan-review-relations";
const RUN_ID = "run-review-relations";
const PLANNER_ID = `${RUN_ID}-worker-1`;

let server: LifecycleServer;
let client: LifecycleClient;
let tempDir: string;

beforeEach(async () => {
  __resetNamedEventsForTests();
  await db.delete(executionEvents);
  await db.delete(messages);
  await db.delete(planningReviewFindings);
  await db.delete(planningReviewRounds);
  await db.delete(planningReviewRuns);
  await db.delete(workers);
  await db.delete(workerCounters);
  await db.delete(runs);
  await db.delete(plans);

  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "omni-review-relations-"));
  const planPath = path.join(tempDir, "plan.md");
  fs.writeFileSync(planPath, "## Phase 1\n- [ ] Task\n");

  const now = new Date();
  await db.insert(plans).values({ id: PLAN_ID, path: planPath, status: "pending", createdAt: now, updatedAt: now });
  await db.insert(runs).values({
    id: RUN_ID,
    planId: PLAN_ID,
    mode: "planning",
    projectPath: tempDir,
    title: "Plan review relations",
    preferredWorkerType: "codex",
    allowedWorkerTypes: JSON.stringify(["codex"]),
    status: "ready",
    plannerArtifactsJson: JSON.stringify({
      planPath,
      specPath: null,
      candidates: [{ kind: "plan", path: planPath, exists: true }],
    }),
    artifactPlanPath: planPath,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(workers).values({
    id: PLANNER_ID,
    runId: RUN_ID,
    type: "codex",
    status: "idle",
    cwd: tempDir,
    workerNumber: 1,
    title: "Planner",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(workerCounters).values({ runId: RUN_ID, nextNumber: 2, updatedAt: now }).onConflictDoNothing();

  server = await startLifecycleHarness({
    routes: [
      { pattern: "/api/events", module: eventsRoute },
      { pattern: "/api/planning/:id/review", module: reviewRoute },
    ],
  });
  client = new LifecycleClient({ baseUrl: server.baseUrl, chaos: new Chaos(11, NO_CHAOS) });
});

afterEach(async () => {
  await client.close();
  await server.stop();
  vi.clearAllMocks();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe("plan review relationship events", () => {
  it("publishes reviewer -> planner start and finish, and tags the reviewer's role", { timeout: 30_000 }, async () => {
    await client.bootstrapSnapshot(RUN_ID);
    await client.subscribe({ runId: RUN_ID });

    const res = await client.fetch(`/api/planning/${RUN_ID}/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agentSelection: "auto", rounds: 1 }),
    });
    expect(res.status).toBe(200);

    const started = await client.waitFor("worker.review_started", { timeoutMs: 10_000 });
    const startedPayload = started.payload as { reviewerWorkerId: string };
    expect(started.payload).toMatchObject({
      kind: "worker.review_started",
      runId: RUN_ID,
      subjectWorkerId: PLANNER_ID,
      reviewKind: "plan",
      round: 1,
    });
    expect(startedPayload.reviewerWorkerId).not.toBe(PLANNER_ID);

    const finished = await client.waitFor("worker.review_finished", { timeoutMs: 10_000 });
    expect(finished.payload).toMatchObject({
      kind: "worker.review_finished",
      runId: RUN_ID,
      reviewerWorkerId: startedPayload.reviewerWorkerId,
      subjectWorkerId: PLANNER_ID,
      outcome: "no_findings",
    });

    const reviewer = await db.select().from(workers).where(eq(workers.id, startedPayload.reviewerWorkerId)).get();
    expect(reviewer?.workerRole).toBe("plan_review");
  });
});
