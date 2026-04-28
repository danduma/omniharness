import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { eq } from "drizzle-orm";
import { messages, plans, runs, workerCounters, workers } from "@/server/db/schema";

const {
  mockStartSupervisorRun,
  mockQueueConversationTitleGeneration,
  mockEnsureSupervisorRuntimeStarted,
  mockSpawnAgent,
  mockAskAgent,
  mockGetAgent,
  mockNotifyEventStreamSubscribers,
} = vi.hoisted(() => ({
  mockStartSupervisorRun: vi.fn(),
  mockQueueConversationTitleGeneration: vi.fn().mockResolvedValue(undefined),
  mockEnsureSupervisorRuntimeStarted: vi.fn().mockResolvedValue(undefined),
  mockNotifyEventStreamSubscribers: vi.fn(),
  mockSpawnAgent: vi.fn().mockResolvedValue({
    name: "worker-1",
    type: "codex",
    state: "idle",
    cwd: "/workspace/app",
    lastText: "",
    currentText: "",
    stderrBuffer: [],
    stopReason: null,
  }),
  mockAskAgent: vi.fn().mockResolvedValue({
    response: "Acknowledged.",
    state: "working",
  }),
  mockGetAgent: vi.fn().mockResolvedValue({
    name: "worker-1",
    type: "codex",
    state: "working",
    cwd: "/workspace/app",
    lastText: "Acknowledged.",
    currentText: "",
    renderedOutput: "",
    outputEntries: [
      {
        id: "entry-1",
        type: "message",
        text: "Acknowledged.",
        timestamp: new Date(0).toISOString(),
      },
    ],
    stderrBuffer: [],
    stopReason: null,
  }),
}));

vi.mock("@/server/supervisor/start", () => ({
  startSupervisorRun: mockStartSupervisorRun,
}));

vi.mock("@/server/conversation-title", () => ({
  queueConversationTitleGeneration: mockQueueConversationTitleGeneration,
}));

vi.mock("@/server/supervisor/runtime-watchdog", () => ({
  ensureSupervisorRuntimeStarted: mockEnsureSupervisorRuntimeStarted,
}));

vi.mock("@/server/bridge-client", () => ({
  spawnAgent: mockSpawnAgent,
  askAgent: mockAskAgent,
  getAgent: mockGetAgent,
}));

vi.mock("@/server/events/live-updates", () => ({
  notifyEventStreamSubscribers: mockNotifyEventStreamSubscribers,
}));

import { POST } from "@/app/api/conversations/route";

