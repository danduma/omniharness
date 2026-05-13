import { describe, expect, it, vi } from "vitest";
import type { ExecutionEventRecord, RunRecord } from "@/app/home/types";

vi.mock("react", () => ({
  useMemo: (factory: () => unknown) => factory(),
}));

import { useConversationExecutionStatus } from "@/app/home/useConversationExecutionStatus";

function buildRun(overrides: Partial<RunRecord>): RunRecord {
  return {
    id: "run-1",
    planId: "plan-1",
    status: "running",
    createdAt: "2026-05-08T00:00:00.000Z",
    updatedAt: "2026-05-08T00:00:00.000Z",
    projectPath: "/workspace/project",
    title: "Test run",
    mode: "implementation",
    ...overrides,
  };
}

function buildExecutionEvent(overrides: Partial<ExecutionEventRecord>): ExecutionEventRecord {
  return {
    id: "event-1",
    runId: "run-1",
    eventType: "supervisor_stopped",
    details: JSON.stringify({ summary: "Stopped supervisor and cancelled active workers." }),
    createdAt: "2026-05-08T00:01:00.000Z",
    ...overrides,
  };
}

describe("useConversationExecutionStatus", () => {
  it("shows running supervisor work before any worker is active", () => {
    const { liveExecutionStatus } = useConversationExecutionStatus({
      selectedRun: buildRun({ status: "running" }),
      latestExecutionEvent: null,
      erroredAgent: null,
      pendingPermissionAgent: null,
      hasStuckWorker: false,
      latestStuckEvent: null,
      showRecoverableRunningState: false,
      latestWaitEvent: null,
      latestPromptDeferredEvent: null,
      completionEvent: null,
      queuedMessageCount: 0,
      activeConversationAgents: [],
      liveThoughts: [],
    });

    expect(liveExecutionStatus).toMatchObject({
      label: "Working",
      tone: "active",
    });
    expect(liveExecutionStatus.detail).toContain("The supervisor is still checking the run.");
  });

  it("shows cancelled implementation runs as user-stopped instead of thinking", () => {
    const { liveExecutionStatus } = useConversationExecutionStatus({
      selectedRun: buildRun({ status: "cancelled" }),
      latestExecutionEvent: buildExecutionEvent({}),
      erroredAgent: null,
      pendingPermissionAgent: null,
      hasStuckWorker: false,
      latestStuckEvent: null,
      showRecoverableRunningState: false,
      latestWaitEvent: null,
      latestPromptDeferredEvent: null,
      completionEvent: null,
      queuedMessageCount: 0,
      activeConversationAgents: [],
      liveThoughts: [],
    });

    expect(liveExecutionStatus).toMatchObject({
      label: "Stopped",
      tone: "muted",
    });
    expect(liveExecutionStatus.detail).toContain("Stopped supervisor and cancelled active workers.");
  });

  it("shows completed runs even if a stale worker snapshot still looks active", () => {
    const { liveExecutionStatus } = useConversationExecutionStatus({
      selectedRun: buildRun({
        status: "done",
        updatedAt: "2026-05-08T00:02:00.000Z",
      }),
      latestExecutionEvent: buildExecutionEvent({
        eventType: "run_completed",
        details: JSON.stringify({ summary: "Final summary is ready." }),
        createdAt: "2026-05-08T00:02:00.000Z",
      }),
      erroredAgent: null,
      pendingPermissionAgent: null,
      hasStuckWorker: false,
      latestStuckEvent: null,
      showRecoverableRunningState: false,
      latestWaitEvent: null,
      latestPromptDeferredEvent: null,
      completionEvent: buildExecutionEvent({
        eventType: "run_completed",
        details: JSON.stringify({ summary: "Final summary is ready." }),
        createdAt: "2026-05-08T00:02:00.000Z",
      }),
      queuedMessageCount: 0,
      activeConversationAgents: [{
        name: "run-1-worker-1",
        type: "codex",
        state: "working",
        currentText: "Old live output",
      }],
      liveThoughts: [{
        agentName: "run-1-worker-1",
        text: "Old live output",
        snippet: "Old live output",
        isLive: true,
      }],
    });

    expect(liveExecutionStatus).toMatchObject({
      label: "Completed",
      tone: "muted",
    });
    expect(liveExecutionStatus.detail).toContain("Final summary is ready.");
  });
});
