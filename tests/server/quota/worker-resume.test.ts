import { randomUUID } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
  executionEvents,
  plans,
  recoveryIncidents,
  runs,
  supervisorInterventions,
  supervisorScheduledWakes,
  workers,
} from "@/server/db/schema";
import { readWorkerOutputEntries } from "@/server/workers/output-store";

const now = new Date("2026-05-10T10:00:00.000Z");

const { mockAskAgent, mockGetAgent, mockSpawnAgent } = vi.hoisted(() => ({
  mockAskAgent: vi.fn(),
  mockGetAgent: vi.fn(),
  mockSpawnAgent: vi.fn(),
}));

vi.mock("@/server/bridge-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/bridge-client")>();
  return {
    ...actual,
    askAgent: mockAskAgent,
    getAgent: mockGetAgent,
    spawnAgent: mockSpawnAgent,
  };
});

import { resumeElapsedQuotaWaits, resumeQuotaExhaustedWorkers } from "@/server/quota/worker-resume";

function agentSnapshot(workerId: string, state: string) {
  return {
    name: workerId,
    type: "claude",
    cwd: "/tmp",
    state,
    sessionId: "session-1",
    sessionMode: "full-access",
    currentText: "",
    lastText: "",
    renderedOutput: "",
    outputEntries: [],
    pendingElicitations: [],
    pendingPermissions: [],
    stderrBuffer: [],
    stopReason: null,
  };
}

async function insertRunWithQuotaIncident() {
  const planId = randomUUID();
  const runId = randomUUID();
  const workerId = `${runId}-worker-1`;
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
    mode: "direct",
    status: "quota_waiting",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(workers).values({
    id: workerId,
    runId,
    type: "claude",
    status: "quota_waiting",
    cwd: "/tmp",
    workerNumber: 1,
    outputLog: "",
    outputEntriesJson: "[]",
    currentText: "",
    lastText: "",
    bridgeSessionId: "session-1",
    bridgeSessionMode: "full-access",
    createdAt: now,
    updatedAt: now,
  });
  const incidentId = randomUUID();
  await db.insert(recoveryIncidents).values({
    id: incidentId,
    runId,
    workerId,
    kind: "quota_exhausted",
    status: "open",
    autoAttemptCount: 0,
    details: JSON.stringify({ recoveryState: "quota_waiting" }),
    detectedAt: now,
    updatedAt: now,
  });
  const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
  return { runId, workerId, incidentId, run: run! };
}

