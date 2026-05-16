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

describe("attemptWorkerFailover", () => {
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
      if (args[0] === "claude-agent-acp" || args[0] === "codex-acp" || args[0] === "opencode" || args[0] === "gemini") {
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

  async function seedRun(allowedTypes: string[] = ["codex", "claude"]) {
    const { db } = await import("@/server/db");
    const schema = await import("@/server/db/schema");
    const planId = randomUUID();
    const runId = randomUUID();
    const now = new Date();
    await db.insert(schema.plans).values({
      id: planId,
      path: "vibes/ad-hoc/failover-test.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(schema.runs).values({
      id: runId,
      planId,
      mode: "implementation",
      status: "running",
      allowedWorkerTypes: JSON.stringify(allowedTypes),
      createdAt: now,
      updatedAt: now,
    });
    return runId;
  }

  async function seedWorker(runId: string, type: string, withSession = true) {
    const { db } = await import("@/server/db");
    const schema = await import("@/server/db/schema");
    const workerId = `${runId}-worker-1`;
    const now = new Date();
    await db.insert(schema.workerCounters).values({
      runId,
      nextNumber: 2,
      updatedAt: now,
    });
    await db.insert(schema.workers).values({
      id: workerId,
      runId,
      type,
      status: "working",
      cwd: "/tmp",
      workerNumber: 1,
      title: "Test worker",
      initialPrompt: "Refactor the auth module",
      outputLog: "",
      outputEntriesJson: "",
      currentText: "Made progress on tests",
      lastText: "Last update from outgoing worker",
      bridgeSessionId: withSession ? "session-1" : null,
      bridgeSessionMode: withSession ? "full-access" : null,
      createdAt: now,
      updatedAt: now,
    });
    return workerId;
  }

  it("emits the full failover lifecycle when a replacement is available", async () => {
    const runId = await seedRun(["codex", "claude"]);
    const workerId = await seedWorker(runId, "codex");

    mockAskAgent.mockResolvedValueOnce({
      response: "```omniharness-handoff\nTASK: refactor auth\nPROGRESS: wrote tests\nNEXT_STEPS: run tests\n```",
      state: "stopped",
      stopReason: "end_turn",
    }).mockResolvedValueOnce({
      response: "Replacement continued from handoff.",
      state: "idle",
      stopReason: "end_turn",
    });
    mockCancelAgent.mockResolvedValue(undefined);
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
      originalPrompt: "Refactor the auth module",
      allowedTypes: ["codex", "claude"],
      env: {},
      cwd: "/tmp",
      title: "Test worker",
    });

    expect(result.state).toBe("failed_over");
    if (result.state !== "failed_over") return;
    expect(result.newType).toBe("claude");
    expect(mockAskAgent).toHaveBeenCalledTimes(2);
    expect(mockAskAgent.mock.calls[0]?.[0]).toBe(workerId);
    expect(mockAskAgent.mock.calls[1]?.[0]).toBe(result.newWorkerId);
    expect(mockAskAgent.mock.calls[1]?.[1]).toContain("# Failover Handoff");
    expect(mockAskAgent.mock.calls[1]?.[1]).toContain("TASK:** refactor auth");

    const { __getRingForTests } = await import("@/server/events/named-events");
    const events = __getRingForTests();
    const kinds = events.map((entry) => entry.event.kind);
    expect(kinds).toContain("worker.failover_started");
    expect(kinds).toContain("worker.handoff_emitted");
    expect(kinds).toContain("worker.spawned");
    expect(kinds).toContain("worker.failover_completed");

    const { db } = await import("@/server/db");
    const schema = await import("@/server/db/schema");
    const incidents = await db.select().from(schema.recoveryIncidents).where(eq(schema.recoveryIncidents.runId, runId));
    expect(incidents).toHaveLength(1);
    expect(incidents[0]?.status).toBe("resolved");

    const { readWorkerOutputEntries } = await import("@/server/workers/output-store");
    const entries = await readWorkerOutputEntries(runId, result.newWorkerId);
    expect(entries.some((entry) =>
      entry.type === "supervisor_input"
      && entry.text.includes("# Failover Handoff")
    )).toBe(true);
  });

  it("parks the run when no replacement worker is available", async () => {
    const runId = await seedRun(["codex"]);
    const workerId = await seedWorker(runId, "codex");

    const { attemptWorkerFailover } = await import("@/server/supervisor/worker-failover");
    const result = await attemptWorkerFailover({
      runId,
      outgoingWorkerId: workerId,
      outgoingWorkerType: "codex",
      quotaText: "quota exhausted; try again in 30 minutes",
      originalPrompt: "Refactor the auth module",
      allowedTypes: ["codex"],
      env: {},
      cwd: "/tmp",
      title: "Test worker",
    });

    expect(result.state).toBe("no_replacement");

    const { db } = await import("@/server/db");
    const schema = await import("@/server/db/schema");
    const run = await db.select().from(schema.runs).where(eq(schema.runs.id, runId)).get();
    expect(run?.status).toBe("quota_waiting");

    const { __getRingForTests } = await import("@/server/events/named-events");
    const kinds = __getRingForTests().map((entry) => entry.event.kind);
    expect(kinds).not.toContain("worker.failover_started");
    expect(kinds).not.toContain("worker.failover_completed");
  });

  it("falls back to a synthetic handoff when the outgoing worker times out", async () => {
    const runId = await seedRun(["codex", "claude"]);
    const workerId = await seedWorker(runId, "codex");

    mockAskAgent
      .mockImplementationOnce(() => new Promise(() => undefined))
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
      originalPrompt: "Refactor the auth module",
      allowedTypes: ["codex", "claude"],
      env: {},
      cwd: "/tmp",
      title: "Test worker",
      handoffTimeoutMs: 100,
    });

    expect(result.state).toBe("failed_over");
    if (result.state !== "failed_over") return;
    expect(result.handoff.source).toBe("synthetic");
  });

  it("walks the allowed list when the first replacement also hits quota", async () => {
    const runId = await seedRun(["codex", "claude", "gemini"]);
    const workerId = await seedWorker(runId, "codex");

    mockAskAgent.mockResolvedValueOnce({
      response: "```omniharness-handoff\nTASK: x\nPROGRESS: y\nNEXT_STEPS: z\n```",
      state: "stopped",
      stopReason: "end_turn",
    }).mockResolvedValueOnce({
      response: "Gemini continued from handoff.",
      state: "idle",
      stopReason: "end_turn",
    });
    mockSpawnAgent
      .mockRejectedValueOnce(new Error("quota exhausted; resets in 1 hour"))
      .mockResolvedValueOnce({
        sessionId: "session-gemini-1",
        sessionMode: "full-access",
        state: "starting",
      });

    const { attemptWorkerFailover } = await import("@/server/supervisor/worker-failover");
    const result = await attemptWorkerFailover({
      runId,
      outgoingWorkerId: workerId,
      outgoingWorkerType: "codex",
      quotaText: "quota exhausted; resets in 30 minutes",
      originalPrompt: "Refactor the auth module",
      allowedTypes: ["codex", "claude", "gemini"],
      env: {},
      cwd: "/tmp",
      title: "Test worker",
    });

    expect(result.state).toBe("failed_over");
    if (result.state !== "failed_over") return;
    expect(result.newType).toBe("gemini");
  });
});
