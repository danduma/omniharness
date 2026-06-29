import { randomUUID } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { clarifications, conversationReadMarkers, creditEvents, executionEvents, messages, planItems, planningReviewFindings, planningReviewRounds, planningReviewRuns, plans, processSessions, queuedConversationMessages, recoveryIncidents, runs, settings, supervisorInterventions, supervisorScheduledWakes, workerAssignments, workerCounters, workers } from "@/server/db/schema";
import { getEventStreamNotificationVersion } from "@/server/events/live-updates";
import { readWorkerOutputEntries } from "@/server/workers/output-store";

const { mockAskAgent, mockGetAgent, mockRespondElicitation, mockSpawnAgent, mockStartSupervisorRun } = vi.hoisted(() => ({
  mockAskAgent: vi.fn(),
  mockGetAgent: vi.fn(),
  mockRespondElicitation: vi.fn(),
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
    askAgent: mockAskAgent,
    getAgent: mockGetAgent,
    respondElicitation: mockRespondElicitation,
    spawnAgent: mockSpawnAgent,
  };
});

import { syncConversationSessions } from "@/server/conversations/sync";

describe("syncConversationSessions", () => {
  beforeEach(async () => {
    mockAskAgent.mockReset();
    mockAskAgent.mockResolvedValue({
      response: "Queued continue delivered.",
      state: "idle",
    });
    mockGetAgent.mockReset();
    mockGetAgent.mockResolvedValue(null);
    mockRespondElicitation.mockReset();
    mockRespondElicitation.mockResolvedValue({ ok: true });
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

  it("marks a selected planning run for recovery when its active worker is missing without a saved session", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const old = new Date(0);

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/plan.md",
      status: "running",
      createdAt: old,
      updatedAt: old,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "planning",
      status: "working",
      title: "Planning recovery",
      createdAt: old,
      updatedAt: old,
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
      createdAt: old,
      updatedAt: old,
    });

    await syncConversationSessions([], { selectedRunId: runId });

    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const worker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    const incidents = await db.select().from(recoveryIncidents).where(eq(recoveryIncidents.runId, runId));

    expect(run?.status).toBe("needs_recovery");
    expect(worker?.status).toBe("lost");
    expect(incidents).toHaveLength(1);
    expect(incidents[0]).toMatchObject({
      workerId,
      kind: "worker_lost",
      status: "needs_user",
    });
    expect(mockSpawnAgent).not.toHaveBeenCalled();
  });

  it("can sync a selected planning worker without refreshing planning artifact fields", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const old = new Date(0);

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/plan.md",
      status: "running",
      createdAt: old,
      updatedAt: old,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "planning",
      status: "working",
      title: "Planning snapshot",
      createdAt: old,
      updatedAt: old,
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
      createdAt: old,
      updatedAt: old,
    });

    await syncConversationSessions([
      {
        name: workerId,
        type: "codex",
        cwd: process.cwd(),
        state: "working",
        lastText: "Still planning.",
        currentText: "Still planning.",
        renderedOutput: "Still planning.",
        outputEntries: [{ type: "message", text: "Still planning." }],
        stderrBuffer: [],
        stopReason: null,
      },
    ], { selectedRunId: runId, refreshPlanningArtifacts: false });

    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const worker = await db.select().from(workers).where(eq(workers.id, workerId)).get();

    expect(run?.status).toBe("working");
    expect(run?.updatedAt?.getTime()).toBe(old.getTime());
    expect(run?.specPath).toBeNull();
    expect(run?.artifactPlanPath).toBeNull();
    expect(run?.plannerArtifactsJson).toBeNull();
    expect(worker?.currentText).toBe("Still planning.");
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

  it("does not infer awaiting_user from idle direct worker prose", async () => {
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

    expect(run?.status).toBe("done");
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

  it("drains queued direct messages after quiescing a live worker that still reports working", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const now = new Date(0);
    const finalAnswer = [
      "I finished the hidden recovery turn and wrote enough final output for OmniHarness to treat this direct worker as complete.",
      "There are no pending tool calls, permission prompts, or blockers left in this worker turn.",
      "The next queued user message should be delivered immediately once the sync pass quiesces the worker to idle.",
      "This long completion text is deliberately shaped like a final assistant response rather than a partial streaming fragment.",
      "It includes a complete summary, concrete verification notes, and enough stable prose to clear the long-completion threshold used for direct worker quiescence.",
      "That threshold prevents accidental completion on tiny partial chunks, so this fixture needs to look like a genuinely finished assistant response.",
      "After this point the worker should no longer be treated as busy by the control plane, and any queued steering for the same worker should drain.",
    ].join(" ");

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/direct-queued-drain.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      status: "running",
      title: "Direct queued drain",
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
      currentText: "",
      lastText: "",
      workerNumber: 1,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(queuedConversationMessages).values({
      id: randomUUID(),
      runId,
      targetWorkerId: workerId,
      action: "steer",
      status: "pending",
      content: "continue",
      attachmentsJson: "[]",
      createdAt: new Date(now.getTime() + 3),
      updatedAt: new Date(now.getTime() + 3),
    });
    await syncConversationSessions([
      {
        name: workerId,
        type: "gemini",
        cwd: process.cwd(),
        state: "working",
        sessionId: "still-working-session",
        sessionMode: "full-access",
        lastText: finalAnswer,
        currentText: finalAnswer,
        renderedOutput: finalAnswer,
        outputEntries: [
          {
            id: "user-1",
            type: "user_input",
            text: "Recover worker",
            timestamp: now.toISOString(),
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

    const queued = await db.select().from(queuedConversationMessages).where(eq(queuedConversationMessages.runId, runId)).get();
    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const worker = await db.select().from(workers).where(eq(workers.id, workerId)).get();

    expect(worker?.status).toBe("idle");
    expect(run?.status).toBe("done");
    expect(mockAskAgent).toHaveBeenCalledWith(workerId, expect.stringContaining("User message:\ncontinue"));
    expect(queued?.status).toBe("delivered");
    const events = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId));
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        eventType: "queue_drain_decision",
        workerId,
      }),
      expect.objectContaining({
        eventType: "queue_drain_finished",
        workerId,
      }),
      expect.objectContaining({
        eventType: "queued_message_delivered",
        workerId,
      }),
    ]));
  });

  it("answers a pending direct worker elicitation instead of leaving the queued reply stuck behind working status", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const now = new Date(0);
    const question = "The terminal feature is done and tested, but unrelated WIP is interleaved in some files. How should I commit?";

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/direct-elicitation-queued-drain.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      status: "running",
      title: "Direct elicitation queued drain",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "claude",
      status: "working",
      cwd: process.cwd(),
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: question,
      lastText: question,
      workerNumber: 1,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(queuedConversationMessages).values({
      id: "queued-answer",
      runId,
      targetWorkerId: workerId,
      action: "steer",
      status: "pending",
      content: "just group files and commit them",
      attachmentsJson: "[]",
      createdAt: new Date(now.getTime() + 3),
      updatedAt: new Date(now.getTime() + 3),
    });
    mockGetAgent.mockResolvedValue({
      name: workerId,
      type: "claude",
      cwd: process.cwd(),
      state: "working",
      currentText: question,
      lastText: question,
      renderedOutput: question,
      outputEntries: [],
      pendingElicitations: [
        {
          requestId: 2,
          requestedAt: now.toISOString(),
          sessionId: "elicitation-session",
          toolCallId: "ask-tool",
          message: question,
          requestedSchema: {
            type: "object",
            properties: {
              customAnswer: { type: "string", title: "Other" },
            },
          },
        },
      ],
      stderrBuffer: [],
      stopReason: null,
    });

    await syncConversationSessions([
      {
        name: workerId,
        type: "claude",
        cwd: process.cwd(),
        state: "working",
        sessionId: "elicitation-session",
        sessionMode: "full-access",
        currentText: question,
        lastText: question,
        renderedOutput: question,
        outputEntries: [
          {
            id: "ask-start",
            type: "tool_call",
            text: "Asking for your input",
            toolCallId: "ask-tool",
            toolKind: "other",
            status: "pending",
            timestamp: now.toISOString(),
            raw: {
              _meta: { claudeCode: { toolName: "AskUserQuestion" } },
              kind: "other",
              title: "Asking for your input",
            },
          },
          {
            id: "elicitation-1",
            type: "elicitation",
            text: `Question for user: ${question}`,
            status: "pending",
            timestamp: new Date(now.getTime() + 1).toISOString(),
            raw: {
              requestId: 2,
              message: question,
              requestedSchema: {
                type: "object",
                properties: {
                  customAnswer: { type: "string", title: "Other" },
                },
              },
            },
          },
        ],
        pendingElicitations: [
          {
            requestId: 2,
            requestedAt: now.toISOString(),
            sessionId: "elicitation-session",
            toolCallId: "ask-tool",
            message: question,
            requestedSchema: {
              type: "object",
              properties: {
                customAnswer: { type: "string", title: "Other" },
              },
            },
          },
        ],
        stderrBuffer: [],
        stopReason: null,
      },
    ], { selectedRunId: runId });

    const queued = await db.select().from(queuedConversationMessages).where(eq(queuedConversationMessages.id, "queued-answer")).get();
    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const worker = await db.select().from(workers).where(eq(workers.id, workerId)).get();

    expect(mockAskAgent).not.toHaveBeenCalled();
    expect(mockRespondElicitation).toHaveBeenCalledWith(workerId, {
      action: "accept",
      content: { customAnswer: "just group files and commit them" },
    });
    expect(queued?.status).toBe("delivered");
    expect(run?.status).toBe("running");
    expect(worker?.status).toBe("working");
  });

  it("drains an awaiting direct worker when the list snapshot only has an open elicitation entry", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const now = new Date(0);
    const question = "The worker is waiting for a direct answer, but the list snapshot is stale.";

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/direct-stale-elicitation-drain.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      status: "awaiting_user",
      title: "Direct stale elicitation drain",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "claude",
      status: "working",
      cwd: process.cwd(),
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: question,
      lastText: question,
      workerNumber: 1,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(queuedConversationMessages).values({
      id: "queued-stale-answer",
      runId,
      targetWorkerId: workerId,
      action: "steer",
      status: "pending",
      content: "answer the pending direct question",
      attachmentsJson: "[]",
      createdAt: new Date(now.getTime() + 3),
      updatedAt: new Date(now.getTime() + 3),
    });
    await syncConversationSessions([
      {
        name: workerId,
        type: "claude",
        cwd: process.cwd(),
        state: "working",
        sessionId: "elicitation-session",
        sessionMode: "full-access",
        currentText: question,
        lastText: question,
        renderedOutput: question,
        outputEntries: [
          {
            id: "elicitation-stale",
            type: "elicitation",
            text: `Question for user: ${question}`,
            status: "pending",
            timestamp: new Date(now.getTime() + 1).toISOString(),
            raw: {
              requestId: 4,
              sessionId: "elicitation-session",
              toolCallId: "ask-tool",
              message: question,
              requestedSchema: {
                type: "object",
                properties: {
                  customAnswer: { type: "string", title: "Other" },
                },
              },
            },
          },
        ],
        pendingElicitations: [],
        stderrBuffer: [],
        stopReason: null,
      },
    ], { selectedRunId: runId });

    const queued = await db.select().from(queuedConversationMessages).where(eq(queuedConversationMessages.id, "queued-stale-answer")).get();
    const events = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId));

    expect(mockGetAgent).not.toHaveBeenCalled();
    expect(mockAskAgent).not.toHaveBeenCalled();
    expect(mockRespondElicitation).toHaveBeenCalledWith(workerId, {
      action: "accept",
      content: { customAnswer: "answer the pending direct question" },
    });
    expect(queued?.status).toBe("delivered");
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        eventType: "queue_drain_decision",
        detailsPreview: expect.stringContaining("\"reason\":\"pending_elicitation\""),
      }),
    ]));
  });

  it("does not append a queued answer when a stale elicitation snapshot is already answered", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const now = new Date(0);
    const question = "The worker already accepted this direct answer.";

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/direct-stale-elicitation-no-duplicate.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      status: "awaiting_user",
      title: "Direct stale elicitation no duplicate",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "claude",
      status: "working",
      cwd: process.cwd(),
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: question,
      lastText: question,
      workerNumber: 1,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(queuedConversationMessages).values({
      id: "queued-already-answered",
      runId,
      targetWorkerId: workerId,
      action: "steer",
      status: "pending",
      content: "answer the pending direct question",
      attachmentsJson: "[]",
      createdAt: new Date(now.getTime() + 3),
      updatedAt: new Date(now.getTime() + 3),
    });
    mockRespondElicitation.mockRejectedValueOnce(new Error("Respond elicitation failed: no_pending_elicitations"));

    await syncConversationSessions([
      {
        name: workerId,
        type: "claude",
        cwd: process.cwd(),
        state: "working",
        sessionId: "elicitation-session",
        sessionMode: "full-access",
        currentText: question,
        lastText: question,
        renderedOutput: question,
        outputEntries: [
          {
            id: "stale-elicitation-entry",
            type: "elicitation",
            text: `Question for user: ${question}`,
            status: "pending",
            timestamp: new Date(now.getTime() + 1).toISOString(),
            raw: {
              requestId: 4,
              sessionId: "elicitation-session",
              toolCallId: "ask-tool",
              message: question,
              requestedSchema: {
                type: "object",
                properties: {
                  customAnswer: { type: "string", title: "Other" },
                },
              },
            },
          },
        ],
        pendingElicitations: [],
        stderrBuffer: [],
        stopReason: null,
      },
    ], { selectedRunId: runId });

    const queued = await db.select().from(queuedConversationMessages).where(eq(queuedConversationMessages.id, "queued-already-answered")).get();
    const storedMessages = await db.select().from(messages).where(eq(messages.runId, runId));
    const entries = await readWorkerOutputEntries(runId, workerId);

    expect(mockAskAgent).not.toHaveBeenCalled();
    expect(mockRespondElicitation).toHaveBeenCalledWith(workerId, {
      action: "accept",
      content: { customAnswer: "answer the pending direct question" },
    });
    expect(queued?.status).toBe("failed");
    expect(queued?.lastError).toContain("no_pending_elicitations");
    expect(storedMessages).toHaveLength(0);
    expect(entries.filter((entry) => entry.type === "user_input")).toHaveLength(0);
  });

  it("keeps a direct run running after an elicitation is answered while the worker continues", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const now = new Date(0);

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/direct-answered-elicitation.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      status: "running",
      title: "Direct answered elicitation",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "claude",
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
        type: "claude",
        cwd: process.cwd(),
        state: "working",
        sessionId: "elicitation-session",
        sessionMode: "full-access",
        currentText: "Let me read the actual renderer + style files I'll edit.",
        lastText: "Let me read the actual renderer + style files I'll edit.",
        renderedOutput: "Let me read the actual renderer + style files I'll edit.",
        outputEntries: [
          {
            id: "elicitation-pending",
            type: "elicitation",
            text: "Question for user: Please answer the following questions. (3 fields)",
            status: "pending",
            timestamp: new Date(now.getTime() + 1).toISOString(),
            raw: { requestId: 2 },
          },
          {
            id: "elicitation-answered",
            type: "elicitation",
            text: "Question answered for request 2",
            status: "answered",
            timestamp: new Date(now.getTime() + 2).toISOString(),
            raw: { requestId: 2, action: "accept" },
          },
          {
            id: "read-file",
            type: "tool_call",
            text: "Read File",
            toolCallId: "toolu_read",
            toolKind: "read",
            status: "pending",
            timestamp: new Date(now.getTime() + 3).toISOString(),
          },
        ],
        pendingElicitations: [],
        stderrBuffer: [],
        stopReason: null,
      },
    ], { selectedRunId: runId });

    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const worker = await db.select().from(workers).where(eq(workers.id, workerId)).get();

    expect(run?.status).toBe("running");
    expect(worker?.status).toBe("working");
    expect(mockAskAgent).not.toHaveBeenCalled();
    expect(mockRespondElicitation).not.toHaveBeenCalled();
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

  it("completes a commit run when final text contains an optional follow-up", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const now = new Date(0);
    const finalText = [
      "Done. The modified files are grouped into three logical commits and pushed to `origin/master`.",
      "",
      "Two files were deliberately left uncommitted because they are artifacts.",
      "Let me know if you actually want either committed or added to `.gitignore`.",
    ].join("\n");

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/commit.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "commit",
      status: "running",
      title: "Commit and push",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "claude",
      status: "idle",
      cwd: process.cwd(),
      outputLog: "",
      outputEntriesJson: JSON.stringify([
        { type: "message", text: finalText },
      ]),
      currentText: "",
      lastText: finalText,
      workerNumber: 1,
      createdAt: now,
      updatedAt: now,
    });

    await syncConversationSessions([], { selectedRunId: runId });

    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const awaitingEvents = await db.select()
      .from(executionEvents)
      .where(eq(executionEvents.runId, runId));

    expect(run?.status).toBe("done");
    expect(awaitingEvents.some((event) => event.eventType === "direct_worker_awaiting_user")).toBe(false);
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
