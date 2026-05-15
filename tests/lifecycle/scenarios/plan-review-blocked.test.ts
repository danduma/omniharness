/**
 * The plan-review-blocked silent-throw bug, end-to-end through HTTP.
 *
 * Setup: a `runs` row in planning mode + a leftover `planningReviewRuns`
 * row in status="running" — the exact corrupt state the original bug
 * report described. The fix is twofold: (1) the API returns 409 with a
 * structured error, (2) the SSE stream carries `plan.review.blocked` +
 * `error.surfaced` so the UI can surface a user-visible message.
 *
 * This scenario asserts both at once.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { executionEvents, planningReviewRuns } from "@/server/db/schema";

import * as eventsRoute from "@/app/api/events/route";
import * as planningReviewRoute from "@/app/api/planning/[id]/review/route";

import { startLifecycleHarness, type LifecycleServer } from "../harness/server";
import { LifecycleClient } from "../harness/client";
import { Chaos, NO_CHAOS } from "../harness/chaos";
import {
  clearLifecycleSchema,
  seedPlanningRunWithLeftoverReview,
} from "../harness/fixtures";
import { __resetNamedEventsForTests } from "@/server/events/named-events";

vi.mock("@/server/plans/readiness-pipeline", () => ({
  ensureReadinessVerdict: vi.fn().mockResolvedValue({ verdict: "ready", planHash: "h" }),
  loadCachedReadinessRecord: vi.fn().mockResolvedValue(null),
  hashPlanMarkdown: () => "h",
}));

// Skip the disk-walking refresh so we get to the leftover-review check
// without needing a real plan tree on disk.
vi.mock("@/server/planning/refresh", () => ({
  refreshPlanningArtifactsForRun: vi.fn().mockResolvedValue({ status: "ready" }),
}));

let server: LifecycleServer;
let client: LifecycleClient;

beforeEach(async () => {
  __resetNamedEventsForTests();
  await db.delete(executionEvents);
  await db.delete(planningReviewRuns);
  await clearLifecycleSchema();
  server = await startLifecycleHarness({
    routes: [
      { pattern: "/api/events", module: eventsRoute },
      { pattern: "/api/planning/:id/review", module: planningReviewRoute },
    ],
  });
  client = new LifecycleClient({
    baseUrl: server.baseUrl,
    chaos: new Chaos(4, NO_CHAOS),
  });
});

afterEach(async () => {
  await client.close();
  await server.stop();
});

describe("lifecycle harness — plan.review.blocked end-to-end", () => {
  it("returns 409 and emits plan.review.blocked + error.surfaced on the SSE stream", async () => {
    const { runId } = await seedPlanningRunWithLeftoverReview();
    await client.bootstrapSnapshot(runId);
    await client.subscribe({ runId });

    const res = await client.fetch(`/api/planning/${runId}/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agentSelection: "auto", rounds: 1 }),
    });
    expect(res.status).toBe(409);

    const blocked = await client.waitFor("plan.review.blocked", { timeoutMs: 4_000 });
    expect(blocked.payload).toMatchObject({
      kind: "plan.review.blocked",
      runId,
      reason: "leftover_state",
    });

    const surfaced = await client.waitFor("error.surfaced", {
      predicate: (frame) => (frame.payload as { code?: string } | null)?.code === "plan.review.leftover_state",
      timeoutMs: 4_000,
    });
    expect(surfaced.payload).toMatchObject({
      code: "plan.review.leftover_state",
      runId,
      surface: "banner",
    });
  });
});
