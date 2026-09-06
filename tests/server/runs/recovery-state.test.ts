import { describe, expect, it } from "vitest";
import { classifyRunRecoveryState } from "@/server/runs/recovery-state";

const run = {
  id: "run-1",
  mode: "implementation",
  status: "running",
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

const userMessage = {
  id: "message-1",
  runId: run.id,
  role: "user",
  createdAt: new Date(0),
};

describe("classifyRunRecoveryState", () => {
  it("keeps active workers healthy when a live bridge agent exists", () => {
    const state = classifyRunRecoveryState({
      run,
      workers: [{ id: "worker-1", runId: run.id, status: "working", updatedAt: new Date(0) }],
      liveAgents: [{ name: "worker-1", state: "working" }],
      messages: [userMessage],
      nowMs: 60_000,
    });

    expect(state.kind).toBe("healthy");
  });

  it("classifies missing active workers with saved sessions as resumable", () => {
    const state = classifyRunRecoveryState({
      run,
      workers: [{
        id: "worker-1",
        runId: run.id,
        status: "working",
        bridgeSessionId: "session-1",
        updatedAt: new Date(0),
      }],
      liveAgents: [],
      messages: [userMessage],
      nowMs: 60_000,
    });

    expect(state).toMatchObject({
      kind: "lost_worker_resumable",
      workerId: "worker-1",
      sessionId: "session-1",
      recommendedAction: "resume_session",
    });
  });

  it("classifies quota-waiting runs as intentionally paused for quota reset", () => {
    const resumeAt = "2026-05-10T18:00:01.000Z";
    const state = classifyRunRecoveryState({
      run: {
        ...run,
        status: "quota_waiting",
        quotaResumeAt: resumeAt,
        quotaResetSource: "relative-duration",
        quotaResetConfidence: "high",
      },
      workers: [],
      liveAgents: [],
      messages: [userMessage],
      nowMs: 60_000,
    });

    expect(state).toMatchObject({
      kind: "quota_waiting",
      status: "open",
      recommendedAction: "wait_for_quota_reset",
      resumeAt,
      quotaResetSource: "relative-duration",
      quotaResetConfidence: "high",
    });
  });

  it("classifies missing implementation workers without sessions as rerunnable", () => {
    const state = classifyRunRecoveryState({
      run,
      workers: [{ id: "worker-1", runId: run.id, status: "working", updatedAt: new Date(0) }],
      liveAgents: [],
      messages: [userMessage],
      nowMs: 60_000,
    });

    expect(state).toMatchObject({
      kind: "lost_worker_rerunnable",
      workerId: "worker-1",
      recommendedAction: "restart_from_checkpoint",
    });
  });

  it("keeps freshly transitioned active workers out of recovery during grace window", () => {
    const state = classifyRunRecoveryState({
      run,
      workers: [{
        id: "worker-1",
        runId: run.id,
        status: "working",
        bridgeSessionId: "session-1",
        updatedAt: new Date(55_000),
      }],
      liveAgents: [],
      messages: [userMessage],
      nowMs: 60_000,
    });

    expect(state.kind).toBe("healthy");
  });

  it("keeps fresh starting workers out of recovery", () => {
    const state = classifyRunRecoveryState({
      run,
      workers: [{ id: "worker-1", runId: run.id, status: "starting", updatedAt: new Date(50_000) }],
      liveAgents: [],
      messages: [userMessage],
      nowMs: 60_000,
    });

    expect(state.kind).toBe("healthy");
  });

  it("classifies blocked direct queued messages as needing recovery", () => {
    const state = classifyRunRecoveryState({
      run: { ...run, mode: "direct" },
      workers: [],
      liveAgents: [],
      messages: [userMessage],
      queuedMessages: [{
        id: "queue-1",
        runId: run.id,
        targetWorkerId: "worker-1",
        status: "failed",
        lastError: "Worker recovery in progress.",
      }],
      nowMs: 60_000,
    });

    expect(state).toMatchObject({
      kind: "queue_blocked",
      queuedMessageId: "queue-1",
      recommendedAction: "manual_resume",
    });
  });

  it("still sees the saved session after the blocked worker was parked as lost", () => {
    // `markNeedsUser` parks the worker as `lost`, which is not an active
    // status. That used to hide the saved session from every later tick, so a
    // direct run latched on `queue_blocked` with a resumable session unused.
    const state = classifyRunRecoveryState({
      run: { ...run, mode: "direct" },
      workers: [{
        id: "worker-1",
        runId: run.id,
        status: "lost",
        bridgeSessionId: "session-1",
        updatedAt: new Date(0),
      }],
      liveAgents: [],
      messages: [userMessage],
      queuedMessages: [{
        id: "queue-1",
        runId: run.id,
        targetWorkerId: "worker-1",
        status: "failed",
        lastError: "Ask failed: Agent not found: worker-1",
      }],
      nowMs: 60_000,
    });

    expect(state).toMatchObject({
      kind: "lost_worker_resumable",
      workerId: "worker-1",
      queuedMessageId: "queue-1",
      sessionId: "session-1",
      recommendedAction: "resume_session",
    });
  });

  it("surfaces a resumable session even after the run was stamped needs_recovery", () => {
    const state = classifyRunRecoveryState({
      run: { ...run, mode: "direct", status: "needs_recovery" },
      workers: [{
        id: "worker-1",
        runId: run.id,
        status: "lost",
        bridgeSessionId: "session-1",
        updatedAt: new Date(0),
      }],
      liveAgents: [],
      messages: [userMessage],
      queuedMessages: [{
        id: "queue-1",
        runId: run.id,
        targetWorkerId: "worker-1",
        status: "failed",
        lastError: "Ask failed: Agent not found: worker-1",
      }],
      nowMs: 60_000,
    });

    expect(state).toMatchObject({
      kind: "lost_worker_resumable",
      sessionId: "session-1",
    });
  });

  it("keeps parking a needs_recovery run that has no saved session", () => {
    const state = classifyRunRecoveryState({
      run: { ...run, mode: "direct", status: "needs_recovery" },
      workers: [{ id: "worker-1", runId: run.id, status: "lost", updatedAt: new Date(0) }],
      liveAgents: [],
      messages: [userMessage],
      nowMs: 60_000,
    });

    expect(state.kind).toBe("needs_recovery");
  });

  it("never classifies a persisted lost direct worker without session metadata as healthy", () => {
    const state = classifyRunRecoveryState({
      run: { ...run, mode: "direct", status: "running" },
      workers: [{ id: "worker-1", runId: run.id, status: "lost", updatedAt: new Date(0) }],
      liveAgents: [],
      messages: [userMessage],
      nowMs: 60_000,
    });

    expect(state).toMatchObject({
      kind: "needs_recovery",
      status: "needs_user",
      workerId: "worker-1",
      recommendedAction: "manual_resume",
    });
  });

  it("prefers direct worker session recovery over a blocked queued message", () => {
    const state = classifyRunRecoveryState({
      run: { ...run, mode: "direct" },
      workers: [{
        id: "worker-1",
        runId: run.id,
        status: "working",
        bridgeSessionId: "session-1",
        updatedAt: new Date(0),
      }],
      liveAgents: [],
      messages: [userMessage],
      queuedMessages: [{
        id: "queue-1",
        runId: run.id,
        targetWorkerId: "worker-1",
        status: "failed",
        lastError: "Ask failed: Agent not found: worker-1",
      }],
      nowMs: 60_000,
    });

    expect(state).toMatchObject({
      kind: "lost_worker_resumable",
      workerId: "worker-1",
      queuedMessageId: "queue-1",
      sessionId: "session-1",
      recommendedAction: "resume_session",
    });
  });

  it("ignores a blocked queued message whose target worker is live again", () => {
    const state = classifyRunRecoveryState({
      run: { ...run, mode: "direct" },
      workers: [{
        id: "worker-1",
        runId: run.id,
        status: "working",
        bridgeSessionId: "session-1",
        updatedAt: new Date(0),
      }],
      liveAgents: [{ name: "worker-1", state: "working" }],
      messages: [userMessage],
      queuedMessages: [{
        id: "queue-1",
        runId: run.id,
        targetWorkerId: "worker-1",
        status: "failed",
        lastError: "Ask failed: Agent not found: worker-1",
      }],
      nowMs: 60_000,
    });

    expect(state.kind).toBe("healthy");
  });
});
