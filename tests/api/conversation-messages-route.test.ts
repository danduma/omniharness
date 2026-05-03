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
  validationRuns,
  workerAssignments,
  workerCounters,
  workers,
} from "@/server/db/schema";

const { mockAskAgent, mockGetAgent, mockStartSupervisorRun } = vi.hoisted(() => ({
  mockAskAgent: vi.fn().mockResolvedValue({
    response: "Here is the next planning step.",
    state: "working",
  }),
  mockGetAgent: vi.fn().mockResolvedValue(null),
  mockStartSupervisorRun: vi.fn(),
}));

vi.mock("@/server/bridge-client", () => ({
  askAgent: mockAskAgent,
  getAgent: mockGetAgent,
}));

vi.mock("@/server/supervisor/start", () => ({
  startSupervisorRun: mockStartSupervisorRun,
}));

import { POST } from "@/app/api/conversations/[id]/messages/route";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("POST /api/conversations/[id]/messages", () => {
  beforeEach(async () => {
    mockAskAgent.mockClear();
    mockGetAgent.mockClear();
    mockStartSupervisorRun.mockClear();
    await db.delete(supervisorInterventions);
    await db.delete(validationRuns);
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

  it("queues active implementation follow-ups instead of trying to wake an already-running supervisor", async () => {
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
        busyAction: "steer",
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
    expect(mockStartSupervisorRun).not.toHaveBeenCalled();
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
});
