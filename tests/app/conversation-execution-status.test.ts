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
});
