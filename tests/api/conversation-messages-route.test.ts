import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
  clarifications,
  executionEvents,
  messages,
  planItems,
  plans,
  queuedConversationMessages,
  runs,
  settings,
  supervisorInterventions,
  workerAssignments,
  workerCounters,
  workers,
} from "@/server/db/schema";

const { mockAskAgent, mockGetAgent, mockSpawnAgent, mockStartSupervisorRun } = vi.hoisted(() => ({
  mockAskAgent: vi.fn().mockResolvedValue({
    response: "Here is the next planning step.",
    state: "working",
  }),
  mockGetAgent: vi.fn().mockResolvedValue(null),
  mockSpawnAgent: vi.fn().mockResolvedValue({
    name: "worker-1",
    type: "claude",
    cwd: "/workspace/app",
    state: "idle",
    sessionId: "resumed-session",
    sessionMode: "direct",
    outputEntries: [],
    currentText: "",
    lastText: "",
  }),
  mockStartSupervisorRun: vi.fn(),
}));

vi.mock("@/server/bridge-client", () => ({
  askAgent: mockAskAgent,
  getAgent: mockGetAgent,
  spawnAgent: mockSpawnAgent,
}));

vi.mock("@/server/supervisor/start", () => ({
  startSupervisorRun: mockStartSupervisorRun,
}));

