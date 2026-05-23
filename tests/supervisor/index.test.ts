import { randomUUID } from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { clarifications, conversationReadMarkers, creditEvents, executionEvents, messages, planItems, planningReviewFindings, planningReviewRounds, planningReviewRuns, plans, processSessions, queuedConversationMessages, recoveryIncidents, runs, settings, supervisorInterventions, supervisorScheduledWakes, workerAssignments, workerCounters, workers } from "@/server/db/schema";
import { __resetNamedEventsForTests, getNamedEventsSince } from "@/server/events/named-events";
import { readWorkerOutputEntries, writeWorkerOutputEntries } from "@/server/workers/output-store";

const {
  mockAgentGenerate,
  mockSpawnAgent,
  mockAskAgent,
  mockCancelAgent,
  mockApprovePermission,
  mockGetAgent,
  mockBuildSupervisorTurnContext,
  mockParseSupervisorToolCall,
  mockSelectSpawnableWorkerType,
  mockNotifyEventStreamSubscribers,
  mockAgentConfigs,
  mockGetSupervisorModelConfig,
  mockValidateSupervisorModelConfig,
  mockBuildMastraModelConfig,
} = vi.hoisted(() => ({
  mockAgentGenerate: vi.fn(),
  mockSpawnAgent: vi.fn(),
  mockAskAgent: vi.fn(),
  mockCancelAgent: vi.fn(),
  mockApprovePermission: vi.fn(),
  mockGetAgent: vi.fn(),
  mockBuildSupervisorTurnContext: vi.fn(),
  mockParseSupervisorToolCall: vi.fn(),
  mockSelectSpawnableWorkerType: vi.fn(),
  mockNotifyEventStreamSubscribers: vi.fn(),
  mockAgentConfigs: [] as unknown[],
  mockGetSupervisorModelConfig: vi.fn((_env?: unknown, sourcePreference?: "primary" | "fallback") => ({
    provider: sourcePreference === "fallback" ? "openai" : "gemini",
    model: sourcePreference === "fallback" ? "gpt-5.4-mini" : "gemini-3.5-flash",
    apiKey: "key",
    baseURL: undefined,
    source: sourcePreference === "fallback" ? "fallback" : "primary",
  })),
  mockValidateSupervisorModelConfig: vi.fn(),
  mockBuildMastraModelConfig: vi.fn((config) => ({
    id: `${config.provider}/${config.model}`,
    apiKey: config.apiKey,
    url: config.baseURL,
  })),
}));

