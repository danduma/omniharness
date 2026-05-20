import { randomUUID } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

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

describe("worker failover bounded retry across the allowed list", () => {
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
      if (args[0] === "codex-acp" || args[0] === "claude-agent-acp" || args[0] === "gemini") {
        return Buffer.from(`/usr/local/bin/${args[0]}\n`);
      }
      throw new Error("not found");
    });

    const { db } = await import("@/server/db");
    const schema = await import("@/server/db/schema");
    await db.delete(schema.planningReviewFindings);
    await db.delete(schema.planningReviewRounds);
    await db.delete(schema.planningReviewRuns);
    await db.delete(schema.executionEvents);
    await db.delete(schema.supervisorScheduledWakes);
    await db.delete(schema.supervisorInterventions);
    await db.delete(schema.workerAssignments);
    await db.delete(schema.clarifications);
    await db.delete(schema.recoveryIncidents);
    await db.delete(schema.queuedConversationMessages);
    await db.delete(schema.messages);
    await db.delete(schema.processSessions);
    await db.delete(schema.creditEvents);
    await db.delete(schema.workers);
    await db.delete(schema.workerCounters);
    await db.delete(schema.conversationReadMarkers);
    await db.delete(schema.runs);
    await db.delete(schema.planItems);
    await db.delete(schema.plans);
    const { __resetNamedEventsForTests } = await import("@/server/events/named-events");
    __resetNamedEventsForTests();
    const { resetDurableSupervisorWakeSchedulerForTests } = await import("@/server/supervisor/wake-schedule");
    resetDurableSupervisorWakeSchedulerForTests();
  });

  it("parks the run when every allowed replacement also hits quota on spawn", async () => {
    const { db } = await import("@/server/db");
    const schema = await import("@/server/db/schema");
    const planId = randomUUID();
    const runId = randomUUID();
    const now = new Date();
    await db.insert(schema.plans).values({
      id: planId,
      path: "vibes/ad-hoc/spawn-retry.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(schema.runs).values({
      id: runId,
      planId,
      mode: "implementation",
      status: "running",
      allowedWorkerTypes: JSON.stringify(["codex", "claude", "gemini"]),
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
      initialPrompt: "Do thing",
      outputLog: "",
      outputEntriesJson: "",
      currentText: "",
      lastText: "",
      bridgeSessionId: "s1",
      bridgeSessionMode: "full-access",
      createdAt: now,
      updatedAt: now,
    });

    mockAskAgent.mockResolvedValueOnce({
      response: "```omniharness-handoff\nTASK: x\nPROGRESS: y\nNEXT_STEPS: z\n```",
      state: "stopped",
      stopReason: "end_turn",
    });
    // Both replacement spawns fail with quota errors
    mockSpawnAgent
      .mockRejectedValueOnce(new Error("quota exhausted; resets in 1 hour"))
      .mockRejectedValueOnce(new Error("quota exhausted; resets in 2 hours"));

    const { attemptWorkerFailover } = await import("@/server/supervisor/worker-failover");
    const result = await attemptWorkerFailover({
      runId,
      outgoingWorkerId: workerId,
      outgoingWorkerType: "codex",
      quotaText: "quota exhausted; try again in 30 minutes",
      originalPrompt: "Do thing",
      allowedTypes: ["codex", "claude", "gemini"],
      env: {},
      cwd: "/tmp",
      title: "Test",
    });

    expect(result.state).toBe("park_failed");
    const run = await db.select().from(schema.runs).where(eq(schema.runs.id, runId)).get();
    expect(run?.status).toBe("quota_waiting");

    const { __getRingForTests } = await import("@/server/events/named-events");
    const kinds = __getRingForTests().map((entry) => entry.event.kind);
    expect(kinds).toContain("worker.failover_failed");
  });
});
