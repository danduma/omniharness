/**
 * Reported regression from session 90629ba2e9c8:
 * a project commit run persisted its dedicated Codex/Luna selection but
 * launched Codex with the composer's Claude model, then treated the provider
 * rejection as a successful terminal response.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
  artifactStreams,
  executionEvents,
  messages,
  plans,
  processSessions,
  runs,
  settings,
  workerCounters,
  workerCredentialAllocations,
  workerTokenUsage,
  workers,
} from "@/server/db/schema";
import {
  GIT_COMMIT_WORKER_EFFORT_SETTING,
  GIT_COMMIT_WORKER_MODEL_SETTING,
  GIT_COMMIT_WORKER_TYPE_SETTING,
} from "@/lib/commit-workflow";
import {
  conversationsRouteModule as conversationsRoute,
  eventsRouteModule as eventsRoute,
} from "@/../tests/helpers/runtime-routes";
import { __resetNamedEventsForTests } from "@/server/events/named-events";
import { startLifecycleHarness, type LifecycleServer } from "../harness/server";
import { LifecycleClient } from "../harness/client";
import { Chaos, NO_CHAOS } from "../harness/chaos";

const { mockAskAgent, mockGetAgent, mockSpawnAgent } = vi.hoisted(() => ({
  mockAskAgent: vi.fn(),
  mockGetAgent: vi.fn(),
  mockSpawnAgent: vi.fn(),
}));

vi.mock("@/server/bridge-client", () => ({
  spawnAgent: mockSpawnAgent,
  askAgent: mockAskAgent,
  getAgent: mockGetAgent,
  cancelAgent: vi.fn().mockResolvedValue(undefined),
  cancelAgentTerminalProcess: vi.fn().mockResolvedValue(undefined),
  BRIDGE_URL: "http://localhost:0",
}));

vi.mock("@/server/git/auto-commit", () => ({
  captureGitBaseline: vi.fn(() => null),
}));

vi.mock("@/server/supervisor/start", () => ({
  startSupervisorRun: vi.fn(),
}));

vi.mock("@/server/workers/snapshots", () => ({
  persistWorkerSnapshot: vi.fn().mockResolvedValue(undefined),
}));

let server: LifecycleServer;
let client: LifecycleClient;

function agent(output = "Committed and pushed.") {
  return {
    name: "commit-worker",
    type: "codex",
    state: "idle",
    currentText: "",
    lastText: output,
    renderedOutput: output,
    sessionId: "commit-session",
    sessionMode: "full-access",
    pendingPermissions: [],
    pendingElicitations: [],
    outputEntries: output ? [{ id: "entry-1", type: "message", text: output, timestamp: new Date(0).toISOString() }] : [],
    stderrBuffer: [],
    stopReason: "end_turn",
    cwd: "/workspace/app",
  };
}

async function waitUntil<T>(read: () => T | Promise<T>, predicate: (value: T) => boolean, timeoutMs = 2_000) {
  const deadline = Date.now() + timeoutMs;
  let value = await read();
  while (!predicate(value)) {
    if (Date.now() >= deadline) {
      throw new Error(`Timed out waiting for lifecycle state: ${JSON.stringify(value)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
    value = await read();
  }
  return value;
}

beforeEach(async () => {
  __resetNamedEventsForTests();
  mockAskAgent.mockReset();
  mockGetAgent.mockReset();
  mockSpawnAgent.mockReset();
  await db.delete(executionEvents);
  await db.delete(messages);
  await db.delete(processSessions);
  await db.delete(workerCredentialAllocations);
  await db.delete(workerTokenUsage);
  await db.delete(workers);
  await db.delete(workerCounters);
  await db.delete(artifactStreams);
  await db.delete(runs);
  await db.delete(plans);
  await db.delete(settings);

  mockSpawnAgent.mockResolvedValue(agent());
  mockAskAgent.mockResolvedValue({ response: "Committed and pushed.", state: "idle" });
  mockGetAgent.mockResolvedValue(agent());

  server = await startLifecycleHarness({
    routes: [
      { pattern: "/api/events", module: eventsRoute },
      { pattern: "/api/conversations", module: conversationsRoute },
    ],
  });
  client = new LifecycleClient({
    baseUrl: server.baseUrl,
    chaos: new Chaos(90629, NO_CHAOS),
  });
});

afterEach(async () => {
  await client.close();
  await server.stop();
  vi.clearAllMocks();
});

describe("lifecycle — commit worker model routing", () => {
  it("launches the dedicated commit model instead of the composer model", async () => {
    await db.insert(settings).values([
      { key: GIT_COMMIT_WORKER_TYPE_SETTING, value: "codex", updatedAt: new Date() },
      { key: GIT_COMMIT_WORKER_MODEL_SETTING, value: "gpt-5.6-luna", updatedAt: new Date() },
      { key: GIT_COMMIT_WORKER_EFFORT_SETTING, value: "high", updatedAt: new Date() },
    ]);
    await client.bootstrapSnapshot();
    await client.subscribe({});

    const response = await client.fetch("/api/conversations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: "commit",
        command: "Commit and push the project changes.",
        projectPath: "/workspace/app",
        preferredWorkerType: "claude",
        preferredWorkerModel: "claude-opus-5",
        preferredWorkerEffort: "max",
        allowedWorkerTypes: ["claude"],
      }),
    });

    expect(response.status).toBe(200);
    const { runId } = (await response.json()) as { runId: string };
    await waitUntil(() => mockSpawnAgent.mock.calls.length, (count) => count > 0);
    const persistedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const persistedWorker = await db.select().from(workers).where(eq(workers.runId, runId)).get();

    expect(mockSpawnAgent).toHaveBeenCalledWith(expect.objectContaining({
      type: "codex",
      model: "gpt-5.6-luna",
      effort: "high",
    }));
    expect(persistedRun).toMatchObject({
      preferredWorkerType: "codex",
      preferredWorkerModel: "gpt-5.6-luna",
      preferredWorkerEffort: "high",
    });
    expect(persistedWorker).toMatchObject({
      effectiveLaunchModel: "gpt-5.6-luna",
      effectiveLaunchEffort: "high",
    });
  });

  it("surfaces a structured provider rejection and persists the run as failed", async () => {
    const providerMessage = "The 'claude-opus-5' model is not supported when using Codex with a ChatGPT account.";
    const providerOutput = [
      "Warning: Model metadata for `claude-opus-5` not found. Defaulting to fallback metadata; this can degrade performance and cause issues.",
      "",
      JSON.stringify({
        type: "error",
        status: 400,
        error: { type: "invalid_request_error", message: providerMessage },
      }),
    ].join("\n");
    mockAskAgent.mockResolvedValueOnce({ response: providerOutput, state: "idle" });
    mockGetAgent.mockResolvedValueOnce(agent(providerOutput));

    await client.bootstrapSnapshot();
    await client.subscribe({});
    const response = await client.fetch("/api/conversations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: "direct",
        command: "Run the commit workflow.",
        projectPath: "/workspace/app",
        preferredWorkerType: "codex",
        preferredWorkerModel: "claude-opus-5",
      }),
    });

    expect(response.status).toBe(200);
    const { runId } = (await response.json()) as { runId: string };
    const surfaced = await client.waitFor("error.surfaced", {
      predicate: (frame) => {
        const payload = frame.payload as { code?: string; runId?: string } | null;
        return payload?.code === "worker.initial.turn_failed" && payload.runId === runId;
      },
      timeoutMs: 10_000,
    });
    const persistedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const persistedWorker = await db.select().from(workers).where(eq(workers.runId, runId)).get();

    expect(surfaced.payload).toMatchObject({
      code: "worker.initial.turn_failed",
      message: providerMessage,
      surface: "toast",
      runId,
      workerId: persistedWorker?.id,
    });
    expect(persistedRun).toMatchObject({
      status: "failed",
      lastError: providerMessage,
    });
    expect(persistedWorker).toMatchObject({
      status: "error",
      outputLog: providerOutput,
    });
  });
});
