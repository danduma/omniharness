import { randomUUID } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, like } from "drizzle-orm";
import { db } from "@/server/db";
import { messages, plans, runs, settings } from "@/server/db/schema";

const { mockSupervisorRun, mockStopRunObserver } = vi.hoisted(() => ({
  mockSupervisorRun: vi.fn(),
  mockStopRunObserver: vi.fn(),
}));

vi.mock("@/server/supervisor", () => ({
  Supervisor: class {
    run() {
      return mockSupervisorRun();
    }
  },
}));

vi.mock("@/server/supervisor/observer", () => ({
  stopRunObserver: mockStopRunObserver,
}));

import { cancelSupervisorWake, executeSupervisorWake } from "@/server/supervisor/wake";

describe("executeSupervisorWake", () => {
  beforeEach(async () => {
    vi.useRealTimers();
    mockSupervisorRun.mockReset();
    mockStopRunObserver.mockReset();
    await db.delete(messages);
    await db.delete(runs);
    await db.delete(plans);
    await db.delete(settings).where(like(settings.key, "SUPERVISOR_WAKE_LEASE:%"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps an implementation run active when supervisor execution hits a retryable bridge reset", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const now = new Date();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/test-plan.md",
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

    mockSupervisorRun.mockRejectedValue(Object.assign(
      new Error("Get agent failed: fetch failed"),
      { cause: Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" }) },
    ));

    await executeSupervisorWake(runId);
    cancelSupervisorWake(runId);

    const persistedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const runMessages = await db.select().from(messages).where(eq(messages.runId, runId));

    expect(persistedRun?.status).toBe("running");
    expect(persistedRun?.lastError).toBeNull();
    expect(runMessages.some((message) => message.kind === "error")).toBe(false);
    expect(mockStopRunObserver).not.toHaveBeenCalled();
  });

  it("retries a wake when an active persisted lease temporarily blocks acquisition", async () => {
    vi.useFakeTimers();
    const planId = randomUUID();
    const runId = randomUUID();
    const now = new Date();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/test-plan.md",
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
    await db.insert(settings).values({
      key: `SUPERVISOR_WAKE_LEASE:${runId}`,
      value: JSON.stringify({ leaseId: randomUUID(), expiresAt: Date.now() + 900_000 }),
      updatedAt: now,
    });

    mockSupervisorRun.mockResolvedValue({ state: "completed" });

    await executeSupervisorWake(runId);

    expect(mockSupervisorRun).not.toHaveBeenCalled();

    await db.delete(settings).where(eq(settings.key, `SUPERVISOR_WAKE_LEASE:${runId}`));
    await vi.advanceTimersByTimeAsync(1_000);
    cancelSupervisorWake(runId);

    expect(mockSupervisorRun).toHaveBeenCalledTimes(1);
  });
});
