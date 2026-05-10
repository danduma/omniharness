import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { db } from "@/server/db";
import { getAppDataPath } from "@/server/app-root";
import {
  plans,
  runs,
  messages,
  workers,
  clarifications,
  planItems,
  executionEvents,
  creditEvents,
  accounts,
  settings,
} from "@/server/db/schema";
import { PATCH, DELETE, POST } from "@/app/api/runs/[id]/route";

const {
  mockAskAgent,
  mockCancelAgent,
  mockCancelAgentTerminalProcess,
  mockGetAgent,
  mockSpawnAgent,
  mockStartSupervisorRun,
  mockStopRunObserver,
  mockCancelSupervisorWake,
  mockQueueConversationTitleGeneration,
} = vi.hoisted(() => ({
  mockAskAgent: vi.fn().mockResolvedValue({
    response: "Rerun complete.",
    state: "working",
  }),
  mockCancelAgent: vi.fn().mockResolvedValue(undefined),
  mockCancelAgentTerminalProcess: vi.fn().mockResolvedValue(undefined),
  mockGetAgent: vi.fn().mockResolvedValue({
    name: "rerun-worker",
    type: "codex",
    state: "working",
    cwd: "/workspace/app",
    sessionId: "session-rerun",
    sessionMode: "full-access",
    renderedOutput: "",
    currentText: "",
    lastText: "Rerun complete.",
    outputEntries: [
      {
        id: "entry-rerun",
        type: "message",
        text: "Rerun complete.",
        timestamp: new Date(0).toISOString(),
      },
    ],
    stderrBuffer: [],
    stopReason: null,
  }),
  mockSpawnAgent: vi.fn().mockResolvedValue({
    name: "rerun-worker",
    type: "codex",
    state: "idle",
    cwd: "/workspace/app",
    sessionId: "session-rerun",
    sessionMode: "full-access",
    lastText: "",
    currentText: "",
    stderrBuffer: [],
    stopReason: null,
  }),
  mockStartSupervisorRun: vi.fn(),
  mockStopRunObserver: vi.fn(),
  mockCancelSupervisorWake: vi.fn(),
  mockQueueConversationTitleGeneration: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/bridge-client", () => ({
  askAgent: mockAskAgent,
  cancelAgent: mockCancelAgent,
  cancelAgentTerminalProcess: mockCancelAgentTerminalProcess,
  getAgent: mockGetAgent,
  spawnAgent: mockSpawnAgent,
}));

vi.mock("@/server/supervisor/start", () => ({
  startSupervisorRun: mockStartSupervisorRun,
}));

vi.mock("@/server/supervisor/observer", () => ({
  stopRunObserver: mockStopRunObserver,
}));

vi.mock("@/server/supervisor/wake", () => ({
  cancelSupervisorWake: mockCancelSupervisorWake,
}));

vi.mock("@/server/conversation-title", () => ({
  queueConversationTitleGeneration: mockQueueConversationTitleGeneration,
}));

describe("PATCH /api/runs/[id]", () => {
  it("renames a conversation title", async () => {
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
      title: "New conversation",
      status: "running",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const request = new NextRequest(`http://localhost/api/runs/${runId}`, {
      method: "PATCH",
      body: JSON.stringify({ title: "Fix mobile header" }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: runId }) });
    expect(response.status).toBe(200);

    const updatedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    expect(updatedRun?.title).toBe("Fix mobile header");
  });
});

