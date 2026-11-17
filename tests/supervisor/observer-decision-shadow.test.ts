import { randomUUID } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { executionEvents, plans, runs, workers } from "@/server/db/schema";

const { mockGetAgent, mockShadowSupervisorWake, mockGateSupervisorWake, mockNoteSupervisorWoken } = vi.hoisted(() => ({
  mockGetAgent: vi.fn(),
  mockShadowSupervisorWake: vi.fn(),
  mockGateSupervisorWake: vi.fn(),
  mockNoteSupervisorWoken: vi.fn(),
}));

vi.mock("@/server/bridge-client", () => ({
  getAgent: mockGetAgent,
  cancelAgent: vi.fn(),
  approvePermission: vi.fn(),
  spawnAgent: vi.fn(),
  BRIDGE_URL: "http://localhost:0",
}));

vi.mock("@/server/decisions/points/supervisor-wake", () => ({
  shadowSupervisorWake: mockShadowSupervisorWake,
  gateSupervisorWake: mockGateSupervisorWake,
  noteSupervisorWoken: mockNoteSupervisorWoken,
}));

import { pollRunWorkers } from "@/server/supervisor/observer";

async function seedRun() {
  const planId = randomUUID();
  const runId = randomUUID();
  const workerId = randomUUID();
  const now = new Date();
  await db.insert(plans).values({ id: planId, path: "vibes/ad-hoc/test-plan.md", status: "running", createdAt: now, updatedAt: now });
  await db.insert(runs).values({ id: runId, planId, status: "running", createdAt: now, updatedAt: now });
  await db.insert(workers).values({ id: workerId, runId, type: "opencode", status: "working", cwd: process.cwd(), outputLog: "", createdAt: now, updatedAt: now });
  return { runId, workerId };
}

describe("observer decision-layer shadow (B1)", () => {
  beforeEach(() => {
    mockGetAgent.mockReset();
    mockShadowSupervisorWake.mockReset();
    mockGateSupervisorWake.mockReset().mockResolvedValue({ delayMs: 0, consulted: false });
    mockNoteSupervisorWoken.mockReset();
  });

  it("reports that it woke the supervisor for an errored worker, without changing the wake", async () => {
    const { runId, workerId } = await seedRun();
    mockGetAgent.mockResolvedValue({
      state: "error",
      currentText: "",
      lastText: "Fatal: cannot continue",
      pendingPermissions: [],
      stderrBuffer: [],
      stopReason: null,
    });
    const wakeSupervisor = vi.fn();

    await pollRunWorkers(runId, wakeSupervisor);

    expect(wakeSupervisor).toHaveBeenCalledWith(runId, 0);
    expect(mockShadowSupervisorWake).toHaveBeenCalledTimes(1);
    const input = mockShadowSupervisorWake.mock.calls[0]![0];
    expect(input).toMatchObject({ runId, workerId, woke: true, runStatus: "running", workerState: "error" });
    expect(input.events.map((event: { type: string }) => event.type)).toContain("worker_error");
    expect(mockNoteSupervisorWoken).toHaveBeenCalledWith(runId, workerId);
  });

  it("schedules a deferred wake instead of an immediate one when the gate defers", async () => {
    const { runId, workerId } = await seedRun();
    mockGateSupervisorWake.mockResolvedValue({ delayMs: 120_000, consulted: true });
    mockGetAgent.mockResolvedValue({
      state: "error",
      currentText: "",
      lastText: "x",
      pendingPermissions: [],
      stderrBuffer: [],
      stopReason: null,
    });
    const wakeSupervisor = vi.fn();

    await pollRunWorkers(runId, wakeSupervisor);

    expect(wakeSupervisor).toHaveBeenCalledWith(runId, 120_000);
    expect(wakeSupervisor).not.toHaveBeenCalledWith(runId, 0);
    expect(mockNoteSupervisorWoken).not.toHaveBeenCalled();
    // The gate already asked the decision layer, so no second shadow call.
    expect(mockShadowSupervisorWake).not.toHaveBeenCalled();
    const deferred = await db.select().from(executionEvents).where(and(
      eq(executionEvents.runId, runId),
      eq(executionEvents.workerId, workerId),
      eq(executionEvents.eventType, "supervisor_wake_deferred"),
    ));
    expect(deferred).toHaveLength(1);
  });

  it("reports no wake when the worker only produced output", async () => {
    const { runId, workerId } = await seedRun();
    mockGetAgent.mockResolvedValue({
      state: "working",
      currentText: "Editing src/a.ts",
      lastText: "",
      pendingPermissions: [],
      stderrBuffer: [],
      stopReason: null,
    });
    const wakeSupervisor = vi.fn();

    await pollRunWorkers(runId, wakeSupervisor);

    expect(wakeSupervisor).not.toHaveBeenCalled();
    expect(mockShadowSupervisorWake).toHaveBeenCalledWith(expect.objectContaining({ runId, workerId, woke: false, recentOutput: "Editing src/a.ts" }));
  });
});
