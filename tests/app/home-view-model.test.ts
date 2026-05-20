import { describe, expect, it, vi } from "vitest";
import type { EventStreamState, RunRecord } from "@/app/home/types";

vi.mock("react", () => ({
  useCallback: (callback: unknown) => callback,
  useMemo: (factory: () => unknown) => factory(),
  useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) => getSnapshot(),
}));

import { useHomeViewModel } from "@/app/home/useHomeViewModel";

function createState(overrides: Partial<EventStreamState> = {}): EventStreamState {
  return {
    messages: [],
    plans: [],
    runs: [],
    accounts: [],
    agents: [],
    workers: [],
    planItems: [],
    clarifications: [],
    executionEvents: [],
    supervisorInterventions: [],
    frontendErrors: [],
    queuedMessages: [],
    recoveryIncidents: [],
    ...overrides,
  };
}

function createRun(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    id: "run-1",
    planId: "plan-1",
    mode: "direct",
    status: "done",
    createdAt: "2026-05-13T00:00:00.000Z",
    updatedAt: "2026-05-13T00:01:00.000Z",
    projectPath: "/workspace/project",
    title: "Finished direct run",
    ...overrides,
  };
}

function useRenderViewModel(state: EventStreamState) {
  return useHomeViewModel({
    state,
    selectedRunId: "run-1",
    selectedConversationMode: "direct",
    selectedCliAgent: "codex",
    selectedModel: "gpt-5",
    selectedEffort: "medium",
    draftProjectPath: null,
    searchQuery: "",
    apiKeys: {},
    workerCatalogData: undefined,
  });
}

describe("useHomeViewModel", () => {
  it("does not keep a completed direct conversation busy just because its worker is idle", () => {
    const viewModel = useRenderViewModel(createState({
      runs: [createRun()],
      plans: [{ id: "plan-1", path: "/workspace/project" }],
      messages: [{
        id: "message-1",
        runId: "run-1",
        role: "user",
        kind: "checkpoint",
        content: "Do the thing",
        createdAt: "2026-05-13T00:00:00.000Z",
      }],
      workers: [{
        id: "run-1-worker-1",
        runId: "run-1",
        type: "gemini",
        status: "idle",
        createdAt: "2026-05-13T00:00:00.000Z",
        updatedAt: "2026-05-13T00:01:00.000Z",
      }],
      agents: [{
        name: "run-1-worker-1",
        type: "gemini",
        state: "idle",
        currentText: "",
        lastText: "",
      }],
    }));

    expect(viewModel.conversationWorkerGroups.active).toEqual([]);
    expect(viewModel.conversationWorkerGroups.finished.map((worker) => worker.id)).toEqual(["run-1-worker-1"]);
    expect(viewModel.activeConversationAgents).toEqual([]);
    expect(viewModel.hasActiveWorker).toBe(false);
    expect(viewModel.isConversationStoppable).toBe(false);
    expect(viewModel.isConversationThinking).toBe(false);
  });

  it("does not show a manual-recovery run as thinking because of a stale recovering worker", () => {
    const viewModel = useRenderViewModel(createState({
      runs: [createRun({
        mode: "implementation",
        status: "needs_recovery",
        lastError: "This run needs manual recovery before it can continue.",
      })],
      plans: [{ id: "plan-1", path: "/workspace/project" }],
      messages: [{
        id: "message-1",
        runId: "run-1",
        role: "user",
        kind: "checkpoint",
        content: "Do the thing",
        createdAt: "2026-05-13T00:00:00.000Z",
      }],
      workers: [{
        id: "run-1-worker-1",
        runId: "run-1",
        type: "gemini",
        status: "recovering",
        createdAt: "2026-05-13T00:00:00.000Z",
        updatedAt: "2026-05-13T00:01:00.000Z",
      }],
    }));

    expect(viewModel.conversationWorkerGroups.active).toEqual([]);
    expect(viewModel.conversationWorkerGroups.finished.map((worker) => worker.id)).toEqual(["run-1-worker-1"]);
    expect(viewModel.activeConversationAgents).toEqual([]);
    expect(viewModel.hasActiveWorker).toBe(false);
    expect(viewModel.isConversationStoppable).toBe(false);
    expect(viewModel.isConversationThinking).toBe(false);
  });

  it("does not show stale stuck-worker recovery once the supervisor is awaiting input", () => {
    const viewModel = useRenderViewModel(createState({
      runs: [createRun({
        mode: "implementation",
        status: "awaiting_user",
      })],
      plans: [{ id: "plan-1", path: "/workspace/project" }],
      messages: [
        {
          id: "message-1",
          runId: "run-1",
          role: "user",
          kind: "checkpoint",
          content: "Do the thing",
          createdAt: "2026-05-13T00:00:00.000Z",
        },
        {
          id: "message-2",
          runId: "run-1",
          role: "supervisor",
          kind: "implementation_confirmation",
          content: "I found the plan and need confirmation before implementing.",
          createdAt: "2026-05-13T00:01:00.000Z",
        },
      ],
      workers: [{
        id: "run-1-worker-1",
        runId: "run-1",
        type: "gemini",
        status: "stuck",
        createdAt: "2026-05-13T00:00:10.000Z",
        updatedAt: "2026-05-13T00:00:30.000Z",
      }],
      executionEvents: [{
        id: "event-1",
        runId: "run-1",
        workerId: "run-1-worker-1",
        eventType: "worker_stuck",
        details: JSON.stringify({ summary: "run-1-worker-1 appears stuck" }),
        createdAt: "2026-05-13T00:00:30.000Z",
      }],
    }));

    expect(viewModel.hasStuckWorker).toBe(false);
    expect(viewModel.showRecoverableRunningState).toBe(false);
    expect(viewModel.latestStuckEvent).toBeNull();
  });

  it("does not treat cached selected-run previews as authoritative conversation loads", () => {
    const viewModel = useRenderViewModel(createState({
      snapshotRunId: "run-1",
      snapshotSource: "cache",
      runs: [createRun()],
      plans: [{ id: "plan-1", path: "/workspace/project" }],
      messages: [{
        id: "message-1",
        runId: "run-1",
        role: "user",
        kind: "checkpoint",
        content: "Cached preview only",
        createdAt: "2026-05-13T00:00:00.000Z",
      }],
    }));

    expect(viewModel.isSelectedConversationLoaded).toBe(false);
  });
});