describe("POST /api/runs/[id]", () => {
  it("archives a conversation without deleting its persisted records", async () => {
    const planId = randomUUID();
    const runId = randomUUID();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/archive-test-plan.md",
      status: "running",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(runs).values({
      id: runId,
      planId,
      title: "Commit changes",
      status: "done",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(messages).values({
      id: randomUUID(),
      runId,
      role: "user",
      content: "commit this",
      createdAt: new Date(),
    });

    const request = new NextRequest(`http://localhost/api/runs/${runId}`, {
      method: "POST",
      body: JSON.stringify({ action: "archive" }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: runId }) });
    expect(response.status).toBe(200);

    const updatedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    expect(updatedRun).toBeTruthy();
    expect(updatedRun?.archivedAt).toBeInstanceOf(Date);
    expect(await db.select().from(messages).where(eq(messages.runId, runId))).toHaveLength(1);
  });

  it("rejects archiving a running conversation", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const now = new Date();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/running-archive-test-plan.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(runs).values({
      id: runId,
      planId,
      title: "Still working",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });

    const request = new NextRequest(`http://localhost/api/runs/${runId}`, {
      method: "POST",
      body: JSON.stringify({ action: "archive" }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: runId }) });
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.error.message).toContain("Only finished conversations can be archived");

    const updatedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    expect(updatedRun?.archivedAt).toBeNull();
  });

  it("stops the supervisor run and cancels active workers", async () => {
    mockCancelAgent.mockClear();
    mockStopRunObserver.mockClear();
    mockCancelSupervisorWake.mockClear();
    const planId = randomUUID();
    const runId = randomUUID();
    const activeWorkerId = randomUUID();
    const finishedWorkerId = randomUUID();
    const now = new Date();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/stop-plan.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "implementation",
      title: "Stop supervisor",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(workers).values([
      {
        id: activeWorkerId,
        runId,
        type: "codex",
        status: "working",
        cwd: process.cwd(),
        outputLog: "",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: finishedWorkerId,
        runId,
        type: "codex",
        status: "cancelled",
        cwd: process.cwd(),
        outputLog: "",
        createdAt: now,
        updatedAt: now,
      },
    ]);
    await db.insert(settings).values({
      key: `SUPERVISOR_WAKE_LEASE:${runId}`,
      value: JSON.stringify({ leaseId: randomUUID(), expiresAt: Date.now() + 900_000 }),
      updatedAt: now,
    });

    const request = new NextRequest(`http://localhost/api/runs/${runId}`, {
      method: "POST",
      body: JSON.stringify({ action: "stop_supervisor" }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: runId }) });
    expect(response.status).toBe(200);

    const updatedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const updatedWorkers = await db.select().from(workers).where(eq(workers.runId, runId));
    const stopEvent = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId)).get();
    const staleLease = await db.select().from(settings).where(eq(settings.key, `SUPERVISOR_WAKE_LEASE:${runId}`)).get();

    expect(mockCancelSupervisorWake).toHaveBeenCalledWith(runId);
    expect(mockStopRunObserver).toHaveBeenCalledWith(runId);
    expect(mockCancelAgent).toHaveBeenCalledWith(activeWorkerId);
    expect(mockCancelAgent).not.toHaveBeenCalledWith(finishedWorkerId);
    expect(updatedRun?.status).toBe("cancelled");
    expect(updatedWorkers.find((worker) => worker.id === activeWorkerId)?.status).toBe("cancelled");
    expect(staleLease).toBeUndefined();
    expect(stopEvent?.eventType).toBe("supervisor_stopped");
    expect(JSON.parse(stopEvent?.details || "{}")).toMatchObject({
      userInitiated: true,
      reason: "User stopped the supervisor.",
    });
  });

  it("stops a single direct worker without stopping the supervisor", async () => {
    mockCancelAgent.mockClear();
    mockStopRunObserver.mockClear();
    mockCancelSupervisorWake.mockClear();
    const planId = randomUUID();
    const runId = randomUUID();
    const targetWorkerId = randomUUID();
    const otherWorkerId = randomUUID();
    const now = new Date();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/stop-worker.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      title: "Stop worker",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(workers).values([
      {
        id: targetWorkerId,
        runId,
        type: "codex",
        status: "working",
        cwd: process.cwd(),
        outputLog: "",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: otherWorkerId,
        runId,
        type: "codex",
        status: "working",
        cwd: process.cwd(),
        outputLog: "",
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const request = new NextRequest(`http://localhost/api/runs/${runId}`, {
      method: "POST",
      body: JSON.stringify({ action: "stop_worker", workerId: targetWorkerId }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: runId }) });
    expect(response.status).toBe(200);

    const updatedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const updatedWorkers = await db.select().from(workers).where(eq(workers.runId, runId));
    const stopEvent = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId)).get();

    expect(mockCancelAgent).toHaveBeenCalledWith(targetWorkerId);
    expect(mockCancelAgent).not.toHaveBeenCalledWith(otherWorkerId);
    expect(mockCancelSupervisorWake).not.toHaveBeenCalled();
    expect(mockStopRunObserver).not.toHaveBeenCalled();
    expect(updatedRun?.status).toBe("running");
    expect(updatedWorkers.find((worker) => worker.id === targetWorkerId)?.status).toBe("cancelled");
    expect(updatedWorkers.find((worker) => worker.id === otherWorkerId)?.status).toBe("working");
    expect(stopEvent?.eventType).toBe("worker_cancelled");
  });

  it("marks a direct worker cancelled without waiting for the bridge stop to finish", async () => {
    mockCancelAgent.mockClear();
    mockStopRunObserver.mockClear();
    mockCancelSupervisorWake.mockClear();
    mockCancelAgent.mockImplementationOnce(() => new Promise(() => {}));
    const planId = randomUUID();
    const runId = randomUUID();
    const targetWorkerId = randomUUID();
    const now = new Date();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/stop-worker-immediate.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      title: "Immediate stop worker",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(workers).values({
      id: targetWorkerId,
      runId,
      type: "codex",
      status: "working",
      cwd: process.cwd(),
      outputLog: "",
      createdAt: now,
      updatedAt: now,
    });

    const request = new NextRequest(`http://localhost/api/runs/${runId}`, {
      method: "POST",
      body: JSON.stringify({ action: "stop_worker", workerId: targetWorkerId }),
    });

    const response = await Promise.race([
      POST(request, { params: Promise.resolve({ id: runId }) }),
      new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), 25)),
    ]);
    if (response === "timeout") {
      throw new Error("Stop worker request waited for bridge cancellation");
    }
    expect(response.status).toBe(200);

    const updatedWorker = await db.select().from(workers).where(eq(workers.id, targetWorkerId)).get();
    const stopEvent = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId)).get();

    expect(mockCancelAgent).toHaveBeenCalledWith(targetWorkerId);
    expect(updatedWorker?.status).toBe("cancelled");
    expect(stopEvent?.eventType).toBe("worker_cancelled");
  });

  it("pauses implementation work and asks for user direction when a worker is stopped", async () => {
    mockCancelAgent.mockClear();
    mockStopRunObserver.mockClear();
    mockCancelSupervisorWake.mockClear();
    const planId = randomUUID();
    const runId = randomUUID();
    const targetWorkerId = randomUUID();
    const siblingWorkerId = randomUUID();
    const finishedWorkerId = randomUUID();
    const now = new Date();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/stop-worker-pause.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "implementation",
      title: "Pause after stop",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(workers).values([
      {
        id: targetWorkerId,
        runId,
        type: "codex",
        status: "working",
        cwd: process.cwd(),
        outputLog: "",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: siblingWorkerId,
        runId,
        type: "codex",
        status: "stuck",
        cwd: process.cwd(),
        outputLog: "",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: finishedWorkerId,
        runId,
        type: "codex",
        status: "cancelled",
        cwd: process.cwd(),
        outputLog: "",
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const request = new NextRequest(`http://localhost/api/runs/${runId}`, {
      method: "POST",
      body: JSON.stringify({ action: "stop_worker", workerId: targetWorkerId }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: runId }) });
    expect(response.status).toBe(200);

    const updatedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const updatedWorkers = await db.select().from(workers).where(eq(workers.runId, runId));
    const runMessages = await db.select().from(messages).where(eq(messages.runId, runId));
    const runClarifications = await db.select().from(clarifications).where(eq(clarifications.runId, runId));
    const stopEvents = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId));

    expect(mockCancelAgent).toHaveBeenCalledWith(targetWorkerId);
    expect(mockCancelAgent).toHaveBeenCalledWith(siblingWorkerId);
    expect(mockCancelAgent).not.toHaveBeenCalledWith(finishedWorkerId);
    expect(mockCancelSupervisorWake).toHaveBeenCalledWith(runId);
    expect(mockStopRunObserver).toHaveBeenCalledWith(runId);
    expect(updatedRun?.status).toBe("awaiting_user");
    expect(updatedWorkers.find((worker) => worker.id === targetWorkerId)?.status).toBe("cancelled");
    expect(updatedWorkers.find((worker) => worker.id === siblingWorkerId)?.status).toBe("cancelled");
    expect(updatedWorkers.find((worker) => worker.id === finishedWorkerId)?.status).toBe("cancelled");
    expect(runMessages).toEqual([
      expect.objectContaining({
        role: "supervisor",
        kind: "clarification",
        content: expect.stringContaining("I paused the active workers"),
      }),
    ]);
    expect(runClarifications).toEqual([
      expect.objectContaining({
        status: "pending",
        question: expect.stringContaining("modify"),
      }),
    ]);
    const workerStopEvent = stopEvents.find((event) => event.eventType === "worker_stop_requested");
    expect(workerStopEvent).toBeTruthy();
    expect(JSON.parse(workerStopEvent?.details || "{}")).toMatchObject({
      userInitiated: true,
      reason: "User stopped a worker.",
      stoppedWorkerId: targetWorkerId,
    });
  });

  it("stops a worker terminal process without stopping the worker", async () => {
    mockCancelAgent.mockClear();
    mockCancelAgentTerminalProcess.mockClear();
    mockStopRunObserver.mockClear();
    mockCancelSupervisorWake.mockClear();
    const planId = randomUUID();
    const runId = randomUUID();
    const targetWorkerId = randomUUID();
    const now = new Date();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/stop-terminal.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "implementation",
      title: "Stop terminal",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(workers).values({
      id: targetWorkerId,
      runId,
      type: "codex",
      status: "working",
      cwd: process.cwd(),
      outputLog: "",
      createdAt: now,
      updatedAt: now,
    });

    const request = new NextRequest(`http://localhost/api/runs/${runId}`, {
      method: "POST",
      body: JSON.stringify({
        action: "stop_worker_terminal",
        workerId: targetWorkerId,
        terminalProcessId: "tool-1",
        processId: "93230",
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: runId }) });
    expect(response.status).toBe(200);

    const updatedWorker = await db.select().from(workers).where(eq(workers.id, targetWorkerId)).get();
    const stopEvent = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId)).get();

    expect(mockCancelAgentTerminalProcess).toHaveBeenCalledWith(targetWorkerId, "93230", "tool-1");
    expect(mockCancelAgent).not.toHaveBeenCalled();
    expect(mockCancelSupervisorWake).not.toHaveBeenCalled();
    expect(mockStopRunObserver).not.toHaveBeenCalled();
    expect(updatedWorker?.status).toBe("working");
    expect(stopEvent?.eventType).toBe("worker_terminal_cancelled");
  });

  it("treats an already-gone terminal process as stopped", async () => {
    mockCancelAgent.mockClear();
    mockCancelAgentTerminalProcess.mockClear();
    mockCancelAgentTerminalProcess.mockRejectedValueOnce(new Error("Cancel terminal failed: terminal process not found: 91568"));
    mockStopRunObserver.mockClear();
    mockCancelSupervisorWake.mockClear();
    const planId = randomUUID();
    const runId = randomUUID();
    const targetWorkerId = randomUUID();
    const now = new Date();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/stale-terminal.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "implementation",
      title: "Stale terminal",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(workers).values({
      id: targetWorkerId,
      runId,
      type: "codex",
      status: "working",
      cwd: process.cwd(),
      outputLog: "",
      createdAt: now,
      updatedAt: now,
    });

    const request = new NextRequest(`http://localhost/api/runs/${runId}`, {
      method: "POST",
      body: JSON.stringify({
        action: "stop_worker_terminal",
        workerId: targetWorkerId,
        terminalProcessId: "tool-stale",
        processId: "91568",
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: runId }) });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, alreadyStopped: true });

    const updatedWorker = await db.select().from(workers).where(eq(workers.id, targetWorkerId)).get();
    const stopEvent = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId)).get();
    const eventDetails = JSON.parse(String(stopEvent?.details ?? "{}"));

    expect(mockCancelAgentTerminalProcess).toHaveBeenCalledWith(targetWorkerId, "91568", "tool-stale");
    expect(mockCancelAgent).not.toHaveBeenCalled();
    expect(mockCancelSupervisorWake).not.toHaveBeenCalled();
    expect(mockStopRunObserver).not.toHaveBeenCalled();
    expect(updatedWorker?.status).toBe("working");
    expect(stopEvent?.eventType).toBe("worker_terminal_cancelled");
    expect(eventDetails.alreadyStopped).toBe(true);
  });

  it("labels unexpected terminal stop failures as stop terminal errors", async () => {
    mockCancelAgentTerminalProcess.mockClear();
    mockCancelAgentTerminalProcess.mockRejectedValueOnce(new Error("Cancel terminal failed: bridge refused the request"));
    const planId = randomUUID();
    const runId = randomUUID();
    const targetWorkerId = randomUUID();
    const now = new Date();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/terminal-error.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "implementation",
      title: "Terminal error",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(workers).values({
      id: targetWorkerId,
      runId,
      type: "codex",
      status: "working",
      cwd: process.cwd(),
      outputLog: "",
      createdAt: now,
      updatedAt: now,
    });

    const request = new NextRequest(`http://localhost/api/runs/${runId}`, {
      method: "POST",
      body: JSON.stringify({
        action: "stop_worker_terminal",
        workerId: targetWorkerId,
        terminalProcessId: "tool-error",
        processId: "91568",
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: runId }) });
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).toMatchObject({
      action: "Stop worker terminal",
      message: "Cancel terminal failed: bridge refused the request",
    });
  });

  it("resumes a supervisor-managed conversation from its existing workers", async () => {
    mockAskAgent.mockClear();
    mockCancelAgent.mockClear();
    mockGetAgent.mockClear();
    mockSpawnAgent.mockClear();
    mockStartSupervisorRun.mockClear();
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = randomUUID();
    const userMessageId = randomUUID();
    const laterMessageId = randomUUID();
    const adHocRelativePath = path.join("vibes", "ad-hoc", `${randomUUID()}.md`);
    const adHocAbsolutePath = getAppDataPath(adHocRelativePath);

    fs.mkdirSync(path.dirname(adHocAbsolutePath), { recursive: true });
    fs.writeFileSync(adHocAbsolutePath, "# temp\nretry the failing run");

    await db.insert(plans).values({
      id: planId,
      path: adHocRelativePath,
      status: "running",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "implementation",
      title: "Retry test",
      status: "failed",
      lastError: "Get agent failed: fetch failed (caused by: read ECONNRESET)",
      failedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "codex",
      status: "working",
      cwd: process.cwd(),
      outputLog: "",
      bridgeSessionId: "session-existing",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(messages).values([
      {
        id: userMessageId,
        runId,
        role: "user",
        kind: "checkpoint",
        content: "retry the failing run",
        createdAt: new Date("2026-04-21T10:00:00Z"),
      },
      {
        id: laterMessageId,
        runId,
        role: "system",
        kind: "error",
        content: "Run failed: Get agent failed: fetch failed (caused by: read ECONNRESET)",
        createdAt: new Date("2026-04-21T10:01:00Z"),
      },
    ]);

    await db.insert(clarifications).values({
      id: randomUUID(),
      runId,
      question: "Question?",
      answer: null,
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(settings).values({
      key: `SUPERVISOR_WAKE_LEASE:${runId}`,
      value: JSON.stringify({ leaseId: randomUUID(), expiresAt: Date.now() + 900_000 }),
      updatedAt: new Date(),
    });

    const request = new NextRequest(`http://localhost/api/runs/${runId}`, {
      method: "POST",
      body: JSON.stringify({ action: "retry", targetMessageId: userMessageId }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: runId }) });
    expect(response.status).toBe(200);

    const updatedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const remainingMessages = await db.select().from(messages).where(eq(messages.runId, runId));
    const remainingWorkers = await db.select().from(workers).where(eq(workers.runId, runId));
    const remainingClarifications = await db.select().from(clarifications).where(eq(clarifications.runId, runId));
    const staleLease = await db.select().from(settings).where(eq(settings.key, `SUPERVISOR_WAKE_LEASE:${runId}`)).get();

    expect(await response.json()).toMatchObject({ ok: true, runId });
    expect(mockCancelAgent).not.toHaveBeenCalled();
    expect(mockStartSupervisorRun).toHaveBeenCalledWith(runId);
    expect(updatedRun?.status).toBe("running");
    expect(updatedRun?.lastError).toBeNull();
    expect(updatedRun?.failedAt).toBeNull();
    expect(remainingWorkers).toHaveLength(1);
    expect(remainingWorkers[0]?.status).toBe("working");
    expect(remainingWorkers[0]?.bridgeSessionId).toBe("session-existing");
    expect(remainingClarifications).toHaveLength(1);
    expect(staleLease).toBeUndefined();
    expect(remainingMessages.map((message) => message.id)).toEqual([userMessageId]);
  });

  it("reruns a direct conversation from the selected user checkpoint in a fresh CLI worker", async () => {
    mockAskAgent.mockClear();
    mockCancelAgent.mockClear();
    mockGetAgent.mockClear();
    mockSpawnAgent.mockClear();
    mockStartSupervisorRun.mockClear();
    const planId = randomUUID();
    const runId = randomUUID();
    const oldWorkerId = randomUUID();
    const firstMessageId = randomUUID();
    const rerunMessageId = randomUUID();
    const laterWorkerMessageId = randomUUID();
    const adHocRelativePath = path.join("vibes", "ad-hoc", `${randomUUID()}.md`);
    const adHocAbsolutePath = getAppDataPath(adHocRelativePath);

    fs.mkdirSync(path.dirname(adHocAbsolutePath), { recursive: true });
    fs.writeFileSync(adHocAbsolutePath, "# temp\nfirst prompt");

    await db.insert(plans).values({
      id: planId,
      path: adHocRelativePath,
      status: "running",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      title: "Direct rerun",
      projectPath: "/workspace/app",
      preferredWorkerType: "codex",
      preferredWorkerModel: "gpt-5.4",
      preferredWorkerEffort: "medium",
      allowedWorkerTypes: JSON.stringify(["codex"]),
      status: "done",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(workers).values({
      id: oldWorkerId,
      runId,
      type: "codex",
      status: "idle",
      cwd: "/workspace/app",
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(messages).values([
      {
        id: firstMessageId,
        runId,
        role: "user",
        kind: "checkpoint",
        content: "first prompt",
        createdAt: new Date("2026-04-21T10:00:00Z"),
      },
      {
        id: rerunMessageId,
        runId,
        role: "user",
        kind: "checkpoint",
        content: "rerun this direct prompt",
        createdAt: new Date("2026-04-21T10:01:00Z"),
      },
      {
        id: laterWorkerMessageId,
        runId,
        role: "worker",
        kind: "direct",
        content: "old answer",
        workerId: oldWorkerId,
        createdAt: new Date("2026-04-21T10:02:00Z"),
      },
    ]);

    const request = new NextRequest(`http://localhost/api/runs/${runId}`, {
      method: "POST",
      body: JSON.stringify({ action: "retry", targetMessageId: rerunMessageId }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: runId }) });
    expect(response.status).toBe(200);

    const storedWorkers = await db.select().from(workers).where(eq(workers.runId, runId));
    const storedMessages = await db.select().from(messages).where(eq(messages.runId, runId)).orderBy(messages.createdAt);

    expect(mockCancelAgent).toHaveBeenCalledWith(oldWorkerId);
    expect(mockStartSupervisorRun).not.toHaveBeenCalled();
    expect(mockSpawnAgent).toHaveBeenCalledWith(expect.objectContaining({
      type: "codex",
      cwd: "/workspace/app",
      model: "gpt-5.4",
      effort: "medium",
    }));
    expect(mockAskAgent).toHaveBeenCalledWith(expect.any(String), "rerun this direct prompt");
    expect(storedWorkers.map((worker) => worker.status)).toContain("cancelled");
    expect(storedWorkers.some((worker) => worker.status === "working" && worker.id !== oldWorkerId)).toBe(true);
    expect(storedMessages.map((message) => message.id)).not.toContain(laterWorkerMessageId);
    expect(storedMessages.at(-1)?.role).toBe("worker");
    expect(storedMessages.at(-1)?.content).toBe("Rerun complete.");
    expect(fs.readFileSync(adHocAbsolutePath, "utf-8")).toContain("rerun this direct prompt");
  });

  it("edits a user checkpoint in place before rerunning", async () => {
    mockStartSupervisorRun.mockClear();
    const planId = randomUUID();
    const runId = randomUUID();
    const userMessageId = randomUUID();
    const laterMessageId = randomUUID();
    const adHocRelativePath = path.join("vibes", "ad-hoc", `${randomUUID()}.md`);
    const adHocAbsolutePath = getAppDataPath(adHocRelativePath);

    fs.mkdirSync(path.dirname(adHocAbsolutePath), { recursive: true });
    fs.writeFileSync(adHocAbsolutePath, "# temp\nold prompt");

    await db.insert(plans).values({
      id: planId,
      path: adHocRelativePath,
      status: "running",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      title: "Edit test",
      status: "failed",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(messages).values([
      {
        id: userMessageId,
        runId,
        role: "user",
        kind: "checkpoint",
        content: "old prompt",
        createdAt: new Date("2026-04-21T10:00:00Z"),
      },
      {
        id: laterMessageId,
        runId,
        role: "system",
        content: "old output",
        createdAt: new Date("2026-04-21T10:01:00Z"),
      },
    ]);

    const request = new NextRequest(`http://localhost/api/runs/${runId}`, {
      method: "POST",
      body: JSON.stringify({ action: "edit", targetMessageId: userMessageId, content: "new prompt" }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: runId }) });
    expect(response.status).toBe(200);

    const updatedMessage = await db.select().from(messages).where(eq(messages.id, userMessageId)).get();
    const remainingMessages = await db.select().from(messages).where(eq(messages.runId, runId));

    expect(updatedMessage?.content).toBe("new prompt");
    expect(remainingMessages.map((message) => message.id)).toEqual([userMessageId, expect.any(String)]);
    expect(remainingMessages.at(-1)?.role).toBe("worker");
    expect(fs.readFileSync(adHocAbsolutePath, "utf-8")).toContain("new prompt");
    expect(mockStartSupervisorRun).not.toHaveBeenCalled();
    expect(mockAskAgent).toHaveBeenCalledWith(expect.any(String), "new prompt");
  });

  it("forks a new direct conversation from a direct user checkpoint", async () => {
    mockAskAgent.mockClear();
    mockCancelAgent.mockClear();
    mockGetAgent.mockClear();
    mockSpawnAgent.mockClear();
    mockStartSupervisorRun.mockClear();
    mockQueueConversationTitleGeneration.mockClear();
    const planId = randomUUID();
    const runId = randomUUID();
    const userMessageId = randomUUID();
    const adHocRelativePath = path.join("vibes", "ad-hoc", `${randomUUID()}.md`);
    const adHocAbsolutePath = getAppDataPath(adHocRelativePath);

    fs.mkdirSync(path.dirname(adHocAbsolutePath), { recursive: true });
    fs.writeFileSync(adHocAbsolutePath, "# temp\nsource prompt");

    await db.insert(plans).values({
      id: planId,
      path: adHocRelativePath,
      status: "running",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      title: "Source run",
      projectPath: "/workspace/app",
      preferredWorkerType: "codex",
      preferredWorkerModel: "gpt-5.4",
      preferredWorkerEffort: "medium",
      allowedWorkerTypes: JSON.stringify(["codex", "opencode"]),
      status: "done",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(messages).values({
      id: userMessageId,
      runId,
      role: "user",
      kind: "checkpoint",
      content: "source prompt",
      createdAt: new Date("2026-04-21T10:00:00Z"),
    });

    const request = new NextRequest(`http://localhost/api/runs/${runId}`, {
      method: "POST",
      body: JSON.stringify({ action: "fork", targetMessageId: userMessageId, content: "forked prompt" }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: runId }) });
    expect(response.status).toBe(200);

    const payload = await response.json();
    const forkedRun = await db.select().from(runs).where(eq(runs.id, payload.runId)).get();
    const forkedMessages = await db.select().from(messages).where(eq(messages.runId, payload.runId));
    const forkedPlan = await db.select().from(plans).where(eq(plans.id, forkedRun!.planId)).get();

    expect(payload.runId).not.toBe(runId);
    expect(payload.runId).toMatch(/^[0-9a-f]{12}$/);
    expect(forkedRun?.parentRunId).toBe(runId);
    expect(forkedRun?.forkedFromMessageId).toBe(userMessageId);
    expect(forkedRun?.mode).toBe("direct");
    expect(forkedRun?.projectPath).toBe("/workspace/app");
    expect(forkedRun?.preferredWorkerType).toBe("codex");
    expect(forkedRun?.preferredWorkerModel).toBe("gpt-5.4");
    expect(forkedRun?.preferredWorkerEffort).toBe("medium");
    expect(forkedRun?.allowedWorkerTypes).toBe(JSON.stringify(["codex", "opencode"]));
    expect(forkedMessages.map((message) => message.role)).toEqual(["user", "worker"]);
    expect(forkedMessages[0]?.content).toBe("forked prompt");
    expect(forkedMessages.at(-1)?.content).toBe("Rerun complete.");
    expect(fs.readFileSync(getAppDataPath(forkedPlan!.path), "utf-8")).toContain("forked prompt");
    expect(mockStartSupervisorRun).not.toHaveBeenCalled();
    expect(mockSpawnAgent).toHaveBeenCalledWith(expect.objectContaining({
      type: "codex",
      cwd: "/workspace/app",
      model: "gpt-5.4",
      effort: "medium",
    }));
    expect(mockAskAgent).toHaveBeenCalledWith(expect.any(String), "forked prompt");
  });
});

describe("DELETE /api/runs/[id]", () => {
  it("deletes a conversation and its dependent records", async () => {
    mockCancelAgent.mockClear();
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = randomUUID();
    const itemId = randomUUID();
    const accountId = randomUUID();
    const adHocRelativePath = path.join("vibes", "ad-hoc", `${randomUUID()}.md`);
    const adHocAbsolutePath = getAppDataPath(adHocRelativePath);

    fs.mkdirSync(path.dirname(adHocAbsolutePath), { recursive: true });
    fs.writeFileSync(adHocAbsolutePath, "# temp");

    await db.insert(plans).values({
      id: planId,
      path: adHocRelativePath,
      status: "running",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(runs).values({
      id: runId,
      planId,
      title: "Temp conversation",
      status: "running",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(accounts).values({
      id: accountId,
      provider: "openai",
      type: "api",
      authRef: "test",
      createdAt: new Date(),
    });

    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "codex",
      status: "idle",
      cwd: process.cwd(),
      outputLog: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(messages).values({
      id: randomUUID(),
      runId,
      role: "user",
      content: "hello",
      workerId,
      createdAt: new Date(),
    });

    await db.insert(clarifications).values({
      id: randomUUID(),
      runId,
      question: "Question?",
      answer: null,
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(planItems).values({
      id: itemId,
      planId,
      title: "Do thing",
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(executionEvents).values({
      id: randomUUID(),
      runId,
      workerId,
      planItemId: itemId,
      eventType: "started",
      details: null,
      createdAt: new Date(),
    });

    await db.insert(creditEvents).values({
      id: randomUUID(),
      accountId,
      workerId,
      eventType: "switched",
      details: null,
      createdAt: new Date(),
    });

    const request = new NextRequest(`http://localhost/api/runs/${runId}`, {
      method: "DELETE",
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: runId }) });
    expect(response.status).toBe(200);
    expect(mockCancelAgent).toHaveBeenCalledWith(workerId);

    expect(await db.select().from(runs).where(eq(runs.id, runId)).get()).toBeUndefined();
    expect(await db.select().from(plans).where(eq(plans.id, planId)).get()).toBeUndefined();
    expect(await db.select().from(workers).where(eq(workers.id, workerId)).get()).toBeUndefined();
    expect(await db.select().from(planItems).where(eq(planItems.id, itemId)).get()).toBeUndefined();
    expect(fs.existsSync(adHocAbsolutePath)).toBe(false);
  });
});
