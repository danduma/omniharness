/**
 * Reproduces the bug: a leftover planningReviewRuns row blocks a new
 * review request. Previously this was a silent throw. We now expect
 * `plan.review.blocked` + `error.surfaced` to be emitted.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

import { db } from "@/server/db";
import {
  plans,
  planningReviewFindings,
  planningReviewRounds,
  planningReviewRuns,
  runs,
  workers,
  messages,
} from "@/server/db/schema";
import { startPlanningReview } from "@/server/planning/review";
import {
  __getRingForTests,
  __resetNamedEventsForTests,
} from "@/server/events/named-events";

vi.mock("@/server/plans/readiness-pipeline", () => ({
  ensureReadinessVerdict: vi.fn().mockResolvedValue({ verdict: "ready", planHash: "h" }),
  loadCachedReadinessRecord: vi.fn().mockResolvedValue(null),
  hashPlanMarkdown: () => "h",
}));

// Refresh would rebuild plannerArtifactsJson from disk scans, which we
// don't care about here — we want the leftover-review check to fire.
vi.mock("@/server/planning/refresh", () => ({
  refreshPlanningArtifactsForRun: vi.fn().mockResolvedValue({ status: "ready" }),
}));

const PLAN_ID = "plan-blocked";
const RUN_ID = "run-blocked";

describe("plan.review.blocked named event", () => {
  beforeEach(async () => {
    __resetNamedEventsForTests();
    await db.delete(planningReviewFindings);
    await db.delete(planningReviewRounds);
    await db.delete(planningReviewRuns);
    await db.delete(messages);
    await db.delete(workers);
    await db.delete(runs);
    await db.delete(plans);

    const now = new Date();
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "omni-plan-blocked-"));
    const planPath = path.join(cwd, "plan.md");
    fs.writeFileSync(planPath, "## Phase 1\n- [ ] Task\n");

    await db.insert(plans).values({
      id: PLAN_ID,
      path: planPath,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: RUN_ID,
      planId: PLAN_ID,
      mode: "planning",
      projectPath: cwd,
      title: "Blocked review test",
      preferredWorkerType: "codex",
      allowedWorkerTypes: "codex",
      status: "ready",
      specPath: null,
      artifactPlanPath: planPath,
      plannerArtifactsJson: JSON.stringify({
        planPath,
        specPath: null,
        candidates: [{ kind: "plan", path: planPath, exists: true }],
      }),
      createdAt: now,
      updatedAt: now,
    });

    // The leftover state: a running review run from a previous attempt.
    await db.insert(planningReviewRuns).values({
      id: "review-leftover",
      runId: RUN_ID,
      status: "running",
      agentSelection: "auto",
      roundsRequested: 1,
      startedAt: new Date(Date.now() + 60_000),
      createdAt: now,
      updatedAt: new Date(Date.now() + 60_000),
    });
  });

  it("emits plan.review.blocked + error.surfaced when a leftover running review blocks a new one", async () => {
    await expect(
      startPlanningReview({ runId: RUN_ID, agentSelection: "auto", rounds: 1 }),
    ).rejects.toThrow(/already active/i);

    const ring = __getRingForTests();
    const blocked = ring.filter((entry) => entry.event.kind === "plan.review.blocked");
    expect(blocked).toHaveLength(1);
    expect(blocked[0]!.event).toMatchObject({
      kind: "plan.review.blocked",
      runId: RUN_ID,
      reason: "leftover_state",
    });

    const surfaced = ring.filter((entry) => entry.event.kind === "error.surfaced");
    expect(surfaced).toHaveLength(1);
    expect(surfaced[0]!.event).toMatchObject({
      kind: "error.surfaced",
      code: "plan.review.leftover_state",
      runId: RUN_ID,
      surface: "banner",
    });
  });
});
