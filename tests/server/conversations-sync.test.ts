import { randomUUID } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { clarifications, conversationReadMarkers, creditEvents, executionEvents, messages, planItems, planningReviewFindings, planningReviewRounds, planningReviewRuns, plans, processSessions, queuedConversationMessages, recoveryIncidents, runs, settings, supervisorInterventions, supervisorScheduledWakes, workerAssignments, workerCounters, workers } from "@/server/db/schema";
import { getEventStreamNotificationVersion } from "@/server/events/live-updates";
import { readWorkerOutputEntries } from "@/server/workers/output-store";

const { mockSpawnAgent, mockStartSupervisorRun } = vi.hoisted(() => ({
  mockSpawnAgent: vi.fn(),
  mockStartSupervisorRun: vi.fn(),
}));

vi.mock("@/server/supervisor/start", () => ({
  startSupervisorRun: mockStartSupervisorRun,
}));

vi.mock("@/server/bridge-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/bridge-client")>();
  return {
    ...actual,
    spawnAgent: mockSpawnAgent,
  };
});

import { syncConversationSessions } from "@/server/conversations/sync";

describe("syncConversationSessions", () => {
  beforeEach(async () => {
    mockSpawnAgent.mockReset();
    mockStartSupervisorRun.mockReset();
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
    await db.delete(runs);
    await db.delete(planItems);
    await db.delete(plans);
    await db.delete(settings);
  });

  it("resumes a selected direct run when its active worker is missing but has a saved session", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const now = new Date(0);

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
      title: "Direct recovery",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(messages).values({
      id: randomUUID(),
      runId,
      role: "user",
      kind: "checkpoint",
      content: "Commit the changes",
      createdAt: now,
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "codex",
      status: "working",
      cwd: process.cwd(),
      bridgeSessionId: "session-direct",
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "",
      createdAt: now,
      updatedAt: now,
    });
    mockSpawnAgent.mockResolvedValue({
      name: workerId,
      type: "codex",
      cwd: process.cwd(),
      state: "idle",
      sessionId: "session-direct-resumed",
      sessionMode: "full-access",
      lastText: "",
      currentText: "",
      stderrBuffer: [],
      stopReason: null,
    });

    await syncConversationSessions([], { selectedRunId: runId });

    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const worker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    const incident = await db.select().from(recoveryIncidents).where(eq(recoveryIncidents.runId, runId)).get();

    expect(run?.status).toBe("done");
    expect(run?.lastError).toBeNull();
    expect(worker?.status).toBe("idle");
    expect(worker?.bridgeSessionId).toBe("session-direct-resumed");
    expect(incident).toMatchObject({
      workerId,
      kind: "session_missing",
      status: "resolved",
    });
    expect(mockSpawnAgent).toHaveBeenCalledWith(expect.objectContaining({
      name: workerId,
      mode: "full-access",
      resumeSessionId: "session-direct",
    }));
    expect(mockStartSupervisorRun).not.toHaveBeenCalled();
  });

  it("recovers the latest non-cancelled direct worker instead of completing from an older cancelled worker", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const cancelledWorkerId = `${runId}-worker-1`;
    const activeWorkerId = `${runId}-worker-2`;
    const now = new Date(0);

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
      title: "Direct recovery with cancelled worker",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(messages).values({
      id: randomUUID(),
      runId,
      role: "user",
      kind: "checkpoint",
      content: "you did it?",
      createdAt: now,
    });
    await db.insert(workers).values([
      {
        id: cancelledWorkerId,
        runId,
        type: "claude",
        status: "cancelled",
        cwd: process.cwd(),
        outputLog: "Older cancelled worker output.",
        outputEntriesJson: "[]",
        currentText: "",
        lastText: "Older cancelled worker output.",
        workerNumber: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: activeWorkerId,
        runId,
        type: "claude",
        status: "working",
        cwd: process.cwd(),
        bridgeSessionId: "active-session",
        bridgeSessionMode: "full-access",
        outputLog: "",
        outputEntriesJson: "[]",
        currentText: "",
        lastText: "",
        workerNumber: 2,
        createdAt: new Date(now.getTime() + 1),
        updatedAt: now,
      },
    ]);
    mockSpawnAgent.mockResolvedValue({
      name: activeWorkerId,
      type: "claude",
      cwd: process.cwd(),
      state: "idle",
      sessionId: "active-session-resumed",
      sessionMode: "full-access",
      lastText: "",
      currentText: "",
      stderrBuffer: [],
      stopReason: null,
    });

    await syncConversationSessions([], { selectedRunId: runId });

    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const activeWorker = await db.select().from(workers).where(eq(workers.id, activeWorkerId)).get();
    const incident = await db.select().from(recoveryIncidents).where(eq(recoveryIncidents.runId, runId)).get();

    expect(run?.status).toBe("done");
    expect(activeWorker?.status).toBe("idle");
    expect(activeWorker?.bridgeSessionId).toBe("active-session-resumed");
    expect(incident).toMatchObject({
      workerId: activeWorkerId,
      kind: "session_missing",
      status: "resolved",
    });
    expect(mockSpawnAgent).toHaveBeenCalledWith(expect.objectContaining({
      name: activeWorkerId,
      resumeSessionId: "active-session",
    }));
  });

  it("keeps an idle direct worker question in awaiting_user instead of completing the run", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const now = new Date(0);
    const workerQuestion = [
      "Before merging, I need your decision.",
      "Should I commit, stash, or merge only committed changes?",
      "Which approach do you want?",
    ].join("\n");

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
      title: "Merge and delete branch",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "claude",
      status: "idle",
      cwd: process.cwd(),
      outputLog: workerQuestion,
      outputEntriesJson: "[]",
      currentText: "",
      lastText: workerQuestion,
      workerNumber: 1,
      createdAt: now,
      updatedAt: now,
    });

    await syncConversationSessions([], { selectedRunId: runId });

    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();

    expect(run?.status).toBe("awaiting_user");
    expect(mockSpawnAgent).not.toHaveBeenCalled();
  });

  it("completes a running direct run when the live worker is idle with output but no stop reason", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const now = new Date(0);

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
      title: "Direct idle live worker",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "codex",
      status: "working",
      cwd: process.cwd(),
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "",
      createdAt: now,
      updatedAt: now,
    });

    await syncConversationSessions([
      {
        name: workerId,
        type: "codex",
        cwd: process.cwd(),
        state: "idle",
        sessionId: "session-live",
        sessionMode: "full-access",
        lastText: "",
        currentText: "",
        stderrBuffer: [],
        stopReason: null,
        outputEntries: [
          {
            id: "entry-1",
            type: "message",
            text: "Done. I traced the queue and fixed the stale row.",
            timestamp: new Date().toISOString(),
          },
        ],
      },
    ], { selectedRunId: runId });

    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const worker = await db.select().from(workers).where(eq(workers.id, workerId)).get();

    expect(run?.status).toBe("done");
    expect(worker?.status).toBe("idle");
    expect(mockSpawnAgent).not.toHaveBeenCalled();
  });

  it("completes a direct run when a live adapter keeps reporting working after a final assistant message", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const now = new Date(0);
    const finalAnswer = [
      "I have implemented the fix and verified the changed files.",
      "The direct conversation can now inspect the worker stream, persist the final answer, and avoid leaving the run stuck in a stale working state.",
      "Verification covered the relevant control-plane path, the worker status transition, and the persisted terminal output that the UI consumes after a reload.",
      "The remaining work is only normal review; there is no pending tool call, permission prompt, or user decision blocking this turn.",
      "This deliberately long final-looking text mirrors the fallback path for adapters that keep reporting working even after a complete response has already been emitted.",
      "It is long enough to avoid confusing an early partial assistant chunk with a real completed answer.",
    ].join(" ");

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/direct-stale-working.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      status: "running",
      title: "Direct stale working",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "gemini",
      status: "working",
      cwd: process.cwd(),
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "Previous in-flight text",
      lastText: "Previous in-flight text",
      workerNumber: 1,
      createdAt: now,
      updatedAt: now,
    });

    await syncConversationSessions([
      {
        name: workerId,
        type: "gemini",
        cwd: process.cwd(),
        state: "working",
        sessionId: "stale-working-session",
        sessionMode: "full-access",
        lastText: finalAnswer,
        currentText: finalAnswer,
        renderedOutput: finalAnswer,
        outputEntries: [
          {
            id: "user-1",
            type: "user_input",
            text: "Fix it",
            timestamp: now.toISOString(),
          },
          {
            id: "tool-1",
            type: "tool_call",
            text: "Edit",
            toolCallId: "tool-1",
            toolKind: "edit",
            status: "completed",
            timestamp: new Date(now.getTime() + 1).toISOString(),
          },
          {
            id: "message-1",
            type: "message",
            text: finalAnswer,
            timestamp: new Date(now.getTime() + 2).toISOString(),
          },
        ],
        stderrBuffer: [],
        stopReason: null,
      },
    ], { selectedRunId: runId });

    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const worker = await db.select().from(workers).where(eq(workers.id, workerId)).get();

    expect(run?.status).toBe("done");
    expect(worker?.status).toBe("idle");
    expect(worker?.currentText).toBe("");
    expect(worker?.lastText).toBe(finalAnswer);
    expect(mockSpawnAgent).not.toHaveBeenCalled();
  });

  it("keeps a direct run running when the live worker only has a partial streaming message", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const now = new Date(0);
    const partialText = "I’ll trace the co-p";

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/direct-partial-stream.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      status: "running",
      title: "Direct partial stream",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "codex",
      status: "working",
      cwd: process.cwd(),
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "",
      workerNumber: 1,
      createdAt: now,
      updatedAt: now,
    });

    await syncConversationSessions([
      {
        name: workerId,
        type: "codex",
        cwd: process.cwd(),
        state: "working",
        sessionId: "streaming-session",
        sessionMode: "full-access",
        lastText: partialText,
        currentText: partialText,
        renderedOutput: partialText,
        outputEntries: [
          {
            id: "message-1",
            type: "message",
            text: partialText,
            timestamp: new Date(now.getTime() + 1).toISOString(),
          },
        ],
        stderrBuffer: [],
        stopReason: null,
      },
    ], { selectedRunId: runId });

    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const worker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    const entries = await readWorkerOutputEntries(runId, workerId);

    expect(run?.status).toBe("running");
    expect(worker?.status).toBe("working");
    expect(worker?.currentText).toBe(partialText);
    expect(worker?.lastText).toBe(partialText);
    expect(entries.map((entry) => (entry as { text?: string }).text)).toContain(partialText);
    expect(mockSpawnAgent).not.toHaveBeenCalled();
  });

  it("revives and syncs a selected terminal direct run when the live worker is still streaming", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const now = new Date(0);
    const partialText = "I’ll trace the co-p";

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/direct-terminal-stream.md",
      status: "done",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      status: "done",
      title: "Terminal direct still streaming",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "codex",
      status: "idle",
      cwd: process.cwd(),
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "",
      workerNumber: 1,
      createdAt: now,
      updatedAt: now,
    });

    await syncConversationSessions([
      {
        name: workerId,
        type: "codex",
        cwd: process.cwd(),
        state: "working",
        sessionId: "terminal-streaming-session",
        sessionMode: "full-access",
        lastText: partialText,
        currentText: partialText,
        renderedOutput: partialText,
        outputEntries: [
          {
            id: "message-1",
            type: "message",
            text: partialText,
            timestamp: new Date(now.getTime() + 1).toISOString(),
          },
        ],
        stderrBuffer: [],
        stopReason: null,
      },
    ], { selectedRunId: runId });

    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const worker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    const entries = await readWorkerOutputEntries(runId, workerId);

    expect(run?.status).toBe("running");
    expect(worker?.status).toBe("working");
    expect(worker?.currentText).toBe(partialText);
    expect(worker?.lastText).toBe(partialText);
    expect(entries.map((entry) => (entry as { text?: string }).text)).toContain(partialText);
    expect(mockSpawnAgent).not.toHaveBeenCalled();
  });

  it("does not recover a running implementation worker from an incomplete runtime list", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const oldEnoughForRecoveryClassifier = new Date(Date.now() - 120_000);

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/implementation.md",
      status: "running",
      createdAt: oldEnoughForRecoveryClassifier,
      updatedAt: oldEnoughForRecoveryClassifier,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "implementation",
      status: "running",
      title: "Implementation recovery guard",
      createdAt: oldEnoughForRecoveryClassifier,
      updatedAt: oldEnoughForRecoveryClassifier,
    });
    await db.insert(messages).values({
      id: randomUUID(),
      runId,
      role: "user",
      kind: "clarification_answer",
      content: "Yes, implement it",
      createdAt: oldEnoughForRecoveryClassifier,
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "gemini",
      status: "working",
      cwd: process.cwd(),
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "",
      workerNumber: 1,
      createdAt: oldEnoughForRecoveryClassifier,
      updatedAt: oldEnoughForRecoveryClassifier,
    });

    await syncConversationSessions([], { selectedRunId: runId });

    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const worker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    const incidents = await db.select().from(recoveryIncidents).where(eq(recoveryIncidents.runId, runId));

    expect(run?.status).toBe("running");
    expect(worker?.status).toBe("working");
    expect(incidents).toEqual([]);
    expect(mockStartSupervisorRun).not.toHaveBeenCalled();
    expect(mockSpawnAgent).not.toHaveBeenCalled();
  });

  it("fails a running direct run when the live worker is idle with no output", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const now = new Date(0);

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
      title: "Direct idle empty worker",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "gemini",
      status: "idle",
      cwd: process.cwd(),
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "",
      createdAt: now,
      updatedAt: now,
    });

    await syncConversationSessions([
      {
        name: workerId,
        type: "gemini",
        cwd: process.cwd(),
        state: "idle",
        sessionId: "session-live-empty",
        sessionMode: "full-access",
        lastText: "",
        currentText: "",
        renderedOutput: "",
        outputEntries: [],
        stderrBuffer: [],
        stopReason: null,
      },
    ], { selectedRunId: runId });

    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const worker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    const errorMessage = await db.select().from(messages).where(eq(messages.runId, runId)).get();

    expect(run?.status).toBe("failed");
    expect(run?.lastError).toContain("idle with no recorded output");
    expect(worker?.status).toBe("error");
    expect(worker?.outputLog).toContain("idle with no recorded output");
    expect(errorMessage?.kind).toBe("error");
    expect(mockSpawnAgent).not.toHaveBeenCalled();
  });

  it("completes a direct run when latest worker text supersedes an older question", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const now = new Date(0);
    const oldQuestion = [
      "Before merging, I need your decision.",
      "Should I commit, stash, or merge only committed changes?",
      "Which approach do you want?",
    ].join("\n");
    const latestDone = "Done. Committed the changes, merged into master, pushed, and deleted the branch.";

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
      status: "awaiting_user",
      title: "Merge and delete branch",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "claude",
      status: "idle",
      cwd: process.cwd(),
      outputLog: oldQuestion,
      outputEntriesJson: "[]",
      currentText: latestDone,
      lastText: latestDone,
      workerNumber: 1,
      createdAt: now,
      updatedAt: now,
    });

    const notificationVersionBefore = getEventStreamNotificationVersion();

    await syncConversationSessions([], { selectedRunId: runId });

    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();

    expect(run?.status).toBe("done");
    expect(getEventStreamNotificationVersion()).toBeGreaterThan(notificationVersionBefore);
    expect(mockSpawnAgent).not.toHaveBeenCalled();
  });

  it("does not resurrect a cancelled implementation worker from a late live bridge snapshot", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const now = new Date(0);

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/implementation.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "implementation",
      status: "running",
      title: "Implementation cancellation",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "gemini",
      status: "cancelled",
      cwd: process.cwd(),
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "",
      bridgeSessionId: "cancelled-session",
      workerNumber: 1,
      createdAt: now,
      updatedAt: now,
    });

    await syncConversationSessions([
      {
        name: workerId,
        type: "gemini",
        cwd: process.cwd(),
        state: "working",
        sessionId: "cancelled-session",
        sessionMode: "full-access",
        lastText: "late bridge output",
        currentText: "late bridge output",
        renderedOutput: "late bridge output",
        outputEntries: [],
        stderrBuffer: [],
        stopReason: null,
      },
    ], { selectedRunId: runId });

    const worker = await db.select().from(workers).where(eq(workers.id, workerId)).get();

    expect(worker?.status).toBe("cancelled");
    expect(worker?.currentText).toBe("");
    expect(mockStartSupervisorRun).not.toHaveBeenCalled();
  });

  it("clears stale direct currentText on terminal idle workers", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const now = new Date(0);
    const finalAnswer = "Final answer already rendered in the worker stream.";

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
      status: "done",
      title: "Terminal direct run",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "gemini",
      status: "idle",
      cwd: process.cwd(),
      outputLog: finalAnswer,
      outputEntriesJson: "[]",
      currentText: finalAnswer,
      lastText: finalAnswer,
      workerNumber: 1,
      createdAt: now,
      updatedAt: now,
    });

    await syncConversationSessions([], { selectedRunId: runId });

    const worker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();

    expect(run?.status).toBe("done");
    expect(worker?.status).toBe("idle");
    expect(worker?.currentText).toBe("");
    expect(worker?.lastText).toBe(finalAnswer);
    expect(mockSpawnAgent).not.toHaveBeenCalled();
  });
});
