import { randomUUID } from "crypto";
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { plans, runs, workers } from "@/server/db/schema";

async function createRun() {
  const now = new Date(0);
  const planId = randomUUID();
  const runId = randomUUID();

  await db.insert(plans).values({
    id: planId,
    path: `vibes/ad-hoc/${planId}.md`,
    status: "running",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(runs).values({
    id: runId,
    planId,
    mode: "implementation",
    status: "running",
    createdAt: now,
    updatedAt: now,
  });

  return runId;
}

describe("worker active work duration", () => {
  it("accumulates only working intervals across status changes", async () => {
    const runId = await createRun();
    const workerId = `${runId}-worker-1`;

    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "codex",
      status: "starting",
      cwd: process.cwd(),
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });

    await db.update(workers).set({ status: "working", updatedAt: new Date(1_000) }).where(eq(workers.id, workerId));
    await db.update(workers).set({ currentText: "still working", updatedAt: new Date(5_000) }).where(eq(workers.id, workerId));
    await db.update(workers).set({ status: "idle", updatedAt: new Date(7_000) }).where(eq(workers.id, workerId));
    await db.update(workers).set({ status: "stuck", updatedAt: new Date(9_000) }).where(eq(workers.id, workerId));
    await db.update(workers).set({ status: "working", updatedAt: new Date(10_000) }).where(eq(workers.id, workerId));
    await db.update(workers).set({ status: "idle", updatedAt: new Date(12_000) }).where(eq(workers.id, workerId));

    const worker = await db.select().from(workers).where(eq(workers.id, workerId)).get();

    expect(worker?.activeWorkStartedAt).toBeNull();
    expect(worker?.activeWorkDurationMs).toBe(8_000);
  });
});
