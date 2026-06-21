import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";
import os from "os";
import { db } from "@/server/db";
import { getAppDataPath } from "@/server/app-root";
import { __resetNamedEventsForTests, getNamedEventsSince } from "@/server/events/named-events";
import {
  plans,
  runs,
  conversationReadMarkers,
  messages,
  workers,
  clarifications,
  planItems,
  executionEvents,
  creditEvents,
  accounts,
  settings,
  workerAssignments,
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
  mockCreateBranchWorktree,
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
  mockCreateBranchWorktree: vi.fn(),
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

vi.mock("@/server/git/workspaces", () => ({
  createBranchWorktree: mockCreateBranchWorktree,
  GitWorkspaceError: class GitWorkspaceError extends Error {
    readonly code: string;
    readonly details: Record<string, unknown>;

    constructor(code: string, message: string, details: Record<string, unknown> = {}) {
      super(message);
      this.name = "GitWorkspaceError";
      this.code = code;
      this.details = details;
    }
  },
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

  it("moves a conversation to another project", async () => {
    __resetNamedEventsForTests();
    const planId = randomUUID();
    const runId = randomUUID();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/move-project-plan.md",
      status: "running",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(runs).values({
      id: runId,
      planId,
      title: "Move me",
      status: "done",
      projectPath: "/workspace/old-project",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(settings).values({
      key: "PROJECTS",
      value: JSON.stringify(["/workspace/old-project", "/workspace/new-project"]),
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: settings.key,
      set: {
        value: JSON.stringify(["/workspace/old-project", "/workspace/new-project"]),
        updatedAt: new Date(),
      },
    });

    const request = new NextRequest(`http://localhost/api/runs/${runId}`, {
      method: "PATCH",
      body: JSON.stringify({ projectPath: "/workspace/new-project" }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: runId }) });
    const payload = await response.json();

    const updatedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const events = getNamedEventsSince(0).events.map((entry) => entry.event);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ ok: true, runId, projectPath: "/workspace/new-project" });
    expect(updatedRun?.projectPath).toBe("/workspace/new-project");
    expect(events).toContainEqual({
      kind: "conversation.project_moved",
      runId,
      previousProjectPath: "/workspace/old-project",
      projectPath: "/workspace/new-project",
    });
  });

  it("rejects moving a conversation that is not terminal", async () => {
    const planId = randomUUID();
    const runId = randomUUID();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/reject-running-move.md",
      status: "running",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(runs).values({
      id: runId,
      planId,
      title: "Still running",
      status: "running",
      projectPath: "/workspace/old-project",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(settings).values({
      key: "PROJECTS",
      value: JSON.stringify(["/workspace/old-project", "/workspace/new-project"]),
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: settings.key,
      set: {
        value: JSON.stringify(["/workspace/old-project", "/workspace/new-project"]),
        updatedAt: new Date(),
      },
    });

    const request = new NextRequest(`http://localhost/api/runs/${runId}`, {
      method: "PATCH",
      body: JSON.stringify({ projectPath: "/workspace/new-project" }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: runId }) });
    const updatedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();

    expect(response.status).toBe(409);
    expect(updatedRun?.projectPath).toBe("/workspace/old-project");
  });
});

describe("POST /api/runs/[id]", () => {
  it("persists a read marker from server-side conversation activity", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const createdAt = new Date("2026-05-20T10:00:00.000Z");
    const messageAt = new Date("2026-05-20T10:05:00.000Z");
    const completedAt = new Date("2026-05-20T10:10:00.000Z");

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/mark-read.md",
      status: "done",
      createdAt,
      updatedAt: completedAt,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      title: "Mark read",
      status: "done",
      createdAt,
      updatedAt: completedAt,
    });
    await db.insert(messages).values({
      id: randomUUID(),
      runId,
      role: "user",
      content: "hello",
      createdAt: messageAt,
    });

    const response = await POST(new NextRequest(`http://localhost/api/runs/${runId}`, {
      method: "POST",
      body: JSON.stringify({ action: "mark_read" }),
    }), { params: Promise.resolve({ id: runId }) });
    const payload = await response.json();

    const marker = await db.select().from(conversationReadMarkers).where(eq(conversationReadMarkers.runId, runId)).get();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      runId,
      lastReadAt: "2026-05-20T10:10:00.000Z",
    });
    expect(marker?.lastReadAt).toEqual(completedAt);
  });

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

  it("treats repeated supervisor stop requests as already settled", async () => {
    mockCancelAgent.mockClear();
    mockStopRunObserver.mockClear();
    mockCancelSupervisorWake.mockClear();
    const planId = randomUUID();
    const runId = randomUUID();
    const activeWorkerId = randomUUID();
    const now = new Date();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/repeated-stop-plan.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "implementation",
      title: "Repeated stop supervisor",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(workers).values({
      id: activeWorkerId,
      runId,
      type: "codex",
      status: "working",
      cwd: process.cwd(),
      outputLog: "",
      createdAt: now,
      updatedAt: now,
    });

    const firstResponse = await POST(new NextRequest(`http://localhost/api/runs/${runId}`, {
      method: "POST",
      body: JSON.stringify({ action: "stop_supervisor" }),
    }), { params: Promise.resolve({ id: runId }) });
    expect(firstResponse.status).toBe(200);

    mockCancelAgent.mockClear();
    mockStopRunObserver.mockClear();
    mockCancelSupervisorWake.mockClear();

    const secondResponse = await POST(new NextRequest(`http://localhost/api/runs/${runId}`, {
      method: "POST",
      body: JSON.stringify({ action: "stop_supervisor" }),
    }), { params: Promise.resolve({ id: runId }) });
    const secondPayload = await secondResponse.json();
    const stopEvents = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId));

    expect(secondResponse.status).toBe(200);
    expect(secondPayload).toMatchObject({ ok: true, alreadyStopped: true, status: "cancelled" });
    expect(mockCancelAgent).not.toHaveBeenCalled();
    expect(mockCancelSupervisorWake).not.toHaveBeenCalled();
    expect(mockStopRunObserver).not.toHaveBeenCalled();
    expect(stopEvents.filter((event) => event.eventType === "supervisor_stopped")).toHaveLength(1);
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

  it("emits worker.status and worker.terminal named events when stop_worker cancels a worker", async () => {
    mockCancelAgent.mockClear();
    __resetNamedEventsForTests();

    const planId = randomUUID();
    const runId = randomUUID();
    const targetWorkerId = randomUUID();
    const now = new Date();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/stop-worker-events.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      title: "Stop worker emits named events",
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

    const response = await POST(new NextRequest(`http://localhost/api/runs/${runId}`, {
      method: "POST",
      body: JSON.stringify({ action: "stop_worker", workerId: targetWorkerId }),
    }), { params: Promise.resolve({ id: runId }) });
    expect(response.status).toBe(200);

    const events = getNamedEventsSince(0).events
      .map((entry) => entry.event)
      .filter((event) => event.kind === "worker.status" || event.kind === "worker.terminal");

    const statusEvent = events.find((event) => event.kind === "worker.status");
    expect(statusEvent).toMatchObject({
      kind: "worker.status",
      runId,
      workerId: targetWorkerId,
      prev: "working",
      next: "cancelled",
    });

    const terminalEvent = events.find((event) => event.kind === "worker.terminal");
    expect(terminalEvent).toMatchObject({
      kind: "worker.terminal",
      runId,
      workerId: targetWorkerId,
      status: "cancelled",
    });
  });

  it("emits worker.status and worker.terminal for each active worker stopped by stop_supervisor", async () => {
    mockCancelAgent.mockClear();
    mockStopRunObserver.mockClear();
    mockCancelSupervisorWake.mockClear();
    __resetNamedEventsForTests();

    const planId = randomUUID();
    const runId = randomUUID();
    const activeWorkerA = randomUUID();
    const activeWorkerB = randomUUID();
    const finishedWorkerId = randomUUID();
    const now = new Date();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/stop-supervisor-events.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "implementation",
      title: "Stop supervisor emits named events",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(workers).values([
      {
        id: activeWorkerA,
        runId,
        type: "codex",
        status: "working",
        cwd: process.cwd(),
        outputLog: "",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: activeWorkerB,
        runId,
        type: "codex",
        status: "idle",
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

    const response = await POST(new NextRequest(`http://localhost/api/runs/${runId}`, {
      method: "POST",
      body: JSON.stringify({ action: "stop_supervisor" }),
    }), { params: Promise.resolve({ id: runId }) });
    expect(response.status).toBe(200);

    const terminalEvents = getNamedEventsSince(0).events
      .map((entry) => entry.event)
      .filter((event) => event.kind === "worker.terminal");

    const terminalWorkerIds = terminalEvents.map((event) =>
      event.kind === "worker.terminal" ? event.workerId : null,
    );
    expect(terminalWorkerIds).toContain(activeWorkerA);
    expect(terminalWorkerIds).toContain(activeWorkerB);
    expect(terminalWorkerIds).not.toContain(finishedWorkerId);
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

    const updatedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const updatedWorker = await db.select().from(workers).where(eq(workers.id, targetWorkerId)).get();
    const stopEvent = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId)).get();

    expect(mockCancelAgent).toHaveBeenCalledWith(targetWorkerId);
    expect(updatedRun?.status).toBe("cancelled");
    expect(updatedWorker?.status).toBe("cancelled");
    expect(stopEvent?.eventType).toBe("worker_cancelled");
    expect(JSON.parse(stopEvent?.details || "{}")).toMatchObject({ runCancelled: true });
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

  it("repairs direct retry session metadata from the worker stream", async () => {
    __resetNamedEventsForTests();
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
      bridgeSessionId: null,
      bridgeSessionMode: null,
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
    const { appendWorkerEntryWithResult } = await import("@/server/workers/output-store");
    await appendWorkerEntryWithResult(runId, oldWorkerId, {
      id: "worker-session-metadata:saved-stream-session",
      type: "lifecycle",
      text: "Worker ACP session metadata saved.",
      timestamp: new Date("2026-04-21T10:00:05Z").toISOString(),
      authorRole: "system",
      channel: "system",
      raw: {
        kind: "worker_session_metadata",
        sessionId: "saved-stream-session",
        sessionMode: "direct",
        source: "test",
      },
    });
    mockSpawnAgent.mockResolvedValueOnce({
      name: oldWorkerId,
      type: "codex",
      state: "idle",
      cwd: "/workspace/app",
      sessionId: "saved-stream-session",
      sessionMode: "direct",
      lastText: "old output",
      currentText: "",
      outputEntries: [],
      stderrBuffer: [],
      stopReason: null,
    });
    mockAskAgent.mockResolvedValueOnce({
      response: "Recovered from stream session metadata.",
      state: "idle",
    });

    const request = new NextRequest(`http://localhost/api/runs/${runId}`, {
      method: "POST",
      body: JSON.stringify({ action: "retry", targetMessageId: rerunMessageId }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: runId }) });
    expect(response.status).toBe(200);

    const storedWorkers = await db.select().from(workers).where(eq(workers.runId, runId));
    const storedMessages = await db.select().from(messages).where(eq(messages.runId, runId)).orderBy(messages.createdAt);

    expect(mockCancelAgent).not.toHaveBeenCalled();
    expect(mockStartSupervisorRun).not.toHaveBeenCalled();
    expect(mockSpawnAgent).toHaveBeenCalledWith(expect.objectContaining({
      name: oldWorkerId,
      resumeSessionId: "saved-stream-session",
    }));
    expect(mockAskAgent).toHaveBeenCalledWith(oldWorkerId, "rerun this direct prompt");
    expect(storedWorkers.map((worker) => worker.id)).toEqual([oldWorkerId]);
    expect(storedWorkers[0]?.bridgeSessionId).toBe("saved-stream-session");
    expect(storedMessages.map((message) => message.id)).toEqual([firstMessageId, rerunMessageId]);
    expect(fs.readFileSync(adHocAbsolutePath, "utf-8")).toContain("first prompt");
  });

  it("retries a cancelled direct conversation by resuming the saved worker session", async () => {
    mockAskAgent.mockClear();
    mockCancelAgent.mockClear();
    mockGetAgent.mockClear();
    mockSpawnAgent.mockClear();
    mockStartSupervisorRun.mockClear();
    const planId = randomUUID();
    const runId = randomUUID();
    const oldWorkerId = `${runId}-worker-1`;
    const latestWorkerId = `${runId}-worker-3`;
    const firstMessageId = randomUUID();
    const targetMessageId = randomUUID();
    const adHocRelativePath = path.join("vibes", "ad-hoc", `${randomUUID()}.md`);
    const adHocAbsolutePath = getAppDataPath(adHocRelativePath);
    const attachment = {
      id: "attachment-retry",
      kind: "file",
      name: "260524-1226-platter-core-recommendations.md",
      mimeType: "text/markdown",
      size: 9754,
      storagePath: "attachments/retry/260524-1226-platter-core-recommendations.md",
    };

    fs.mkdirSync(path.dirname(adHocAbsolutePath), { recursive: true });
    fs.writeFileSync(adHocAbsolutePath, "# temp\nhere, this one");

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
      title: "Cancelled direct retry",
      projectPath: "/workspace/app",
      preferredWorkerType: "gemini",
      preferredWorkerModel: "gemini-3.5-flash",
      preferredWorkerEffort: "high",
      status: "cancelled",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(workers).values([
      {
        id: oldWorkerId,
        runId,
        type: "gemini",
        status: "cancelled",
        cwd: "/workspace/app",
        outputLog: "",
        outputEntriesJson: "[]",
        currentText: "",
        lastText: "",
        createdAt: new Date("2026-05-24T12:00:00Z"),
        updatedAt: new Date("2026-05-24T18:00:00Z"),
      },
      {
        id: latestWorkerId,
        runId,
        type: "gemini",
        status: "cancelled",
        cwd: "/workspace/app",
        bridgeSessionId: "saved-direct-session",
        bridgeSessionMode: "direct",
        outputLog: "previous output",
        outputEntriesJson: "[]",
        currentText: "",
        lastText: "Previous direct output.",
        createdAt: new Date("2026-05-24T18:57:46Z"),
        updatedAt: new Date("2026-05-24T19:02:33Z"),
      },
    ]);
    await db.insert(messages).values([
      {
        id: firstMessageId,
        runId,
        role: "user",
        kind: "checkpoint",
        content: "implement all of the things in the file I sent you where we said adopt",
        createdAt: new Date("2026-05-24T18:59:15Z"),
      },
      {
        id: targetMessageId,
        runId,
        role: "user",
        kind: "checkpoint",
        content: "here, this one",
        attachmentsJson: JSON.stringify([attachment]),
        createdAt: new Date("2026-05-24T19:02:31Z"),
      },
    ]);

    mockSpawnAgent.mockResolvedValueOnce({
      name: latestWorkerId,
      type: "gemini",
      state: "idle",
      cwd: "/workspace/app",
      sessionId: "resumed-direct-session",
      sessionMode: "direct",
      lastText: "Previous direct output.",
      currentText: "",
      outputEntries: [],
      stderrBuffer: [],
      stopReason: null,
    });
    mockAskAgent.mockResolvedValueOnce({
      response: "Resumed cancelled direct session.",
      state: "idle",
    });

    const response = await POST(new NextRequest(`http://localhost/api/runs/${runId}`, {
      method: "POST",
      body: JSON.stringify({ action: "retry", targetMessageId }),
    }), { params: Promise.resolve({ id: runId }) });

    expect(response.status).toBe(200);
    expect(mockCancelAgent).not.toHaveBeenCalled();
    expect(mockStartSupervisorRun).not.toHaveBeenCalled();
    expect(mockSpawnAgent).toHaveBeenCalledWith(expect.objectContaining({
      name: latestWorkerId,
      type: "gemini",
      cwd: "/workspace/app",
      resumeSessionId: "saved-direct-session",
    }));
    expect(mockAskAgent).toHaveBeenCalledWith(
      latestWorkerId,
      expect.stringContaining("here, this one"),
    );
    expect(mockAskAgent.mock.calls[0]?.[1]).toContain("path:");
    expect(mockAskAgent.mock.calls[0]?.[1]).toContain(attachment.storagePath);

    const storedWorkers = await db.select().from(workers).where(eq(workers.runId, runId));
    const updatedWorker = await db.select().from(workers).where(eq(workers.id, latestWorkerId)).get();
    expect(storedWorkers.map((worker) => worker.id).sort()).toEqual([latestWorkerId, oldWorkerId].sort());
    expect(updatedWorker?.bridgeSessionId).toBe("resumed-direct-session");
  });

  it("does not leave an empty direct rerun worker active when spawn fails", async () => {
    __resetNamedEventsForTests();
    mockAskAgent.mockClear();
    mockCancelAgent.mockClear();
    mockGetAgent.mockClear();
    mockSpawnAgent.mockClear();
    mockStartSupervisorRun.mockClear();
    mockSpawnAgent.mockRejectedValueOnce(new Error("Spawn failed: boom"));
    const planId = randomUUID();
    const runId = randomUUID();
    const oldWorkerId = `${runId}-worker-1`;
    const targetMessageId = randomUUID();
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
      title: "Direct rerun spawn failure",
      projectPath: "/workspace/app",
      preferredWorkerType: "gemini",
      preferredWorkerModel: "gemini-3.5-flash",
      preferredWorkerEffort: "high",
      status: "done",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(workers).values({
      id: oldWorkerId,
      runId,
      type: "gemini",
      status: "idle",
      cwd: "/workspace/app",
      workerNumber: 1,
      bridgeSessionId: "saved-direct-session",
      bridgeSessionMode: "direct",
      outputLog: "previous output",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "Previous direct output.",
      createdAt: new Date("2026-05-24T18:57:46Z"),
      updatedAt: new Date("2026-05-24T19:02:33Z"),
    });
    await db.insert(messages).values({
      id: targetMessageId,
      runId,
      role: "user",
      content: "first prompt",
      createdAt: new Date("2026-05-24T18:57:46Z"),
    });

    const response = await POST(new NextRequest(`http://localhost/api/runs/${runId}`, {
      method: "POST",
      body: JSON.stringify({
        action: "edit",
        targetMessageId,
        content: "fix the typescript",
      }),
    }), { params: Promise.resolve({ id: runId }) });

    expect(response.status).toBe(500);
    expect(mockAskAgent).not.toHaveBeenCalled();
    const storedWorkers = await db.select().from(workers).where(eq(workers.runId, runId));
    const replacementWorker = storedWorkers.find((worker) => worker.id !== oldWorkerId);
    const failedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const surfacedErrors = getNamedEventsSince(0).events
      .map((entry) => entry.event)
      .filter((event) => event.kind === "error.surfaced");

    expect(storedWorkers.some((worker) => worker.status === "starting")).toBe(false);
    expect(replacementWorker).toMatchObject({
      id: `${runId}-worker-2`,
      status: "error",
      outputLog: "Spawn failed: boom",
    });
    expect(failedRun?.status).toBe("failed");
    expect(failedRun?.lastError).toContain("Spawn failed: boom");
    expect(surfacedErrors).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "worker.spawn.failed",
        runId,
        workerId: `${runId}-worker-2`,
      }),
    ]));
  });

  it("resumes a failed direct conversation from the saved worker session", async () => {
    __resetNamedEventsForTests();
    mockAskAgent.mockClear();
    mockCancelAgent.mockClear();
    mockGetAgent.mockClear();
    mockSpawnAgent.mockClear();
    mockStartSupervisorRun.mockClear();
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const userMessageId = randomUUID();
    const failureMessageId = randomUUID();

    await db.insert(plans).values({
      id: planId,
      path: path.join("vibes", "ad-hoc", `${randomUUID()}.md`),
      status: "running",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      title: "Direct resume",
      projectPath: "/workspace/app",
      preferredWorkerType: "claude",
      preferredWorkerModel: "claude-sonnet-4",
      preferredWorkerEffort: "high",
      status: "failed",
      lastError: `Ask failed: Agent not found: ${workerId}`,
      failedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "claude",
      status: "error",
      cwd: "/workspace/app",
      bridgeSessionId: "saved-session",
      bridgeSessionMode: "direct",
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "Previous answer.",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(messages).values([
      {
        id: userMessageId,
        runId,
        role: "user",
        kind: "checkpoint",
        content: "continue the walkthrough",
        createdAt: new Date("2026-05-10T10:55:32Z"),
      },
      {
        id: failureMessageId,
        runId,
        role: "system",
        kind: "error",
        content: `Run failed: Ask failed: Agent not found: ${workerId}`,
        createdAt: new Date("2026-05-10T10:55:33Z"),
      },
    ]);

    mockSpawnAgent.mockResolvedValueOnce({
      name: workerId,
      type: "claude",
      state: "idle",
      cwd: "/workspace/app",
      sessionId: "resumed-session",
      sessionMode: "direct",
      lastText: "Previous answer.",
      currentText: "",
      outputEntries: [],
      stderrBuffer: [],
      stopReason: null,
    });
    mockAskAgent.mockResolvedValueOnce({
      response: "Recovered and continuing.",
      state: "idle",
    });

    const request = new NextRequest(`http://localhost/api/runs/${runId}`, {
      method: "POST",
      body: JSON.stringify({ action: "retry", targetMessageId: userMessageId }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: runId }) });
    expect(response.status).toBe(200);

    const updatedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const updatedWorker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    const storedMessages = await db.select().from(messages).where(eq(messages.runId, runId)).orderBy(messages.createdAt);
    const resumeEvents = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId));

    expect(mockCancelAgent).not.toHaveBeenCalled();
    expect(mockStartSupervisorRun).not.toHaveBeenCalled();
    expect(mockSpawnAgent).toHaveBeenCalledWith(expect.objectContaining({
      name: workerId,
      type: "claude",
      cwd: "/workspace/app",
      mode: "full-access",
      model: "claude-sonnet-4",
      effort: "high",
      resumeSessionId: "saved-session",
    }));
    expect(mockAskAgent).toHaveBeenCalledWith(workerId, "continue the walkthrough");
    expect(updatedRun?.status).toBe("done");
    expect(updatedRun?.lastError).toBeNull();
    expect(updatedRun?.failedAt).toBeNull();
    expect(updatedWorker?.bridgeSessionId).toBe("resumed-session");
    expect(storedMessages.map((message) => message.id)).not.toContain(failureMessageId);
    // Worker response now lives in the unified worker stream — the
    // last `messages` row is the user prompt that triggered the resume.
    expect(storedMessages.at(-1)?.content).toBe("continue the walkthrough");
    expect(resumeEvents.some((event) => event.eventType === "worker_session_resumed")).toBe(true);
    expect(getNamedEventsSince(0, { runId }).events.map((entry) => entry.event)).toContainEqual(expect.objectContaining({
      kind: "worker.reattached",
      runId,
      workerId,
    }));
  });

  it("retries a direct conversation with a fresh worker when saved session metadata is missing", async () => {
    __resetNamedEventsForTests();
    mockAskAgent.mockClear();
    mockCancelAgent.mockClear();
    mockGetAgent.mockClear();
    mockSpawnAgent.mockClear();
    mockStartSupervisorRun.mockClear();
    const planId = randomUUID();
    const runId = randomUUID();
    const oldWorkerId = `${runId}-worker-1`;
    const newWorkerId = `${runId}-worker-2`;
    const userMessageId = randomUUID();
    const adHocRelativePath = path.join("vibes", "ad-hoc", `${randomUUID()}.md`);
    const adHocAbsolutePath = getAppDataPath(adHocRelativePath);

    fs.mkdirSync(path.dirname(adHocAbsolutePath), { recursive: true });
    fs.writeFileSync(adHocAbsolutePath, "# temp\ncontinue without the missing ACP session");

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
      title: "Direct fresh retry",
      projectPath: "/workspace/app",
      preferredWorkerType: "codex",
      preferredWorkerModel: "gpt-5.4",
      preferredWorkerEffort: "medium",
      status: "failed",
      lastError: `Ask failed: Agent not found: ${oldWorkerId}`,
      failedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(workers).values({
      id: oldWorkerId,
      runId,
      type: "codex",
      status: "lost",
      cwd: "/workspace/app",
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "",
      workerNumber: 1,
      createdAt: new Date("2026-05-24T18:57:46Z"),
      updatedAt: new Date("2026-05-24T19:02:33Z"),
    });
    await db.insert(messages).values({
      id: userMessageId,
      runId,
      role: "user",
      kind: "checkpoint",
      content: "continue without the missing ACP session",
      createdAt: new Date("2026-05-24T18:57:46Z"),
    });

    mockSpawnAgent.mockResolvedValueOnce({
      name: newWorkerId,
      type: "codex",
      state: "idle",
      cwd: "/workspace/app",
      sessionId: "fresh-session",
      sessionMode: "full-access",
      lastText: "",
      currentText: "",
      outputEntries: [],
      stderrBuffer: [],
      stopReason: null,
    });
    mockAskAgent.mockResolvedValueOnce({
      response: "Fresh retry completed.",
      state: "idle",
    });
    mockGetAgent.mockRejectedValueOnce(new Error("Agent already ended"));

    const response = await POST(new NextRequest(`http://localhost/api/runs/${runId}`, {
      method: "POST",
      body: JSON.stringify({ action: "retry", targetMessageId: userMessageId }),
    }), { params: Promise.resolve({ id: runId }) });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, runId });
    expect(mockSpawnAgent).toHaveBeenCalledWith(expect.objectContaining({
      name: newWorkerId,
      type: "codex",
      cwd: "/workspace/app",
    }));
    expect(mockSpawnAgent.mock.calls[0]?.[0]).not.toHaveProperty("resumeSessionId");
    expect(mockAskAgent).toHaveBeenCalledWith(newWorkerId, "continue without the missing ACP session");

    const workersAfter = await db.select().from(workers).where(eq(workers.runId, runId));
    const oldWorker = workersAfter.find((worker) => worker.id === oldWorkerId);
    const newWorker = workersAfter.find((worker) => worker.id === newWorkerId);
    const surfacedErrors = getNamedEventsSince(0, { runId }).events
      .map((entry) => entry.event)
      .filter((event) => event.kind === "error.surfaced");

    expect(oldWorker?.status).toBe("cancelled");
    expect(newWorker?.bridgeSessionId).toBe("fresh-session");
    expect(surfacedErrors).not.toContainEqual(expect.objectContaining({
      code: "worker.resume.failed",
    }));
  });

  it("starts a fresh direct worker when an empty saved session is rejected", async () => {
    __resetNamedEventsForTests();
    mockAskAgent.mockClear();
    mockCancelAgent.mockClear();
    mockGetAgent.mockClear();
    mockSpawnAgent.mockClear();
    mockStartSupervisorRun.mockClear();
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const userMessageId = randomUUID();

    await db.insert(plans).values({
      id: planId,
      path: path.join("vibes", "ad-hoc", `${randomUUID()}.md`),
      status: "running",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      title: "Direct missing session resume",
      projectPath: "/workspace/app",
      preferredWorkerType: "gemini",
      preferredWorkerModel: "gemini-3",
      preferredWorkerEffort: "high",
      status: "failed",
      lastError: `Ask failed: Agent not found: ${workerId}`,
      failedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "gemini",
      status: "error",
      cwd: "/workspace/app",
      bridgeSessionId: "missing-session",
      bridgeSessionMode: "full-access",
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(messages).values({
      id: userMessageId,
      runId,
      role: "user",
      kind: "checkpoint",
      content: "recover this direct turn",
      createdAt: new Date("2026-05-10T10:55:32Z"),
    });

    mockSpawnAgent
      .mockRejectedValueOnce(new Error('Spawn failed: failed to start gemini agent via gemini: {"code":-32603,"message":"Internal error","data":{"details":"Invalid session identifier \\"missing-session\\"."}}'))
      .mockResolvedValueOnce({
        name: workerId,
        type: "gemini",
        state: "idle",
        cwd: "/workspace/app",
        sessionId: "fresh-session",
        sessionMode: "full-access",
        lastText: "",
        currentText: "",
        outputEntries: [],
        stderrBuffer: [],
        stopReason: null,
      });
    mockAskAgent.mockResolvedValueOnce({
      response: "Fresh worker continued.",
      state: "idle",
    });

    const request = new NextRequest(`http://localhost/api/runs/${runId}`, {
      method: "POST",
      body: JSON.stringify({ action: "retry", targetMessageId: userMessageId }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: runId }) });
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ runId });

    expect(mockSpawnAgent).toHaveBeenNthCalledWith(1, expect.objectContaining({
      name: workerId,
      resumeSessionId: "missing-session",
    }));
    expect(mockSpawnAgent).toHaveBeenNthCalledWith(2, expect.not.objectContaining({
      resumeSessionId: expect.any(String),
    }));
    expect(mockSpawnAgent).toHaveBeenCalledTimes(2);
    expect(mockAskAgent).toHaveBeenCalledWith(workerId, expect.stringContaining("recover this direct turn"));

    const updatedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const updatedWorker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    const resumeEvents = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId));
    expect(updatedRun?.status).toBe("done");
    expect(updatedRun?.lastError).toBeNull();
    expect(updatedWorker?.bridgeSessionId).toBe("fresh-session");
    expect(resumeEvents.some((event) => event.eventType === "worker_session_missing")).toBe(true);
    expect(resumeEvents.some((event) => event.eventType === "worker_session_recreated")).toBe(true);
    expect(getNamedEventsSince(0, { runId }).events.map((entry) => entry.event)).toContainEqual(expect.objectContaining({
      kind: "worker.recreated",
      runId,
      workerId,
    }));
  });

  it("continues from the worker transcript when saved-session recovery fails after provider output", async () => {
    __resetNamedEventsForTests();
    mockAskAgent.mockClear();
    mockCancelAgent.mockClear();
    mockGetAgent.mockClear();
    mockSpawnAgent.mockClear();
    mockStartSupervisorRun.mockClear();
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const userMessageId = randomUUID();

    await db.insert(plans).values({
      id: planId,
      path: path.join("vibes", "ad-hoc", `${randomUUID()}.md`),
      status: "running",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      title: "Direct missing session resume",
      projectPath: "/workspace/app",
      preferredWorkerType: "gemini",
      preferredWorkerModel: "gemini-3",
      preferredWorkerEffort: "high",
      status: "failed",
      lastError: `Ask failed: Agent not found: ${workerId}`,
      failedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "gemini",
      status: "error",
      cwd: "/workspace/app",
      bridgeSessionId: "missing-session",
      bridgeSessionMode: "full-access",
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(messages).values({
      id: userMessageId,
      runId,
      role: "user",
      kind: "checkpoint",
      content: "recover this direct turn",
      createdAt: new Date("2026-05-10T10:55:32Z"),
    });
    const { appendWorkerEntryWithResult } = await import("@/server/workers/output-store");
    await appendWorkerEntryWithResult(runId, workerId, {
      id: "provider-output-1",
      type: "message",
      text: "I had started working on this.",
      timestamp: new Date("2026-05-10T10:56:00Z").toISOString(),
      authorRole: "assistant",
      channel: "agent",
    });

    const chatsDir = fs.mkdtempSync(path.join(os.tmpdir(), "omni-gemini-materialize-"));
    mockSpawnAgent.mockRejectedValueOnce(new Error(`Spawn failed: failed to start gemini agent via gemini: {"code":-32603,"message":"Internal error","data":{"details":"Invalid session identifier \\"missing-session\\".\\n  Searched for sessions in ${chatsDir}.\\n  Use --list-sessions to see available sessions, then use --resume {number}, --resume {uuid}, or --resume latest."}}`));
    mockSpawnAgent.mockResolvedValueOnce({
      name: workerId,
      type: "gemini",
      state: "idle",
      cwd: "/workspace/app",
      sessionId: "fresh-session",
      sessionMode: "full-access",
      lastText: "",
      currentText: "",
      outputEntries: [],
      stderrBuffer: [],
      stopReason: null,
    });
    mockAskAgent.mockResolvedValueOnce({
      response: "Continued from transcript.",
      state: "idle",
    });

    const request = new NextRequest(`http://localhost/api/runs/${runId}`, {
      method: "POST",
      body: JSON.stringify({ action: "retry", targetMessageId: userMessageId }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: runId }) });
    const payload = await response.json();
    expect(response.status).toBe(200);

    expect(payload).toMatchObject({ runId });
    expect(mockSpawnAgent).toHaveBeenCalledTimes(2);
    expect(mockSpawnAgent).toHaveBeenNthCalledWith(2, expect.objectContaining({
      name: workerId,
      resumeSessionId: "missing-session",
    }));
    expect(mockAskAgent).toHaveBeenCalledWith(workerId, expect.stringContaining("recover this direct turn"));

    const updatedWorker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    const resumeEvents = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId));
    const materializedFiles = fs.readdirSync(chatsDir);
    expect(updatedWorker?.bridgeSessionId).toBe("fresh-session");
    expect(materializedFiles.some((file) => file.endsWith("-missing-.jsonl") || file.includes("missing-"))).toBe(true);
    expect(resumeEvents.some((event) => event.eventType === "worker_session_materialized")).toBe(true);
    expect(resumeEvents.some((event) => event.eventType === "worker_session_recreated_from_transcript")).toBe(false);
    expect(getNamedEventsSince(0, { runId }).events.map((entry) => entry.event)).toContainEqual(expect.objectContaining({
      kind: "worker.reattached",
      runId,
      workerId,
    }));
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
    // Worker response now lives in the unified worker stream — only
    // the user-checkpoint row remains in `messages` after the edit.
    expect(remainingMessages.map((message) => message.id)).toEqual([userMessageId]);
    expect(remainingMessages.at(-1)?.role).toBe("user");
    expect(fs.readFileSync(adHocAbsolutePath, "utf-8")).toContain("new prompt");
    expect(mockStartSupervisorRun).not.toHaveBeenCalled();
    expect(mockAskAgent).toHaveBeenCalledWith(expect.any(String), "new prompt");
  });

  it("persists direct edit rerun session metadata before the first ask returns", async () => {
    mockAskAgent.mockClear();
    mockGetAgent.mockClear();
    mockSpawnAgent.mockClear();
    mockStartSupervisorRun.mockClear();
    mockSpawnAgent.mockResolvedValueOnce({
      name: "rerun-worker",
      type: "codex",
      state: "idle",
      cwd: "/workspace/app",
      sessionId: "session-before-ask",
      sessionMode: "full-access",
      lastText: "",
      currentText: "",
      outputEntries: [],
      stderrBuffer: [],
      stopReason: null,
    });
    let resolveAsk!: (value: { response: string; state: string }) => void;
    mockAskAgent.mockImplementationOnce(() => new Promise((resolve) => {
      resolveAsk = resolve;
    }));
    const planId = randomUUID();
    const runId = randomUUID();
    const userMessageId = randomUUID();

    await db.insert(plans).values({
      id: planId,
      path: path.join("vibes", "ad-hoc", `${randomUUID()}.md`),
      status: "running",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      title: "Edit pending ask",
      projectPath: "/workspace/app",
      status: "failed",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(messages).values({
      id: userMessageId,
      runId,
      role: "user",
      kind: "checkpoint",
      content: "old prompt",
      createdAt: new Date("2026-04-21T10:00:00Z"),
    });

    const responsePromise = POST(new NextRequest(`http://localhost/api/runs/${runId}`, {
      method: "POST",
      body: JSON.stringify({ action: "edit", targetMessageId: userMessageId, content: "new prompt" }),
    }), { params: Promise.resolve({ id: runId }) });

    await vi.waitUntil(() => mockAskAgent.mock.calls.length > 0, { timeout: 1_000 });

    const replacementWorker = await db.select().from(workers).where(eq(workers.id, `${runId}-worker-1`)).get();
    const { readWorkerOutputEntries } = await import("@/server/workers/output-store");
    const workerEntries = await readWorkerOutputEntries(runId, `${runId}-worker-1`);

    expect(replacementWorker).toMatchObject({
      status: "working",
      bridgeSessionId: "session-before-ask",
      bridgeSessionMode: "full-access",
    });
    expect(workerEntries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: userMessageId,
        type: "user_input",
        text: "new prompt",
      }),
      expect.objectContaining({
        type: "lifecycle",
        raw: expect.objectContaining({
          kind: "worker_session_metadata",
          sessionId: "session-before-ask",
          sessionMode: "full-access",
        }),
      }),
    ]));

    resolveAsk({ response: "Rerun complete.", state: "idle" });
    const response = await responsePromise;
    expect(response.status).toBe(200);
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
    // Worker response now lives in the unified worker stream.
    expect(forkedMessages.map((message) => message.role)).toEqual(["user"]);
    expect(forkedMessages[0]?.content).toBe("forked prompt");
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

  it("forks a direct conversation into a new branch-backed worktree", async () => {
    mockAskAgent.mockClear();
    mockCancelAgent.mockClear();
    mockGetAgent.mockClear();
    mockSpawnAgent.mockClear();
    mockCreateBranchWorktree.mockReset();
    const planId = randomUUID();
    const runId = randomUUID();
    const userMessageId = randomUUID();
    const worktreePath = "/workspace/app-forked-worktree";
    const adHocRelativePath = path.join("vibes", "ad-hoc", `${randomUUID()}.md`);
    const adHocAbsolutePath = getAppDataPath(adHocRelativePath);
    const target = {
      kind: "worktree" as const,
      repoRoot: "/workspace/app",
      gitCommonDir: "/workspace/app/.git",
      checkoutPath: worktreePath,
      branchName: "feature/forked-worktree",
      worktreeId: worktreePath,
    };

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
      allowedWorkerTypes: JSON.stringify(["codex"]),
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

    mockCreateBranchWorktree.mockResolvedValueOnce({
      target,
      snapshot: {
        repoRoot: "/workspace/app",
        gitCommonDir: "/workspace/app/.git",
        checkoutPath: "/workspace/app",
        headSha: "abc123",
        branchName: "main",
        detachedLabel: null,
        isDetached: false,
        isBare: false,
        dirtyFileCount: 0,
        conflictedFileCount: 0,
        aheadCount: 0,
        behindCount: 0,
        statusFingerprint: "fingerprint",
        warnings: [{ code: "git_lfs", message: "Git LFS filters are configured." }],
        refreshedAt: new Date(0).toISOString(),
        branches: [],
        worktrees: [{
          checkoutPath: worktreePath,
          headSha: "abc123",
          branchName: "feature/forked-worktree",
          detachedLabel: null,
          isCurrent: false,
          isDetached: false,
          isBare: false,
          isPrunable: false,
          dirtyFileCount: 0,
          conflictedFileCount: 0,
        }],
      },
    });

    const response = await POST(new NextRequest(`http://localhost/api/runs/${runId}`, {
      method: "POST",
      body: JSON.stringify({
        action: "fork",
        targetMessageId: userMessageId,
        content: "forked prompt",
        gitWorkspaceLaunch: {
          mode: "new_worktree",
          projectPath: "/workspace/app",
          newBranchName: "feature/forked-worktree",
          checkoutPath: worktreePath,
          expectedHeadSha: "abc123",
          expectedStatusFingerprint: "fingerprint",
        },
      }),
    }), { params: Promise.resolve({ id: runId }) });

    expect(response.status).toBe(200);
    const payload = await response.json();
    const forkedRun = await db.select().from(runs).where(eq(runs.id, payload.runId)).get();
    const events = await db.select().from(executionEvents).where(eq(executionEvents.runId, payload.runId));
    const workspaceSnapshot = JSON.parse(forkedRun?.gitWorkspaceJson ?? "{}");

    expect(forkedRun?.parentRunId).toBe(runId);
    expect(forkedRun?.forkedFromMessageId).toBe(userMessageId);
    expect(forkedRun?.projectPath).toBe(worktreePath);
    expect(workspaceSnapshot.target).toEqual(target);
    expect(workspaceSnapshot.worktrees).toBeUndefined();
    expect(workspaceSnapshot.branches).toBeUndefined();
    expect(workspaceSnapshot.warnings).toEqual([{ code: "git_lfs", message: "Git LFS filters are configured." }]);
    expect(events.some((event) => event.eventType === "git_workspace_forked")).toBe(true);
    expect(mockCreateBranchWorktree).toHaveBeenCalledWith(expect.objectContaining({
      projectPath: "/workspace/app",
      newBranchName: "feature/forked-worktree",
      checkoutPath: worktreePath,
    }));
    expect(mockSpawnAgent).toHaveBeenCalledWith(expect.objectContaining({
      cwd: worktreePath,
    }));
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

    await db.insert(workerAssignments).values({
      id: randomUUID(),
      runId,
      workerId,
      planItemId: itemId,
      status: "running",
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
    expect(await db.select().from(workerAssignments).where(eq(workerAssignments.runId, runId))).toHaveLength(0);
    expect(fs.existsSync(adHocAbsolutePath)).toBe(false);
  });
});
