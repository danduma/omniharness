import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { eq } from "drizzle-orm";
import { plans, runs, workerCounters, workers } from "@/server/db/schema";
import { allocateWorkerIdentity } from "@/server/workers/ids";

describe("worker id allocation", () => {
  beforeEach(async () => {
    await db.delete(workers);
    await db.delete(workerCounters);
    await db.delete(runs);
    await db.delete(plans);
  });

  it("allocates per-run worker numbers without making them globally unique", async () => {
    const now = new Date();
    await db.insert(plans).values({
      id: "plan-a",
      path: "vibes/ad-hoc/plan-a.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values([
      {
        id: "run-a",
        planId: "plan-a",
        status: "running",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "run-b",
        planId: "plan-a",
        status: "running",
        createdAt: now,
        updatedAt: now,
      },
    ]);

    await expect(allocateWorkerIdentity("run-a")).resolves.toEqual({
      workerId: "run-a-worker-1",
      workerNumber: 1,
    });
    await expect(allocateWorkerIdentity("run-a")).resolves.toEqual({
      workerId: "run-a-worker-2",
      workerNumber: 2,
    });
    await expect(allocateWorkerIdentity("run-b")).resolves.toEqual({
      workerId: "run-b-worker-1",
      workerNumber: 1,
    });
  });

  it("seeds a new counter from existing workers on old runs", async () => {
    const now = new Date();
    await db.insert(plans).values({
      id: "plan-existing",
      path: "vibes/ad-hoc/plan-existing.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: "run-existing",
      planId: "plan-existing",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(workers).values([
      {
        id: "run-existing-worker-1",
        runId: "run-existing",
        type: "codex",
        status: "done",
        cwd: "/tmp/project",
        workerNumber: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "run-existing-worker-2",
        runId: "run-existing",
        type: "codex",
        status: "done",
        cwd: "/tmp/project",
        workerNumber: null,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    await expect(allocateWorkerIdentity("run-existing")).resolves.toEqual({
      workerId: "run-existing-worker-3",
      workerNumber: 3,
    });

    const counter = await db.select().from(workerCounters).where(eq(workerCounters.runId, "run-existing")).get();
    expect(counter?.nextNumber).toBe(3);
  });
});
