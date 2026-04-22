import { randomUUID } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { plans, runs } from "@/server/db/schema";

const { mockStartSupervisorRun } = vi.hoisted(() => ({
  mockStartSupervisorRun: vi.fn(),
}));

vi.mock("@/server/supervisor/start", () => ({
  startSupervisorRun: mockStartSupervisorRun,
}));

describe("supervisor runtime watchdog", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await db.delete(runs);
    await db.delete(plans);
  });

  it("reattaches supervision for runs that are still marked running", async () => {
    const runningPlanId = randomUUID();
    const donePlanId = randomUUID();
    const runningRunId = randomUUID();
    const doneRunId = randomUUID();
    const now = new Date();

    await db.insert(plans).values([
      { id: runningPlanId, path: "vibes/ad-hoc/running.md", status: "running", createdAt: now, updatedAt: now },
      { id: donePlanId, path: "vibes/ad-hoc/done.md", status: "done", createdAt: now, updatedAt: now },
    ]);

    await db.insert(runs).values([
      { id: runningRunId, planId: runningPlanId, status: "running", createdAt: now, updatedAt: now },
      { id: doneRunId, planId: donePlanId, status: "done", createdAt: now, updatedAt: now },
    ]);

    const { syncRunningSupervision } = await import("@/server/supervisor/runtime-watchdog");
    await syncRunningSupervision();

    expect(mockStartSupervisorRun).toHaveBeenCalledTimes(1);
    expect(mockStartSupervisorRun).toHaveBeenCalledWith(runningRunId);
  });
});

