import { randomUUID } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { clarifications, conversationReadMarkers, creditEvents, executionEvents, messages, planItems, planningReviewFindings, planningReviewRounds, planningReviewRuns, plans, processSessions, queuedConversationMessages, recoveryIncidents, runs, settings, supervisorInterventions, supervisorScheduledWakes, workerAssignments, workerCounters, workers } from "@/server/db/schema";
import { getEventStreamNotificationVersion } from "@/server/events/live-updates";
import { readWorkerOutputEntries } from "@/server/workers/output-store";
import { waitForConversationBackgroundTasksForTests } from "@/server/conversations/worker-turn-gate";
import { annotateVerifiedDeadCredential } from "@/lib/provider-account-failures";

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

import { syncConversationSessions as syncConversationSessionsUnsettled } from "@/server/conversations/sync";

/**
 * Queue drains run as background tasks: the drain executes a full worker turn,
 * and awaiting one inline would park the serialized sync chain for its whole
 * duration (a deadlock when the turn blocks on a mid-turn elicitation). Tests
 * assert on drain effects, so settle the background work before returning.
 */
async function syncConversationSessions(
  ...args: Parameters<typeof syncConversationSessionsUnsettled>
) {
  const result = await syncConversationSessionsUnsettled(...args);
  await waitForConversationBackgroundTasksForTests();
  return result;
}

