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

  it("coalesces concurrent schedules for the same run without primary key conflicts", async () => {
    const runId = await insertRun();
    const earlier = new Date(baseNow.getTime() + 60_000);
    const later = new Date(baseNow.getTime() + 120_000);

    await expect(Promise.all([
      scheduleDurableSupervisorWakeAt({
        runId,
        wakeAt: later,
        reason: "quota_wait",
        source: "absolute-timestamp",
      }),
      scheduleDurableSupervisorWakeAt({
        runId,
        wakeAt: earlier,
        reason: "quota_wait",
        source: "relative-duration",
      }),
    ])).resolves.toHaveLength(2);

    const rows = await db.select().from(supervisorScheduledWakes).where(eq(supervisorScheduledWakes.runId, runId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.wakeAt.getTime()).toBe(earlier.getTime());
    expect(rows[0]?.source).toBe("relative-duration");
  });

  it("preserves quota resume wakes over earlier supervisor heartbeat backups", async () => {
    const runId = await insertRun();
    const quotaReset = new Date(baseNow.getTime() + 120_000);
    const heartbeat = new Date(baseNow.getTime() + 60_000);

    await scheduleDurableSupervisorWakeAt({ runId, wakeAt: quotaReset, reason: "quota_wait" });
    await scheduleDurableSupervisorWakeAt({ runId, wakeAt: heartbeat, reason: "supervisor_wait" });

    const row = await db.select().from(supervisorScheduledWakes).where(eq(supervisorScheduledWakes.runId, runId)).get();
    expect(row).toMatchObject({
      reason: "quota_wait",
    });
    expect(row?.wakeAt.getTime()).toBe(quotaReset.getTime());
  });

  it("replaces supervisor heartbeat backups with quota resume wakes", async () => {
    const runId = await insertRun();
    const heartbeat = new Date(baseNow.getTime() + 60_000);
    const quotaReset = new Date(baseNow.getTime() + 120_000);

    await scheduleDurableSupervisorWakeAt({ runId, wakeAt: heartbeat, reason: "supervisor_wait" });
    await scheduleDurableSupervisorWakeAt({ runId, wakeAt: quotaReset, reason: "quota_wait" });

    const row = await db.select().from(supervisorScheduledWakes).where(eq(supervisorScheduledWakes.runId, runId)).get();
    expect(row).toMatchObject({
      reason: "quota_wait",
    });
    expect(row?.wakeAt.getTime()).toBe(quotaReset.getTime());
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

  it("fires future durable wakes after an in-memory scheduler restart", async () => {
    const runId = await insertRun();
    const executor = vi.fn(async () => {});
    setDurableSupervisorWakeExecutorForTests(executor);
    await scheduleDurableSupervisorWakeAt({
      runId,
      wakeAt: new Date(baseNow.getTime() + 5_000),
      reason: "quota_wait",
      source: "absolute-timestamp",
      details: { resetAt: new Date(baseNow.getTime() + 5_000).toISOString() },
    });

    resetDurableSupervisorWakeSchedulerForTests();
    setDurableSupervisorWakeExecutorForTests(executor);
    await rehydrateDurableSupervisorWakes();

    await vi.advanceTimersByTimeAsync(4_999);
    expect(executor).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(executor).toHaveBeenCalledTimes(1);
    expect(executor).toHaveBeenCalledWith(runId);
    const row = await db.select().from(supervisorScheduledWakes).where(eq(supervisorScheduledWakes.runId, runId)).get();
    expect(row?.details).toBe(JSON.stringify({ resetAt: new Date(baseNow.getTime() + 5_000).toISOString() }));
  });

  it("drops persisted wakes for terminal runs during restart rehydration", async () => {
    const runId = await insertRun("done");
    const executor = vi.fn(async () => {});
    setDurableSupervisorWakeExecutorForTests(executor);
    await scheduleDurableSupervisorWakeAt({
      runId,
      wakeAt: new Date(baseNow.getTime() + 1_000),
      reason: "quota_wait",
    });

    resetDurableSupervisorWakeSchedulerForTests();
    setDurableSupervisorWakeExecutorForTests(executor);
    await rehydrateDurableSupervisorWakes();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(executor).not.toHaveBeenCalled();
    expect(await db.select().from(supervisorScheduledWakes).where(eq(supervisorScheduledWakes.runId, runId)).get()).toBeUndefined();
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
