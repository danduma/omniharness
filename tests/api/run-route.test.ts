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
  validationRuns,
  executionEvents,
  creditEvents,
  accounts,
} from "@/server/db/schema";
import { PATCH, DELETE, POST } from "@/app/api/runs/[id]/route";

const { mockCancelAgent, mockStartSupervisorRun, mockQueueConversationTitleGeneration } = vi.hoisted(() => ({
  mockCancelAgent: vi.fn().mockResolvedValue(undefined),
  mockStartSupervisorRun: vi.fn(),
  mockQueueConversationTitleGeneration: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/bridge-client", () => ({
  cancelAgent: mockCancelAgent,
}));

vi.mock("@/server/supervisor/start", () => ({
  startSupervisorRun: mockStartSupervisorRun,
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
  it("retries from a user checkpoint by truncating later history and cancelling workers", async () => {
    mockCancelAgent.mockClear();
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
      title: "Retry test",
      status: "failed",
      lastError: "API key not valid",
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
        content: "Run failed: API key not valid",
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

    expect(mockCancelAgent).toHaveBeenCalledWith(workerId);
    expect(mockStartSupervisorRun).toHaveBeenCalledWith(runId);
    expect(updatedRun?.status).toBe("running");
    expect(updatedRun?.lastError).toBeNull();
    expect(updatedRun?.failedAt).toBeNull();
    expect(remainingWorkers).toHaveLength(1);
    expect(remainingWorkers[0]?.status).toBe("cancelled");
    expect(remainingClarifications).toHaveLength(0);
    expect(remainingMessages.map((message) => message.id)).toEqual([userMessageId]);
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
    expect(remainingMessages.map((message) => message.id)).toEqual([userMessageId]);
    expect(fs.readFileSync(adHocAbsolutePath, "utf-8")).toContain("new prompt");
    expect(mockStartSupervisorRun).toHaveBeenCalledWith(runId);
  });

  it("forks a new conversation from a user checkpoint", async () => {
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
      title: "Source run",
      preferredWorkerType: "codex",
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
    expect(forkedRun?.parentRunId).toBe(runId);
    expect(forkedRun?.forkedFromMessageId).toBe(userMessageId);
    expect(forkedRun?.preferredWorkerType).toBe("codex");
    expect(forkedRun?.allowedWorkerTypes).toBe(JSON.stringify(["codex", "opencode"]));
    expect(forkedMessages).toHaveLength(1);
    expect(forkedMessages[0]?.content).toBe("forked prompt");
    expect(fs.readFileSync(getAppDataPath(forkedPlan!.path), "utf-8")).toContain("forked prompt");
    expect(mockStartSupervisorRun).toHaveBeenCalledWith(payload.runId);
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

    await db.insert(validationRuns).values({
      id: randomUUID(),
      runId,
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
    expect(fs.existsSync(adHocAbsolutePath)).toBe(false);
  });
});
