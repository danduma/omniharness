import { randomUUID } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { executionEvents, messages, plans, runs, settings, supervisorInterventions, workerCounters, workers } from "@/server/db/schema";

const {
  mockTokenCreate,
  mockSpawnAgent,
  mockAskAgent,
  mockCancelAgent,
  mockApprovePermission,
  mockGetAgent,
  mockBuildSupervisorTurnContext,
  mockParseSupervisorToolCall,
  mockSelectSpawnableWorkerType,
} = vi.hoisted(() => ({
  mockTokenCreate: vi.fn(),
  mockSpawnAgent: vi.fn(),
  mockAskAgent: vi.fn(),
  mockCancelAgent: vi.fn(),
  mockApprovePermission: vi.fn(),
  mockGetAgent: vi.fn(),
  mockBuildSupervisorTurnContext: vi.fn(),
  mockParseSupervisorToolCall: vi.fn(),
  mockSelectSpawnableWorkerType: vi.fn(),
}));

vi.mock("token.js", () => ({
  TokenJS: class MockTokenJS {
    chat = {
      completions: {
        create: mockTokenCreate,
      },
    };
  },
}));

vi.mock("@/server/bridge-client", () => ({
  spawnAgent: mockSpawnAgent,
  askAgent: mockAskAgent,
  cancelAgent: mockCancelAgent,
  approvePermission: mockApprovePermission,
  getAgent: mockGetAgent,
}));

vi.mock("@/server/supervisor/model-config", () => ({
  getSupervisorModelConfig: vi.fn(() => ({
    provider: "openai",
    model: "gpt-5.4-mini",
    apiKey: "key",
    baseURL: undefined,
  })),
  validateSupervisorModelConfig: vi.fn(),
  configureSupervisorModel: vi.fn(),
}));

vi.mock("@/server/supervisor/runtime-settings", () => ({
  hydrateRuntimeEnvFromSettings: vi.fn(() => ({
    env: { OPENAI_API_KEY: "key" },
    decryptionFailures: [],
  })),
}));

vi.mock("@/server/supervisor/context", () => ({
  buildSupervisorTurnContext: mockBuildSupervisorTurnContext,
}));

vi.mock("@/server/supervisor/protocol", async () => {
  const actual = await vi.importActual<typeof import("@/server/supervisor/protocol")>("@/server/supervisor/protocol");
  return {
    ...actual,
    parseSupervisorToolCall: mockParseSupervisorToolCall,
  };
});

