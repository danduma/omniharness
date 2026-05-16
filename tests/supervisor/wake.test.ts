import { randomUUID } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, like } from "drizzle-orm";
import { db } from "@/server/db";
import { executionEvents, messages, plans, recoveryIncidents, runs, settings, supervisorInterventions, supervisorScheduledWakes, workers } from "@/server/db/schema";
import { resetDurableSupervisorWakeSchedulerForTests } from "@/server/supervisor/wake-schedule";

const { mockAskAgent, mockGetAgent, mockSpawnAgent, mockSupervisorRun, mockStopRunObserver } = vi.hoisted(() => ({
  mockAskAgent: vi.fn(),
  mockGetAgent: vi.fn(),
  mockSpawnAgent: vi.fn(),
  mockSupervisorRun: vi.fn(),
  mockStopRunObserver: vi.fn(),
}));

vi.mock("@/server/supervisor", () => ({
  Supervisor: class {
    run() {
      return mockSupervisorRun();
    }
  },
}));

vi.mock("@/server/supervisor/observer", () => ({
  stopRunObserver: mockStopRunObserver,
}));

vi.mock("@/server/bridge-client", () => ({
  askAgent: mockAskAgent,
  getAgent: mockGetAgent,
  spawnAgent: mockSpawnAgent,
}));

import { cancelSupervisorWake, executeSupervisorWake } from "@/server/supervisor/wake";

