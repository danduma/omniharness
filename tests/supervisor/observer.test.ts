import { randomUUID } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { messages, plans, runs, workers } from "@/server/db/schema";

const { mockGetAgent } = vi.hoisted(() => ({
  mockGetAgent: vi.fn(),
}));

vi.mock("@/server/bridge-client", () => ({
  getAgent: mockGetAgent,
}));

import { deriveWorkerEvents, pollRunWorkers } from "@/server/supervisor/observer";

describe("deriveWorkerEvents", () => {
  beforeEach(async () => {
    mockGetAgent.mockReset();
    await db.delete(messages);
    await db.delete(workers);
    await db.delete(runs);
    await db.delete(plans);
  });

  it("records output changes without waking the supervisor immediately", () => {
    const { nextState, events } = deriveWorkerEvents({
      workerId: "worker-1",
      snapshot: {
        state: "working",
        currentText: "running tests",
        lastText: "editing files",
        stderrBuffer: [],
        stopReason: null,
      },
      previous: undefined,
      now: 1_000,
    });

    expect(nextState.idleNotified).toBe(false);
    expect(events).toEqual([
      expect.objectContaining({
        type: "worker_output_changed",
        shouldWakeSupervisor: false,
        updatesActivity: true,
      }),
    ]);
  });

  it("wakes the supervisor when a worker has been idle for thirty seconds", () => {
    const { events } = deriveWorkerEvents({
      workerId: "worker-1",
      snapshot: {
        state: "working",
        currentText: "same output",
        lastText: "same output",
        stderrBuffer: [],
        stopReason: null,
      },
      previous: {
        fingerprint: JSON.stringify({
          state: "working",
          currentText: "same output",
          lastText: "same output",
          stopReason: null,
          stderrTail: [],
        }),
        lastChangedAt: 0,
        idleNotified: false,
      },
      now: 30_000,
    });

    expect(events).toEqual([
      expect.objectContaining({
        type: "worker_idle",
        shouldWakeSupervisor: true,
        updatesActivity: false,
      }),
    ]);
  });

  it("fails the run when bridge status polling errors", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = randomUUID();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/test-plan.md",
      status: "running",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(runs).values({
      id: runId,
      planId,
      status: "running",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "opencode",
      status: "working",
      cwd: process.cwd(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockGetAgent.mockRejectedValue(new Error("ACP bridge is not running at http://127.0.0.1:7800"));

    await pollRunWorkers(runId, vi.fn());

    const failedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const runMessages = await db.select().from(messages).where(eq(messages.runId, runId));

    expect(failedRun?.status).toBe("failed");
    expect(failedRun?.lastError).toContain("ACP bridge is not running");
    expect(runMessages.some((message) => message.content.includes("ACP bridge is not running"))).toBe(true);
  });
});
