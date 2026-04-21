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
        pendingPermissions: [],
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
        pendingPermissions: [],
        stderrBuffer: [],
        stopReason: null,
      },
      previous: {
        fingerprint: JSON.stringify({
          state: "working",
          currentText: "same output",
          lastText: "same output",
          pendingPermissions: [],
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

  it("wakes the supervisor immediately when a permission request appears", () => {
    const permission = {
      requestId: 12,
      requestedAt: new Date(0).toISOString(),
      options: [
        { optionId: "allow-always", kind: "allow_always", name: "Always Allow" },
      ],
    };

    const { events } = deriveWorkerEvents({
      workerId: "worker-1",
      snapshot: {
        state: "working",
        currentText: "waiting for approval",
        lastText: "waiting for approval",
        pendingPermissions: [permission],
        stderrBuffer: [],
        stopReason: null,
      },
      previous: {
        fingerprint: JSON.stringify({
          state: "working",
          currentText: "waiting for approval",
          lastText: "waiting for approval",
          pendingPermissions: [],
          stopReason: null,
          stderrTail: [],
        }),
        lastChangedAt: 0,
        idleNotified: false,
      },
      now: 1_000,
    });

    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "worker_permission_requested",
        shouldWakeSupervisor: true,
        updatesActivity: false,
      }),
    ]));
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
      outputLog: "",
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

  it("fails the run when worker stderr reports a fatal bridge pipe error", async () => {
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
      outputLog: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockGetAgent.mockResolvedValue({
      state: "working",
      currentText: "sending update",
      lastText: "sending update",
      pendingPermissions: [],
      stderrBuffer: [
        "[bridge] ACP write error: Error: write EPIPE",
      ],
      stopReason: null,
    });

    await pollRunWorkers(runId, vi.fn());

    const failedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const runMessages = await db.select().from(messages).where(eq(messages.runId, runId));

    expect(failedRun?.status).toBe("failed");
    expect(failedRun?.lastError).toContain("write EPIPE");
    expect(runMessages.some((message) => message.content.includes("write EPIPE"))).toBe(true);
  });
});
