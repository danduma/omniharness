import { randomUUID } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { plans, runs, supervisorScheduledWakes } from "@/server/db/schema";
import {
  cancelDurableSupervisorWake,
  claimDueDurableSupervisorWake,
  rehydrateDurableSupervisorWakes,
  resetDurableSupervisorWakeSchedulerForTests,
  scheduleDurableSupervisorWakeAt,
  setDurableSupervisorWakeExecutorForTests,
} from "@/server/supervisor/wake-schedule";

const baseNow = new Date("2026-05-10T10:00:00.000Z");

async function insertRun(status = "quota_waiting") {
  const planId = randomUUID();
  const runId = randomUUID();
  await db.insert(plans).values({
    id: planId,
    path: "vibes/ad-hoc/quota.md",
    status: "running",
    createdAt: baseNow,
    updatedAt: baseNow,
  });
  await db.insert(runs).values({
    id: runId,
    planId,
    mode: "implementation",
    status,
    createdAt: baseNow,
    updatedAt: baseNow,
  });
  return runId;
}

describe("durable supervisor wake schedule", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(baseNow);
    resetDurableSupervisorWakeSchedulerForTests();
    await db.delete(supervisorScheduledWakes);
    await db.delete(runs);
    await db.delete(plans);
  });

  afterEach(() => {
    resetDurableSupervisorWakeSchedulerForTests();
    vi.useRealTimers();
  });

  it("keeps an earlier durable wake instead of replacing it with a later one", async () => {
    const runId = await insertRun();
    const earlier = new Date(baseNow.getTime() + 60_000);
    const later = new Date(baseNow.getTime() + 120_000);

    await scheduleDurableSupervisorWakeAt({
      runId,
      wakeAt: earlier,
      reason: "quota_wait",
      source: "relative-duration",
    });
    await scheduleDurableSupervisorWakeAt({
      runId,
      wakeAt: later,
      reason: "quota_wait",
      source: "absolute-timestamp",
    });

    const row = await db.select().from(supervisorScheduledWakes).where(eq(supervisorScheduledWakes.runId, runId)).get();
    expect(row?.wakeAt.getTime()).toBe(earlier.getTime());
    expect(row?.source).toBe("relative-duration");
  });

  it("replaces a later durable wake with an earlier one", async () => {
    const runId = await insertRun();
    const later = new Date(baseNow.getTime() + 120_000);
    const earlier = new Date(baseNow.getTime() + 60_000);

    await scheduleDurableSupervisorWakeAt({ runId, wakeAt: later, reason: "quota_wait" });
    await scheduleDurableSupervisorWakeAt({ runId, wakeAt: earlier, reason: "quota_wait" });

    const row = await db.select().from(supervisorScheduledWakes).where(eq(supervisorScheduledWakes.runId, runId)).get();
    expect(row?.wakeAt.getTime()).toBe(earlier.getTime());
  });

  it("claims and removes only due durable wakes", async () => {
    const runId = await insertRun();
    await scheduleDurableSupervisorWakeAt({
      runId,
      wakeAt: new Date(baseNow.getTime() + 1_000),
      reason: "quota_wait",
      details: { incidentId: "incident-1" },
    });

    await expect(claimDueDurableSupervisorWake(runId, baseNow.getTime())).resolves.toBeNull();

    const claimed = await claimDueDurableSupervisorWake(runId, baseNow.getTime() + 1_000);
    expect(claimed).toMatchObject({
      runId,
      reason: "quota_wait",
    });
    expect(await db.select().from(supervisorScheduledWakes).where(eq(supervisorScheduledWakes.runId, runId)).get()).toBeUndefined();
  });

  it("rehydrates due rows and schedules the durable executor once", async () => {
    const runId = await insertRun();
    const executor = vi.fn(async () => {});
    setDurableSupervisorWakeExecutorForTests(executor);
    await scheduleDurableSupervisorWakeAt({
      runId,
      wakeAt: new Date(baseNow.getTime() - 1_000),
      reason: "quota_wait",
    });

    await rehydrateDurableSupervisorWakes();
    await vi.advanceTimersByTimeAsync(0);

    expect(executor).toHaveBeenCalledTimes(1);
    expect(executor).toHaveBeenCalledWith(runId);
  });

  it("cancels durable rows and in-memory timers", async () => {
    const runId = await insertRun();
    const executor = vi.fn(async () => {});
    setDurableSupervisorWakeExecutorForTests(executor);
    await scheduleDurableSupervisorWakeAt({
      runId,
      wakeAt: new Date(baseNow.getTime() + 1_000),
      reason: "quota_wait",
    });

    await cancelDurableSupervisorWake(runId);
    await vi.advanceTimersByTimeAsync(1_000);

    expect(executor).not.toHaveBeenCalled();
    expect(await db.select().from(supervisorScheduledWakes).where(eq(supervisorScheduledWakes.runId, runId)).get()).toBeUndefined();
  });
});
