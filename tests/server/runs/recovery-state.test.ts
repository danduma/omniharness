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
        lastError: "Ask failed: Agent not found: worker-1",
      }],
      nowMs: 60_000,
    });

    expect(state).toMatchObject({
      kind: "queue_blocked",
      queuedMessageId: "queue-1",
      recommendedAction: "manual_resume",
    });
  });
});
