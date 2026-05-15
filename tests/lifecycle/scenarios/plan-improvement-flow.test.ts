/**
 * Plan improvement end-to-end:
 *   1. Set up a planning run with a ready plan.
 *   2. POST /api/planning/:id/review → review starts.
 *   3. Assert `plan.review.started` + `worker.spawned` (for the reviewer).
 *   4. Drop the SSE, simulate restart (ring reset), reconnect.
 *   5. Verify resync flow surfaces correctly.
 *
 * Closes one of the user-cited workflows: "plan is ready, user
 * requests plan improvement, agents run, server restarts, we
 * reconnect."
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

import * as eventsRoute from "@/app/api/events/route";
import * as reviewRoute from "@/app/api/planning/[id]/review/route";

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
    cwd: "/tmp",
  }),
  // `askAgent` is what reviewer orchestration awaits. Returning a slow
  // promise lets us observe plan.review.started before the run
  // completes.
  askAgent: vi.fn().mockImplementation(() => new Promise(() => {})),
  getAgent: vi.fn().mockResolvedValue({
    state: "working",
    sessionId: "review-session",
    sessionMode: null,
  }),
  cancelAgent: vi.fn().mockResolvedValue(undefined),
  BRIDGE_URL: "http://localhost:0",
}));

vi.mock("@/server/workers/snapshots", () => ({
  persistWorkerSnapshot: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/workers/ids", async () => {
  const actual = await vi.importActual<typeof import("@/server/workers/ids")>(
    "@/server/workers/ids",
  );
  return actual;
});

let server: LifecycleServer;
let client: LifecycleClient;

const PLAN_ID = "plan-improvement";
const RUN_ID = "run-improvement";

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

  const now = new Date();
  await db.insert(plans).values({
    id: PLAN_ID,
    path: "/tmp/improvement.md",
    status: "pending",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(runs).values({
    id: RUN_ID,
    planId: PLAN_ID,
    mode: "planning",
    projectPath: "/tmp",
    title: "Plan improvement",
    preferredWorkerType: "codex",
    allowedWorkerTypes: JSON.stringify(["codex"]),
    status: "ready",
    plannerArtifactsJson: JSON.stringify({
      planPath: "/tmp/improvement.md",
      specPath: null,
      candidates: [{ kind: "plan", path: "/tmp/improvement.md", exists: true }],
    }),
    artifactPlanPath: "/tmp/improvement.md",
    createdAt: now,
    updatedAt: now,
  });
  // The reviewer reads spec/plan from disk; provide minimal stubs.
  const fs = await import("node:fs");
  if (!fs.existsSync("/tmp/improvement.md")) {
    fs.writeFileSync("/tmp/improvement.md", "## Phase 1\n- [ ] Task\n");
  }

  server = await startLifecycleHarness({
    routes: [
      { pattern: "/api/events", module: eventsRoute },
      { pattern: "/api/planning/:id/review", module: reviewRoute },
    ],
  });
  client = new LifecycleClient({
    baseUrl: server.baseUrl,
    chaos: new Chaos(9, NO_CHAOS),
  });
});

afterEach(async () => {
  await client.close();
  await server.stop();
  vi.clearAllMocks();
});

describe("lifecycle harness — plan improvement", () => {
  it("starts a review run, emits plan.review.started + worker.spawned, survives a restart", { timeout: 30_000 }, async () => {
    await client.bootstrapSnapshot(RUN_ID);
    await client.subscribe({ runId: RUN_ID });

    const res = await client.fetch(`/api/planning/${RUN_ID}/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agentSelection: "auto", rounds: 1 }),
    });
    expect(res.status).toBe(200);

    const started = await client.waitFor("plan.review.started", { timeoutMs: 10_000 });
    expect(started.payload).toMatchObject({
      kind: "plan.review.started",
      runId: RUN_ID,
    });

    // Reviewer worker should be spawned.
    const spawned = await client.waitFor("worker.spawned", {
      predicate: (frame) => (frame.payload as { runId?: string } | null)?.runId === RUN_ID,
      timeoutMs: 10_000,
    });
    expect(spawned.payload).toMatchObject({
      kind: "worker.spawned",
      runId: RUN_ID,
    });
    const resumeId = client.resumeIdNow();

    // Simulate server restart mid-review. The ring is wiped; reconnect
    // with a stale Last-Event-ID must trigger stream.resync_required
    // rather than silently lose state.
    client.dropSse();
    server.simulateRestart();
    await client.subscribe({ runId: RUN_ID, resumeFrom: resumeId });
    const resync = await client.waitFor("stream.resync_required", { timeoutMs: 10_000 });
    expect(resync.payload).toMatchObject({ reason: "id_out_of_buffer" });

    // The DB still holds the review run row — restart preserves persisted state.
    const reviewRows = (await db.select().from(planningReviewRuns)).filter(
      (r) => r.runId === RUN_ID,
    );
    expect(reviewRows).toHaveLength(1);
    expect(reviewRows[0]!.status).toBe("running");
  });
});