describe("resumeQuotaExhaustedWorkers", () => {
  beforeEach(async () => {
    mockAskAgent.mockReset();
    mockAskAgent.mockResolvedValue({ response: "Resumed.", state: "idle" });
    mockGetAgent.mockReset();
    mockSpawnAgent.mockReset();
    await db.delete(executionEvents);
    await db.delete(supervisorInterventions);
    await db.delete(supervisorScheduledWakes);
    await db.delete(recoveryIncidents);
    await db.delete(workers);
    await db.delete(runs);
    await db.delete(plans);
  });

  it("resolves the quota incident as soon as the session resumes, without waiting for the resume turn", async () => {
    // Regression: the resolve was sequenced after `promptResumedQuotaWorker`,
    // which awaits a full agent turn. The incident stayed `open` — and the
    // "Waiting for quota reset" banner stayed up — for the entire turn, while
    // the worker was already visibly working.
    const { runId, workerId, incidentId, run } = await insertRunWithQuotaIncident();
    mockSpawnAgent.mockResolvedValue(agentSnapshot(workerId, "idle"));
    mockGetAgent.mockResolvedValue(agentSnapshot(workerId, "idle"));

    // A resume turn that is still in flight, standing in for real work.
    let releaseAsk: (value: { response: string; state: string }) => void = () => {};
    mockAskAgent.mockImplementationOnce(() => new Promise((resolve) => {
      releaseAsk = resolve;
    }));

    const resume = resumeQuotaExhaustedWorkers({ run });

    await vi.waitFor(() => {
      expect(mockAskAgent).toHaveBeenCalledTimes(1);
    });
    await vi.waitFor(async () => {
      const incident = await db
        .select()
        .from(recoveryIncidents)
        .where(eq(recoveryIncidents.id, incidentId))
        .get();
      expect(incident?.status).toBe("resolved");
    });
    // The banner is already gone while the resume turn is still running.

    releaseAsk({ response: "Resumed.", state: "idle" });
    await expect(resume).resolves.toMatchObject({ state: "resumed", resumedCount: 1 });

    const incident = await db
      .select()
      .from(recoveryIncidents)
      .where(eq(recoveryIncidents.id, incidentId))
      .get();
    expect(incident?.resolvedAt).not.toBeNull();
    expect(await db.select().from(workers).where(eq(workers.runId, runId)).get()).toBeDefined();
  });

  it("anchors the quota resume prompt before the resumed turn starts", async () => {
    const { runId, workerId, run } = await insertRunWithQuotaIncident();
    mockSpawnAgent.mockResolvedValue(agentSnapshot(workerId, "idle"));
    mockGetAgent.mockResolvedValue(agentSnapshot(workerId, "idle"));

    let entriesAtAskStart: Awaited<ReturnType<typeof readWorkerOutputEntries>> = [];
    mockAskAgent.mockImplementationOnce(async () => {
      entriesAtAskStart = await readWorkerOutputEntries(runId, workerId);
      return { response: "Resumed.", state: "idle" };
    });

    await expect(resumeQuotaExhaustedWorkers({ run })).resolves.toMatchObject({
      state: "resumed",
      resumedCount: 1,
    });

    expect(entriesAtAskStart.map((entry) => entry.type)).toContain("supervisor_input");
    expect(entriesAtAskStart.find((entry) => entry.type === "supervisor_input")?.text).toContain(
      "Continue the interrupted work now that the quota wait has cleared.",
    );
  });

  it("reopens a quota incident when the resume prompt proves quota is still exhausted", async () => {
    // Resolving early is only safe because a still-closed quota window is
    // reported by the ask and reopens a fresh incident.
    const { runId, workerId, incidentId, run } = await insertRunWithQuotaIncident();
    mockSpawnAgent.mockResolvedValue(agentSnapshot(workerId, "idle"));
    mockGetAgent.mockResolvedValue(agentSnapshot(workerId, "idle"));
    mockAskAgent.mockRejectedValueOnce(
      new Error("Ask failed: Internal error: You've hit your session limit · resets 10pm (Europe/Madrid)"),
    );

    await resumeQuotaExhaustedWorkers({ run });

    const incidents = await db
      .select()
      .from(recoveryIncidents)
      .where(eq(recoveryIncidents.runId, runId));
    const original = incidents.find((incident) => incident.id === incidentId);
    const reopened = incidents.filter((incident) => (
      incident.id !== incidentId && incident.kind === "quota_exhausted"
    ));

    expect(original?.status).toBe("resolved");
    expect(reopened).toHaveLength(1);
    expect(reopened[0]?.status).toBe("open");
    expect(reopened[0]?.workerId).toBe(workerId);
  });

  it("claims a quota incident before resuming so concurrent wakes only reattach once", async () => {
    const { runId, workerId, run } = await insertRunWithQuotaIncident();
    const spawnResolvers: Array<(value: ReturnType<typeof agentSnapshot>) => void> = [];
    mockSpawnAgent.mockImplementation(() => new Promise((resolve) => {
      spawnResolvers.push(resolve);
    }));
    mockGetAgent.mockResolvedValue(agentSnapshot(workerId, "idle"));

    const first = resumeQuotaExhaustedWorkers({ run });
    await vi.waitFor(() => expect(mockSpawnAgent).toHaveBeenCalledTimes(1));

    const second = resumeQuotaExhaustedWorkers({ run });
    await vi.waitFor(() => expect(mockSpawnAgent).toHaveBeenCalledTimes(1));

    for (const resolve of spawnResolvers) {
      resolve(agentSnapshot(workerId, "idle"));
    }
    await expect(Promise.all([first, second])).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ state: "resumed", resumedCount: 1 }),
      expect.objectContaining({ state: "none", resumedCount: 0 }),
    ]));
    expect(await db.select().from(workers).where(eq(workers.runId, runId))).toHaveLength(1);
  });

  it("parks a non-quota resume failure for the user instead of failing the run", async () => {
    const { runId, workerId, incidentId, run } = await insertRunWithQuotaIncident();
    mockSpawnAgent.mockResolvedValue(agentSnapshot(workerId, "idle"));
    mockGetAgent.mockResolvedValue(agentSnapshot(workerId, "idle"));
    mockAskAgent.mockRejectedValueOnce(
      new Error("Ask failed: Internal error: [ede_diagnostic] result_type=user last_content_type=n/a stop_reason=null"),
    );

    await expect(resumeQuotaExhaustedWorkers({ run })).resolves.toMatchObject({
      state: "needs_recovery",
      runId,
      incidentId,
    });

    const persistedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const persistedWorker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    const incident = await db.select().from(recoveryIncidents).where(eq(recoveryIncidents.id, incidentId)).get();
    const events = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId));

    expect(persistedRun?.status).toBe("needs_recovery");
    expect(persistedRun?.lastError).toContain("ede_diagnostic");
    expect(persistedWorker?.status).toBe("error");
    expect(incident?.status).toBe("needs_user");
    expect(events.some((event) => event.eventType === "quota_resume_failed")).toBe(true);
  });
});

