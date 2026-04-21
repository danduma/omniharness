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
  mockGetAgent,
  mockBuildSupervisorTurnContext,
  mockParseSupervisorToolCall,
  mockSelectSpawnableWorkerType,
} = vi.hoisted(() => ({
  mockTokenCreate: vi.fn(),
  mockSpawnAgent: vi.fn(),
  mockAskAgent: vi.fn(),
  mockCancelAgent: vi.fn(),
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
    vi.spyOn(Date, "now").mockReturnValue(123456);
  });

  it("persists the worker before awaiting the initial ask and skips auto mode by default", async () => {
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
    }));
    expect(mockSpawnAgent.mock.calls[0]?.[0]?.mode).toBeUndefined();

    pendingAsk.resolve({ response: "Started work", state: "working" });
    await expect(runPromise).resolves.toEqual({ state: "wait", delayMs: 5_000 });
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
});