vi.mock("@/server/supervisor/worker-availability", () => ({
  selectSpawnableWorkerType: mockSelectSpawnableWorkerType,
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("Supervisor worker spawn flow", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    await db.delete(supervisorInterventions);
    await db.delete(executionEvents);
    await db.delete(messages);
    await db.delete(workers);
    await db.delete(workerCounters);
    await db.delete(settings);
    await db.delete(runs);
    await db.delete(plans);

    mockTokenCreate.mockResolvedValue({ choices: [{ message: { tool_calls: [{ id: "tool-1" }] } }] });
    mockSpawnAgent.mockResolvedValue({ name: "mocked-worker-id", state: "idle" });
    mockApprovePermission.mockResolvedValue({ ok: true });
    mockBuildSupervisorTurnContext.mockResolvedValue({
      runId: "run-id",
      projectPath: "/tmp/project",
      goal: "ship it",
      preferredWorkerType: "opencode",
      allowedWorkerTypes: ["opencode"],
      recentUserMessages: ["ship it"],
      pendingClarifications: [],
      answeredClarifications: [],
      activeWorkers: [],
      recentEvents: [],
    });
    mockParseSupervisorToolCall.mockReturnValue({
      id: "tool-1",
      name: "worker_spawn",
      args: {
        type: "opencode",
        cwd: "/tmp/project",
        title: "Main implementation",
        prompt: "start implementing",
        mode: "auto",
        purpose: "finish the task",
      },
    });
    mockSelectSpawnableWorkerType.mockReturnValue({
      type: "opencode",
      requestedType: "opencode",
      fallbackReason: null,
    });
    mockAskAgent.mockResolvedValue({ response: "ok", state: "working" });
    mockGetAgent.mockResolvedValue(null);
    vi.spyOn(Date, "now").mockReturnValue(123456);
  });

  it("compacts the supervisor prompt before calling the model when the context is near the window limit", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const largeInstruction = "old implementation detail ".repeat(1_200);
    const latestInstruction = "Validate the final implementation now.";

    vi.stubEnv("SUPERVISOR_CONTEXT_WINDOW_TOKENS", "700");
    vi.stubEnv("SUPERVISOR_CONTEXT_RESPONSE_RESERVE_TOKENS", "100");
    vi.stubEnv("SUPERVISOR_CONTEXT_COMPACTION_THRESHOLD", "0.6");

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
      allowedWorkerTypes: JSON.stringify(["opencode"]),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockBuildSupervisorTurnContext.mockResolvedValue({
      runId,
      projectPath: "/tmp/project",
      goal: `${largeInstruction}\n\n${latestInstruction}`,
      preferredWorkerType: "opencode",
      allowedWorkerTypes: ["opencode"],
      recentUserMessages: [
        largeInstruction,
        "second old instruction ".repeat(1_000),
        latestInstruction,
      ],
      pendingClarifications: [],
      answeredClarifications: [],
      activeWorkers: [],
      recentEvents: [],
      compactedMemory: null,
    });

    const { Supervisor } = await import("@/server/supervisor");

    await expect(new Supervisor({ runId }).run()).resolves.toEqual({ state: "wait", delayMs: 5_000 });

    const request = mockTokenCreate.mock.calls[0]?.[0];
    const promptMessages = request.messages as Array<{ role: string; content: string }>;
    expect(promptMessages.some((message) => message.content.includes("Prior supervision memory"))).toBe(true);
    expect(promptMessages.filter((message) => message.role === "user")).toEqual([
      { role: "user", content: latestInstruction },
    ]);

    const compactionEvent = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId)).get();
    expect(compactionEvent?.eventType).toBe("supervisor_context_compacted");
    expect(compactionEvent?.details).toContain("memorySummary");
  });

  it("does not mutate direct conversations if a wake reaches the supervisor", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const now = new Date();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/direct.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      status: "failed",
      lastError: "direct worker failed",
      createdAt: now,
      updatedAt: now,
    });

    const { Supervisor } = await import("@/server/supervisor");
    await expect(new Supervisor({ runId }).run()).resolves.toEqual({ state: "completed" });

    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    expect(run?.status).toBe("failed");
    expect(run?.lastError).toBe("direct worker failed");
    expect(mockTokenCreate).not.toHaveBeenCalled();
  });

  it("does not resurrect a cancelled implementation run", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const now = new Date();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/cancelled.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "implementation",
      status: "cancelled",
      createdAt: now,
      updatedAt: now,
    });

    const { Supervisor } = await import("@/server/supervisor");
    await expect(new Supervisor({ runId }).run()).resolves.toEqual({ state: "completed" });

    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    expect(run?.status).toBe("cancelled");
    expect(mockTokenCreate).not.toHaveBeenCalled();
  });

  it("does not execute a tool call if the run fails while the model request is in flight", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const pendingCompletion = deferred<{ choices: Array<{ message: { tool_calls: Array<{ id: string }> } }> }>();
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
      status: "running",
      allowedWorkerTypes: JSON.stringify(["opencode"]),
      createdAt: now,
      updatedAt: now,
    });

    mockTokenCreate.mockReturnValue(pendingCompletion.promise);

    const { Supervisor } = await import("@/server/supervisor");
    const runPromise = new Supervisor({ runId }).run();

    await vi.waitFor(() => {
      expect(mockTokenCreate).toHaveBeenCalled();
    });

    await db.update(runs).set({
      status: "failed",
      lastError: "Get agent failed: not_found",
      failedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(runs.id, runId));

    pendingCompletion.resolve({ choices: [{ message: { tool_calls: [{ id: "tool-1" }] } }] });

    await expect(runPromise).resolves.toEqual({ state: "completed" });

    expect(mockParseSupervisorToolCall).not.toHaveBeenCalled();
    expect(mockSpawnAgent).not.toHaveBeenCalled();
    const allWorkers = await db.select().from(workers).where(eq(workers.runId, runId));
    expect(allWorkers).toHaveLength(0);
    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    expect(run?.status).toBe("failed");
    expect(run?.lastError).toBe("Get agent failed: not_found");
  });

  it("cancels a spawned bridge agent if the run fails while spawn is in flight", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const pendingSpawn = deferred<{ name: string; state: string; sessionId: string; sessionMode: string }>();
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
      status: "running",
      allowedWorkerTypes: JSON.stringify(["opencode"]),
      createdAt: now,
      updatedAt: now,
    });

    mockSpawnAgent.mockReturnValue(pendingSpawn.promise);

    const { Supervisor } = await import("@/server/supervisor");
    const runPromise = new Supervisor({ runId }).run();

    await vi.waitFor(() => {
      expect(mockSpawnAgent).toHaveBeenCalled();
    });

    await db.update(runs).set({
      status: "failed",
      lastError: "observer failed the run",
      failedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(runs.id, runId));

    pendingSpawn.resolve({
      name: `${runId}-worker-1`,
      state: "starting",
      sessionId: "session-after-failure",
      sessionMode: "full-access",
    });

    await expect(runPromise).resolves.toEqual({ state: "completed" });

    expect(mockAskAgent).not.toHaveBeenCalled();
    expect(mockCancelAgent).toHaveBeenCalledWith(`${runId}-worker-1`);
    const persistedWorker = await db.select().from(workers).where(eq(workers.id, `${runId}-worker-1`)).get();
    expect(persistedWorker?.status).toBe("cancelled");
    expect(persistedWorker?.bridgeSessionId).toBe("session-after-failure");
    const events = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId));
    expect(events.some((event) => event.eventType === "worker_spawned")).toBe(false);
    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    expect(run?.status).toBe("failed");
    expect(run?.lastError).toBe("observer failed the run");
  });

  it("persists the worker before awaiting the initial ask and defaults workers to full-access mode", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const pendingAsk = deferred<{ response: string; state: string }>();

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
      allowedWorkerTypes: JSON.stringify(["opencode"]),
      preferredWorkerModel: "openai/gpt-5.4",
      preferredWorkerEffort: "high",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockAskAgent.mockReturnValue(pendingAsk.promise);

    const { Supervisor } = await import("@/server/supervisor");
    const runPromise = new Supervisor({ runId }).run();

    await vi.waitFor(() => {
      expect(mockSpawnAgent).toHaveBeenCalled();
    });

    const persistedWorker = await db.select().from(workers).where(eq(workers.id, `${runId}-worker-1`)).get();
    expect(persistedWorker?.runId).toBe(runId);
    expect(persistedWorker?.status).toBe("starting");
    expect(persistedWorker?.workerNumber).toBe(1);
    expect(persistedWorker?.title).toBe("Main implementation");
    expect(persistedWorker?.initialPrompt).toBe("start implementing");
    expect(mockSpawnAgent).toHaveBeenCalledWith(expect.objectContaining({
      type: "opencode",
      cwd: "/tmp/project",
      name: `${runId}-worker-1`,
      env: { OPENAI_API_KEY: "key" },
      model: "openai/gpt-5.4",
      effort: "high",
      mode: "full-access",
    }));
    expect(mockSpawnAgent.mock.calls[0]?.[0]?.mode).toBe("full-access");

    pendingAsk.resolve({ response: "Started work", state: "working" });
    await expect(runPromise).resolves.toEqual({ state: "wait", delayMs: 5_000 });

    const systemMessages = await db.select().from(messages).where(eq(messages.runId, runId));
    const spawnMessage = systemMessages.find((message) => message.role === "system" && message.content.includes("Spawned"));
    expect(spawnMessage?.content).toContain("CLI: OpenCode");
    expect(spawnMessage?.content).toContain(`Worker: ${runId}-worker-1`);
    expect(spawnMessage?.content).toContain("Model: openai/gpt-5.4");
    expect(spawnMessage?.content).toContain("Effort: high");
    expect(spawnMessage?.content).toContain("Mode: full-access");
    expect(spawnMessage?.content).toContain("Title: Main implementation");
    expect(spawnMessage?.content).toContain("Purpose: finish the task.");
  });

  it("blocks a second main implementation worker while another active main worker exists", async () => {
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
      status: "running",
      allowedWorkerTypes: JSON.stringify(["opencode"]),
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(workers).values({
      id: `${runId}-worker-1`,
      runId,
      type: "opencode",
      status: "working",
      cwd: "/tmp/project",
      title: "Main implementation",
      initialPrompt: "implement the plan",
      outputLog: "",
      createdAt: now,
      updatedAt: now,
    });

    mockParseSupervisorToolCall.mockReturnValue({
      id: "tool-duplicate",
      name: "worker_spawn",
      args: {
        type: "opencode",
        cwd: "/tmp/project",
        title: "Main implementation",
        prompt: "implement the plan",
        purpose: "Implement the plan",
      },
    });

    const { Supervisor } = await import("@/server/supervisor");

    await expect(new Supervisor({ runId }).run()).resolves.toEqual({ state: "wait", delayMs: 5_000 });

    expect(mockSpawnAgent).not.toHaveBeenCalled();
    const allWorkers = await db.select().from(workers).where(eq(workers.runId, runId));
    expect(allWorkers).toHaveLength(1);
    const event = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId)).get();
    expect(event?.eventType).toBe("worker_spawn_blocked");
    expect(event?.details).toContain("already has active implementation worker");
  });

  it("blocks duplicate verification workers that are checking the same plan", async () => {
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
      status: "running",
      allowedWorkerTypes: JSON.stringify(["opencode"]),
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(workers).values({
      id: `${runId}-worker-1`,
      runId,
      type: "opencode",
      status: "working",
      cwd: "/tmp/project",
      workerNumber: 1,
      title: "Verify Plan Implementation",
      initialPrompt: "Read the plan and check whether we fully implemented it.",
      outputLog: "",
      createdAt: now,
      updatedAt: now,
    });

    mockParseSupervisorToolCall.mockReturnValue({
      id: "tool-duplicate-verify",
      name: "worker_spawn",
      args: {
        type: "opencode",
        cwd: "/tmp/project",
        title: "Verify mobile ultrapilot copilot hardening plan",
        prompt: "Check if the mobile ultrapilot copilot hardening plan is fully implemented.",
        purpose: "Check implementation status of the mobile ultrapilot copilot hardening plan.",
      },
    });

    const { Supervisor } = await import("@/server/supervisor");

    await expect(new Supervisor({ runId }).run()).resolves.toEqual({ state: "wait", delayMs: 5_000 });

    expect(mockSpawnAgent).not.toHaveBeenCalled();
    const allWorkers = await db.select().from(workers).where(eq(workers.runId, runId));
    expect(allWorkers).toHaveLength(1);
    const event = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId)).get();
    expect(event?.eventType).toBe("worker_spawn_blocked");
    expect(event?.details).toContain("Verify mobile ultrapilot copilot hardening plan");
  });

  it("reserves the worker row before awaiting bridge spawn", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const pendingSpawn = deferred<{ name: string; state: string; sessionId: string; sessionMode: string }>();

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
      allowedWorkerTypes: JSON.stringify(["opencode"]),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockSpawnAgent.mockReturnValue(pendingSpawn.promise);

    const { Supervisor } = await import("@/server/supervisor");
    const runPromise = new Supervisor({ runId }).run();

    await vi.waitFor(() => {
      expect(mockSpawnAgent).toHaveBeenCalled();
    });

    const reservedWorker = await db.select().from(workers).where(eq(workers.id, `${runId}-worker-1`)).get();
    expect(reservedWorker?.status).toBe("starting");

    pendingSpawn.resolve({
      name: `${runId}-worker-1`,
      state: "starting",
      sessionId: "session-1",
      sessionMode: "full-access",
    });

    await expect(runPromise).resolves.toEqual({ state: "wait", delayMs: 5_000 });
  });

  it("lets settings disable default yolo mode for newly spawned workers", async () => {
    const planId = randomUUID();
    const runId = randomUUID();

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
      allowedWorkerTypes: JSON.stringify(["opencode"]),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(settings).values({
      key: "WORKER_YOLO_MODE",
      value: "false",
      updatedAt: new Date(),
    });

    const { Supervisor } = await import("@/server/supervisor");

    await expect(new Supervisor({ runId }).run()).resolves.toEqual({ state: "wait", delayMs: 5_000 });

    expect(mockSpawnAgent.mock.calls[0]?.[0]?.mode).toBeUndefined();
  });

  it("marks the persisted worker as errored when the initial ask fails", async () => {
    const planId = randomUUID();
    const runId = randomUUID();

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
      allowedWorkerTypes: JSON.stringify(["opencode"]),
      preferredWorkerModel: "openai/gpt-5.4",
      preferredWorkerEffort: "high",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockAskAgent.mockRejectedValue(new Error("Ask failed: setSessionMode failed"));

    const { Supervisor } = await import("@/server/supervisor");

    await expect(new Supervisor({ runId }).run()).rejects.toThrow(/Ask failed: setSessionMode failed/i);

    const persistedWorker = await db.select().from(workers).where(eq(workers.id, `${runId}-worker-1`)).get();
    expect(persistedWorker?.status).toBe("error");
  });

  it("passes an explicit optionId when the supervisor approves a permission manually", async () => {
    const planId = randomUUID();
    const runId = randomUUID();

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
      id: "worker-claude",
      runId,
      type: "claude",
      status: "working",
      cwd: "/tmp/project",
      title: "Permission worker",
      initialPrompt: "edit files",
      outputLog: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockParseSupervisorToolCall.mockReturnValue({
      id: "tool-approve",
      name: "worker_approve",
      args: {
        workerId: "worker-claude",
        reason: "safe file edit",
        optionId: "allow-once",
      },
    });

    const { Supervisor } = await import("@/server/supervisor");

    await expect(new Supervisor({ runId }).run()).resolves.toEqual({ state: "wait", delayMs: 1_000 });

    expect(mockApprovePermission).toHaveBeenCalledWith("worker-claude", "allow-once");
  });

  it("records supervisor interventions when a worker is prompted to continue", async () => {
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
      status: "running",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(workers).values({
      id: "worker-needs-steering",
      runId,
      type: "codex",
      status: "idle",
      cwd: "/tmp/project",
      title: "Main implementation",
      initialPrompt: "implement the plan",
      outputLog: "",
      createdAt: now,
      updatedAt: now,
    });

    mockParseSupervisorToolCall.mockReturnValue({
      id: "tool-continue",
      name: "worker_continue",
      args: {
        workerId: "worker-needs-steering",
        prompt: "The plan is not fully implemented yet. Continue and finish the remaining checklist items.",
      },
    });
    mockAskAgent.mockResolvedValue({ response: "Continuing now", state: "working" });

    const { Supervisor } = await import("@/server/supervisor");

    await expect(new Supervisor({ runId }).run()).resolves.toEqual({ state: "wait", delayMs: 5_000 });

    const interventions = await db.select().from(supervisorInterventions).where(eq(supervisorInterventions.runId, runId));
    expect(interventions).toHaveLength(1);
    expect(interventions[0]).toMatchObject({
      runId,
      workerId: "worker-needs-steering",
      interventionType: "completion_gap",
      prompt: "The plan is not fully implemented yet. Continue and finish the remaining checklist items.",
    });
  });

  it("lists recorded supervisor interventions when completing the run", async () => {
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
      status: "running",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(workers).values({
      id: "worker-steered",
      runId,
      type: "codex",
      status: "idle",
      cwd: "/tmp/project",
      title: "Main implementation",
      initialPrompt: "implement the plan",
      outputLog: "",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(supervisorInterventions).values({
      id: randomUUID(),
      runId,
      workerId: "worker-steered",
      interventionType: "completion_gap",
      prompt: "The plan is not fully implemented yet. Continue.",
      summary: "Sent follow-up to worker-steered",
      createdAt: now,
    });

    mockParseSupervisorToolCall.mockReturnValue({
      id: "tool-complete",
      name: "mark_complete",
      args: {
        summary: "Done.",
      },
    });

    const { Supervisor } = await import("@/server/supervisor");

    await expect(new Supervisor({ runId }).run()).resolves.toEqual({ state: "completed" });

    const completionMessage = await db.select().from(messages).where(eq(messages.runId, runId)).get();
    expect(completionMessage?.content).toContain("Done.");
    expect(completionMessage?.content).toContain("Supervisor interventions (1):");
    expect(completionMessage?.content).toContain("worker-steered: The plan is not fully implemented yet. Continue.");

    const completionEvent = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId)).get();
    expect(completionEvent?.details).toContain('"interventionCount":1');
    expect(completionEvent?.details).toContain('"interventionType":"completion_gap"');
  });

  it("records worker cancellation without deleting the worker before writing events", async () => {
    const planId = randomUUID();
    const runId = randomUUID();

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
      id: "worker-cancel",
      runId,
      type: "codex",
      status: "working",
      cwd: "/tmp/project",
      title: "Cancel worker",
      initialPrompt: "work until cancelled",
      outputLog: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockParseSupervisorToolCall.mockReturnValue({
      id: "tool-cancel",
      name: "worker_cancel",
      args: {
        workerId: "worker-cancel",
        reason: "switch strategy",
      },
    });

    const { Supervisor } = await import("@/server/supervisor");

    await expect(new Supervisor({ runId }).run()).resolves.toEqual({ state: "wait", delayMs: 1_000 });

    const persistedWorker = await db.select().from(workers).where(eq(workers.id, "worker-cancel")).get();
    const cancelEvent = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId)).get();

    expect(persistedWorker?.status).toBe("cancelled");
    expect(cancelEvent?.workerId).toBe("worker-cancel");
    expect(cancelEvent?.eventType).toBe("worker_cancelled");
  });

  it("treats not_found bridge cancellations as already cancelled instead of failing the run", async () => {
    const planId = randomUUID();
    const runId = randomUUID();

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
      id: "worker-missing",
      runId,
      type: "codex",
      status: "working",
      cwd: "/tmp/project",
      title: "Missing worker",
      initialPrompt: "work until missing",
      outputLog: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockCancelAgent.mockRejectedValueOnce(new Error("Cancel failed: not_found"));
    mockParseSupervisorToolCall.mockReturnValue({
      id: "tool-cancel-missing",
      name: "worker_cancel",
      args: {
        workerId: "worker-missing",
        reason: "worker already gone",
      },
    });

    const { Supervisor } = await import("@/server/supervisor");

    await expect(new Supervisor({ runId }).run()).resolves.toEqual({ state: "wait", delayMs: 1_000 });

    const persistedWorker = await db.select().from(workers).where(eq(workers.id, "worker-missing")).get();
    expect(persistedWorker?.status).toBe("cancelled");
  });
});
