import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { plans, runGoalOperations, runGoalOutbox, runGoals, runs } from "@/server/db/schema";
import { buildPersistedEventPayload } from "@/server/events/persisted-snapshot";
import { goalControl } from "@/server/runs/goal-control";

describe("persisted goal snapshots", () => {
  beforeEach(async () => {
    await db.delete(runGoalOutbox);
    await db.delete(runGoalOperations);
    await db.delete(runGoals);
    await db.delete(runs);
    await db.delete(plans);
    const now = new Date();
    await db.insert(plans).values({ id: "goal-snapshot-plan", path: "/tmp/goal-snapshot.md", status: "running", createdAt: now, updatedAt: now });
    await db.insert(runs).values({ id: "goal-snapshot-run", planId: "goal-snapshot-plan", status: "running", createdAt: now, updatedAt: now });
  });

  it("includes the selected run's complete canonical goal", async () => {
    await goalControl.putGoal({
      runId: "goal-snapshot-run",
      goalId: "goal-1",
      expectedRevision: 0,
      operationId: "goal-snapshot-op",
      principalId: "test",
      endpoint: "goal.put",
      objective: "Keep bootstrap authoritative",
    });

    const payload = await buildPersistedEventPayload({ selectedRunId: "goal-snapshot-run" });
    expect(payload.goalsByRunId).toMatchObject({
      "goal-snapshot-run": {
        goalId: "goal-1",
        revision: 1,
        objective: "Keep bootstrap authoritative",
        provenance: { source: "server", complete: true },
      },
    });
  });
});