describe("resumeElapsedQuotaWaits", () => {
  beforeEach(async () => {
    mockAskAgent.mockReset();
    mockAskAgent.mockResolvedValue({ response: "Resumed.", state: "idle" });
    mockGetAgent.mockReset();
    mockSpawnAgent.mockReset();
    await db.delete(executionEvents);
    await db.delete(supervisorInterventions);
    await db.delete(supervisorScheduledWakes);
    await db.delete(recoveryIncidents);
    await db.delete(workers);
    await db.delete(runs);
    await db.delete(plans);
  });

  async function setElapsedIncident(incidentId: string, resumeAt: Date) {
    await db.update(recoveryIncidents).set({
      details: JSON.stringify({ recoveryState: "quota_waiting", resumeAt: resumeAt.toISOString() }),
    }).where(eq(recoveryIncidents.id, incidentId));
  }

  it("resumes a direct run whose quota wake was consumed without resuming it", async () => {
    // Regression: the durable wake row is deleted by `claimDueDurableSupervisorWake`
    // *before* the handler checks whether it can act. When conversation sync had
    // already rewritten `runs.status` from `quota_waiting` to `running`, the wake
    // handler bailed with `run_not_runnable` — the wake row was gone, nothing
    // rescheduled it, and the conversation hung with a cred-exhausted worker.
    const { runId, workerId, incidentId } = await insertRunWithQuotaIncident();
    await db.update(runs).set({ status: "running" }).where(eq(runs.id, runId));
    await db.update(workers).set({ status: "cred-exhausted" }).where(eq(workers.id, workerId));
    await setElapsedIncident(incidentId, new Date(now.getTime() - 60_000));
    mockSpawnAgent.mockResolvedValue(agentSnapshot(workerId, "idle"));
    mockGetAgent.mockResolvedValue(agentSnapshot(workerId, "idle"));

    await expect(resumeElapsedQuotaWaits({ now })).resolves.toEqual({ sweptCount: 1, clearedCount: 0 });

    expect(mockSpawnAgent).toHaveBeenCalledWith(expect.objectContaining({
      name: workerId,
      resumeSessionId: "session-1",
    }));
    const incident = await db.select().from(recoveryIncidents).where(eq(recoveryIncidents.id, incidentId)).get();
    const events = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId));
    expect(incident?.status).toBe("resolved");
    expect(events.some((event) => event.eventType === "quota_wait_swept")).toBe(true);
    expect(events.some((event) => event.eventType === "worker_session_resumed")).toBe(true);
  });

  it("clears a stale incident without waking a conversation whose worker already recovered", async () => {
    // Two of these were found in the wild: the worker came back on a later
    // turn but the incident was never resolved, so the conversation read
    // `done` with a "waiting for quota reset" banner stuck on it. Resuming
    // those would start unrequested work in a conversation the user finished.
    const { runId, workerId, incidentId } = await insertRunWithQuotaIncident();
    await db.update(runs).set({ status: "done" }).where(eq(runs.id, runId));
    await db.update(workers).set({ status: "idle" }).where(eq(workers.id, workerId));
    await setElapsedIncident(incidentId, new Date(now.getTime() - 60_000));

    await expect(resumeElapsedQuotaWaits({ now })).resolves.toEqual({ sweptCount: 0, clearedCount: 1 });

    expect(mockSpawnAgent).not.toHaveBeenCalled();
    expect(mockAskAgent).not.toHaveBeenCalled();
    const incident = await db.select().from(recoveryIncidents).where(eq(recoveryIncidents.id, incidentId)).get();
    const persistedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    expect(incident?.status).toBe("resolved");
    // The finished conversation is left exactly as the user left it.
    expect(persistedRun?.status).toBe("done");
  });

  it("leaves a run alone while its quota reset is still in the future", async () => {
    const { incidentId } = await insertRunWithQuotaIncident();
    await setElapsedIncident(incidentId, new Date(now.getTime() + 60_000));

    await expect(resumeElapsedQuotaWaits({ now })).resolves.toEqual({ sweptCount: 0, clearedCount: 0 });
    expect(mockSpawnAgent).not.toHaveBeenCalled();
  });

  it("defers to a scheduled wake that has not fired yet", async () => {
    const { runId, incidentId } = await insertRunWithQuotaIncident();
    await setElapsedIncident(incidentId, new Date(now.getTime() - 60_000));
    await db.insert(supervisorScheduledWakes).values({
      runId,
      wakeAt: new Date(now.getTime() + 60_000),
      reason: "quota_wait",
      source: "time-of-day",
      incidentId,
      details: null,
      createdAt: now,
      updatedAt: now,
    });

    await expect(resumeElapsedQuotaWaits({ now })).resolves.toEqual({ sweptCount: 0, clearedCount: 0 });
    expect(mockSpawnAgent).not.toHaveBeenCalled();
  });

  it("re-arms a due wake for a stranded implementation run instead of resuming it directly", async () => {
    // The watchdog loop skips `quota_waiting` implementation runs, so a lost
    // wake strands them the same way. Hand them back to the normal wake
    // handler rather than duplicating the resume logic here.
    const { runId, incidentId } = await insertRunWithQuotaIncident();
    await db.update(runs).set({ mode: "implementation", status: "quota_waiting" }).where(eq(runs.id, runId));
    await setElapsedIncident(incidentId, new Date(now.getTime() - 60_000));

    await expect(resumeElapsedQuotaWaits({ now })).resolves.toEqual({ sweptCount: 1, clearedCount: 0 });

    expect(mockSpawnAgent).not.toHaveBeenCalled();
    const wake = await db.select().from(supervisorScheduledWakes).where(eq(supervisorScheduledWakes.runId, runId)).get();
    expect(wake?.reason).toBe("quota_wait");
    expect(wake?.wakeAt.getTime()).toBe(now.getTime());
  });

  it("leaves an implementation run alone once it is no longer parked on quota", async () => {
    // Guards the convergence argument: after the wake handler runs, the run
    // moves out of `quota_waiting`, so the sweep must stop re-arming it.
    const { runId, incidentId } = await insertRunWithQuotaIncident();
    await db.update(runs).set({ mode: "implementation", status: "running" }).where(eq(runs.id, runId));
    await setElapsedIncident(incidentId, new Date(now.getTime() - 60_000));

    await expect(resumeElapsedQuotaWaits({ now })).resolves.toEqual({ sweptCount: 0, clearedCount: 0 });
    expect(await db.select().from(supervisorScheduledWakes).where(eq(supervisorScheduledWakes.runId, runId)).get())
      .toBeUndefined();
  });
});