vi.mock("@mastra/core/agent", () => ({
  Agent: class MockAgent {
    constructor(public config: unknown) {
      mockAgentConfigs.push(config);
    }

    generate = mockAgentGenerate;
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
  getSupervisorModelConfig: mockGetSupervisorModelConfig,
  validateSupervisorModelConfig: mockValidateSupervisorModelConfig,
  buildMastraModelConfig: mockBuildMastraModelConfig,
}));

vi.mock("@/server/supervisor/runtime-settings", () => ({
  hydrateRuntimeEnvFromSettings: vi.fn(() => ({
    env: { OPENAI_API_KEY: "key" },
    decryptionFailures: [],
  })),
  readRuntimeEnvFromSettings: vi.fn(() => ({
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
    parseSupervisorToolCallFromMastra: mockParseSupervisorToolCall,
  };
});

vi.mock("@/server/supervisor/worker-availability", () => ({
  selectSpawnableWorkerType: mockSelectSpawnableWorkerType,
}));

vi.mock("@/server/events/live-updates", () => ({
  notifyEventStreamSubscribers: mockNotifyEventStreamSubscribers,
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
    __resetNamedEventsForTests();
    mockAgentConfigs.length = 0;
    vi.unstubAllEnvs();
    await db.delete(planningReviewFindings);
    await db.delete(planningReviewRounds);
    await db.delete(planningReviewRuns);
    await db.delete(supervisorScheduledWakes);
    await db.delete(supervisorInterventions);
    await db.delete(executionEvents);
    await db.delete(workerAssignments);
    await db.delete(clarifications);
    await db.delete(recoveryIncidents);
    await db.delete(queuedConversationMessages);
    await db.delete(messages);
    await db.delete(processSessions);
    await db.delete(creditEvents);
    await db.delete(workers);
    await db.delete(workerCounters);
    await db.delete(conversationReadMarkers);
    await db.delete(settings);
    await db.delete(runs);
    await db.delete(planItems);
    await db.delete(plans);

    mockAgentGenerate.mockResolvedValue({ toolCalls: [{ payload: { toolCallId: "tool-1", toolName: "worker_spawn", args: {} } }] });
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
    mockGetSupervisorModelConfig.mockImplementation((_env, sourcePreference?: "primary" | "fallback") => ({
      provider: sourcePreference === "fallback" ? "openai" : "gemini",
      model: sourcePreference === "fallback" ? "gpt-5.4-mini" : "gemini-3.5-flash",
      apiKey: sourcePreference === "fallback" ? "fallback-key" : "primary-key",
      baseURL: undefined,
      source: sourcePreference === "fallback" ? "fallback" : "primary",
    }));
    mockValidateSupervisorModelConfig.mockImplementation((config) => config);
    mockBuildMastraModelConfig.mockImplementation((config) => ({
      id: `${config.provider}/${config.model}`,
      apiKey: config.apiKey,
      url: config.baseURL,
    }));
  });

  it("notifies live event subscribers when supervisor state changes", async () => {
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

    const { Supervisor } = await import("@/server/supervisor");

    await expect(new Supervisor({ runId }).run()).resolves.toEqual({ state: "wait", delayMs: 5_000 });

    expect(mockNotifyEventStreamSubscribers).toHaveBeenCalled();
  }, 15_000);

  it("requires user-visible preflight confirmation before the first implementation worker spawn", async () => {
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
      projectPath: "/tmp/project",
      allowedWorkerTypes: JSON.stringify(["opencode"]),
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(messages).values({
      id: randomUUID(),
      runId,
      role: "user",
      kind: "checkpoint",
      content: "@docs/superpowers/plans/2026-05-08-settings-reorganization.md",
      createdAt: now,
    });

    const { Supervisor } = await import("@/server/supervisor");

    await expect(new Supervisor({ runId }).run()).resolves.toEqual({ state: "paused" });

    expect(mockSpawnAgent).not.toHaveBeenCalled();
    expect(mockAskAgent).not.toHaveBeenCalled();

    const persistedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    expect(persistedRun?.status).toBe("awaiting_user");

    const persistedMessages = await db.select().from(messages).where(eq(messages.runId, runId)).orderBy(messages.createdAt);
    expect(persistedMessages.map((message) => message.role)).toEqual(["user", "supervisor"]);
    expect(persistedMessages[1]).toMatchObject({
      kind: "implementation_confirmation",
    });
    expect(persistedMessages[1]?.content).toContain("Before I start implementation");
    expect(persistedMessages[1]?.content).toContain("Reply with confirmation or corrections");

    const events = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId));
    expect(events.map((event) => event.eventType)).toContain("preflight_confirmation_required");
    expect(mockNotifyEventStreamSubscribers).toHaveBeenCalledTimes(1);
  });

  it("rechecks immediately when a worker returns long final-looking output", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const now = new Date();
    const longWorkerResponse = [
      "Implemented the next real slice of the parity plan: the mobile media core now has a feature-gated linked FFmpeg/libav path instead of only the adapter-unavailable stub.",
      "",
      "Changed:",
      "",
      "Added optional ffmpeg-next and image deps behind mobile_media_core/ffmpeg in Cargo.toml.",
      "Implemented linked-library support for probe_media, extract_frame, render_preview_frame, and audio stream waveform summaries in engine.rs.",
      "Kept the no-feature production path explicitly failing with adapter-unavailable errors, so unstaged native-library builds still cannot fake media success.",
      "Added a feature-gated real fixture test in linked_ffmpeg_adapter.rs.",
      "Updated the plan and FFmpeg architecture-mismatch note with the current state and remaining encoder/muxer gap.",
    ].join("\n");

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

    mockAskAgent.mockResolvedValue({ response: longWorkerResponse, state: "idle" });

    const { Supervisor } = await import("@/server/supervisor");

    await expect(new Supervisor({ runId }).run()).resolves.toEqual({ state: "wait", delayMs: 0 });
  });

  it("resolves relative worker spawn cwd under the run project path", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "omniharness-worker-cwd-"));

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
      projectPath: workspace,
      allowedWorkerTypes: JSON.stringify(["opencode"]),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockParseSupervisorToolCall.mockReturnValue({
      id: "tool-relative-cwd",
      name: "worker_spawn",
      args: {
        type: "opencode",
        cwd: ".",
        title: "Main implementation",
        prompt: "start implementing",
        mode: "auto",
        purpose: "finish the task",
      },
    });

    const { Supervisor } = await import("@/server/supervisor");

    await expect(new Supervisor({ runId }).run()).resolves.toEqual({ state: "wait", delayMs: 5_000 });

    expect(mockSpawnAgent).toHaveBeenCalledWith(expect.objectContaining({
      cwd: workspace,
      name: `${runId}-worker-1`,
    }));

    const worker = await db.select().from(workers).where(eq(workers.runId, runId)).get();
    expect(worker?.cwd).toBe(workspace);
  });

  it("records supervisor waits without adding main conversation system messages", async () => {
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

    mockParseSupervisorToolCall.mockReturnValue({
      id: "tool-wait",
      name: "wait_until",
      args: {
        seconds: 5,
        reason: "Worker is actively checking available browser tooling/deps.",
      },
    });

    const { Supervisor } = await import("@/server/supervisor");

    await expect(new Supervisor({ runId }).run()).resolves.toEqual({ state: "wait", delayMs: 5_000 });

    const waitEvent = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId)).get();
    const persistedMessages = await db.select().from(messages).where(eq(messages.runId, runId));

    expect(waitEvent).toMatchObject({
      eventType: "supervisor_wait",
      runId,
    });
    expect(persistedMessages).toEqual([]);
  });

  it("lets the supervisor explicitly end its turn without recording a wait event", async () => {
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

    mockParseSupervisorToolCall.mockReturnValue({
      id: "tool-end-turn",
      name: "end_turn",
      args: {
        reason: "No intervention needed; worker is still making progress.",
        nextCheckSeconds: 7,
      },
    });

    const { Supervisor } = await import("@/server/supervisor");

    await expect(new Supervisor({ runId }).run()).resolves.toEqual({ state: "wait", delayMs: 7_000 });

    const event = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId)).get();
    const persistedMessages = await db.select().from(messages).where(eq(messages.runId, runId));

    expect(event).toMatchObject({
      eventType: "supervisor_turn_ended",
      runId,
    });
    expect(event?.details).toContain("No intervention needed");
    expect(persistedMessages).toEqual([]);
  });

  it("persists supervisor clarification questions before sending one live update", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const now = new Date();
    const question = "Which deployment target should I prioritize?";

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

    mockParseSupervisorToolCall.mockReturnValue({
      id: "tool-ask-user",
      name: "ask_user",
      args: { question },
    });

    const { Supervisor } = await import("@/server/supervisor");

    await expect(new Supervisor({ runId }).run()).resolves.toEqual({ state: "paused" });

    const persistedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const persistedMessages = await db.select().from(messages).where(eq(messages.runId, runId));
    const persistedEvents = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId));

    expect(persistedRun?.status).toBe("awaiting_user");
    expect(persistedMessages).toHaveLength(1);
    expect(persistedMessages[0]).toMatchObject({
      role: "supervisor",
      kind: "clarification",
      content: question,
    });
    expect(persistedEvents.map((event) => event.eventType)).toEqual(["clarification_requested"]);
    expect(mockNotifyEventStreamSubscribers).toHaveBeenCalledTimes(1);
  });

  it("lets the supervisor send a generated user-visible message before ending its turn", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const now = new Date();
    const supervisorReply = "I heard the fork-sync constraint and delivered it to the active worker. I'll keep watching that parity code stays additive or documented for trunk sync.";

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

    await db.insert(messages).values({
      id: randomUUID(),
      runId,
      role: "user",
      kind: "checkpoint",
      content: "Keep fork changes isolated so trunk sync stays easy.",
      createdAt: new Date(now.getTime() - 1_000),
    });

    mockParseSupervisorToolCall.mockReturnValueOnce({
      id: "tool-send-user-message",
      name: "send_user_message",
      args: {
        message: supervisorReply,
      },
    }).mockReturnValueOnce({
      id: "tool-end-turn",
      name: "end_turn",
      args: {
        reason: "The user has been acknowledged and the worker is still making progress.",
        nextCheckSeconds: 7,
      },
    });

    const { Supervisor } = await import("@/server/supervisor");

    await expect(new Supervisor({ runId }).run()).resolves.toEqual({ state: "wait", delayMs: 7_000 });

    const persistedMessages = await db.select().from(messages).where(eq(messages.runId, runId)).orderBy(messages.createdAt);

    expect(persistedMessages.map((message) => message.role)).toEqual(["user", "supervisor"]);
    expect(persistedMessages[1]).toMatchObject({
      kind: "update",
      content: supervisorReply,
    });
    const sentEvent = await db.select().from(executionEvents).where(eq(executionEvents.eventType, "supervisor_user_message_sent")).get();
    expect(sentEvent).toMatchObject({
      runId,
      workerId: null,
    });
    expect(mockBuildSupervisorTurnContext).toHaveBeenCalledTimes(2);
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

    const promptMessages = mockAgentGenerate.mock.calls[0]?.[0] as Array<{ role: string; content: string }>;
    expect(promptMessages.some((message) => message.content.includes("Prior supervision memory"))).toBe(true);
    expect(promptMessages.map((message) => message.content).join("\n\n")).toContain(latestInstruction);

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
    expect(mockAgentGenerate).not.toHaveBeenCalled();
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
    expect(mockAgentGenerate).not.toHaveBeenCalled();
  });

  it("does not execute a tool call if the run fails while the model request is in flight", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const pendingCompletion = deferred<{ toolCalls: Array<{ payload: { toolCallId: string; toolName: string; args: Record<string, unknown> } }> }>();
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

    mockAgentGenerate.mockReturnValue(pendingCompletion.promise);

    const { Supervisor } = await import("@/server/supervisor");
    const runPromise = new Supervisor({ runId }).run();

    await vi.waitFor(() => {
      expect(mockAgentGenerate).toHaveBeenCalled();
    });

    await db.update(runs).set({
      status: "failed",
      lastError: "Get agent failed: not_found",
      failedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(runs.id, runId));

    pendingCompletion.resolve({ toolCalls: [{ payload: { toolCallId: "tool-1", toolName: "worker_spawn", args: {} } }] });

    await expect(runPromise).resolves.toEqual({ state: "completed" });

    expect(mockParseSupervisorToolCall).not.toHaveBeenCalled();
    expect(mockSpawnAgent).not.toHaveBeenCalled();
    const allWorkers = await db.select().from(workers).where(eq(workers.runId, runId));
    expect(allWorkers).toHaveLength(0);
    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    expect(run?.status).toBe("failed");
    expect(run?.lastError).toBe("Get agent failed: not_found");
  });

  it("reads a referenced file into supervisor context without spawning a worker", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "omniharness-supervisor-read-"));
    const specPath = path.join(workspace, "docs", "spec.md");
    fs.mkdirSync(path.dirname(specPath), { recursive: true });
    fs.writeFileSync(specPath, "# Spec\n\nOutcome: understand the why before implementation.", "utf8");

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
      projectPath: workspace,
      allowedWorkerTypes: JSON.stringify(["opencode"]),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockParseSupervisorToolCall.mockReturnValue({
      id: "tool-read-file",
      name: "read_file",
      args: {
        path: "docs/spec.md",
      },
    });

    const { Supervisor } = await import("@/server/supervisor");

    await expect(new Supervisor({ runId }).run()).resolves.toEqual({ state: "wait", delayMs: 1_000 });

    expect(mockSpawnAgent).not.toHaveBeenCalled();
    const event = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId)).get();
    expect(event?.eventType).toBe("supervisor_file_read");
    expect(event?.details).toContain("docs/spec.md");
    expect(event?.details).toContain("understand the why before implementation");
    expect(await db.select().from(messages).where(eq(messages.runId, runId))).toEqual([]);
  });

  it("continues the same supervisor turn after reading evidence and then acts", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "omniharness-supervisor-turn-"));
    fs.writeFileSync(path.join(workspace, "evidence.md"), "worker history says tests passed", "utf8");

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
      projectPath: workspace,
      allowedWorkerTypes: JSON.stringify(["opencode"]),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockParseSupervisorToolCall
      .mockReturnValueOnce({
        id: "tool-read",
        name: "read_file",
        args: { path: "evidence.md" },
      })
      .mockReturnValueOnce({
        id: "tool-spawn",
        name: "worker_spawn",
        args: {
          type: "opencode",
          cwd: ".",
          title: "Main implementation",
          prompt: "act after reading evidence",
          mode: "auto",
          purpose: "finish the task",
        },
      });

    const { Supervisor } = await import("@/server/supervisor");

    await expect(new Supervisor({ runId }).run()).resolves.toEqual({ state: "wait", delayMs: 5_000 });

    expect(mockAgentGenerate).toHaveBeenCalledTimes(2);
    expect(mockSpawnAgent).toHaveBeenCalledWith(expect.objectContaining({
      cwd: workspace,
      name: `${runId}-worker-1`,
    }));
    const events = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId));
    expect(events.map((event) => event.eventType)).toEqual(expect.arrayContaining([
      "supervisor_file_read",
      "worker_spawned",
    ]));
  });

  it("can read recent worker history as evidence before deciding", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const now = new Date();
    const workerId = `${runId}-worker-1`;

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
      projectPath: "/tmp/project",
      allowedWorkerTypes: JSON.stringify(["opencode"]),
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "opencode",
      status: "idle",
      cwd: "/tmp/project",
      workerNumber: 1,
      title: "Main implementation",
      initialPrompt: "implement",
      outputLog: ["line 1", "line 2", "line 3", "line 4"].join("\n"),
      outputEntriesJson: "",
      currentText: "",
      lastText: "",
      createdAt: now,
      updatedAt: now,
    });

    mockParseSupervisorToolCall
      .mockReturnValueOnce({
        id: "tool-history",
        name: "read_worker_history",
        args: { workerId, lines: 2 },
      })
      .mockReturnValueOnce({
        id: "tool-wait",
        name: "wait_until",
        args: {
          seconds: 5,
          reason: "History has enough evidence; wait for next worker update.",
        },
      });

    const { Supervisor } = await import("@/server/supervisor");

    await expect(new Supervisor({ runId }).run()).resolves.toEqual({ state: "wait", delayMs: 5_000 });

    expect(mockAgentGenerate).toHaveBeenCalledTimes(2);
    const historyEvent = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId)).get();
    expect(historyEvent?.eventType).toBe("supervisor_worker_history_read");
    expect(historyEvent?.details).toContain("line 3");
    expect(historyEvent?.details).toContain("line 4");
    expect(historyEvent?.details).not.toContain("line 1");
  });

  it("runs targeted repository inspection without spawning a worker", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "omniharness-supervisor-inspect-"));
    const specPath = path.join(workspace, "docs", "spec.md");
    fs.mkdirSync(path.dirname(specPath), { recursive: true });
    fs.writeFileSync(specPath, "# Spec\n\nOutcome: inspect only the needed lines.", "utf8");

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
      projectPath: workspace,
      allowedWorkerTypes: JSON.stringify(["opencode"]),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockParseSupervisorToolCall.mockReturnValue({
      id: "tool-inspect-repo",
      name: "inspect_repo",
      args: {
        command: "sed",
        args: ["-n", "1,3p", "docs/spec.md"],
        reason: "read the heading and first outcome only",
      },
    });

    const { Supervisor } = await import("@/server/supervisor");

    await expect(new Supervisor({ runId }).run()).resolves.toEqual({ state: "wait", delayMs: 1_000 });

    expect(mockSpawnAgent).not.toHaveBeenCalled();
    const event = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId)).get();
    expect(event?.eventType).toBe("supervisor_repo_inspected");
    expect(event?.details).toContain('"command":"sed"');
    expect(event?.details).toContain("Outcome: inspect only the needed lines");
    expect(await db.select().from(messages).where(eq(messages.runId, runId))).toEqual([]);
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

    const persistedMessages = await db.select().from(messages).where(eq(messages.runId, runId));
    const spawnEvent = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId)).get();
    expect(persistedMessages).toEqual([]);
    expect(spawnEvent).toMatchObject({
      eventType: "worker_spawned",
      workerId: `${runId}-worker-1`,
    });
    expect(spawnEvent?.details).toContain("CLI: OpenCode");
    expect(spawnEvent?.details).toContain(`Worker: ${runId}-worker-1`);
    expect(spawnEvent?.details).toContain("Model: openai/gpt-5.4");
    expect(spawnEvent?.details).toContain("Effort: high");
    expect(spawnEvent?.details).toContain("Mode: full-access");
    expect(spawnEvent?.details).toContain("Title: Main implementation");
    expect(spawnEvent?.details).toContain("Purpose: finish the task.");
    expect(spawnEvent?.details).toContain("\"cwd\":\"/tmp/project\"");
  });

  it("passes worker-requested skill roots and MCP servers to the bridge spawn call", async () => {
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

    mockParseSupervisorToolCall.mockReturnValue({
      id: "tool-1",
      name: "worker_spawn",
      args: {
        type: "opencode",
        cwd: "/tmp/project",
        title: "Main implementation",
        prompt: "start implementing",
        purpose: "finish the task",
        skillRoots: ["/tmp/shared-skills"],
        mcpServers: [
          {
            type: "stdio",
            name: "chrome-devtools",
            command: "npx",
            args: ["chrome-devtools-mcp@latest"],
            env: [{ name: "SAMPLE", value: "1" }],
          },
        ],
      },
    });

    const { Supervisor } = await import("@/server/supervisor");
    await new Supervisor({ runId }).run();

    expect(mockSpawnAgent).toHaveBeenCalledWith(expect.objectContaining({
      skillRoots: ["/tmp/shared-skills"],
      mcpServers: [
        {
          type: "stdio",
          name: "chrome-devtools",
          command: "npx",
          args: ["chrome-devtools-mcp@latest"],
          env: [{ name: "SAMPLE", value: "1" }],
        },
      ],
    }));
  });

  it("anchors a supervisor-spawned worker prompt before streamed bridge output", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;

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

    mockParseSupervisorToolCall.mockReturnValue({
      id: "tool-streamed-spawn",
      name: "worker_spawn",
      args: {
        type: "opencode",
        cwd: "/tmp/project",
        title: "Main implementation",
        prompt: "Please implement the plan.",
        purpose: "Implement the plan",
      },
    });
    mockAskAgent.mockImplementationOnce(async () => {
      await writeWorkerOutputEntries(runId, workerId, [{
        id: "bridge-output-1",
        type: "thought",
        text: "streamed bridge output",
        timestamp: new Date().toISOString(),
      }]);
      return { response: "done", state: "idle" };
    });

    const { Supervisor } = await import("@/server/supervisor");

    await expect(new Supervisor({ runId }).run()).resolves.toEqual({ state: "wait", delayMs: 5_000 });

    const entries = await readWorkerOutputEntries(runId, workerId);
    const supervisorInputIndex = entries.findIndex((entry) => entry.type === "supervisor_input");
    const bridgeOutputIndex = entries.findIndex((entry) => entry.id === "bridge-output-1");

    expect(supervisorInputIndex).toBeGreaterThanOrEqual(0);
    expect(bridgeOutputIndex).toBeGreaterThanOrEqual(0);
    expect(supervisorInputIndex).toBeLessThan(bridgeOutputIndex);
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

  it("does not block a new worker behind a completed idle implementation worker", async () => {
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
      status: "idle",
      cwd: "/tmp/project",
      title: "Main implementation",
      initialPrompt: "implement the plan",
      outputLog: "",
      lastText: "I have implemented the plan and verified the tests.",
      createdAt: now,
      updatedAt: now,
    });

    mockParseSupervisorToolCall.mockReturnValue({
      id: "tool-after-idle-complete",
      name: "worker_spawn",
      args: {
        type: "opencode",
        cwd: "/tmp/project",
        title: "Main implementation retry",
        prompt: "Continue implementing the plan from the completed worker output.",
        purpose: "Implement the plan",
      },
    });

    const { Supervisor } = await import("@/server/supervisor");

    await expect(new Supervisor({ runId }).run()).resolves.toEqual({ state: "wait", delayMs: 5_000 });

    expect(mockSpawnAgent).toHaveBeenCalled();
    const allWorkers = await db.select().from(workers).where(eq(workers.runId, runId));
    expect(allWorkers).toHaveLength(2);
    const blockedEvent = await db.select().from(executionEvents).where(eq(executionEvents.eventType, "worker_spawn_blocked")).get();
    expect(blockedEvent).toBeUndefined();
  });

  it("parks a final-looking active implementation worker before spawning a validator", async () => {
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
      bridgeSessionId: "implementer-session",
      bridgeSessionMode: "full-access",
      currentText: "I implemented the plan and verified the full test matrix. ".repeat(20),
      lastText: "I implemented the plan and verified the full test matrix. ".repeat(20),
      createdAt: now,
      updatedAt: now,
    });

    mockParseSupervisorToolCall.mockReturnValue({
      id: "tool-validator-after-completion",
      name: "worker_spawn",
      args: {
        type: "opencode",
        cwd: "/tmp/project",
        title: "Validate completed implementation",
        prompt: "Validate the implementation and report any regressions.",
        purpose: "Validate the implementation of the plan.",
      },
    });

    const { Supervisor } = await import("@/server/supervisor");

    await expect(new Supervisor({ runId }).run()).resolves.toEqual({ state: "wait", delayMs: 5_000 });

    expect(mockCancelAgent).not.toHaveBeenCalled();
    expect(mockSpawnAgent).toHaveBeenCalled();

    const parkedWorker = await db.select().from(workers).where(eq(workers.id, `${runId}-worker-1`)).get();
    expect(parkedWorker?.status).toBe("idle");
    expect(parkedWorker?.bridgeSessionId).toBe("implementer-session");

    const allWorkers = await db.select().from(workers).where(eq(workers.runId, runId));
    expect(allWorkers).toHaveLength(2);
    expect(allWorkers.find((worker) => worker.id === `${runId}-worker-1`)?.workerRole).toBeNull();
    const validatorWorker = allWorkers.find((worker) => worker.id !== `${runId}-worker-1`);
    expect(validatorWorker).toMatchObject({
      workerRole: "validation",
      allocationKey: "main",
    });

    const blockedEvent = await db.select().from(executionEvents).where(eq(executionEvents.eventType, "worker_spawn_blocked")).get();
    expect(blockedEvent).toBeUndefined();

    const parkedEvent = await db.select().from(executionEvents).where(eq(executionEvents.eventType, "worker_completed_parked")).get();
    expect(parkedEvent?.workerId).toBe(`${runId}-worker-1`);
  });

  it("blocks validator spawn while the implementation worker is still actively working", async () => {
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
      workerRole: "implementation",
      allocationKey: "main",
      title: "Main implementation",
      initialPrompt: "implement the plan",
      outputLog: "",
      currentText: "Still editing files.",
      createdAt: now,
      updatedAt: now,
    });

    mockParseSupervisorToolCall.mockReturnValue({
      id: "tool-validator-too-early",
      name: "worker_spawn",
      args: {
        type: "opencode",
        cwd: "/tmp/project",
        title: "Validate implementation",
        prompt: "Validate the implementation and report gaps.",
        purpose: "Validate the implementation.",
      },
    });

    const { Supervisor } = await import("@/server/supervisor");

    await expect(new Supervisor({ runId }).run()).resolves.toEqual({ state: "wait", delayMs: 5_000 });

    expect(mockSpawnAgent).not.toHaveBeenCalled();
    const event = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId)).get();
    expect(event?.eventType).toBe("worker_spawn_blocked");
    expect(event?.details).toContain('"requestedRole":"validation"');
    expect(event?.details).toContain('"activeWorkerRole":"implementation"');
  });

  it("does not let an active validator block feedback to the original implementer", async () => {
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

    await db.insert(workers).values([
      {
        id: `${runId}-worker-1`,
        runId,
        type: "opencode",
        status: "idle",
        cwd: "/tmp/project",
        workerRole: "implementation",
        allocationKey: "main",
        title: "Main implementation",
        initialPrompt: "implement the plan",
        outputLog: "",
        bridgeSessionId: "implementer-session",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: `${runId}-worker-2`,
        runId,
        type: "opencode",
        status: "working",
        cwd: "/tmp/project",
        workerRole: "validation",
        allocationKey: "main",
        title: "Validate implementation",
        initialPrompt: "validate the plan",
        outputLog: "",
        createdAt: now,
        updatedAt: now,
      },
    ]);

    mockParseSupervisorToolCall.mockReturnValue({
      id: "tool-completion-gap",
      name: "worker_continue",
      args: {
        workerId: `${runId}-worker-1`,
        prompt: "Validator found missing error handling. Please fix that gap and rerun verification.",
        interventionType: "completion_gap",
      },
    });

    const { Supervisor } = await import("@/server/supervisor");

    await expect(new Supervisor({ runId }).run()).resolves.toEqual({ state: "wait", delayMs: 5_000 });

    expect(mockSpawnAgent).not.toHaveBeenCalled();
    expect(mockAskAgent).toHaveBeenCalledWith(
      `${runId}-worker-1`,
      "Validator found missing error handling. Please fix that gap and rerun verification.",
    );

    const implementer = await db.select().from(workers).where(eq(workers.id, `${runId}-worker-1`)).get();
    expect(implementer?.status).toBe("working");
    const blockedEvent = await db.select().from(executionEvents).where(eq(executionEvents.eventType, "worker_spawn_blocked")).get();
    expect(blockedEvent).toBeUndefined();
  });

  it("allows an independent implementation slice while the main implementation is active", async () => {
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
      workerRole: "implementation",
      allocationKey: "main",
      title: "Main implementation",
      initialPrompt: "implement the plan",
      outputLog: "",
      createdAt: now,
      updatedAt: now,
    });

    mockParseSupervisorToolCall.mockReturnValue({
      id: "tool-independent-slice",
      name: "worker_spawn",
      args: {
        type: "opencode",
        cwd: "/tmp/project",
        title: "Implement API module only",
        prompt: "Implement the API module only. Do not touch UI files.",
        purpose: "Implement one independent module slice.",
      },
    });

    const { Supervisor } = await import("@/server/supervisor");

    await expect(new Supervisor({ runId }).run()).resolves.toEqual({ state: "wait", delayMs: 5_000 });

    expect(mockSpawnAgent).toHaveBeenCalled();
    const allWorkers = await db.select().from(workers).where(eq(workers.runId, runId));
    expect(allWorkers).toHaveLength(2);
    const sliceWorker = allWorkers.find((worker) => worker.id !== `${runId}-worker-1`);
    expect(sliceWorker).toMatchObject({
      workerRole: "implementation",
      allocationKey: "slice:implement-api-module-only",
    });
    const blockedEvent = await db.select().from(executionEvents).where(eq(executionEvents.eventType, "worker_spawn_blocked")).get();
    expect(blockedEvent).toBeUndefined();
  });

  it("blocks a replacement main worker while a stopped main worker still has a resumable session", async () => {
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
      status: "stopped",
      cwd: "/tmp/project",
      title: "Main implementation",
      initialPrompt: "implement the plan",
      outputLog: "",
      bridgeSessionId: "session-resumable",
      createdAt: now,
      updatedAt: now,
    });

    mockParseSupervisorToolCall.mockReturnValue({
      id: "tool-replacement",
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
    expect(event?.details).toContain("resumable implementation worker");
  });

  it("blocks a duplicate main continuation worker even when the active worker prompt says to review current state", async () => {
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
      allowedWorkerTypes: JSON.stringify(["gemini"]),
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(workers).values({
      id: `${runId}-worker-1`,
      runId,
      type: "gemini",
      status: "starting",
      cwd: "/tmp/project",
      title: "Implement music-driven rough cut refinement",
      initialPrompt: "A previous worker was stopped, so please review the current state of the repository and continue the implementation from where it left off.",
      outputLog: "",
      bridgeSessionId: "session-active",
      createdAt: now,
      updatedAt: now,
    });

    mockParseSupervisorToolCall.mockReturnValue({
      id: "tool-duplicate-continuation",
      name: "worker_spawn",
      args: {
        type: "gemini",
        cwd: "/tmp/project",
        title: "Implement music-driven rough cut refinement",
        prompt: "Check the current state of the repository and continue the implementation.",
        purpose: "Implement the music-driven rough cut refinement plan",
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

  it("applies fallback_api credit strategy by retrying supervisor model requests with the fallback profile", async () => {
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
      key: "CREDIT_STRATEGY",
      value: "fallback_api",
      updatedAt: new Date(),
    });

    mockAgentGenerate
      .mockRejectedValueOnce(Object.assign(new Error("quota exceeded"), { status: 429 }))
      .mockResolvedValueOnce({ toolCalls: [{ payload: { toolCallId: "tool-1", toolName: "worker_spawn", args: {} } }] });

    const { Supervisor } = await import("@/server/supervisor");

    await expect(new Supervisor({ runId }).run()).resolves.toEqual({ state: "wait", delayMs: 5_000 });

    expect(mockAgentGenerate).toHaveBeenCalledTimes(2);
    expect(mockGetSupervisorModelConfig).toHaveBeenCalledWith(expect.any(Object));
    expect(mockGetSupervisorModelConfig).toHaveBeenCalledWith(expect.any(Object), "fallback");
    expect(mockAgentConfigs.map((config) => (config as { model?: { id?: string } }).model?.id)).toEqual([
      "gemini/gemini-3.5-flash",
      "openai/gpt-5.4-mini",
    ]);

    const strategyEvent = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId));
    expect(strategyEvent.some((event) => event.eventType === "supervisor_credit_strategy_applied")).toBe(true);
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

  it("records supervisor continue prompts before waiting for the worker response", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const now = new Date();
    const pendingAsk = deferred<{ response: string; state: string }>();

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
      id: "worker-needs-visible-prompt",
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
        workerId: "worker-needs-visible-prompt",
        prompt: "Please continue from the next unchecked item.",
      },
    });
    mockAskAgent.mockReturnValue(pendingAsk.promise);

    const { Supervisor } = await import("@/server/supervisor");

    const runPromise = new Supervisor({ runId }).run();
    await vi.waitFor(() => expect(mockAskAgent).toHaveBeenCalledWith(
      "worker-needs-visible-prompt",
      "Please continue from the next unchecked item.",
    ));

    const interventionsWhileWorkerRuns = await db.select()
      .from(supervisorInterventions)
      .where(eq(supervisorInterventions.runId, runId));

    expect(interventionsWhileWorkerRuns).toHaveLength(1);
    expect(interventionsWhileWorkerRuns[0]).toMatchObject({
      runId,
      workerId: "worker-needs-visible-prompt",
      prompt: "Please continue from the next unchecked item.",
    });

    pendingAsk.resolve({ response: "Continuing now", state: "working" });
    await expect(runPromise).resolves.toEqual({ state: "wait", delayMs: 5_000 });
  });

  it("defers worker follow-ups when the bridge reports the agent is busy", async () => {
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
      id: "worker-already-running",
      runId,
      type: "codex",
      status: "working",
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
        workerId: "worker-already-running",
        prompt: "Keep going and report back.",
      },
    });
    mockAskAgent.mockRejectedValue(new Error("Ask failed: Agent is busy: worker-already-running"));

    const { Supervisor } = await import("@/server/supervisor");

    await expect(new Supervisor({ runId }).run()).resolves.toEqual({ state: "wait", delayMs: 5_000 });

    const persistedWorker = await db.select().from(workers).where(eq(workers.id, "worker-already-running")).get();
    expect(persistedWorker?.status).toBe("working");

    const events = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId));
    const persistedMessages = await db.select().from(messages).where(eq(messages.runId, runId));
    const interventions = await db.select().from(supervisorInterventions).where(eq(supervisorInterventions.runId, runId));
    const deferredEvent = events.find((event) => event.eventType === "worker_prompt_deferred");
    expect(deferredEvent?.workerId).toBe("worker-already-running");
    expect(deferredEvent?.details).toContain("Agent is busy");
    expect(persistedMessages).toEqual([]);
    expect(interventions).toHaveLength(1);
    expect(interventions[0]).toMatchObject({
      runId,
      workerId: "worker-already-running",
      prompt: "Keep going and report back.",
      summary: "Deferred follow-up to worker-already-running; worker is busy.",
    });
  });

  it("does not resume a worker follow-up after the run pauses for user input mid-turn", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = "worker-paused-by-user";
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
      id: workerId,
      runId,
      type: "codex",
      status: "cancelled",
      cwd: "/tmp/project",
      title: "Main implementation",
      initialPrompt: "implement the plan",
      outputLog: "",
      bridgeSessionId: "saved-session-paused",
      bridgeSessionMode: "full-access",
      createdAt: now,
      updatedAt: now,
    });

    mockAgentGenerate.mockImplementationOnce(async () => {
      await db.insert(clarifications).values({
        id: randomUUID(),
        runId,
        question: "I paused the active workers after you stopped one. Is there anything you want to modify before I continue?",
        answer: null,
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await db.update(runs).set({ status: "awaiting_user", updatedAt: new Date() }).where(eq(runs.id, runId));
      return { toolCalls: [{ payload: { toolCallId: "tool-continue", toolName: "worker_continue", args: {} } }] };
    });
    mockParseSupervisorToolCall.mockReturnValue({
      id: "tool-continue",
      name: "worker_continue",
      args: {
        workerId,
        prompt: "Please continue.",
      },
    });

    const { Supervisor } = await import("@/server/supervisor");

    await expect(new Supervisor({ runId }).run()).resolves.toEqual({ state: "paused" });

    const persistedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const workerEvents = await db.select().from(executionEvents).where(eq(executionEvents.workerId, workerId));
    expect(persistedRun?.status).toBe("awaiting_user");
    expect(mockParseSupervisorToolCall).not.toHaveBeenCalled();
    expect(mockAskAgent).not.toHaveBeenCalled();
    expect(mockSpawnAgent).not.toHaveBeenCalled();
    expect(workerEvents.some((event) => event.eventType === "worker_session_resumed")).toBe(false);
    expect(workerEvents.some((event) => event.eventType === "worker_prompted")).toBe(false);
  });

  it("resumes a saved worker session before retrying a follow-up to a missing worker", async () => {
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
      preferredWorkerModel: "openai/gpt-5.4",
      preferredWorkerEffort: "high",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(workers).values({
      id: "worker-needs-resume",
      runId,
      type: "codex",
      status: "idle",
      cwd: "/tmp/project",
      title: "Main implementation",
      initialPrompt: "implement the plan",
      outputLog: "",
      bridgeSessionId: "saved-session-1",
      bridgeSessionMode: "full-access",
      createdAt: now,
      updatedAt: now,
    });

    mockParseSupervisorToolCall.mockReturnValue({
      id: "tool-continue",
      name: "worker_continue",
      args: {
        workerId: "worker-needs-resume",
        prompt: "Continue now that the subscription quota reset.",
      },
    });
    mockAskAgent
      .mockRejectedValueOnce(new Error("Ask failed: Agent not found: worker-needs-resume"))
      .mockResolvedValueOnce({ response: "Continuing after resume", state: "working" });
    mockSpawnAgent.mockResolvedValue({
      name: "worker-needs-resume",
      type: "codex",
      cwd: "/tmp/project",
      state: "idle",
      sessionId: "saved-session-1",
      sessionMode: "full-access",
      currentText: "",
      lastText: "",
      pendingPermissions: [],
      stderrBuffer: [],
      stopReason: null,
    });

    const { Supervisor } = await import("@/server/supervisor");

    await expect(new Supervisor({ runId }).run()).resolves.toEqual({ state: "wait", delayMs: 5_000 });

    expect(mockSpawnAgent).toHaveBeenCalledWith({
      type: "codex",
      cwd: "/tmp/project",
      name: "worker-needs-resume",
      mode: "full-access",
      model: "openai/gpt-5.4",
      effort: "high",
      env: { OPENAI_API_KEY: "key" },
      resumeSessionId: "saved-session-1",
    });
    expect(mockAskAgent).toHaveBeenCalledTimes(2);
    const persistedWorker = await db.select().from(workers).where(eq(workers.id, "worker-needs-resume")).get();
    const workerEvents = await db.select().from(executionEvents).where(eq(executionEvents.workerId, "worker-needs-resume"));
    expect(persistedWorker?.status).toBe("working");
    expect(workerEvents.some((event) => event.eventType === "worker_session_resumed")).toBe(true);
    expect(workerEvents.some((event) => event.eventType === "worker_prompted")).toBe(true);
    expect(getNamedEventsSince(0, { runId }).events.map((entry) => entry.event)).toContainEqual(expect.objectContaining({
      kind: "worker.reattached",
      runId,
      workerId: "worker-needs-resume",
    }));
  });

  it("starts a fresh worker when the saved resume session no longer exists", async () => {
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
      preferredWorkerModel: "gemini-3",
      preferredWorkerEffort: "high",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(workers).values({
      id: "worker-missing-session",
      runId,
      type: "gemini",
      status: "idle",
      cwd: "/tmp/project",
      title: "Main implementation",
      initialPrompt: "implement the plan",
      outputLog: "",
      bridgeSessionId: "missing-session",
      bridgeSessionMode: "full-access",
      createdAt: now,
      updatedAt: now,
    });

    mockParseSupervisorToolCall.mockReturnValue({
      id: "tool-continue-missing-session",
      name: "worker_continue",
      args: {
        workerId: "worker-missing-session",
        prompt: "Continue after the missing runtime session.",
      },
    });
    mockAskAgent
      .mockRejectedValueOnce(new Error("Ask failed: Agent not found: worker-missing-session"))
      .mockResolvedValueOnce({ response: "Continuing in a fresh runtime worker", state: "working" });
    mockSpawnAgent
      .mockRejectedValueOnce(new Error('Spawn failed: failed to start gemini agent via gemini: {"code":-32603,"message":"Internal error","data":{"details":"Invalid session identifier \\"missing-session\\"."}}'))
      .mockResolvedValueOnce({
        name: "worker-missing-session",
        type: "gemini",
        cwd: "/tmp/project",
        state: "idle",
        sessionId: "fresh-session",
        sessionMode: "full-access",
        currentText: "",
        lastText: "",
        pendingPermissions: [],
        stderrBuffer: [],
        stopReason: null,
      });

    const { Supervisor } = await import("@/server/supervisor");

    await expect(new Supervisor({ runId }).run()).resolves.toEqual({ state: "wait", delayMs: 5_000 });

    expect(mockSpawnAgent).toHaveBeenCalledTimes(2);
    expect(mockSpawnAgent.mock.calls[0]?.[0]).toMatchObject({ resumeSessionId: "missing-session" });
    expect(mockSpawnAgent.mock.calls[1]?.[0]).not.toHaveProperty("resumeSessionId");
    expect(mockAskAgent).toHaveBeenCalledTimes(2);
    const persistedWorker = await db.select().from(workers).where(eq(workers.id, "worker-missing-session")).get();
    const workerEvents = await db.select().from(executionEvents).where(eq(executionEvents.workerId, "worker-missing-session"));
    expect(persistedWorker?.status).toBe("working");
    expect(persistedWorker?.bridgeSessionId).toBe("fresh-session");
    expect(workerEvents.some((event) => event.eventType === "worker_session_missing")).toBe(true);
    expect(workerEvents.some((event) => event.eventType === "worker_session_recreated")).toBe(true);
    expect(workerEvents.some((event) => event.eventType === "worker_prompted")).toBe(true);
    expect(getNamedEventsSince(0, { runId }).events.map((entry) => entry.event)).toContainEqual(expect.objectContaining({
      kind: "worker.recreated",
      runId,
      workerId: "worker-missing-session",
    }));
  });

  it("starts a fresh Gemini worker when the saved resume file cannot be loaded", async () => {
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
      preferredWorkerModel: "gemini-3",
      preferredWorkerEffort: "high",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(workers).values({
      id: "worker-corrupt-session",
      runId,
      type: "gemini",
      status: "idle",
      cwd: "/tmp/project",
      title: "Main implementation",
      initialPrompt: "implement the plan",
      outputLog: "",
      bridgeSessionId: "corrupt-session",
      bridgeSessionMode: "full-access",
      createdAt: now,
      updatedAt: now,
    });

    mockParseSupervisorToolCall.mockReturnValue({
      id: "tool-continue-corrupt-session",
      name: "worker_continue",
      args: {
        workerId: "worker-corrupt-session",
        prompt: "Continue after the corrupt runtime session.",
      },
    });
    mockAskAgent
      .mockRejectedValueOnce(new Error("Ask failed: Agent not found: worker-corrupt-session"))
      .mockResolvedValueOnce({ response: "Continuing in a fresh runtime worker", state: "working" });
    mockSpawnAgent
      .mockRejectedValueOnce(new Error('Spawn failed: failed to start gemini agent via gemini: {"code":-32603,"message":"Internal error","data":{"details":"Failed to initialize chat: Failed to load resumed session data from file"}}'))
      .mockResolvedValueOnce({
        name: "worker-corrupt-session",
        type: "gemini",
        cwd: "/tmp/project",
        state: "idle",
        sessionId: "fresh-session",
        sessionMode: "full-access",
        currentText: "",
        lastText: "",
        pendingPermissions: [],
        stderrBuffer: [],
        stopReason: null,
      });

    const { Supervisor } = await import("@/server/supervisor");

    await expect(new Supervisor({ runId }).run()).resolves.toEqual({ state: "wait", delayMs: 5_000 });

    expect(mockSpawnAgent).toHaveBeenCalledTimes(2);
    expect(mockSpawnAgent.mock.calls[0]?.[0]).toMatchObject({ resumeSessionId: "corrupt-session" });
    expect(mockSpawnAgent.mock.calls[1]?.[0]).not.toHaveProperty("resumeSessionId");
    expect(mockAskAgent).toHaveBeenCalledTimes(2);
    const persistedWorker = await db.select().from(workers).where(eq(workers.id, "worker-corrupt-session")).get();
    const workerEvents = await db.select().from(executionEvents).where(eq(executionEvents.workerId, "worker-corrupt-session"));
    expect(persistedWorker?.status).toBe("working");
    expect(persistedWorker?.bridgeSessionId).toBe("fresh-session");
    expect(workerEvents.some((event) => event.eventType === "worker_session_missing")).toBe(true);
    expect(workerEvents.some((event) => event.eventType === "worker_session_recreated")).toBe(true);
    expect(workerEvents.some((event) => event.eventType === "worker_prompted")).toBe(true);
    expect(getNamedEventsSince(0, { runId }).events.map((entry) => entry.event)).toContainEqual(expect.objectContaining({
      kind: "worker.recreated",
      runId,
      workerId: "worker-corrupt-session",
    }));
  });

  it("reattaches a newly spawned worker when the initial prompt finds the runtime missing", async () => {
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
      preferredWorkerType: "gemini",
      preferredWorkerModel: "gemini-3",
      preferredWorkerEffort: "high",
      createdAt: now,
      updatedAt: now,
    });

    mockParseSupervisorToolCall.mockReturnValue({
      id: "tool-spawn-then-missing",
      name: "worker_spawn",
      args: {
        type: "gemini",
        cwd: "/tmp/project",
        title: "Main implementation",
        prompt: "Implement the plan.",
        mode: "full-access",
        purpose: "finish the task",
      },
    });
    mockSelectSpawnableWorkerType.mockReturnValue({
      type: "gemini",
      requestedType: "gemini",
      fallbackReason: null,
    });
    mockSpawnAgent
      .mockResolvedValueOnce({
        name: "spawned-worker",
        type: "gemini",
        cwd: "/tmp/project",
        state: "idle",
        sessionId: "spawn-session",
        sessionMode: "full-access",
        currentText: "",
        lastText: "",
        pendingPermissions: [],
        stderrBuffer: [],
        stopReason: null,
      })
      .mockResolvedValueOnce({
        name: "spawned-worker",
        type: "gemini",
        cwd: "/tmp/project",
        state: "idle",
        sessionId: "reattached-session",
        sessionMode: "full-access",
        currentText: "",
        lastText: "",
        pendingPermissions: [],
        stderrBuffer: [],
        stopReason: null,
      });
    mockAskAgent
      .mockRejectedValueOnce(new Error("Ask failed: Agent not found: spawned-worker"))
      .mockResolvedValueOnce({ response: "Initial prompt delivered after reattach", state: "working" });

    const { Supervisor } = await import("@/server/supervisor");

    await expect(new Supervisor({ runId }).run()).resolves.toEqual({ state: "wait", delayMs: 5_000 });

    const persistedWorker = await db.select().from(workers).where(eq(workers.runId, runId)).get();
    expect(persistedWorker?.status).toBe("working: finish the task");
    expect(persistedWorker?.bridgeSessionId).toBe("reattached-session");
    expect(mockSpawnAgent).toHaveBeenCalledTimes(2);
    expect(mockSpawnAgent.mock.calls[1]?.[0]).toMatchObject({ resumeSessionId: "spawn-session" });
    expect(mockAskAgent).toHaveBeenCalledTimes(2);
    const workerEvents = await db.select().from(executionEvents).where(eq(executionEvents.workerId, persistedWorker?.id ?? ""));
    expect(workerEvents.some((event) => event.eventType === "worker_session_resumed")).toBe(true);
    expect(workerEvents.some((event) => event.eventType === "worker_prompt_failed")).toBe(false);
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

  it("marks complete without running inferred plan-title validation", async () => {
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
      projectPath: "/tmp/project",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(planItems).values({
      id: randomUUID(),
      planId,
      phase: "Regression",
      title: "Update missing-file-that-only-exists-in-prose.txt",
      status: "pending",
      sourceLine: 12,
      createdAt: now,
      updatedAt: now,
    });

    mockParseSupervisorToolCall.mockReturnValue({
      id: "tool-complete",
      name: "mark_complete",
      args: {
        summary: "The supervisor checked the worker evidence and accepted completion.",
      },
    });

    const { Supervisor } = await import("@/server/supervisor");

    await expect(new Supervisor({ runId }).run()).resolves.toEqual({ state: "completed" });

    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    expect(run?.status).toBe("done");

    const completionEvent = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId)).get();
    expect(completionEvent?.eventType).toBe("run_completed");
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
