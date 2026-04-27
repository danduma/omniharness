import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { messages, plans, runs, workerCounters, workers } from "@/server/db/schema";

const { mockAskAgent, mockStartSupervisorRun } = vi.hoisted(() => ({
  mockAskAgent: vi.fn().mockResolvedValue({
    response: "Here is the next planning step.",
    state: "working",
  }),
  mockStartSupervisorRun: vi.fn(),
}));

vi.mock("@/server/bridge-client", () => ({
  askAgent: mockAskAgent,
}));

vi.mock("@/server/supervisor/start", () => ({
  startSupervisorRun: mockStartSupervisorRun,
}));

import { POST } from "@/app/api/conversations/[id]/messages/route";

describe("POST /api/conversations/[id]/messages", () => {
  beforeEach(async () => {
    mockAskAgent.mockClear();
    mockStartSupervisorRun.mockClear();
    await db.delete(messages);
    await db.delete(workers);
    await db.delete(workerCounters);
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
});
