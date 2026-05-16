import { randomUUID } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

const { mockSpawnAgent, mockAskAgent, mockCancelAgent, mockExecFileSync } = vi.hoisted(() => ({
  mockSpawnAgent: vi.fn(),
  mockAskAgent: vi.fn(),
  mockCancelAgent: vi.fn(),
  mockExecFileSync: vi.fn(),
}));

vi.mock("@/server/bridge-client", () => ({
  spawnAgent: mockSpawnAgent,
  askAgent: mockAskAgent,
  cancelAgent: mockCancelAgent,
}));

vi.mock("child_process", () => ({
  execFileSync: mockExecFileSync,
}));

describe("worker failover when no replacement is available", () => {
  beforeEach(async () => {
    mockSpawnAgent.mockReset();
    mockAskAgent.mockReset();
    mockCancelAgent.mockReset();
    mockExecFileSync.mockReset();

    mockExecFileSync.mockImplementation((command: string, args: string[]) => {
      if (args[0] === "codex-acp") {
        return Buffer.from(`/usr/local/bin/${args[0]}\n`);
      }
      throw new Error("not found");
    });

    const { db } = await import("@/server/db");
    const schema = await import("@/server/db/schema");
    await db.delete(schema.executionEvents);
    await db.delete(schema.supervisorScheduledWakes);
    await db.delete(schema.recoveryIncidents);
    await db.delete(schema.workers);
    await db.delete(schema.workerCounters);
    await db.delete(schema.runs);
    await db.delete(schema.plans);
    const { __resetNamedEventsForTests } = await import("@/server/events/named-events");
    __resetNamedEventsForTests();
    const { resetDurableSupervisorWakeSchedulerForTests } = await import("@/server/supervisor/wake-schedule");
    resetDurableSupervisorWakeSchedulerForTests();
  });

  it("parks the run in quota_waiting and does not emit failover events", async () => {
    const { db } = await import("@/server/db");
    const schema = await import("@/server/db/schema");
    const planId = randomUUID();
    const runId = randomUUID();
    const now = new Date();
    await db.insert(schema.plans).values({
      id: planId,
      path: "vibes/ad-hoc/no-replacement.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(schema.runs).values({
      id: runId,
      planId,
      mode: "implementation",
      status: "running",
      allowedWorkerTypes: JSON.stringify(["codex"]),
      createdAt: now,
      updatedAt: now,
    });
    const workerId = `${runId}-worker-1`;
    await db.insert(schema.workerCounters).values({
      runId,
      nextNumber: 2,
      updatedAt: now,
    });
    await db.insert(schema.workers).values({
      id: workerId,
      runId,
      type: "codex",
      status: "working",
      cwd: "/tmp",
      workerNumber: 1,
      title: "Test",
      initialPrompt: "do thing",
      outputLog: "",
      outputEntriesJson: "",
      currentText: "",
      lastText: "",
      bridgeSessionId: "s1",
      bridgeSessionMode: "full-access",
      createdAt: now,
      updatedAt: now,
    });

    const { attemptWorkerFailover } = await import("@/server/supervisor/worker-failover");
    const result = await attemptWorkerFailover({
      runId,
      outgoingWorkerId: workerId,
      outgoingWorkerType: "codex",
      quotaText: "quota exhausted; try again in 30 minutes",
      originalPrompt: "do thing",
      allowedTypes: ["codex"],
      env: {},
      cwd: "/tmp",
      title: "Test",
    });

    expect(result.state).toBe("no_replacement");

    const run = await db.select().from(schema.runs).where(eq(schema.runs.id, runId)).get();
    expect(run?.status).toBe("quota_waiting");

    const { __getRingForTests } = await import("@/server/events/named-events");
    const kinds = __getRingForTests().map((entry) => entry.event.kind);
    expect(kinds).not.toContain("worker.failover_started");
    expect(kinds).not.toContain("worker.failover_completed");
    expect(kinds).not.toContain("worker.handoff_emitted");
  });
});