describe("syncConversationSessions", () => {
  beforeEach(async () => {
    // Never let a straggling drain from the previous test observe (or mutate)
    // the next test's fixtures.
    await waitForConversationBackgroundTasksForTests();
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

  it("preserves a verified-dead credential verdict when a restarted bridge reports the raw auth error", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const now = new Date(0);
    const rawProviderError = "Internal error: Failed to authenticate. API Error: 401 OAuth access token has been revoked.";
    const verifiedFailure = annotateVerifiedDeadCredential(rawProviderError, "claude-sub-1");

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/revoked-credential-restart.md",
      status: "failed",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      status: "failed",
      title: "Revoked credential restart",
      lastError: verifiedFailure,
      failedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "claude",
      status: "error",
      cwd: process.cwd(),
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: rawProviderError,
      lastText: rawProviderError,
      lastError: rawProviderError,
      workerNumber: 1,
      createdAt: now,
      updatedAt: now,
    });

    await syncConversationSessions([{
      name: workerId,
      type: "claude",
      cwd: process.cwd(),
      state: "error",
      sessionId: "revoked-session",
      sessionMode: "full-access",
      currentText: rawProviderError,
      lastText: rawProviderError,
      renderedOutput: rawProviderError,
      outputEntries: [],
      pendingPermissions: [],
      pendingElicitations: [],
      stderrBuffer: [],
      stopReason: null,
      lastError: rawProviderError,
    }], { selectedRunId: runId });

    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    expect(run?.status).toBe("failed");
    expect(run?.lastError).toBe(verifiedFailure);
  });

  it("preserves a verified credential verdict when a restarted bridge reports a generic session error", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const now = new Date(0);
    const rawProviderError = "Internal error: Failed to authenticate. API Error: 401 OAuth access token has been revoked.";
    const verifiedFailure = annotateVerifiedDeadCredential(rawProviderError, "claude-sub-1");
    const bridgeError = "The Claude bridge session closed unexpectedly.";

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/revoked-credential-generic-restart.md",
      status: "failed",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      status: "failed",
      title: "Revoked credential generic restart",
      lastError: verifiedFailure,
      failedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "claude",
      status: "error",
      cwd: process.cwd(),
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: bridgeError,
      lastText: bridgeError,
      workerNumber: 1,
      createdAt: now,
      updatedAt: now,
    });

    await syncConversationSessions([{
      name: workerId,
      type: "claude",
      cwd: process.cwd(),
      state: "error",
      sessionId: "generic-restart-session",
      sessionMode: "full-access",
      currentText: bridgeError,
      lastText: bridgeError,
      renderedOutput: bridgeError,
      outputEntries: [],
      pendingPermissions: [],
      pendingElicitations: [],
      stderrBuffer: [],
      stopReason: null,
      lastError: bridgeError,
    }], { selectedRunId: runId });

    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    expect(run?.lastError).toBe(annotateVerifiedDeadCredential(bridgeError, "claude-sub-1"));
  });

  it("repairs a legacy raw auth error from the persisted dead-credential verification event", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const now = new Date(0);
    const rawProviderError = "Internal error: Failed to authenticate. API Error: 401 OAuth access token has been revoked.";

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/revoked-credential-legacy-repair.md",
      status: "failed",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      status: "failed",
      title: "Legacy revoked credential restart",
      lastError: rawProviderError,
      failedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "claude",
      status: "error",
      cwd: process.cwd(),
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: rawProviderError,
      lastText: rawProviderError,
      lastError: rawProviderError,
      workerNumber: 1,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(executionEvents).values({
      id: randomUUID(),
      runId,
      workerId,
      eventType: "worker_credential_verified",
      details: JSON.stringify({
        accountId: "claude-sub-1",
        liveness: "dead",
        detail: "Probe request was rejected: 401 OAuth access token has been revoked.",
      }),
      createdAt: now,
    });

    await syncConversationSessions([{
      name: workerId,
      type: "claude",
      cwd: process.cwd(),
      state: "error",
      sessionId: "legacy-revoked-session",
      sessionMode: "full-access",
      currentText: rawProviderError,
      lastText: rawProviderError,
      renderedOutput: rawProviderError,
      outputEntries: [],
      pendingPermissions: [],
      pendingElicitations: [],
      stderrBuffer: [],
      stopReason: null,
      lastError: rawProviderError,
    }], { selectedRunId: runId });

    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    expect(run?.lastError).toBe(annotateVerifiedDeadCredential(rawProviderError, "claude-sub-1"));
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
    await waitForConversationBackgroundTasksForTests();

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
    expect(mockAskAgent).toHaveBeenCalledWith(
      workerId,
      expect.stringContaining("Resume the interrupted task now"),
    );
    expect(mockStartSupervisorRun).not.toHaveBeenCalled();
  });

  it("preserves direct quota waits even when the bridge still reports a live worker", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const now = new Date();
    const resumeAt = new Date(now.getTime() + 60 * 60_000);

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/direct-quota.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      status: "running",
      lastError: "stale failure",
      title: "Direct quota wait",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "claude",
      status: "cred-exhausted",
      cwd: process.cwd(),
      bridgeSessionId: "claude-session-1",
      bridgeSessionMode: "full-access",
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "You've hit your session limit · resets 10:40am (Europe/Madrid)",
      lastText: "You've hit your session limit · resets 10:40am (Europe/Madrid)",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(recoveryIncidents).values({
      id: randomUUID(),
      runId,
      workerId,
      queuedMessageId: null,
      kind: "quota_exhausted",
      status: "open",
      autoAttemptCount: 0,
      lastError: "session limit",
      details: JSON.stringify({
        recoveryState: "quota_waiting",
        recommendedAction: "wait_for_quota_reset",
        resumeAt: resumeAt.toISOString(),
      }),
      detectedAt: now,
      updatedAt: now,
      resolvedAt: null,
    });

    await syncConversationSessions([{
      name: workerId,
      type: "claude",
      cwd: process.cwd(),
      state: "working",
      sessionId: "claude-session-1",
      sessionMode: "full-access",
      currentText: "still live",
      lastText: "",
      renderedOutput: "",
      outputEntries: [],
      pendingPermissions: [],
      pendingElicitations: [],
      stderrBuffer: [],
      stopReason: null,
      lastError: null,
    }], { selectedRunId: runId });

    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const worker = await db.select().from(workers).where(eq(workers.id, workerId)).get();

    expect(run?.status).toBe("quota_waiting");
    expect(run?.lastError).toBeNull();
    expect(worker?.status).toBe("cred-exhausted");
    expect(worker?.currentText).toContain("session limit");
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

  it("keeps a selected lost direct worker in one unresolved recovery incident across syncs", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const old = new Date(0);

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/lost-direct.md",
      status: "running",
      createdAt: old,
      updatedAt: old,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      status: "running",
      title: "Lost direct worker",
      createdAt: old,
      updatedAt: old,
    });
    await db.insert(messages).values({
      id: randomUUID(),
      runId,
      role: "user",
      kind: "checkpoint",
      content: "Finish the original request",
      createdAt: old,
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "claude",
      status: "lost",
      cwd: process.cwd(),
      bridgeSessionId: null,
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "",
      workerNumber: 1,
      createdAt: old,
      updatedAt: old,
    });

    await syncConversationSessions([], { selectedRunId: runId });
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

  it("opens one incident when a background sync sees a lost direct worker before selection", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const old = new Date(0);

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/background-lost-direct.md",
      status: "running",
      createdAt: old,
      updatedAt: old,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      status: "running",
      title: "Background lost direct worker",
      createdAt: old,
      updatedAt: old,
    });
    await db.insert(messages).values({
      id: randomUUID(),
      runId,
      role: "user",
      kind: "checkpoint",
      content: "Finish the original request",
      createdAt: old,
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "claude",
      status: "lost",
      cwd: process.cwd(),
      bridgeSessionId: null,
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "",
      workerNumber: 1,
      createdAt: old,
      updatedAt: old,
    });

    await syncConversationSessions([]);
    await syncConversationSessions([], { selectedRunId: runId });

    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const incidents = await db.select().from(recoveryIncidents).where(eq(recoveryIncidents.runId, runId));
    expect(run?.status).toBe("needs_recovery");
    expect(incidents).toHaveLength(1);
    expect(incidents[0]).toMatchObject({
      workerId,
      kind: "worker_lost",
      status: "needs_user",
    });
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
    await waitForConversationBackgroundTasksForTests();

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
    expect(mockAskAgent).toHaveBeenCalledWith(
      activeWorkerId,
      expect.stringContaining("Resume the interrupted task now"),
    );
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

  it("does not rewrite an unchanged direct worker that is still awaiting the same elicitation", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const originalUpdatedAt = new Date("2026-07-11T10:00:00.000Z");
    const question = "Which niche can you reach first?";

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/direct-elicitation-noop.md",
      status: "running",
      createdAt: originalUpdatedAt,
      updatedAt: originalUpdatedAt,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      status: "awaiting_user",
      title: "Direct elicitation no-op",
      createdAt: originalUpdatedAt,
      updatedAt: originalUpdatedAt,
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
      createdAt: originalUpdatedAt,
      updatedAt: originalUpdatedAt,
    });

    await syncConversationSessions([{
      name: workerId,
      type: "claude",
      cwd: process.cwd(),
      state: "working",
      sessionId: "elicitation-session",
      sessionMode: "full-access",
      currentText: question,
      lastText: question,
      renderedOutput: question,
      outputEntries: [],
      pendingElicitations: [{
        requestId: 2,
        requestedAt: originalUpdatedAt.toISOString(),
        sessionId: "elicitation-session",
        toolCallId: "ask-tool",
        message: question,
        requestedSchema: { type: "object", properties: {} },
      }],
      pendingPermissions: [],
      stderrBuffer: [],
      stopReason: null,
    }], { selectedRunId: runId });

    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const worker = await db.select().from(workers).where(eq(workers.id, workerId)).get();

    expect(run?.status).toBe("awaiting_user");
    expect(run?.updatedAt).toEqual(originalUpdatedAt);
    expect(worker?.status).toBe("working");
    expect(worker?.updatedAt).toEqual(originalUpdatedAt);
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

  it("clears stale recovery incidents when a worker starts working again", async () => {
    // Safety net for the whole bug family: recovery bookkeeping is otherwise
    // only written when a turn *ends*, so any path that opens an incident and
    // then awaits a full turn leaves the banner up for the turn's duration —
    // or forever. A worker that begins a new working period has disproved
    // anything recorded before it.
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const now = new Date(0);

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/stale-incident-sweep.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      status: "running",
      title: "Stale incident sweep",
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
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "Previous turn.",
      workerNumber: 1,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(recoveryIncidents).values({
      id: "stale-quota-incident",
      runId,
      workerId,
      kind: "quota_exhausted",
      status: "open",
      autoAttemptCount: 0,
      details: JSON.stringify({ recoveryState: "quota_waiting" }),
      detectedAt: now,
      updatedAt: now,
    });

    await syncConversationSessions([
      {
        name: workerId,
        type: "claude",
        cwd: process.cwd(),
        state: "working",
        sessionId: "sweep-session",
        sessionMode: "full-access",
        currentText: "Back at it.",
        lastText: "Previous turn.",
        renderedOutput: "Back at it.",
        outputEntries: [
          {
            id: "resumed-work",
            type: "message",
            text: "Back at it.",
            status: "pending",
            timestamp: new Date(now.getTime() + 1).toISOString(),
          },
        ],
        pendingElicitations: [],
        stderrBuffer: [],
        stopReason: null,
      },
    ], { selectedRunId: runId });

    const incident = await db
      .select()
      .from(recoveryIncidents)
      .where(eq(recoveryIncidents.id, "stale-quota-incident"))
      .get();
    expect(incident?.status).toBe("resolved");
    expect(incident?.resolvedAt).not.toBeNull();
  });

  it("clears a stale incident on a worker that was already working when sync looked", async () => {
    // The transition-gated version of this sweep could not fire here. Recovery
    // restores a worker by writing `working` to the row itself, so by the time
    // the live sync runs there is no idle→working edge left to catch, and an
    // incident the resume had already disproved kept the "Needs recovery"
    // banner up over a healthy agent for the rest of the turn.
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const now = new Date(0);

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/already-working-sweep.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      status: "running",
      title: "Already working sweep",
      createdAt: now,
      updatedAt: now,
    });
    // Recovery already put the worker back to `working`; its period began at 10.
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "claude",
      status: "working",
      cwd: process.cwd(),
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "Deploying.",
      lastText: "",
      workerNumber: 1,
      activeWorkStartedAt: new Date(now.getTime() + 10_000),
      createdAt: now,
      updatedAt: new Date(now.getTime() + 10_000),
    });
    await db.insert(recoveryIncidents).values({
      id: "orphaned-incident",
      runId,
      workerId,
      kind: "session_missing",
      status: "needs_user",
      autoAttemptCount: 1,
      lastError: `Ask failed: Agent not found: ${workerId}`,
      details: JSON.stringify({ continuationFailed: true }),
      detectedAt: new Date(now.getTime() + 5_000),
      updatedAt: new Date(now.getTime() + 5_000),
    });

    await syncConversationSessions([
      {
        name: workerId,
        type: "claude",
        cwd: process.cwd(),
        state: "working",
        sessionId: "recovered-session",
        sessionMode: "full-access",
        currentText: "Deploying.",
        lastText: "",
        renderedOutput: "Deploying.",
        outputEntries: [
          {
            id: "deploying",
            type: "message",
            text: "Deploying.",
            status: "pending",
            timestamp: new Date(now.getTime() + 11_000).toISOString(),
          },
        ],
        pendingElicitations: [],
        stderrBuffer: [],
        stopReason: null,
      },
    ], { selectedRunId: runId });

    const incident = await db
      .select()
      .from(recoveryIncidents)
      .where(eq(recoveryIncidents.id, "orphaned-incident"))
      .get();
    expect(incident?.status).toBe("resolved");
    expect(incident?.resolvedAt).not.toBeNull();
  });

  it("keeps an incident raised during the current working period", async () => {
    // The fence that stops the sweep from flapping: it only fires on the
    // transition into `working`, so an incident opened while the worker is
    // already working survives and its banner stays up.
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const now = new Date(0);

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/incident-during-work.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      status: "running",
      title: "Incident during work",
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
      currentText: "Working.",
      lastText: "",
      workerNumber: 1,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(recoveryIncidents).values({
      id: "live-incident",
      runId,
      workerId,
      kind: "queue_blocked",
      status: "needs_user",
      autoAttemptCount: 0,
      details: JSON.stringify({ recoveryState: "needs_recovery" }),
      detectedAt: new Date(now.getTime() + 5_000),
      updatedAt: new Date(now.getTime() + 5_000),
    });

    await syncConversationSessions([
      {
        name: workerId,
        type: "claude",
        cwd: process.cwd(),
        state: "working",
        sessionId: "live-session",
        sessionMode: "full-access",
        currentText: "Still working.",
        lastText: "",
        renderedOutput: "Still working.",
        outputEntries: [
          {
            id: "ongoing",
            type: "message",
            text: "Still working.",
            status: "pending",
            timestamp: new Date(now.getTime() + 6_000).toISOString(),
          },
        ],
        pendingElicitations: [],
        stderrBuffer: [],
        stopReason: null,
      },
    ], { selectedRunId: runId });

    const incident = await db
      .select()
      .from(recoveryIncidents)
      .where(eq(recoveryIncidents.id, "live-incident"))
      .get();
    expect(incident?.status).toBe("needs_user");
    expect(incident?.resolvedAt).toBeNull();
  });

  it("does not park the sync pass on a queued turn that blocks mid-delivery", async () => {
    // Regression: the drain was awaited inline, so a delivered turn held the
    // serialized sync chain for its whole duration. When the agent raised an
    // elicitation mid-turn that deadlocked — `askAgent` cannot resolve until
    // the question is answered, and the question only reaches the client
    // through the snapshot writes of the sync pass that is stuck waiting on
    // that same turn. The conversation froze with no prompt, no output and no
    // question, while the worker sat at `working` forever.
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const now = new Date(0);

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/direct-blocking-drain.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      status: "awaiting_user",
      title: "Direct blocking drain",
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
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "Done with the previous turn.",
      workerNumber: 1,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(queuedConversationMessages).values({
      id: "queued-blocking-turn",
      runId,
      targetWorkerId: workerId,
      action: "queue",
      status: "pending",
      content: "handle the follow-up",
      attachmentsJson: "[]",
      createdAt: new Date(now.getTime() + 1),
      updatedAt: new Date(now.getTime() + 1),
    });

    // A turn that never resolves on its own, standing in for one blocked on a
    // mid-turn elicitation.
    let releaseAsk: (value: { response: string; state: string }) => void = () => {};
    mockAskAgent.mockImplementationOnce(() => new Promise((resolve) => {
      releaseAsk = resolve;
    }));

    // The assertion is that this resolves at all: if the drain is awaited
    // inline the sync pass never returns and the test times out.
    await syncConversationSessionsUnsettled([
      {
        name: workerId,
        type: "claude",
        cwd: process.cwd(),
        state: "idle",
        sessionId: "blocking-session",
        sessionMode: "full-access",
        currentText: "",
        lastText: "Done with the previous turn.",
        renderedOutput: "Done with the previous turn.",
        outputEntries: [
          {
            id: "previous-turn",
            type: "message",
            text: "Done with the previous turn.",
            status: "completed",
            timestamp: new Date(now.getTime() + 2).toISOString(),
          },
        ],
        pendingElicitations: [],
        stderrBuffer: [],
        stopReason: "end_turn",
      },
    ], { selectedRunId: runId });

    // Sync returned while the turn is still running; the delivery continues on
    // a background task.
    await vi.waitFor(() => expect(mockAskAgent).toHaveBeenCalledTimes(1));

    // The prompt is anchored while the turn is still in flight, so the user
    // can see what the worker was handed instead of a bare spinner.
    const entriesDuringTurn = await readWorkerOutputEntries(runId, workerId);
    expect(entriesDuringTurn.filter((entry) => entry.type === "user_input")).toEqual([
      expect.objectContaining({ text: "handle the follow-up" }),
    ]);

    releaseAsk({ response: "Follow-up handled.", state: "idle" });
    await waitForConversationBackgroundTasksForTests();

    const queued = await db
      .select()
      .from(queuedConversationMessages)
      .where(eq(queuedConversationMessages.id, "queued-blocking-turn"))
      .get();
    expect(queued?.status).toBe("delivered");
  });

  it("redelivers a queued answer as a normal prompt when the elicitation is already gone", async () => {
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
    mockRespondElicitation.mockRejectedValue(new Error("Respond elicitation failed: no_pending_elicitations"));

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

    // Closing the stale elicitation is intentionally detached; generation-
    // fenced stream persistence can outlive the first sync promise before the
    // replacement delivery is registered as a tracked background turn.
    await vi.waitFor(() => expect(mockAskAgent).toHaveBeenCalledWith(
      workerId,
      expect.stringContaining("answer the pending direct question"),
    ));
    await waitForConversationBackgroundTasksForTests();

    const queued = await db.select().from(queuedConversationMessages).where(eq(queuedConversationMessages.id, "queued-already-answered")).get();
    const storedMessages = await db.select().from(messages).where(eq(messages.runId, runId));
    const entries = await readWorkerOutputEntries(runId, workerId);

    expect(mockRespondElicitation).toHaveBeenCalledWith(workerId, {
      action: "accept",
      content: { customAnswer: "answer the pending direct question" },
    });
    // The elicitation is gone, but the user's answer must not be. Losing it
    // here is silent data loss: the row goes to `failed` and the text the user
    // typed never reaches the worker by any route.
    expect(mockAskAgent).toHaveBeenCalledWith(
      workerId,
      expect.stringContaining("answer the pending direct question"),
    );
    expect(queued?.status).toBe("delivered");
    expect(queued?.lastError).toBeNull();
    expect(storedMessages).toHaveLength(1);
    expect(entries.filter((entry) => entry.type === "user_input")).toHaveLength(1);
    // The stale stream row is closed too, so the answered card stops coming
    // back on the next poll.
    expect(entries.filter((entry) => entry.type === "elicitation" && entry.status === "cancelled")).toHaveLength(1);
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

  it("drains a message queued in the same beat that the run reached a terminal state", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const now = new Date(0);
    const answered = "Here is the finished answer.";
    const queuedContent = "one more thing before you go";

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/terminal-run-pending-queue.md",
      status: "done",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      status: "done",
      title: "Terminal direct with a stranded queue row",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "claude",
      status: "idle",
      cwd: process.cwd(),
      outputLog: answered,
      outputEntriesJson: "[]",
      currentText: "",
      lastText: answered,
      workerNumber: 1,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(queuedConversationMessages).values({
      id: "queued-after-terminal",
      runId,
      targetWorkerId: workerId,
      action: "queue",
      status: "pending",
      content: queuedContent,
      attachmentsJson: "[]",
      createdAt: new Date(now.getTime() + 1),
      updatedAt: new Date(now.getTime() + 1),
    });

    // No `selectedRunId`: the pre-existing terminal-run escape hatch only
    // covered the selected run with a still-streaming agent, so a queue row
    // sitting behind an idle agent had no route out at all.
    await syncConversationSessions([
      {
        name: workerId,
        type: "claude",
        cwd: process.cwd(),
        state: "idle",
        sessionId: "terminal-queue-session",
        sessionMode: "full-access",
        currentText: "",
        lastText: answered,
        renderedOutput: answered,
        outputEntries: [
          {
            id: "message-1",
            type: "message",
            text: answered,
            timestamp: new Date(now.getTime()).toISOString(),
          },
        ],
        stderrBuffer: [],
        stopReason: "end_turn",
      },
    ]);

    const queued = await db
      .select()
      .from(queuedConversationMessages)
      .where(eq(queuedConversationMessages.id, "queued-after-terminal"))
      .get();

    expect(mockAskAgent).toHaveBeenCalledWith(
      workerId,
      expect.stringContaining(queuedContent),
    );
    expect(queued?.status).toBe("delivered");
    expect(queued?.deliveredAt).not.toBeNull();
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
