import { describe, expect, it } from "vitest";
import { applyRunRecoveryOptimisticUpdate, type RecoverableConversationState } from "@/lib/run-recovery-state";

describe("applyRunRecoveryOptimisticUpdate", () => {
  it("clears stale failures, truncates downstream state, and archives existing workers while rerunning", () => {
    const state: RecoverableConversationState = {
      runs: [
        {
          id: "run-1",
          status: "failed",
          lastError: "Old bridge error",
          failedAt: "2026-04-23T10:01:00.000Z",
        },
      ],
      messages: [
        {
          id: "message-1",
          runId: "run-1",
          role: "user",
          content: "Original prompt",
          createdAt: "2026-04-23T10:00:00.000Z",
        },
        {
          id: "message-2",
          runId: "run-1",
          role: "system",
          kind: "error",
          content: "Run failed: Old bridge error",
          createdAt: "2026-04-23T10:01:00.000Z",
        },
      ],
      workers: [
        { id: "worker-1", runId: "run-1", type: "codex", status: "error" },
        { id: "worker-2", runId: "run-1", type: "claude", status: "working" },
      ],
      agents: [
        { name: "worker-1", state: "error", lastError: "Old bridge error" },
        { name: "worker-2", state: "working", currentText: "Still running" },
      ],
      clarifications: [{ id: "clarification-1", runId: "run-1" }],
      validationRuns: [{ id: "validation-1", runId: "run-1" }],
      executionEvents: [
        { id: "event-1", runId: "run-1", workerId: "worker-1", eventType: "worker_error" },
        { id: "event-2", runId: "run-1", eventType: "run_failed" },
      ],
      supervisorInterventions: [{ id: "intervention-1", runId: "run-1" }],
      queuedMessages: [
        { id: "queued-1", runId: "run-1" },
        { id: "queued-2", runId: "run-2" },
      ],
    };

    const nextState = applyRunRecoveryOptimisticUpdate(state, {
      runId: "run-1",
      action: "retry",
      targetMessageId: "message-1",
    });

    expect(nextState.runs).toEqual([
      {
        id: "run-1",
        status: "running",
        lastError: null,
        failedAt: null,
      },
    ]);
    expect(nextState.messages).toEqual([state.messages[0]]);
    expect(nextState.workers).toEqual([
      { id: "worker-1", runId: "run-1", type: "codex", status: "cancelled" },
      { id: "worker-2", runId: "run-1", type: "claude", status: "cancelled" },
    ]);
    expect(nextState.agents).toEqual([]);
    expect(nextState.clarifications).toEqual([]);
    expect(nextState.validationRuns).toEqual([]);
    expect(nextState.executionEvents).toEqual([]);
    expect(nextState.supervisorInterventions).toEqual([]);
    expect(nextState.queuedMessages).toEqual([{ id: "queued-2", runId: "run-2" }]);
  });

  it("updates the checkpoint content when rerunning from an edited user message", () => {
    const state: RecoverableConversationState = {
      runs: [{ id: "run-1", status: "failed", lastError: "Old bridge error", failedAt: "2026-04-23T10:01:00.000Z" }],
      messages: [
        {
          id: "message-1",
          runId: "run-1",
          role: "user",
          content: "Original prompt",
          createdAt: "2026-04-23T10:00:00.000Z",
        },
      ],
      workers: [],
      agents: [],
      clarifications: [],
      validationRuns: [],
      executionEvents: [],
      supervisorInterventions: [],
    };

    const nextState = applyRunRecoveryOptimisticUpdate(state, {
      runId: "run-1",
      action: "edit",
      targetMessageId: "message-1",
      content: "Updated prompt",
    });

    expect(nextState.messages).toEqual([
      {
        id: "message-1",
        runId: "run-1",
        role: "user",
        content: "Updated prompt",
        createdAt: "2026-04-23T10:00:00.000Z",
      },
    ]);
  });

  it("keeps implementation workers and history intact when optimistically resuming", () => {
    const state: RecoverableConversationState = {
      runs: [
        {
          id: "run-1",
          mode: "implementation",
          status: "failed",
          lastError: "Get agent failed: fetch failed (caused by: read ECONNRESET)",
          failedAt: "2026-04-23T10:01:00.000Z",
        },
      ],
      messages: [
        {
          id: "message-1",
          runId: "run-1",
          role: "user",
          content: "Original prompt",
          createdAt: "2026-04-23T10:00:00.000Z",
        },
        {
          id: "message-2",
          runId: "run-1",
          role: "system",
          kind: "error",
          content: "Run failed: Get agent failed: fetch failed (caused by: read ECONNRESET)",
          createdAt: "2026-04-23T10:01:00.000Z",
        },
      ],
      workers: [{ id: "worker-1", runId: "run-1", type: "codex", status: "working" }],
      agents: [{ name: "worker-1", state: "working", currentText: "Still running" }],
      clarifications: [{ id: "clarification-1", runId: "run-1" }],
      validationRuns: [{ id: "validation-1", runId: "run-1" }],
      executionEvents: [{ id: "event-1", runId: "run-1", workerId: "worker-1", eventType: "worker_output_changed" }],
      supervisorInterventions: [{ id: "intervention-1", runId: "run-1" }],
    };

    const nextState = applyRunRecoveryOptimisticUpdate(state, {
      runId: "run-1",
      action: "retry",
      targetMessageId: "message-1",
    });

    expect(nextState.runs[0]).toMatchObject({
      id: "run-1",
      mode: "implementation",
      status: "running",
      lastError: null,
      failedAt: null,
    });
    expect(nextState.messages).toEqual([state.messages[0]]);
    expect(nextState.workers).toEqual(state.workers);
    expect(nextState.agents).toEqual(state.agents);
    expect(nextState.clarifications).toEqual(state.clarifications);
    expect(nextState.validationRuns).toEqual(state.validationRuns);
    expect(nextState.executionEvents).toEqual(state.executionEvents);
    expect(nextState.supervisorInterventions).toEqual(state.supervisorInterventions);
  });
});