import { POST } from "@/app/api/conversations/[id]/messages/route";
import { PATCH as SEND_QUEUED_NOW } from "@/app/api/conversations/[id]/queued-messages/[messageId]/route";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("POST /api/conversations/[id]/messages", () => {
  beforeEach(async () => {
    mockAskAgent.mockClear();
    mockGetAgent.mockClear();
    mockSpawnAgent.mockClear();
    mockStartSupervisorRun.mockClear();
    await db.delete(supervisorInterventions);
    await db.delete(workerAssignments);
    await db.delete(executionEvents);
    await db.delete(clarifications);
    await db.delete(queuedConversationMessages);
    await db.delete(messages);
    await db.delete(workers);
    await db.delete(workerCounters);
    await db.delete(planItems);
    await db.delete(settings);
    await db.delete(runs);
    await db.delete(plans);
  });

  it("sends a follow-up message to a planning worker and stores the exchange", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = randomUUID();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/planning.md",
      status: "running",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "planning",
      status: "running",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(workers).values({
      id: workerId,
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

    const request = new NextRequest(`http://localhost/api/conversations/${runId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "Can you revise the plan for direct mode?" }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: runId }) });
    expect(response.status).toBe(200);

    const storedMessages = await db.select().from(messages).where(eq(messages.runId, runId)).orderBy(messages.createdAt);
    expect(storedMessages.map((message) => message.role)).toEqual(["user", "worker"]);
    expect(mockAskAgent).toHaveBeenCalledWith(workerId, "Can you revise the plan for direct mode?");
  });

  it("blocks user messages when planning review is in progress", async () => {
    const planId = randomUUID();
    const runId = randomUUID();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/planning.md",
      status: "running",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "planning",
      status: "reviewing_plan",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const req = new NextRequest("http://localhost/api/conversations/run-1/messages", {
      method: "POST",
      body: JSON.stringify({ content: "Wait, I want to change something." }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: runId }) });
    expect(res.status).toBe(409);

    const body = await res.json();
    expect(body.error.message).toContain("Plan review is in progress");

    // Verify no message was inserted
    const msgs = await db.select().from(messages).where(eq(messages.runId, runId));
    expect(msgs.length).toBe(0);
  });

  it("sends attachment-only follow-ups to a planning worker and persists metadata", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = randomUUID();
    const attachment = {
      id: "attachment-2",
      kind: "file",
      name: "notes.pdf",
      mimeType: "application/pdf",
      size: 456,
      storagePath: "attachments/upload-2/attachment-2-notes.pdf",
    };

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/planning.md",
      status: "running",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "planning",
      status: "running",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(workers).values({
      id: workerId,
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

    const request = new NextRequest(`http://localhost/api/conversations/${runId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "", attachments: [attachment] }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: runId }) });
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.message.attachments).toEqual([attachment]);

    const storedMessages = await db.select().from(messages).where(eq(messages.runId, runId)).orderBy(messages.createdAt);
    expect(JSON.parse(storedMessages[0]?.attachmentsJson || "[]")).toEqual([attachment]);
    expect(mockAskAgent).toHaveBeenCalledWith(workerId, expect.stringContaining("path: attachments/upload-2/attachment-2-notes.pdf"));
  });

  it("stores implementation follow-ups and wakes the supervisor instead of messaging a worker directly", async () => {
    const planId = randomUUID();
    const runId = randomUUID();

    await db.insert(plans).values({
      id: planId,
      path: "docs/superpowers/plans/implementation.md",
      status: "running",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "implementation",
      status: "running",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const request = new NextRequest(`http://localhost/api/conversations/${runId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "Continue" }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: runId }) });
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.message).toMatchObject({
      runId,
      role: "user",
      kind: "checkpoint",
      content: "Continue",
    });

    const storedMessages = await db.select().from(messages).where(eq(messages.runId, runId));
    expect(storedMessages).toHaveLength(1);
    expect(storedMessages[0]?.role).toBe("user");
    expect(storedMessages[0]?.kind).toBe("checkpoint");
    expect(storedMessages[0]?.content).toBe("Continue");
    expect(mockAskAgent).not.toHaveBeenCalled();
    expect(mockStartSupervisorRun).toHaveBeenCalledWith(runId);
  });

  it("stores active implementation follow-ups as steering instead of queueing the supervisor", async () => {
    const planId = randomUUID();
    const runId = randomUUID();

    await db.insert(plans).values({
      id: planId,
      path: "docs/superpowers/plans/implementation.md",
      status: "running",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "implementation",
      status: "running",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(settings).values({
      key: `SUPERVISOR_WAKE_LEASE:${runId}`,
      value: JSON.stringify({ leaseId: randomUUID(), expiresAt: Date.now() + 900_000 }),
      updatedAt: new Date(),
    });

    const request = new NextRequest(`http://localhost/api/conversations/${runId}/messages`, {
      method: "POST",
      body: JSON.stringify({
        content: "stop the current server on 3002",
        busyAction: "queue",
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: runId }) });
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.queuedMessage).toMatchObject({
      runId,
      action: "steer",
      status: "pending",
      content: "stop the current server on 3002",
    });

    const queuedMessages = await db.select().from(queuedConversationMessages).where(eq(queuedConversationMessages.runId, runId));
    const storedMessages = await db.select().from(messages).where(eq(messages.runId, runId));
    expect(queuedMessages).toHaveLength(1);
    expect(storedMessages).toHaveLength(0);
    expect(mockStartSupervisorRun).toHaveBeenCalledWith(runId);
  });

  it("sends a queued implementation message immediately as steering", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const queuedMessageId = randomUUID();
    const now = new Date();

    await db.insert(plans).values({
      id: planId,
      path: "docs/superpowers/plans/implementation.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "implementation",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(queuedConversationMessages).values({
      id: queuedMessageId,
      runId,
      targetWorkerId: null,
      action: "queue",
      content: "Use this note right now.",
      attachmentsJson: "[]",
      status: "pending",
      lastError: null,
      createdAt: now,
      updatedAt: now,
      deliveredAt: null,
    });

    const request = new NextRequest(`http://localhost/api/conversations/${runId}/queued-messages/${queuedMessageId}`, {
      method: "PATCH",
    });

    const response = await SEND_QUEUED_NOW(request, { params: Promise.resolve({ id: runId, messageId: queuedMessageId }) });
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.message).toBeUndefined();
    expect(payload.queuedMessage).toMatchObject({
      id: queuedMessageId,
      runId,
      action: "steer",
      status: "pending",
      content: "Use this note right now.",
    });

    const storedQueued = await db.select().from(queuedConversationMessages).where(eq(queuedConversationMessages.id, queuedMessageId)).get();
    const storedMessages = await db.select().from(messages).where(eq(messages.runId, runId));
    expect(storedQueued?.status).toBe("pending");
    expect(storedQueued?.action).toBe("steer");
    expect(storedMessages).toHaveLength(0);
    expect(mockStartSupervisorRun).toHaveBeenCalledWith(runId);
  });

  it("acknowledges queued worker steering before the bridge turn finishes", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const queuedMessageId = randomUUID();
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
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "codex",
      status: "working",
      cwd: "/workspace/app",
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(queuedConversationMessages).values({
      id: queuedMessageId,
      runId,
      targetWorkerId: workerId,
      action: "queue",
      content: "Use this worker note now.",
      attachmentsJson: "[]",
      status: "pending",
      lastError: null,
      createdAt: now,
      updatedAt: now,
      deliveredAt: null,
    });
    mockAskAgent.mockImplementationOnce(() => new Promise(() => {}));

    const request = new NextRequest(`http://localhost/api/conversations/${runId}/queued-messages/${queuedMessageId}`, {
      method: "PATCH",
    });
    const response = await Promise.race([
      SEND_QUEUED_NOW(request, { params: Promise.resolve({ id: runId, messageId: queuedMessageId }) }),
      delay(50).then(() => "timeout" as const),
    ]);

    expect(response).not.toBe("timeout");
    if (response === "timeout") {
      throw new Error("send-now timed out");
    }

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.message).toMatchObject({
      runId,
      role: "user",
      kind: "checkpoint",
      content: "Use this worker note now.",
    });
    expect(payload.queuedMessage).toMatchObject({
      id: queuedMessageId,
      action: "steer",
      status: "delivering",
    });

    const storedQueued = await db.select().from(queuedConversationMessages).where(eq(queuedConversationMessages.id, queuedMessageId)).get();
    const storedMessages = await db.select().from(messages).where(eq(messages.runId, runId));
    expect(storedQueued?.status).toBe("delivering");
    expect(storedMessages.map((message) => message.content)).toEqual(["Use this worker note now."]);
  });

  it("uses implementation follow-ups to answer pending clarifications", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const clarificationId = randomUUID();

    await db.insert(plans).values({
      id: planId,
      path: "docs/superpowers/plans/implementation.md",
      status: "running",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "implementation",
      status: "awaiting_user",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(clarifications).values({
      id: clarificationId,
      runId,
      question: "Which API should own this?",
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

    const request = new NextRequest(`http://localhost/api/conversations/${runId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "Use the existing conversations API." }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: runId }) });
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.message).toMatchObject({
      runId,
      role: "user",
      kind: "clarification_answer",
      content: "Use the existing conversations API.",
    });

    const updatedClarification = await db.select().from(clarifications).where(eq(clarifications.id, clarificationId)).get();
    expect(updatedClarification?.status).toBe("answered");
    expect(updatedClarification?.answer).toBe("Use the existing conversations API.");

    const storedMessages = await db.select().from(messages).where(eq(messages.runId, runId));
    const staleLease = await db.select().from(settings).where(eq(settings.key, `SUPERVISOR_WAKE_LEASE:${runId}`)).get();
    expect(storedMessages).toHaveLength(1);
    expect(storedMessages[0]?.kind).toBe("clarification_answer");
    expect(staleLease).toBeUndefined();
    expect(mockAskAgent).not.toHaveBeenCalled();
    expect(mockStartSupervisorRun).toHaveBeenCalledWith(runId);
  });

  it("does not mark a direct conversation failed when the worker is already busy", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
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
      status: "running",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "codex",
      status: "working",
      cwd: "/workspace/app",
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "Still finishing the first turn.",
      lastText: "",
      createdAt: now,
      updatedAt: now,
    });

    mockAskAgent.mockRejectedValueOnce(new Error(`Ask failed: Agent is busy: ${workerId}`));

    const request = new NextRequest(`http://localhost/api/conversations/${runId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "One more thing while you are running" }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: runId }) });
    expect(response.status).toBe(200);

    await delay(20);

    const updatedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const updatedWorker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    const systemErrors = await db.select().from(messages).where(eq(messages.runId, runId));

    expect(updatedRun?.status).toBe("running");
    expect(updatedRun?.lastError).toBeNull();
    expect(updatedWorker?.status).toBe("working");
    expect(systemErrors.filter((message) => message.kind === "error")).toHaveLength(0);
  });

  it("automatically resumes a missing direct worker before sending a follow-up", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const now = new Date();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/direct-resume.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      status: "running",
      preferredWorkerType: "claude",
      preferredWorkerModel: "claude-sonnet-4",
      preferredWorkerEffort: "high",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "claude",
      status: "idle",
      cwd: "/workspace/app",
      bridgeSessionId: "saved-session",
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "",
      createdAt: now,
      updatedAt: now,
    });

    mockAskAgent
      .mockRejectedValueOnce(new Error(`Ask failed: Agent not found: ${workerId}`))
      .mockResolvedValueOnce({
        response: "Continuing from the restored session.",
        state: "idle",
      });
    mockSpawnAgent.mockResolvedValueOnce({
      name: workerId,
      type: "claude",
      cwd: "/workspace/app",
      state: "idle",
      sessionId: "resumed-session",
      sessionMode: "direct",
      outputEntries: [],
      currentText: "",
      lastText: "Restored session.",
    });

    const request = new NextRequest(`http://localhost/api/conversations/${runId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "Please continue the demo work." }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: runId }) });
    expect(response.status).toBe(200);

    await delay(20);

    expect(mockSpawnAgent).toHaveBeenCalledWith(expect.objectContaining({
      name: workerId,
      type: "claude",
      cwd: "/workspace/app",
      mode: "full-access",
      model: "claude-sonnet-4",
      effort: "high",
      resumeSessionId: "saved-session",
    }));
    expect(mockAskAgent).toHaveBeenNthCalledWith(1, workerId, "Please continue the demo work.");
    expect(mockAskAgent).toHaveBeenNthCalledWith(2, workerId, "Please continue the demo work.");

    const updatedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const updatedWorker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    const storedMessages = await db.select().from(messages).where(eq(messages.runId, runId)).orderBy(messages.createdAt);
    const resumeEvents = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId));

    expect(updatedRun?.status).toBe("running");
    expect(updatedRun?.lastError).toBeNull();
    expect(updatedWorker?.status).toBe("idle");
    expect(updatedWorker?.bridgeSessionId).toBe("resumed-session");
    expect(storedMessages.map((message) => message.role)).toEqual(["user", "worker"]);
    expect(storedMessages[1]?.content).toBe("Continuing from the restored session.");
    expect(resumeEvents.some((event) => event.eventType === "worker_session_resumed")).toBe(true);
  });

  it("starts a fresh direct worker when the saved Gemini session id is gone", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const now = new Date();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/direct-missing-gemini-session.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      status: "running",
      preferredWorkerType: "gemini",
      preferredWorkerModel: "gemini-3",
      preferredWorkerEffort: "high",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "gemini",
      status: "idle",
      cwd: "/workspace/app",
      bridgeSessionId: "missing-session",
      bridgeSessionMode: "full-access",
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "",
      createdAt: now,
      updatedAt: now,
    });

    mockAskAgent
      .mockRejectedValueOnce(new Error(`Ask failed: Agent not found: ${workerId}`))
      .mockResolvedValueOnce({
        response: "Fresh Gemini session response.",
        state: "idle",
      });
    mockSpawnAgent
      .mockRejectedValueOnce(new Error('Spawn failed: failed to start gemini agent via gemini: {"code":-32603,"message":"Internal error","data":{"details":"Invalid session identifier \\"missing-session\\"."}}'))
      .mockResolvedValueOnce({
        name: workerId,
        type: "gemini",
        cwd: "/workspace/app",
        state: "idle",
        sessionId: "fresh-session",
        sessionMode: "full-access",
        outputEntries: [],
        currentText: "",
        lastText: "Fresh Gemini session response.",
      });

    const request = new NextRequest(`http://localhost/api/conversations/${runId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "continue" }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: runId }) });
    expect(response.status).toBe(200);

    await delay(20);

    expect(mockSpawnAgent).toHaveBeenNthCalledWith(1, expect.objectContaining({
      name: workerId,
      type: "gemini",
      cwd: "/workspace/app",
      mode: "full-access",
      model: "gemini-3",
      effort: "high",
      resumeSessionId: "missing-session",
    }));
    expect(mockSpawnAgent).toHaveBeenNthCalledWith(2, expect.objectContaining({
      name: workerId,
      type: "gemini",
      cwd: "/workspace/app",
      mode: "full-access",
      model: "gemini-3",
      effort: "high",
    }));
    expect(mockSpawnAgent.mock.calls[1]?.[0]).not.toHaveProperty("resumeSessionId");

    const updatedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const updatedWorker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    const storedMessages = await db.select().from(messages).where(eq(messages.runId, runId)).orderBy(messages.createdAt);

    expect(updatedRun?.status).toBe("running");
    expect(updatedRun?.lastError).toBeNull();
    expect(updatedWorker?.status).toBe("idle");
    expect(updatedWorker?.bridgeSessionId).toBe("fresh-session");
    expect(storedMessages.map((message) => message.role)).toEqual(["user", "worker"]);
    expect(storedMessages[1]?.content).toBe("Fresh Gemini session response.");
  });

  it("routes direct follow-ups to the latest non-cancelled worker", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const cancelledWorkerId = `${runId}-worker-1`;
    const activeWorkerId = `${runId}-worker-2`;
    const now = new Date();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/direct-latest-worker.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      status: "done",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(workers).values([
      {
        id: cancelledWorkerId,
        runId,
        type: "claude",
        status: "cancelled",
        cwd: "/workspace/app",
        outputLog: "",
        outputEntriesJson: "[]",
        currentText: "",
        lastText: "",
        workerNumber: 1,
        createdAt: new Date(now.getTime()),
        updatedAt: new Date(now.getTime()),
      },
      {
        id: activeWorkerId,
        runId,
        type: "claude",
        status: "idle",
        cwd: "/workspace/app",
        outputLog: "",
        outputEntriesJson: "[]",
        currentText: "",
        lastText: "",
        workerNumber: 2,
        createdAt: new Date(now.getTime() + 1),
        updatedAt: new Date(now.getTime() + 1),
      },
    ]);

    const request = new NextRequest(`http://localhost/api/conversations/${runId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "you did it?" }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: runId }) });
    expect(response.status).toBe(200);

    await delay(20);

    expect(mockAskAgent).toHaveBeenCalledWith(activeWorkerId, "you did it?");
    expect(mockAskAgent).not.toHaveBeenCalledWith(cancelledWorkerId, "you did it?");
    const storedMessages = await db.select().from(messages).where(eq(messages.runId, runId)).orderBy(messages.createdAt);
    expect(storedMessages.map((message) => message.role)).toEqual(["user", "worker"]);
  });

  it("keeps a direct worker cancelled when a late response arrives after stop", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const now = new Date();
    let resolveAsk!: (value: { response: string; state: string }) => void;

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/direct-cancel-race.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "codex",
      status: "idle",
      cwd: "/workspace/app",
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "",
      createdAt: now,
      updatedAt: now,
    });

    mockAskAgent.mockImplementationOnce(() => new Promise((resolve) => {
      resolveAsk = resolve;
    }));

    const request = new NextRequest(`http://localhost/api/conversations/${runId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "Keep working until I stop you" }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: runId }) });
    expect(response.status).toBe(200);

    await db.update(workers).set({
      status: "cancelled",
      updatedAt: new Date(),
    }).where(eq(workers.id, workerId));

    resolveAsk({ response: "Late answer that should be ignored.", state: "idle" });
    await delay(20);

    const updatedWorker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    const workerMessages = await db.select().from(messages).where(eq(messages.workerId, workerId));

    expect(updatedWorker?.status).toBe("cancelled");
    expect(workerMessages).toHaveLength(0);
  });
});
