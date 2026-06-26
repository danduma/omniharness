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
      awaitingUserQuestionMessage: null,
      isSelectedConversationLoaded: true,
    });

    expect(liveExecutionStatus).toMatchObject({
      label: "Working",
      tone: "active",
    });
    expect(liveExecutionStatus.detail).toContain("Omni is still checking the run.");
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
      awaitingUserQuestionMessage: null,
      isSelectedConversationLoaded: true,
    });

    expect(liveExecutionStatus).toMatchObject({
      label: "Stopped",
      tone: "muted",
    });
    expect(liveExecutionStatus.detail).toContain("Stopped supervisor and cancelled active workers.");
  });

  it("shows manual recovery state instead of generic working status", () => {
    const { liveExecutionStatus } = useConversationExecutionStatus({
      selectedRun: buildRun({
        status: "needs_recovery",
        lastError: "This run needs manual recovery before it can continue.",
      }),
      latestExecutionEvent: buildExecutionEvent({
        eventType: "recovery_needs_user",
        details: JSON.stringify({ summary: "This run needs manual recovery before it can continue." }),
      }),
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
      awaitingUserQuestionMessage: null,
      isSelectedConversationLoaded: true,
    });

    expect(liveExecutionStatus).toMatchObject({
      label: "Needs recovery",
      tone: "warning",
    });
    expect(liveExecutionStatus.detail).toContain("This run needs manual recovery before it can continue.");
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
      awaitingUserQuestionMessage: null,
      isSelectedConversationLoaded: true,
    });

    expect(liveExecutionStatus).toMatchObject({
      label: "Completed",
      tone: "muted",
    });
    expect(liveExecutionStatus.detail).toContain("Final summary is ready.");
  });

  it("shows a loading state when awaiting_user but the supervisor question has not loaded yet", () => {
    const { liveExecutionStatus } = useConversationExecutionStatus({
      selectedRun: buildRun({ status: "awaiting_user" }),
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
      awaitingUserQuestionMessage: null,
      isSelectedConversationLoaded: true,
    });

    expect(liveExecutionStatus).toMatchObject({
      label: "Loading",
      tone: "active",
    });
  });

  it("shows the awaiting input banner once the supervisor question is visible", () => {
    const { liveExecutionStatus } = useConversationExecutionStatus({
      selectedRun: buildRun({ status: "awaiting_user" }),
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
      awaitingUserQuestionMessage: {
        id: "msg-1",
        runId: "run-1",
        role: "supervisor",
        kind: "clarification",
        content: "What should I do next?",
        createdAt: "2026-05-08T00:01:00.000Z",
      },
      isSelectedConversationLoaded: true,
    });

    expect(liveExecutionStatus).toMatchObject({
      label: "Awaiting input",
      tone: "warning",
    });
  });

  it("shows direct-control awaiting input without requiring a supervisor question", () => {
    const { liveExecutionStatus } = useConversationExecutionStatus({
      selectedRun: buildRun({ mode: "direct", status: "awaiting_user" }),
      latestExecutionEvent: buildExecutionEvent({
        eventType: "direct_worker_awaiting_user",
        details: JSON.stringify({ reason: "worker_requested_input" }),
      }),
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
      awaitingUserQuestionMessage: null,
      isSelectedConversationLoaded: true,
    });

    expect(liveExecutionStatus).toMatchObject({
      label: "Awaiting input",
      tone: "warning",
    });
  });

  it("shows a pending worker question as awaiting input", () => {
    const { liveExecutionStatus } = useConversationExecutionStatus({
      selectedRun: buildRun({ status: "running" }),
      latestExecutionEvent: null,
      erroredAgent: null,
      pendingPermissionAgent: null,
      pendingElicitationAgent: {
        name: "run-1-worker-1",
        type: "claude",
        state: "working",
        pendingElicitations: [{
          requestId: 1,
          requestedAt: "2026-05-08T00:01:00.000Z",
          message: "Which option should I use?",
        }],
      },
      hasStuckWorker: false,
      latestStuckEvent: null,
      showRecoverableRunningState: true,
      latestWaitEvent: null,
      latestPromptDeferredEvent: null,
      completionEvent: null,
      queuedMessageCount: 0,
      activeConversationAgents: [],
      liveThoughts: [],
      awaitingUserQuestionMessage: null,
      isSelectedConversationLoaded: true,
    });

    expect(liveExecutionStatus).toMatchObject({
      label: "Awaiting input",
      detail: "run-1-worker-1 is waiting on 1 answer(s).",
      tone: "warning",
    });
  });

  it("shows pending permission output as awaiting permission even when live permission metadata is absent", () => {
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
      queuedMessageCount: 1,
      activeConversationAgents: [{
        name: "run-1-worker-1",
        type: "claude",
        state: "working",
        currentText: "Ready to code?",
        outputEntries: [{
          id: "permission-1",
          type: "permission",
          text: "Permission requested for switch_mode: Ready to code?",
          status: "pending",
          timestamp: "2026-05-08T00:01:00.000Z",
        }],
      }],
      liveThoughts: [{
        agentName: "run-1-worker-1",
        text: "Ready to code?",
        snippet: "Ready to code?",
        isLive: true,
      }],
      awaitingUserQuestionMessage: null,
      isSelectedConversationLoaded: true,
    });

    expect(liveExecutionStatus).toMatchObject({
      label: "Awaiting permission",
      detail: "run-1-worker-1 is waiting on 1 permission decision.",
      tone: "warning",
    });
  });

  it("shows pending elicitation output as awaiting input even when live elicitation metadata is absent", () => {
    const { liveExecutionStatus } = useConversationExecutionStatus({
      selectedRun: buildRun({ status: "running" }),
      latestExecutionEvent: null,
      erroredAgent: null,
      pendingPermissionAgent: null,
      pendingElicitationAgent: null,
      hasStuckWorker: false,
      latestStuckEvent: null,
      showRecoverableRunningState: false,
      latestWaitEvent: null,
      latestPromptDeferredEvent: null,
      completionEvent: null,
      queuedMessageCount: 1,
      activeConversationAgents: [{
        name: "run-1-worker-1",
        type: "claude",
        state: "working",
        currentText: "How should I proceed?",
        outputEntries: [{
          id: "elicitation-1",
          type: "elicitation",
          text: "Question for user: How should I proceed?",
          status: "pending",
          timestamp: "2026-05-08T00:01:00.000Z",
        }],
      }],
      liveThoughts: [{
        agentName: "run-1-worker-1",
        text: "How should I proceed?",
        snippet: "How should I proceed?",
        isLive: true,
      }],
      awaitingUserQuestionMessage: null,
      isSelectedConversationLoaded: true,
    });

    expect(liveExecutionStatus).toMatchObject({
      label: "Awaiting input",
      detail: "run-1-worker-1 is waiting on 1 answer(s).",
      tone: "warning",
    });
  });

  it("shows working after a stream elicitation has a later answered row", () => {
    const { liveExecutionStatus } = useConversationExecutionStatus({
      selectedRun: buildRun({ status: "running" }),
      latestExecutionEvent: null,
      erroredAgent: null,
      pendingPermissionAgent: null,
      pendingElicitationAgent: null,
      hasStuckWorker: false,
      latestStuckEvent: null,
      showRecoverableRunningState: false,
      latestWaitEvent: null,
      latestPromptDeferredEvent: null,
      completionEvent: null,
      queuedMessageCount: 0,
      activeConversationAgents: [{
        name: "run-1-worker-1",
        type: "claude",
        state: "working",
        currentText: "Let me read the actual renderer + style files I'll edit.",
        outputEntries: [
          {
            id: "elicitation-pending",
            type: "elicitation",
            text: "Question for user: Please answer the following questions.",
            status: "pending",
            timestamp: "2026-06-25T21:11:51.267Z",
            raw: { requestId: 2 },
          },
          {
            id: "elicitation-answered",
            type: "elicitation",
            text: "Question answered for request 2",
            status: "answered",
            timestamp: "2026-06-25T21:14:37.797Z",
            raw: { requestId: 2 },
          },
        ],
      }],
      liveThoughts: [{
        agentName: "run-1-worker-1",
        text: "Let me read the actual renderer + style files I'll edit.",
        snippet: "Let me read the actual renderer + style files I'll edit.",
        isLive: true,
      }],
      awaitingUserQuestionMessage: null,
      isSelectedConversationLoaded: true,
    });

    expect(liveExecutionStatus).toMatchObject({
      label: "Working",
      tone: "active",
    });
  });

  it("shows a loading state when the selected conversation snapshot has not arrived", () => {
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
      awaitingUserQuestionMessage: null,
      isSelectedConversationLoaded: false,
    });

    expect(liveExecutionStatus).toMatchObject({
      label: "Loading",
      tone: "active",
    });
  });
});