describe("POST /api/conversations", () => {
  beforeEach(async () => {
    mockStartSupervisorRun.mockClear();
    mockQueueConversationTitleGeneration.mockClear();
    mockEnsureSupervisorRuntimeStarted.mockClear();
    mockSpawnAgent.mockClear();
    mockAskAgent.mockClear();
    mockGetAgent.mockClear();
    mockNotifyEventStreamSubscribers.mockClear();

    await db.delete(messages);
    await db.delete(workers);
    await db.delete(workerCounters);
    await db.delete(runs);
    await db.delete(plans);
  });

  it("starts an implementation conversation and wakes the supervisor", async () => {
    const request = new NextRequest("http://localhost/api/conversations", {
      method: "POST",
      body: JSON.stringify({
        mode: "implementation",
        command: "Implement docs/superpowers/plans/foo.md",
        projectPath: "/workspace/app",
        preferredWorkerType: "codex",
        allowedWorkerTypes: ["codex"],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const payload = await response.json();
    const run = await db.select().from(runs).where(eq(runs.id, payload.runId)).get();

    expect(run?.mode).toBe("implementation");
    expect(payload.plan).toEqual(expect.objectContaining({
      id: payload.planId,
      path: expect.any(String),
    }));
    expect(payload.run).toEqual(expect.objectContaining({
      id: payload.runId,
      planId: payload.planId,
      mode: "implementation",
      title: "New conversation",
    }));
    expect(payload.message).toEqual(expect.objectContaining({
      runId: payload.runId,
      role: "user",
      kind: "checkpoint",
      content: "Implement docs/superpowers/plans/foo.md",
    }));
    expect(mockStartSupervisorRun).toHaveBeenCalledWith(payload.runId);
    expect(mockSpawnAgent).not.toHaveBeenCalled();
    expect(mockNotifyEventStreamSubscribers).toHaveBeenCalledTimes(1);
  });

  it("starts a planning conversation with one direct worker and no supervisor", async () => {
    const request = new NextRequest("http://localhost/api/conversations", {
      method: "POST",
      body: JSON.stringify({
        mode: "planning",
        command: "Help me write a plan for the conversation modes work",
        projectPath: "/workspace/app",
        preferredWorkerType: "codex",
        preferredWorkerModel: "gpt-5.4",
        preferredWorkerEffort: "high",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const payload = await response.json();
    const createdRun = await db.select().from(runs).where(eq(runs.id, payload.runId)).get();
    const createdWorkers = await db.select().from(workers).where(eq(workers.runId, payload.runId));

    expect(createdRun?.mode).toBe("planning");
    expect(createdRun?.projectPath).toBe("/workspace/app");
    expect(createdWorkers).toHaveLength(1);
    expect(createdWorkers[0]?.cwd).toBe("/workspace/app");
    expect(mockSpawnAgent).toHaveBeenCalledWith(expect.objectContaining({
      type: "codex",
      cwd: "/workspace/app",
      model: "gpt-5.4",
      effort: "high",
    }));
    expect(mockAskAgent).toHaveBeenCalledTimes(1);
    expect(mockStartSupervisorRun).not.toHaveBeenCalled();
  });

  it("starts a direct conversation with one direct worker and no supervisor", async () => {
    const request = new NextRequest("http://localhost/api/conversations", {
      method: "POST",
      body: JSON.stringify({
        mode: "direct",
        command: "Open a direct Codex session in this repo",
        projectPath: "/workspace/app",
        preferredWorkerType: "codex",
        preferredWorkerModel: "gpt-5.4",
        preferredWorkerEffort: "medium",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const payload = await response.json();
    const createdRun = await db.select().from(runs).where(eq(runs.id, payload.runId)).get();

    expect(createdRun?.mode).toBe("direct");
    expect(mockSpawnAgent).toHaveBeenCalledTimes(1);
    expect(mockAskAgent).toHaveBeenCalledTimes(1);
    expect(mockStartSupervisorRun).not.toHaveBeenCalled();
  });

  it("records a visible failure when a direct worker returns no output", async () => {
    mockSpawnAgent.mockResolvedValueOnce({
      name: "worker-empty",
      type: "codex",
      state: "idle",
      cwd: "/workspace/app",
      sessionId: "session-empty",
      sessionMode: "full-access",
      lastText: "",
      currentText: "",
      renderedOutput: "",
      outputEntries: [],
      stderrBuffer: [],
      stopReason: "end_turn",
    });
    mockAskAgent.mockResolvedValueOnce({
      response: "",
      state: "idle",
    });
    mockGetAgent.mockResolvedValueOnce({
      name: "worker-empty",
      type: "codex",
      state: "idle",
      cwd: "/workspace/app",
      sessionId: "session-empty",
      sessionMode: "full-access",
      lastText: "",
      currentText: "",
      renderedOutput: "",
      outputEntries: [],
      stderrBuffer: [],
      stopReason: "end_turn",
    });

    const request = new NextRequest("http://localhost/api/conversations", {
      method: "POST",
      body: JSON.stringify({
        mode: "direct",
        command: "Run the app",
        projectPath: "/workspace/app",
        preferredWorkerType: "codex",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const payload = await response.json();
    const createdRun = await db.select().from(runs).where(eq(runs.id, payload.runId)).get();
    const createdWorkers = await db.select().from(workers).where(eq(workers.runId, payload.runId));
    const storedMessages = await db.select().from(messages).where(eq(messages.runId, payload.runId));

    expect(createdRun?.status).toBe("failed");
    expect(createdRun?.lastError).toContain("stopped without producing output");
    expect(createdWorkers[0]?.status).toBe("error");
    expect(createdWorkers[0]?.bridgeSessionId).toBe("session-empty");
    expect(createdWorkers[0]?.outputLog).toContain("stopped without producing output");
    expect(storedMessages.some((message) => message.kind === "error" && message.content.includes("stopped without producing output"))).toBe(true);
  });
});
