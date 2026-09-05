import { randomUUID } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { accounts, executionEvents, messages, plans, queuedConversationMessages, recoveryIncidents, runs, settings, workerCredentialAllocations, workers } from "@/server/db/schema";
import { __resetNamedEventsForTests, getNamedEventsSince } from "@/server/events/named-events";
import { readWorkerOutputEntries, writeWorkerOutputEntries } from "@/server/workers/output-store";

const { mockAskAgent, mockGetAgent, mockSpawnAgent, mockStartSupervisorRun } = vi.hoisted(() => ({
  mockAskAgent: vi.fn(),
  mockGetAgent: vi.fn(),
  mockSpawnAgent: vi.fn(),
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

import { reconcileRunRecovery } from "@/server/runs/recovery-reconciler";
import { waitForConversationBackgroundTasksForTests } from "@/server/conversations/worker-turn-gate";

async function createImplementationRun() {
  const planId = randomUUID();
  const runId = randomUUID();
  const workerId = `${runId}-worker-1`;
  const now = new Date(0);
  await db.insert(plans).values({
    id: planId,
    path: "vibes/ad-hoc/recovery.md",
    status: "running",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(runs).values({
    id: runId,
    planId,
    mode: "implementation",
    status: "running",
    title: "Recovery test",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(messages).values({
    id: randomUUID(),
    runId,
    role: "user",
    kind: "checkpoint",
    content: "Fix the composer",
    createdAt: now,
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
  return { runId, workerId };
}

async function createDirectRun() {
  const planId = randomUUID();
  const runId = randomUUID();
  const workerId = `${runId}-worker-1`;
  const now = new Date(0);
  await db.insert(plans).values({
    id: planId,
    path: "vibes/ad-hoc/direct-recovery.md",
    status: "running",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(runs).values({
    id: runId,
    planId,
    mode: "direct",
    status: "running",
    title: "Direct recovery test",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(messages).values({
    id: randomUUID(),
    runId,
    role: "user",
    kind: "checkpoint",
    content: "Build the walkthrough",
    createdAt: now,
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
    bridgeSessionId: "session-direct-1",
    bridgeSessionMode: "full-access",
    createdAt: now,
    updatedAt: now,
  });
  return { runId, workerId };
}

describe("reconcileRunRecovery", () => {
  beforeEach(async () => {
    __resetNamedEventsForTests();
    mockAskAgent.mockReset();
    mockGetAgent.mockReset();
    mockSpawnAgent.mockReset();
    mockStartSupervisorRun.mockReset();
    await db.delete(recoveryIncidents);
    await db.delete(executionEvents);
    await db.delete(queuedConversationMessages);
    await db.delete(workerCredentialAllocations);
    await db.delete(messages);
    await db.delete(workers);
    await db.delete(runs);
    await db.delete(plans);
    await db.delete(settings);
  });

  it("resumes a missing worker when a saved session is available", async () => {
    const { runId, workerId } = await createImplementationRun();
    await db.update(workers).set({
      bridgeSessionId: "session-1",
    }).where(eq(workers.id, workerId));
    mockSpawnAgent.mockResolvedValue({
      name: workerId,
      type: "codex",
      cwd: process.cwd(),
      state: "working",
      sessionId: "session-2",
      sessionMode: "full-access",
      lastText: "",
      currentText: "",
      stderrBuffer: [],
      stopReason: null,
    });

    const result = await reconcileRunRecovery({ runId, liveAgents: [], source: "test" });

    expect(result.action).toBe("resume_session");
    expect(mockSpawnAgent).toHaveBeenCalledWith(expect.objectContaining({
      name: workerId,
      mode: "full-access",
      resumeSessionId: "session-1",
    }));
    const worker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    const incident = await db.select().from(recoveryIncidents).where(eq(recoveryIncidents.runId, runId)).get();
    expect(worker?.status).toBe("working");
    expect(worker?.bridgeSessionId).toBe("session-2");
    expect(incident?.status).toBe("resolved");
    expect(getNamedEventsSince(0, { runId }).events.map((entry) => entry.event)).toContainEqual(expect.objectContaining({
      kind: "worker.reattached",
      runId,
      workerId,
    }));
  });

  it("carries an auto-selected account into saved-session recovery", async () => {
    const { runId, workerId } = await createDirectRun();
    const accountId = `claude-recovery-${randomUUID()}`;
    const now = new Date(0);
    await db.insert(accounts).values({
      id: accountId,
      cliType: "claude",
      provider: "anthropic",
      type: "subscription",
      label: "Claude recovery account",
      authMode: "local_session",
      authRef: "local-session:claude",
      enabled: true,
      priority: 1,
      status: "available",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(workerCredentialAllocations).values({
      id: randomUUID(),
      runId,
      workerId,
      workerType: "claude",
      accountId,
      strategy: "priority",
      selectionReason: "selected highest-priority subscription account",
      explicit: false,
      createdAt: now,
      updatedAt: now,
    });
    await db.update(workers).set({
      bridgeSessionId: "session-direct-1",
    }).where(eq(workers.id, workerId));
    mockSpawnAgent.mockResolvedValue({
      name: workerId,
      type: "claude",
      cwd: process.cwd(),
      state: "idle",
      sessionId: "session-direct-2",
      sessionMode: "full-access",
      lastText: "",
      currentText: "",
      stderrBuffer: [],
      stopReason: null,
    });

    await reconcileRunRecovery({ runId, liveAgents: [], source: "test" });

    expect(mockSpawnAgent).toHaveBeenCalledWith(expect.objectContaining({
      accountId,
      resumeSessionId: "session-direct-1",
    }));
  });

  it("does not auto-resume a missing implementation worker while awaiting user input", async () => {
    const { runId, workerId } = await createImplementationRun();
    await db.update(runs).set({
      status: "awaiting_user",
    }).where(eq(runs.id, runId));
    await db.update(workers).set({
      bridgeSessionId: "session-paused-1",
    }).where(eq(workers.id, workerId));

    const result = await reconcileRunRecovery({ runId, liveAgents: [], source: "conversation-sync" });

    expect(result.action).toBe("none");
    expect(mockSpawnAgent).not.toHaveBeenCalled();
    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const worker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    const incident = await db.select().from(recoveryIncidents).where(eq(recoveryIncidents.runId, runId)).get();
    const events = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId));
    expect(run?.status).toBe("awaiting_user");
    expect(worker?.status).toBe("working");
    expect(incident).toBeUndefined();
    expect(events.some((event) => event.eventType === "recovery_paused_for_user")).toBe(true);
  });

  it("restarts implementation runs when a saved session is rejected by the bridge", async () => {
    const { runId, workerId } = await createImplementationRun();
    await db.update(workers).set({
      bridgeSessionId: "missing-session",
    }).where(eq(workers.id, workerId));
    mockSpawnAgent.mockRejectedValue(new Error('Spawn failed: failed to start gemini agent via gemini: {"code":-32603,"message":"Internal error","data":{"details":"Invalid session identifier \\"missing-session\\"."}}'));

    const result = await reconcileRunRecovery({ runId, liveAgents: [], source: "test" });

    expect(result.action).toBe("restart_from_checkpoint");
    expect(mockStartSupervisorRun).toHaveBeenCalledWith(runId);
    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const worker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    const incident = await db.select().from(recoveryIncidents).where(eq(recoveryIncidents.runId, runId)).get();
    expect(run?.status).toBe("running");
    expect(run?.lastError).toBeNull();
    expect(worker?.status).toBe("lost");
    expect(incident).toMatchObject({
      kind: "session_missing",
      status: "resolved",
      autoAttemptCount: 2,
    });
  });

  it("recreates the same implementation worker when Gemini cannot load the saved chat file", async () => {
    const { runId, workerId } = await createImplementationRun();
    await db.update(workers).set({
      bridgeSessionId: "corrupt-session",
      bridgeSessionMode: "full-access",
      type: "gemini",
    }).where(eq(workers.id, workerId));
    mockSpawnAgent
      .mockRejectedValueOnce(new Error('Spawn failed: failed to start gemini agent via gemini: {"code":-32603,"message":"Internal error","data":{"details":"Failed to initialize chat: Failed to load resumed session data from file"}}'))
      .mockResolvedValueOnce({
        name: workerId,
        type: "gemini",
        cwd: process.cwd(),
        state: "working",
        sessionId: "fresh-session",
        sessionMode: "full-access",
        lastText: "",
        currentText: "",
        stderrBuffer: [],
        stopReason: null,
      });

    const result = await reconcileRunRecovery({ runId, liveAgents: [], source: "test" });

    expect(result.action).toBe("resume_session");
    expect(mockSpawnAgent).toHaveBeenNthCalledWith(1, expect.objectContaining({
      name: workerId,
      resumeSessionId: "corrupt-session",
    }));
    expect(mockSpawnAgent).toHaveBeenNthCalledWith(2, expect.not.objectContaining({
      resumeSessionId: expect.any(String),
    }));
    const worker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    const events = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId));
    expect(worker?.status).toBe("working");
    expect(worker?.bridgeSessionId).toBe("fresh-session");
    expect(events.map((event) => event.eventType)).toEqual(expect.arrayContaining([
      "worker_session_missing",
      "worker_session_recreated",
    ]));
    expect(getNamedEventsSince(0, { runId }).events.map((entry) => entry.event)).toContainEqual(expect.objectContaining({
      kind: "worker.recreated",
      runId,
      workerId,
    }));
  });

  it("auto-resumes a missing direct worker with a saved session even after a queued steer failed", async () => {
    const { runId, workerId } = await createDirectRun();
    await db.insert(queuedConversationMessages).values({
      id: "queue-direct-1",
      runId,
      targetWorkerId: workerId,
      action: "steer",
      content: "Are you stuck",
      status: "failed",
      lastError: `Ask failed: Agent not found: ${workerId}`,
      createdAt: new Date(1),
      updatedAt: new Date(1),
      deliveredAt: null,
    });
    mockSpawnAgent.mockResolvedValue({
      name: workerId,
      type: "claude",
      cwd: process.cwd(),
      state: "idle",
      sessionId: "session-direct-2",
      sessionMode: "full-access",
      lastText: "",
      currentText: "",
      stderrBuffer: [],
      stopReason: null,
    });
    mockAskAgent.mockResolvedValue({
      state: "idle",
      response: "Finished the interrupted work.",
    });
    mockGetAgent.mockResolvedValue({
      name: workerId,
      type: "claude",
      cwd: process.cwd(),
      state: "idle",
      sessionId: "session-direct-2",
      sessionMode: "full-access",
      lastText: "Finished the interrupted work.",
      currentText: "",
      outputEntries: [{
        id: "recovered-response",
        type: "message",
        text: "Finished the interrupted work.",
        timestamp: new Date(2).toISOString(),
      }],
      stderrBuffer: [],
      stopReason: "end_turn",
    });

    const result = await reconcileRunRecovery({ runId, liveAgents: [], source: "test" });
    await waitForConversationBackgroundTasksForTests();

    expect(result.action).toBe("resume_session");
    expect(mockSpawnAgent).toHaveBeenCalledWith(expect.objectContaining({
      name: workerId,
      resumeSessionId: "session-direct-1",
    }));
    expect(mockAskAgent).toHaveBeenCalledWith(
      workerId,
      expect.stringContaining("Resume the interrupted task now"),
    );
    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const worker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    const incident = await db.select().from(recoveryIncidents).where(eq(recoveryIncidents.runId, runId)).get();
    expect(run?.status).toBe("done");
    expect(run?.lastError).toBeNull();
    expect(worker?.status).toBe("idle");
    expect(worker?.bridgeSessionId).toBe("session-direct-2");
    expect(incident).toMatchObject({
      kind: "session_missing",
      status: "resolved",
      queuedMessageId: "queue-direct-1",
    });
  });

  it("resumes a direct worker that was already parked as lost with its session intact", async () => {
    // Regression: the run latched here. `markNeedsUser` stamped the run
    // `needs_recovery` and the worker `lost`, which removed the worker from the
    // active scan, so every later tick re-derived `queue_blocked` and every
    // Resume click was a no-op — with a resumable session on the row the whole
    // time.
    const { runId, workerId } = await createDirectRun();
    await db.update(runs).set({
      status: "needs_recovery",
      lastError: "Queued message is blocked by a missing direct worker.",
    }).where(eq(runs.id, runId));
    await db.update(workers).set({ status: "lost", currentText: "" }).where(eq(workers.id, workerId));
    await db.insert(queuedConversationMessages).values({
      id: "queue-direct-latched",
      runId,
      targetWorkerId: workerId,
      action: "steer",
      content: "And also recover the session that is broken",
      status: "failed",
      lastError: `Ask failed: Agent not found: ${workerId}`,
      createdAt: new Date(1),
      updatedAt: new Date(1),
      deliveredAt: null,
    });
    mockSpawnAgent.mockResolvedValue({
      name: workerId,
      type: "claude",
      cwd: process.cwd(),
      state: "idle",
      sessionId: "session-direct-1",
      sessionMode: "full-access",
      lastText: "",
      currentText: "",
      stderrBuffer: [],
      stopReason: null,
    });
    mockAskAgent.mockResolvedValue({ state: "idle", response: "Picked the work back up." });
    mockGetAgent.mockResolvedValue({
      name: workerId,
      type: "claude",
      cwd: process.cwd(),
      state: "idle",
      sessionId: "session-direct-1",
      sessionMode: "full-access",
      lastText: "Picked the work back up.",
      currentText: "",
      outputEntries: [],
      stderrBuffer: [],
      stopReason: "end_turn",
    });

    const result = await reconcileRunRecovery({ runId, liveAgents: [], source: "test" });
    await waitForConversationBackgroundTasksForTests();

    expect(result.action).toBe("resume_session");
    expect(mockSpawnAgent).toHaveBeenCalledWith(expect.objectContaining({
      name: workerId,
      resumeSessionId: "session-direct-1",
    }));
    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    expect(run?.status).not.toBe("needs_recovery");
    expect(run?.lastError).toBeNull();
  });

  it("replaces a direct worker when the bridge rejects its saved session as not found", async () => {
    // The bridge rejects a dead session as "Resource not found: <sessionId>",
    // which the agent-missing matcher never covered, so a direct run whose
    // provider session had been deleted fell straight through to needs_user
    // with no action that could ever fix it.
    const { runId, workerId } = await createDirectRun();
    await db.insert(queuedConversationMessages).values({
      id: "queue-direct-rejected",
      runId,
      targetWorkerId: workerId,
      action: "steer",
      content: "And also recover the session that is broken",
      status: "failed",
      lastError: `Ask failed: Agent not found: ${workerId}`,
      createdAt: new Date(1),
      updatedAt: new Date(1),
      deliveredAt: null,
    });
    mockSpawnAgent.mockImplementation(async (params: { resumeSessionId?: string }) => {
      if (params.resumeSessionId) {
        throw new Error("failed to start claude agent via claude-agent-acp: Resource not found: session-direct-1");
      }
      return {
        name: workerId,
        type: "claude",
        cwd: process.cwd(),
        state: "idle",
        sessionId: "session-direct-replacement",
        sessionMode: "full-access",
        lastText: "",
        currentText: "",
        stderrBuffer: [],
        stopReason: null,
      };
    });

    const result = await reconcileRunRecovery({ runId, liveAgents: [], source: "test" });

    expect(result.action).toBe("restart_direct_worker");
    const worker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    const queued = await db.select().from(queuedConversationMessages)
      .where(eq(queuedConversationMessages.id, "queue-direct-rejected")).get();
    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    expect(worker?.bridgeSessionId).toBe("session-direct-replacement");
    expect(queued?.status).toBe("pending");
    expect(run?.status).toBe("running");
    expect(run?.lastError).toBeNull();
  });

  it("replaces a blocked direct worker and requeues its message when no session survives", async () => {
    const { runId, workerId } = await createDirectRun();
    await db.update(workers).set({
      status: "lost",
      bridgeSessionId: null,
      bridgeSessionMode: null,
    }).where(eq(workers.id, workerId));
    await db.insert(queuedConversationMessages).values({
      id: "queue-direct-no-session",
      runId,
      targetWorkerId: workerId,
      action: "steer",
      content: "Keep going please",
      status: "failed",
      lastError: `Ask failed: Agent not found: ${workerId}`,
      createdAt: new Date(1),
      updatedAt: new Date(1),
      deliveredAt: null,
    });
    mockSpawnAgent.mockResolvedValue({
      name: workerId,
      type: "claude",
      cwd: process.cwd(),
      state: "idle",
      sessionId: "session-direct-fresh",
      sessionMode: "full-access",
      lastText: "",
      currentText: "",
      stderrBuffer: [],
      stopReason: null,
    });

    const result = await reconcileRunRecovery({ runId, liveAgents: [], source: "test" });

    expect(result.action).toBe("restart_direct_worker");
    expect(mockSpawnAgent).toHaveBeenCalledWith(expect.not.objectContaining({
      resumeSessionId: expect.any(String),
    }));
    const worker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    const queued = await db.select().from(queuedConversationMessages)
      .where(eq(queuedConversationMessages.id, "queue-direct-no-session")).get();
    const incident = await db.select().from(recoveryIncidents).where(eq(recoveryIncidents.runId, runId)).get();
    expect(worker?.bridgeSessionId).toBe("session-direct-fresh");
    // The user's text must survive the worker swap.
    expect(queued?.status).toBe("pending");
    expect(queued?.lastError).toBeNull();
    expect(incident).toMatchObject({ kind: "queue_blocked", status: "resolved" });
  });

  it("retires a dead question when the resumed runtime owns a different question", async () => {
    const { runId, workerId } = await createDirectRun();
    const staleRequestId = 1785761272281;
    const liveRequestId = 1785790676826;
    await writeWorkerOutputEntries(runId, workerId, [{
      id: "question-before-runner-crash",
      type: "elicitation",
      text: "Please answer the original questions.",
      status: "pending",
      timestamp: new Date(1).toISOString(),
      raw: {
        requestId: staleRequestId,
        sessionId: "session-direct-1",
        toolCallId: "ask-before-crash",
        mode: "form",
        requestedSchema: { type: "object", properties: {} },
      },
    }]);

    const liveQuestionEntry = {
      id: "question-after-runner-restart",
      type: "elicitation" as const,
      text: "Please answer the replacement questions.",
      status: "pending",
      timestamp: new Date(2).toISOString(),
      raw: {
        requestId: liveRequestId,
        sessionId: "session-direct-2",
        toolCallId: "ask-after-restart",
        mode: "form",
        requestedSchema: { type: "object", properties: {} },
      },
    };
    mockSpawnAgent.mockResolvedValue({
      name: workerId,
      type: "claude",
      cwd: process.cwd(),
      state: "working",
      sessionId: "session-direct-2",
      sessionMode: "full-access",
      lastText: "Please answer the replacement questions.",
      currentText: "Please answer the replacement questions.",
      outputEntries: [liveQuestionEntry],
      pendingElicitations: [{
        requestId: liveRequestId,
        requestedAt: liveQuestionEntry.timestamp,
        sessionId: "session-direct-2",
        toolCallId: "ask-after-restart",
        mode: "form",
        requestedSchema: { type: "object", properties: {} },
      }],
      pendingPermissions: [],
      stderrBuffer: [],
      stopReason: null,
    });

    const result = await reconcileRunRecovery({ runId, liveAgents: [], source: "test" });
    const entries = await readWorkerOutputEntries(runId, workerId);
    const latestStatusByRequestId = new Map<number, string>();
    for (const entry of entries) {
      if (entry.type !== "elicitation" || typeof entry.raw !== "object" || entry.raw === null) continue;
      const requestId = (entry.raw as { requestId?: unknown }).requestId;
      if (typeof requestId === "number") latestStatusByRequestId.set(requestId, entry.status ?? "pending");
    }

    expect(result.action).toBe("resume_session");
    expect(latestStatusByRequestId.get(staleRequestId)).toBe("cancelled");
    expect(latestStatusByRequestId.get(liveRequestId)).toBe("pending");
    expect(getNamedEventsSince(0, { runId }).events.map((entry) => entry.event)).toContainEqual(expect.objectContaining({
      kind: "worker.human_input_reconciled",
      runId,
      workerId,
      interaction: "elicitation",
      closedRequestIds: [staleRequestId],
    }));
  });

  it("resolves the incident as soon as the session is back, not when the continuation turn ends", async () => {
    // The incident drives the "Recovering worker" banner. Holding it open for
    // the whole continuation turn made a healthy multi-minute turn look like a
    // backend that was still failing to restore the session.
    const { runId, workerId } = await createDirectRun();
    let releaseAsk: (value: { state: string; response: string }) => void = () => {};
    const askInFlight = new Promise<{ state: string; response: string }>((resolve) => {
      releaseAsk = resolve;
    });
    const resumedSnapshot = {
      name: workerId,
      type: "claude",
      cwd: process.cwd(),
      state: "idle",
      sessionId: "session-direct-2",
      sessionMode: "full-access",
      lastText: "",
      currentText: "",
      stderrBuffer: [],
      stopReason: null,
    };
    mockSpawnAgent.mockResolvedValue(resumedSnapshot);
    mockAskAgent.mockReturnValue(askInFlight);
    mockGetAgent.mockResolvedValue({
      ...resumedSnapshot,
      lastText: "Finished the interrupted work.",
      outputEntries: [{
        id: "recovered-response",
        type: "message",
        text: "Finished the interrupted work.",
        timestamp: new Date(2).toISOString(),
      }],
      stopReason: "end_turn",
    });

    await reconcileRunRecovery({ runId, liveAgents: [], source: "test" });
    // The continuation runs as a background task; let it reach the ask it is
    // about to block on, without letting that ask settle.
    for (let tick = 0; tick < 50 && mockAskAgent.mock.calls.length === 0; tick += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1));
    }

    const duringContinuation = await db.select().from(recoveryIncidents).where(eq(recoveryIncidents.runId, runId)).get();
    expect(mockAskAgent).toHaveBeenCalled();
    expect(duringContinuation?.status).toBe("resolved");
    expect(duringContinuation?.resolvedAt).not.toBeNull();
    // The turn itself is still running, and ordinary progress UI covers that.
    const workerDuringContinuation = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    expect(workerDuringContinuation?.status).toBe("working");

    releaseAsk({ state: "idle", response: "Finished the interrupted work." });
    await waitForConversationBackgroundTasksForTests();

    const afterContinuation = await db.select().from(recoveryIncidents).where(eq(recoveryIncidents.runId, runId)).get();
    expect(afterContinuation?.status).toBe("resolved");
    const worker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    expect(worker?.status).toBe("idle");
  });

  it("settles the worker's other unsettled incidents when its session comes back", async () => {
    // Incidents are keyed by (run, kind, worker, queuedMessageId), so the same
    // worker failing twice with different queued-message context leaves two
    // rows. Resolving only the row this attempt opened left the earlier
    // needs_user incident driving a "Needs recovery" banner over a worker that
    // had just been restored.
    const { runId, workerId } = await createDirectRun();
    await db.insert(recoveryIncidents).values({
      id: "incident-stale",
      runId,
      workerId,
      queuedMessageId: null,
      kind: "session_missing",
      status: "needs_user",
      autoAttemptCount: 1,
      lastError: `Ask failed: Agent not found: ${workerId}`,
      details: JSON.stringify({ continuationFailed: true }),
      detectedAt: new Date(1),
      updatedAt: new Date(1),
      resolvedAt: null,
    });
    await db.insert(queuedConversationMessages).values({
      id: "queue-stale-1",
      runId,
      targetWorkerId: workerId,
      action: "steer",
      content: "Deploy already",
      status: "failed",
      lastError: `Ask failed: Agent not found: ${workerId}`,
      createdAt: new Date(1),
      updatedAt: new Date(1),
      deliveredAt: null,
    });
    const resumedSnapshot = {
      name: workerId,
      type: "claude",
      cwd: process.cwd(),
      state: "idle",
      sessionId: "session-direct-2",
      sessionMode: "full-access",
      lastText: "",
      currentText: "",
      stderrBuffer: [],
      stopReason: null,
    };
    mockSpawnAgent.mockResolvedValue(resumedSnapshot);
    mockAskAgent.mockResolvedValue({ state: "idle", response: "Deployed." });
    mockGetAgent.mockResolvedValue({ ...resumedSnapshot, stopReason: "end_turn" });

    await reconcileRunRecovery({ runId, liveAgents: [], source: "test" });
    await waitForConversationBackgroundTasksForTests();

    const incidents = await db.select().from(recoveryIncidents).where(eq(recoveryIncidents.runId, runId));
    expect(incidents.length).toBeGreaterThan(1);
    expect(incidents.every((incident) => incident.status === "resolved")).toBe(true);
  });

  it("reopens a resolved incident when the continuation turn fails outright", async () => {
    const { runId, workerId } = await createDirectRun();
    mockSpawnAgent.mockResolvedValue({
      name: workerId,
      type: "claude",
      cwd: process.cwd(),
      state: "idle",
      sessionId: "session-direct-2",
      sessionMode: "full-access",
      lastText: "",
      currentText: "",
      stderrBuffer: [],
      stopReason: null,
    });
    mockAskAgent.mockRejectedValue(new Error("Ask failed: Internal error: worker exploded"));
    mockGetAgent.mockResolvedValue(null);

    await reconcileRunRecovery({ runId, liveAgents: [], source: "test" });
    await waitForConversationBackgroundTasksForTests();

    const incident = await db.select().from(recoveryIncidents).where(eq(recoveryIncidents.runId, runId)).get();
    expect(incident?.status).toBe("needs_user");
    // A reopened incident must not still carry a resolution stamp.
    expect(incident?.resolvedAt).toBeNull();
    expect(incident?.lastError).toContain("worker exploded");
  });

  it("restarts implementation runs from the latest checkpoint when no saved session exists", async () => {
    const { runId, workerId } = await createImplementationRun();
    await db.insert(queuedConversationMessages).values({
      id: "queue-1",
      runId,
      targetWorkerId: workerId,
      action: "steer",
      content: "Also fix the padding",
      status: "failed",
      lastError: `Ask failed: Agent not found: ${workerId}`,
      createdAt: new Date(1),
      updatedAt: new Date(1),
      deliveredAt: null,
    });

    const result = await reconcileRunRecovery({ runId, liveAgents: [], source: "test" });

    expect(result.action).toBe("restart_from_checkpoint");
    expect(mockStartSupervisorRun).toHaveBeenCalledWith(runId);
    const worker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    const runMessages = await db.select().from(messages).where(eq(messages.runId, runId));
    const queued = await db.select().from(queuedConversationMessages).where(eq(queuedConversationMessages.id, "queue-1")).get();
    const incident = await db.select().from(recoveryIncidents).where(eq(recoveryIncidents.runId, runId)).get();
    expect(worker?.status).toBe("lost");
    expect(queued?.status).toBe("delivered");
    expect(runMessages.some((message) => message.content === "Also fix the padding")).toBe(true);
    expect(incident?.status).toBe("resolved");
  });

  it("moves exhausted recovery to needs_recovery", async () => {
    const { runId, workerId } = await createImplementationRun();
    await db.insert(settings).values({
      key: "RECOVERY_POLICY",
      value: JSON.stringify({ maxAutoAttemptsPerIncident: 1 }),
      updatedAt: new Date(),
    });
    await db.insert(recoveryIncidents).values({
      id: randomUUID(),
      runId,
      workerId,
      queuedMessageId: null,
      kind: "worker_lost",
      status: "open",
      autoAttemptCount: 1,
      lastError: null,
      details: null,
      detectedAt: new Date(0),
      updatedAt: new Date(0),
      resolvedAt: null,
    });
    await reconcileRunRecovery({ runId, liveAgents: [], source: "test" });

    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const incident = await db.select().from(recoveryIncidents).where(eq(recoveryIncidents.runId, runId)).get();
    expect(run?.status).toBe("needs_recovery");
    expect(incident?.status).toBe("needs_user");
  });

  it("does not append duplicate needs-user events while a run is already awaiting manual recovery", async () => {
    const { runId, workerId } = await createImplementationRun();
    await db.update(runs).set({
      status: "needs_recovery",
      lastError: "This run needs manual recovery before it can continue.",
    }).where(eq(runs.id, runId));
    await db.insert(recoveryIncidents).values({
      id: randomUUID(),
      runId,
      workerId,
      queuedMessageId: null,
      kind: "worker_lost",
      status: "needs_user",
      autoAttemptCount: 0,
      lastError: "This run needs manual recovery before it can continue.",
      details: JSON.stringify({
        recoveryState: "needs_recovery",
        recommendedAction: "manual_resume",
      }),
      detectedAt: new Date(0),
      updatedAt: new Date(0),
      resolvedAt: null,
    });

    await reconcileRunRecovery({ runId, liveAgents: [], source: "test" });
    await reconcileRunRecovery({ runId, liveAgents: [], source: "test" });

    const needsUserEvents = await db.select().from(executionEvents).where(eq(executionEvents.eventType, "recovery_needs_user"));
    const incident = await db.select().from(recoveryIncidents).where(eq(recoveryIncidents.runId, runId)).get();
    expect(needsUserEvents).toHaveLength(0);
    expect(incident?.status).toBe("needs_user");
    expect(incident?.lastError).toBe("This run needs manual recovery before it can continue.");
  });
});
