import { randomUUID } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { messages, plans, runs, settings, workerCounters } from "@/server/db/schema";

const { mockStartSupervisorRun } = vi.hoisted(() => ({
  mockStartSupervisorRun: vi.fn(),
}));

vi.mock("@/server/supervisor/start", () => ({
  startSupervisorRun: mockStartSupervisorRun,
}));

describe("supervisor runtime watchdog", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await db.delete(messages);
    await db.delete(settings);
    await db.delete(workerCounters);
    await db.delete(runs);
    await db.delete(plans);
  });

  it("reattaches supervision only for implementation runs that are still marked running", async () => {
    const runningPlanId = randomUUID();
    const donePlanId = randomUUID();
    const directPlanId = randomUUID();
    const planningPlanId = randomUUID();
    const runningRunId = randomUUID();
    const doneRunId = randomUUID();
    const directRunId = randomUUID();
    const planningRunId = randomUUID();
    const now = new Date();

    await db.insert(plans).values([
      { id: runningPlanId, path: "vibes/ad-hoc/running.md", status: "running", createdAt: now, updatedAt: now },
      { id: donePlanId, path: "vibes/ad-hoc/done.md", status: "done", createdAt: now, updatedAt: now },
      { id: directPlanId, path: "vibes/ad-hoc/direct.md", status: "running", createdAt: now, updatedAt: now },
      { id: planningPlanId, path: "vibes/ad-hoc/planning.md", status: "running", createdAt: now, updatedAt: now },
    ]);

    await db.insert(runs).values([
      { id: runningRunId, planId: runningPlanId, mode: "implementation", status: "running", createdAt: now, updatedAt: now },
      { id: doneRunId, planId: donePlanId, mode: "implementation", status: "done", createdAt: now, updatedAt: now },
      { id: directRunId, planId: directPlanId, mode: "direct", status: "running", createdAt: now, updatedAt: now },
      { id: planningRunId, planId: planningPlanId, mode: "planning", status: "running", createdAt: now, updatedAt: now },
    ]);

    const { syncRunningSupervision } = await import("@/server/supervisor/runtime-watchdog");
    await syncRunningSupervision();

    expect(mockStartSupervisorRun).toHaveBeenCalledTimes(1);
    expect(mockStartSupervisorRun).toHaveBeenCalledWith(runningRunId);
  });

  it("recovers stale implementation failures from temporary worker unavailability without waiting for UI selection", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const now = new Date();
    const lastError = 'No spawnable worker is available. Requested "codex" failed because codex ACP adapter is not installed. Checked allowed workers: codex.';

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/stale-worker-availability.md",
      status: "failed",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "implementation",
      status: "failed",
      lastError,
      failedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(messages).values({
      id: randomUUID(),
      runId,
      role: "system",
      kind: "error",
      content: `Run failed: ${lastError}`,
      createdAt: now,
    });
    await db.insert(settings).values({
      key: `SUPERVISOR_WAKE_LEASE:${runId}`,
      value: JSON.stringify({ leaseId: randomUUID(), expiresAt: Date.now() + 900_000 }),
      updatedAt: now,
    });

    const { syncRunningSupervision } = await import("@/server/supervisor/runtime-watchdog");
    await syncRunningSupervision();

    const recoveredRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const recoveredPlan = await db.select().from(plans).where(eq(plans.id, planId)).get();
    const remainingMessages = await db.select().from(messages).where(eq(messages.runId, runId));
    const staleLease = await db.select().from(settings).where(eq(settings.key, `SUPERVISOR_WAKE_LEASE:${runId}`)).get();

    expect(recoveredRun?.status).toBe("running");
    expect(recoveredRun?.lastError).toBeNull();
    expect(recoveredRun?.failedAt).toBeNull();
    expect(recoveredPlan?.status).toBe("running");
    expect(remainingMessages.filter((message) => message.kind === "error")).toHaveLength(0);
    expect(staleLease).toBeUndefined();
    expect(mockStartSupervisorRun).toHaveBeenCalledTimes(1);
    expect(mockStartSupervisorRun).toHaveBeenCalledWith(runId);
  });

  it("recovers stale implementation failures from restart session handshakes without waiting for UI selection", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const now = new Date();
    const lastError = "Spawn failed: Agent session did not include a session id.";

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/stale-session-handshake.md",
      status: "failed",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "implementation",
      status: "failed",
      lastError,
      failedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(messages).values({
      id: randomUUID(),
      runId,
      role: "system",
      kind: "error",
      content: `Run failed: ${lastError}`,
      createdAt: now,
    });

    const { syncRunningSupervision } = await import("@/server/supervisor/runtime-watchdog");
    await syncRunningSupervision();

    const recoveredRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const remainingMessages = await db.select().from(messages).where(eq(messages.runId, runId));

    expect(recoveredRun?.status).toBe("running");
    expect(recoveredRun?.lastError).toBeNull();
    expect(recoveredRun?.failedAt).toBeNull();
    expect(remainingMessages.filter((message) => message.kind === "error")).toHaveLength(0);
    expect(mockStartSupervisorRun).toHaveBeenCalledTimes(1);
    expect(mockStartSupervisorRun).toHaveBeenCalledWith(runId);
  });

  it("leaves non-recoverable implementation failures stopped", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const now = new Date();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/nonrecoverable.md",
      status: "failed",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "implementation",
      status: "failed",
      lastError: "API key not valid",
      failedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    const { syncRunningSupervision } = await import("@/server/supervisor/runtime-watchdog");
    await syncRunningSupervision();

    const persistedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();

    expect(persistedRun?.status).toBe("failed");
    expect(persistedRun?.lastError).toBe("API key not valid");
    expect(mockStartSupervisorRun).not.toHaveBeenCalled();
  });
});
