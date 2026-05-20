import { randomUUID } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { executionEvents, messages, plans, queuedConversationMessages, recoveryIncidents, runs, settings, workers } from "@/server/db/schema";

const { mockSpawnAgent, mockStartSupervisorRun } = vi.hoisted(() => ({
  mockSpawnAgent: vi.fn(),
  mockStartSupervisorRun: vi.fn(),
}));

vi.mock("@/server/bridge-client", () => ({
  spawnAgent: mockSpawnAgent,
}));

vi.mock("@/server/supervisor/start", () => ({
  startSupervisorRun: mockStartSupervisorRun,
}));

import { reconcileRunRecovery } from "@/server/runs/recovery-reconciler";

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
    mockSpawnAgent.mockReset();
    mockStartSupervisorRun.mockReset();
    await db.delete(recoveryIncidents);
    await db.delete(executionEvents);
    await db.delete(queuedConversationMessages);
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

    const result = await reconcileRunRecovery({ runId, liveAgents: [], source: "test" });

    expect(result.action).toBe("resume_session");
    expect(mockSpawnAgent).toHaveBeenCalledWith(expect.objectContaining({
      name: workerId,
      resumeSessionId: "session-direct-1",
    }));
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
