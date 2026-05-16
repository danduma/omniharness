import { randomUUID } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSpawnAgent, mockAskAgent, mockCancelAgent, mockGetAgent, mockExecFileSync } = vi.hoisted(() => ({
  mockSpawnAgent: vi.fn(),
  mockAskAgent: vi.fn(),
  mockCancelAgent: vi.fn(),
  mockGetAgent: vi.fn(),
  mockExecFileSync: vi.fn(),
}));

vi.mock("@/server/bridge-client", () => ({
  spawnAgent: mockSpawnAgent,
  askAgent: mockAskAgent,
  cancelAgent: mockCancelAgent,
  getAgent: mockGetAgent,
}));

vi.mock("child_process", () => ({
  execFileSync: mockExecFileSync,
}));

describe("worker failover when the handoff turn itself fails", () => {
  beforeEach(async () => {
    mockSpawnAgent.mockReset();
    mockAskAgent.mockReset();
    mockCancelAgent.mockReset();
    mockGetAgent.mockReset();
    mockExecFileSync.mockReset();
    mockGetAgent.mockResolvedValue({
      outputEntries: [],
      currentText: "",
      lastText: "",
    });
    mockExecFileSync.mockImplementation((command: string, args: string[]) => {
      if (args[0] === "codex-acp" || args[0] === "claude-agent-acp") {
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

  it("uses a synthetic handoff and still spawns the replacement", async () => {
    const { db } = await import("@/server/db");
    const schema = await import("@/server/db/schema");
    const planId = randomUUID();
    const runId = randomUUID();
    const now = new Date();
    await db.insert(schema.plans).values({
      id: planId,
      path: "vibes/ad-hoc/handoff-fails.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(schema.runs).values({
      id: runId,
      planId,
      mode: "implementation",
      status: "running",
      allowedWorkerTypes: JSON.stringify(["codex", "claude"]),
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
      initialPrompt: "Original task",
      outputLog: "",
      outputEntriesJson: "",
      currentText: "Some progress was made",
      lastText: "",
      bridgeSessionId: "s1",
      bridgeSessionMode: "full-access",
      createdAt: now,
      updatedAt: now,
    });

    // Handoff ask rejects (outgoing worker is unresponsive), but the replacement receives the synthetic seed.
    mockAskAgent.mockRejectedValueOnce(new Error("Ask failed: agent unresponsive"))
      .mockResolvedValueOnce({
        response: "Replacement continued from synthetic handoff.",
        state: "idle",
        stopReason: "end_turn",
      });
    mockSpawnAgent.mockResolvedValueOnce({
      sessionId: "session-claude-1",
      sessionMode: "full-access",
      state: "starting",
    });

    const { attemptWorkerFailover } = await import("@/server/supervisor/worker-failover");
    const result = await attemptWorkerFailover({
      runId,
      outgoingWorkerId: workerId,
      outgoingWorkerType: "codex",
      quotaText: "quota exhausted; try again in 30 minutes",
      originalPrompt: "Original task",
      allowedTypes: ["codex", "claude"],
      env: {},
      cwd: "/tmp",
      title: "Test",
    });

    expect(result.state).toBe("failed_over");
    if (result.state !== "failed_over") return;
    expect(result.handoff.source).toBe("synthetic");
    expect(result.newType).toBe("claude");
  });
});
