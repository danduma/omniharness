import { randomUUID } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { executionEvents, messages, plans, runs, settings, workers } from "@/server/db/schema";

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
    await db.delete(executionEvents);
    await db.delete(messages);
    await db.delete(workers);
    await db.delete(settings);
    await db.delete(runs);
    await db.delete(plans);

    mockTokenCreate.mockResolvedValue({ choices: [{ message: { tool_calls: [{ id: "tool-1" }] } }] });
    mockSpawnAgent.mockResolvedValue({ name: "worker-123456", state: "idle" });
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

    const persistedWorker = await db.select().from(workers).where(eq(workers.id, "worker-123456")).get();
    expect(persistedWorker?.runId).toBe(runId);
    expect(persistedWorker?.status).toBe("starting");
    expect(mockSpawnAgent).toHaveBeenCalledWith(expect.objectContaining({
      type: "opencode",
      cwd: "/tmp/project",
      name: "worker-123456",
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
    expect(spawnMessage?.content).toContain("Worker: worker-123456");
    expect(spawnMessage?.content).toContain("Model: openai/gpt-5.4");
    expect(spawnMessage?.content).toContain("Effort: high");
    expect(spawnMessage?.content).toContain("Mode: full-access");
    expect(spawnMessage?.content).toContain("Purpose: finish the task.");
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

    const persistedWorker = await db.select().from(workers).where(eq(workers.id, "worker-123456")).get();
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
