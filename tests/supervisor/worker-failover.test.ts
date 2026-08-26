import { randomUUID } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

const { mockSpawnAgent, mockAskAgent, mockCancelAgent, mockGetAgent, mockExecFileSync, mockBuildPersistedHandoff } = vi.hoisted(() => ({
  mockSpawnAgent: vi.fn(),
  mockAskAgent: vi.fn(),
  mockCancelAgent: vi.fn(),
  mockGetAgent: vi.fn(),
  mockExecFileSync: vi.fn(),
  mockBuildPersistedHandoff: vi.fn(),
}));

vi.mock("@/server/bridge-client", () => ({
  spawnAgent: mockSpawnAgent,
  askAgent: mockAskAgent,
  cancelAgent: mockCancelAgent,
  getAgent: mockGetAgent,
}));

vi.mock("child_process", async (importOriginal) => ({
  ...await importOriginal<typeof import("child_process")>(),
  execFileSync: mockExecFileSync,
}));

vi.mock("@/server/handoff/request", () => ({
  buildPersistedHandoff: mockBuildPersistedHandoff,
}));

describe("attemptWorkerFailover", () => {
  beforeEach(async () => {
    mockSpawnAgent.mockReset();
    mockAskAgent.mockReset();
    mockCancelAgent.mockReset();
    mockGetAgent.mockReset();
    mockExecFileSync.mockReset();
    mockBuildPersistedHandoff.mockReset();
    mockBuildPersistedHandoff.mockResolvedValue({
      task: "Refactor the auth module",
      progress: "Persisted conversation and workspace context",
      nextSteps: "Continue from persisted state",
      source: "synthetic",
      outgoingWorkerType: "codex",
      outgoingWorkerId: "source-worker",
      reason: "quota_exhausted",
    });
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
    await db.delete(schema.conversationHandoffs);
    await db.delete(schema.queuedConversationMessages);
    await db.delete(schema.messages);
    await db.delete(schema.artifactStreams);
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

  afterEach(async () => {
    const { waitForConversationBackgroundTasksForTests } = await import("@/server/conversations/worker-turn-gate");
    await waitForConversationBackgroundTasksForTests(5_000);
  });

  async function seedRun(allowedTypes: string[] = ["codex", "claude"], mode = "implementation") {
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
      mode,
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

  it("never prompts the quota-exhausted worker for a handoff", async () => {
    const runId = await seedRun(["codex", "claude"]);
    const workerId = await seedWorker(runId, "codex");
    mockAskAgent.mockResolvedValue({
      response: "Replacement continued from persisted context.",
      state: "idle",
      stopReason: "end_turn",
    });
    mockCancelAgent.mockResolvedValue(undefined);
    mockSpawnAgent.mockResolvedValueOnce({
      sessionId: "session-claude-persisted",
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
    expect(mockAskAgent.mock.calls.some(([agentId]) => agentId === workerId)).toBe(false);
  });

  it("emits the full failover lifecycle when a replacement is available", async () => {
    const runId = await seedRun(["codex", "claude"]);
    const workerId = await seedWorker(runId, "codex");

    mockAskAgent.mockResolvedValueOnce({
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

    expect(result.state, JSON.stringify(result)).toBe("failed_over");
    if (result.state !== "failed_over") return;
    expect(result.newType).toBe("claude");
    expect(mockAskAgent).toHaveBeenCalledTimes(1);
    expect(mockAskAgent.mock.calls[0]?.[0]).toBe(result.newWorkerId);
    expect(mockAskAgent.mock.calls[0]?.[1]).toContain("# Failover Handoff");
    expect(mockAskAgent.mock.calls[0]?.[1]).toContain("TASK:** Refactor the auth module");

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

  it("creates a distinct target run for automatic direct-control cross-CLI quota recovery", async () => {
    const runId = await seedRun(["codex", "claude"], "direct");
    const workerId = await seedWorker(runId, "codex");
    mockCancelAgent.mockResolvedValue(undefined);
    mockGetAgent
      .mockRejectedValueOnce(Object.assign(new Error("agent missing"), { status: 404 }))
      .mockResolvedValue({ state: "idle", outputEntries: [], currentText: "", lastText: "continued", sessionId: "target-session", sessionMode: "full-access" });
    mockSpawnAgent.mockResolvedValue({ state: "starting", sessionId: "target-session", sessionMode: "full-access" });
    mockAskAgent.mockImplementation(async (_name, prompt, _attachments, options) => {
      if (prompt.startsWith("Summarize the persisted handoff evidence")) {
        return {
          response: "```omniharness-handoff\nTASK: Refactor the auth module\nPROGRESS: Persisted context captured\nNEXT_STEPS: Continue implementation\nBLOCKERS: none\nOPEN_QUESTIONS: none\nRELEVANT_FILES: none\n```",
          state: "idle",
          stopReason: "end_turn",
        };
      }
      await options?.onAccepted?.();
      return { response: "Continued in the target session.", state: "idle", stopReason: "end_turn" };
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

    expect(result.state, JSON.stringify(result)).toBe("handed_off");
    if (result.state !== "handed_off") return;
    expect(result.targetRunId).not.toBe(runId);
    const { db } = await import("@/server/db");
    const schema = await import("@/server/db/schema");
    const source = await db.select().from(schema.runs).where(eq(schema.runs.id, runId)).get();
    const target = await db.select().from(schema.runs).where(eq(schema.runs.id, result.targetRunId)).get();
    const sourceWorkers = await db.select().from(schema.workers).where(eq(schema.workers.runId, runId));
    const targetWorkers = await db.select().from(schema.workers).where(eq(schema.workers.runId, result.targetRunId));
    expect(source?.status).toBe("cancelled");
    expect(target?.originHandoffId).toBeTruthy();
    expect(sourceWorkers.map((worker) => worker.type)).toEqual(["codex"]);
    expect(targetWorkers.map((worker) => worker.type)).toEqual(["claude"]);
  });

  it("abandons a replacement without prompting it when Stop wins during spawn", async () => {
    const runId = await seedRun(["codex", "claude"]);
    const workerId = await seedWorker(runId, "codex");

    mockCancelAgent.mockResolvedValue(undefined);
    mockSpawnAgent.mockImplementationOnce(async () => {
      const { db } = await import("@/server/db");
      const schema = await import("@/server/db/schema");
      await db.update(schema.runs).set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(schema.runs.id, runId));
      await db.update(schema.workers).set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(schema.workers.runId, runId));
      return {
        sessionId: "session-claude-stopped",
        sessionMode: "full-access",
        state: "starting",
      };
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

    expect(result).toMatchObject({ state: "ignored", reason: "run_terminal" });
    expect(mockAskAgent).not.toHaveBeenCalled();
    const { db } = await import("@/server/db");
    const schema = await import("@/server/db/schema");
    const run = await db.select().from(schema.runs).where(eq(schema.runs.id, runId)).get();
    const runWorkers = await db.select().from(schema.workers).where(eq(schema.workers.runId, runId));
    const incident = await db.select().from(schema.recoveryIncidents).where(eq(schema.recoveryIncidents.runId, runId)).get();
    expect(run?.status).toBe("cancelled");
    expect(runWorkers.every((worker) => worker.status === "cancelled")).toBe(true);
    expect(incident?.status).toBe("resolved");
  });

  it("does not reserve or announce a replacement when Stop wins before reservation", async () => {
    const runId = await seedRun(["codex", "claude"]);
    const workerId = await seedWorker(runId, "codex");
    mockBuildPersistedHandoff.mockImplementationOnce(async () => {
      const { db } = await import("@/server/db");
      const schema = await import("@/server/db/schema");
      const { runQuotaRecoveryMutation } = await import("@/server/quota/recovery-mutation");
      await runQuotaRecoveryMutation(runId, async () => {
        await db.update(schema.runs).set({ status: "cancelled", updatedAt: new Date() })
          .where(eq(schema.runs.id, runId));
        await db.update(schema.workers).set({ status: "cancelled", updatedAt: new Date() })
          .where(eq(schema.workers.runId, runId));
      });
      return {
        task: "x",
        progress: "y",
        nextSteps: "z",
        source: "synthetic",
        outgoingWorkerType: "codex",
        outgoingWorkerId: workerId,
        reason: "quota_exhausted",
      };
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

    const { __getRingForTests } = await import("@/server/events/named-events");
    const events = __getRingForTests().map((entry) => entry.event);
    expect(result).toMatchObject({ state: "ignored", reason: "run_terminal" });
    expect(mockSpawnAgent).not.toHaveBeenCalled();
    expect(events.some((event) => event.kind === "worker.spawned")).toBe(false);
  });

  it("does not restore running state when Stop wins after replacement delivery", async () => {
    const runId = await seedRun(["codex", "claude"]);
    const workerId = await seedWorker(runId, "codex");

    mockAskAgent.mockResolvedValueOnce({
      response: "```omniharness-handoff\nTASK: x\nPROGRESS: y\nNEXT_STEPS: z\n```",
      state: "stopped",
      stopReason: "end_turn",
    }).mockResolvedValueOnce({
      response: "Replacement continued from handoff.",
      state: "idle",
      stopReason: "end_turn",
    });
    mockCancelAgent.mockResolvedValue(undefined);
    mockSpawnAgent.mockResolvedValueOnce({
      sessionId: "session-claude-final-race",
      sessionMode: "full-access",
      state: "starting",
    });
    mockGetAgent.mockImplementationOnce(async () => {
      const { db } = await import("@/server/db");
      const schema = await import("@/server/db/schema");
      await db.update(schema.runs).set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(schema.runs.id, runId));
      await db.update(schema.workers).set({
        status: "cancelled",
        turnGeneration: 1,
        updatedAt: new Date(),
      }).where(eq(schema.workers.runId, runId));
      return { outputEntries: [], currentText: "", lastText: "" };
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

    const { db } = await import("@/server/db");
    const schema = await import("@/server/db/schema");
    const run = await db.select().from(schema.runs).where(eq(schema.runs.id, runId)).get();
    const runWorkers = await db.select().from(schema.workers).where(eq(schema.workers.runId, runId));
    const { __getRingForTests } = await import("@/server/events/named-events");
    const kinds = __getRingForTests().map((entry) => entry.event.kind);

    expect(result).toMatchObject({ state: "ignored", reason: "run_terminal" });
    expect(run?.status).toBe("cancelled");
    expect(runWorkers.every((worker) => worker.status === "cancelled")).toBe(true);
    expect(kinds).not.toContain("worker.failover_completed");
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

  it("keeps a gateway-routed Claude worker alive when only an incompatible replacement is available", async () => {
    const runId = await seedRun(["claude", "codex"]);
    const workerId = await seedWorker(runId, "claude");
    const { db } = await import("@/server/db");
    const schema = await import("@/server/db/schema");
    await db.update(schema.workers).set({
      effectiveLaunchModel: "cliproxyapi:gpt-5.6-sol",
      launchCredentialSource: "gateway",
    }).where(eq(schema.workers.id, workerId));

    const { attemptWorkerFailover } = await import("@/server/supervisor/worker-failover");
    const result = await attemptWorkerFailover({
      runId,
      outgoingWorkerId: workerId,
      outgoingWorkerType: "claude",
      quotaText: "quota exhausted; try again in 30 minutes",
      originalPrompt: "Refactor the auth module",
      allowedTypes: ["claude", "codex"],
      env: {},
      cwd: "/tmp",
      title: "Test worker",
    });

    expect(result).toMatchObject({ state: "no_replacement", reason: expect.stringMatching(/gateway-routed/i) });
    expect(mockCancelAgent).not.toHaveBeenCalled();
    expect(mockSpawnAgent).not.toHaveBeenCalled();
    const run = await db.select().from(schema.runs).where(eq(schema.runs.id, runId)).get();
    expect(run?.status).toBe("quota_waiting");
    const { __getRingForTests } = await import("@/server/events/named-events");
    expect(__getRingForTests().map((entry) => entry.event)).toContainEqual(expect.objectContaining({
      kind: "worker.failover_failed",
      stage: "selection",
    }));
  });

  it("reconstructs the handoff without waiting for the outgoing worker", async () => {
    const runId = await seedRun(["codex", "claude"]);
    const workerId = await seedWorker(runId, "codex");

    mockAskAgent.mockResolvedValueOnce({
      response: "Replacement continued from persisted handoff.",
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
    });

    expect(result.state).toBe("failed_over");
    if (result.state !== "failed_over") return;
    expect(result.handoff.source).toBe("synthetic");
  });

  it("walks the allowed list when the first replacement also hits quota", async () => {
    const runId = await seedRun(["codex", "claude", "gemini"]);
    const workerId = await seedWorker(runId, "codex");

    mockAskAgent.mockResolvedValueOnce({
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