describe("executeSupervisorWake", () => {
  beforeEach(async () => {
    vi.useRealTimers();
    mockAskAgent.mockReset();
    mockGetAgent.mockReset();
    mockSpawnAgent.mockReset();
    mockSupervisorRun.mockReset();
    mockStopRunObserver.mockReset();
    resetDurableSupervisorWakeSchedulerForTests();
    await db.delete(supervisorScheduledWakes);
    await db.delete(supervisorInterventions);
    await db.delete(executionEvents);
    await db.delete(messages);
    await db.delete(recoveryIncidents);
    await db.delete(workers);
    await db.delete(runs);
    await db.delete(plans);
    await db.delete(settings).where(like(settings.key, "SUPERVISOR_WAKE_LEASE:%"));
  });

  afterEach(() => {
    resetDurableSupervisorWakeSchedulerForTests();
    vi.useRealTimers();
  });

  it("keeps an implementation run active when supervisor execution hits a retryable bridge reset", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const now = new Date();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/test-plan.md",
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

    mockSupervisorRun.mockRejectedValue(Object.assign(
      new Error("Get agent failed: fetch failed"),
      { cause: Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" }) },
    ));

    await executeSupervisorWake(runId);
    cancelSupervisorWake(runId);

    const persistedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const runMessages = await db.select().from(messages).where(eq(messages.runId, runId));

    expect(persistedRun?.status).toBe("running");
    expect(persistedRun?.lastError).toBeNull();
    expect(runMessages.some((message) => message.kind === "error")).toBe(false);
    expect(mockStopRunObserver).not.toHaveBeenCalled();
  });

  it("retries a wake when an active persisted lease temporarily blocks acquisition", async () => {
    vi.useFakeTimers();
    const planId = randomUUID();
    const runId = randomUUID();
    const now = new Date();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/test-plan.md",
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
    await db.insert(settings).values({
      key: `SUPERVISOR_WAKE_LEASE:${runId}`,
      value: JSON.stringify({ leaseId: randomUUID(), expiresAt: Date.now() + 900_000 }),
      updatedAt: now,
    });

    mockSupervisorRun.mockResolvedValue({ state: "completed" });

    await executeSupervisorWake(runId);

    expect(mockSupervisorRun).not.toHaveBeenCalled();

    await db.delete(settings).where(eq(settings.key, `SUPERVISOR_WAKE_LEASE:${runId}`));
    await vi.advanceTimersByTimeAsync(1_000);
    cancelSupervisorWake(runId);

    expect(mockSupervisorRun).toHaveBeenCalledTimes(1);
  });

  it("persists wait wakeups so supervisor heartbeats survive reloads", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const now = new Date();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/test-plan.md",
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

    mockSupervisorRun.mockResolvedValue({ state: "wait", delayMs: 5_000 });

    await executeSupervisorWake(runId);
    await vi.waitFor(async () => {
      const durableWake = await db.select().from(supervisorScheduledWakes).where(eq(supervisorScheduledWakes.runId, runId)).get();
      expect(durableWake).toMatchObject({
        runId,
        reason: "supervisor_wait",
        source: "volatile-wake-backup",
      });
    });

    cancelSupervisorWake(runId);
  });

  it("resumes quota-exhausted workers from saved sessions before running the supervisor after a quota wake", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const incidentId = randomUUID();
    const runIncidentId = randomUUID();
    const now = new Date();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/quota-resume.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "implementation",
      status: "quota_waiting",
      preferredWorkerModel: "gpt-5.5",
      preferredWorkerEffort: "medium",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "codex",
      status: "cred-exhausted",
      cwd: process.cwd(),
      outputLog: "",
      bridgeSessionId: "saved-session-1",
      bridgeSessionMode: "full-access",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(recoveryIncidents).values({
      id: incidentId,
      runId,
      workerId,
      queuedMessageId: null,
      kind: "quota_exhausted",
      status: "open",
      autoAttemptCount: 0,
      lastError: "usage limit",
      details: JSON.stringify({
        recoveryState: "quota_waiting",
        recommendedAction: "wait_for_quota_reset",
        resumeAt: now.toISOString(),
      }),
      detectedAt: now,
      updatedAt: now,
      resolvedAt: null,
    });
    await db.insert(recoveryIncidents).values({
      id: runIncidentId,
      runId,
      workerId: null,
      queuedMessageId: null,
      kind: "quota_exhausted",
      status: "open",
      autoAttemptCount: 0,
      lastError: null,
      details: JSON.stringify({
        source: "conversation-sync",
        recoveryState: "quota_waiting",
        recommendedAction: "wait_for_quota_reset",
      }),
      detectedAt: now,
      updatedAt: now,
      resolvedAt: null,
    });
    await db.insert(supervisorScheduledWakes).values({
      runId,
      wakeAt: new Date(now.getTime() - 1_000),
      reason: "quota_wait",
      source: "time-of-day",
      incidentId,
      details: JSON.stringify({ incidentId }),
      createdAt: now,
      updatedAt: now,
    });

    mockSpawnAgent.mockResolvedValue({
      name: workerId,
      type: "codex",
      cwd: process.cwd(),
      state: "idle",
      sessionId: "saved-session-1",
      sessionMode: "full-access",
      currentText: "",
      lastText: "",
      pendingPermissions: [],
      stderrBuffer: [],
      stopReason: null,
    });
    mockAskAgent.mockResolvedValue({
      name: workerId,
      state: "idle",
      stopReason: null,
      response: "Resumed and continued the implementation.",
    });
    mockSupervisorRun.mockResolvedValue({ state: "wait", delayMs: 5_000 });

    await executeSupervisorWake(runId);
    cancelSupervisorWake(runId);

    expect(mockSpawnAgent).toHaveBeenCalledWith({
      type: "codex",
      cwd: process.cwd(),
      name: workerId,
      mode: "full-access",
      model: "gpt-5.5",
      effort: "medium",
      env: {},
      resumeSessionId: "saved-session-1",
    });
    expect(mockAskAgent).toHaveBeenCalledWith(
      workerId,
      expect.stringContaining("Continue the interrupted work"),
    );
    expect(mockSupervisorRun).toHaveBeenCalledTimes(1);

    const worker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    const events = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId));
    const incidents = await db.select().from(recoveryIncidents).where(eq(recoveryIncidents.runId, runId));
    const interventions = await db.select().from(supervisorInterventions).where(eq(supervisorInterventions.runId, runId));
    expect(worker?.status).toBe("idle");
    expect(worker?.outputLog).toContain("Resumed and continued the implementation.");
    expect(incidents.every((incident) => incident.status === "resolved")).toBe(true);
    expect(interventions).toHaveLength(1);
    expect(interventions[0]?.interventionType).toBe("recovery");
    expect(events.some((event) => event.eventType === "worker_session_resumed")).toBe(true);
    expect(events.some((event) => event.eventType === "worker_prompted")).toBe(true);
    expect(events.some((event) => event.eventType === "run_failed")).toBe(false);
  });

  it("breaks an orphaned lease when an idle worker already produced completion evidence", async () => {
    vi.useFakeTimers();
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = randomUUID();
    const now = new Date();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/test-plan.md",
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
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "codex",
      status: "idle",
      cwd: process.cwd(),
      outputLog: "",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(executionEvents).values({
      id: randomUUID(),
      runId,
      workerId,
      eventType: "worker_turn_completed",
      details: JSON.stringify({ summary: "Worker completed and verified the requested work." }),
      createdAt: now,
    });
    await db.insert(settings).values({
      key: `SUPERVISOR_WAKE_LEASE:${runId}`,
      value: JSON.stringify({ leaseId: randomUUID(), expiresAt: Date.now() + 900_000 }),
      updatedAt: now,
    });

    mockSupervisorRun.mockResolvedValue({ state: "completed" });

    await executeSupervisorWake(runId);
    expect(mockSupervisorRun).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(0);

    expect(mockSupervisorRun).toHaveBeenCalledTimes(1);
    const recoveryEvent = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId));
    expect(recoveryEvent.some((event) => event.eventType === "supervisor_wake_lease_recovered")).toBe(true);

    cancelSupervisorWake(runId);
  });

  it("does not break an active lease from a worker idle event alone", async () => {
    vi.useFakeTimers();
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = randomUUID();
    const now = new Date();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/test-plan.md",
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
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "codex",
      status: "idle",
      cwd: process.cwd(),
      outputLog: "",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(executionEvents).values({
      id: randomUUID(),
      runId,
      workerId,
      eventType: "worker_idle",
      details: JSON.stringify({ summary: "Worker has been idle for 30 seconds." }),
      createdAt: now,
    });
    await db.insert(settings).values({
      key: `SUPERVISOR_WAKE_LEASE:${runId}`,
      value: JSON.stringify({ leaseId: randomUUID(), expiresAt: Date.now() + 900_000 }),
      updatedAt: now,
    });

    mockSupervisorRun.mockResolvedValue({ state: "completed" });

    await executeSupervisorWake(runId);
    await vi.advanceTimersByTimeAsync(0);

    const events = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId));
    expect(mockSupervisorRun).not.toHaveBeenCalled();
    expect(events.some((event) => event.eventType === "supervisor_wake_lease_recovered")).toBe(false);

    cancelSupervisorWake(runId);
  });
});
