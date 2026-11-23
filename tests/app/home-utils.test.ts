import { describe, expect, it } from "vitest";
import { appendCreatedConversationSnapshot, appendSentConversationMessageSnapshot, buildOptimisticCreatedConversationSnapshot, buildOptimisticSentConversationMessage, classifyExecutionEvent, compareNewestByCreatedAtThenId, compareOldestByCreatedAtThenId, filterOptimisticallyDeletedRuns, getLatestUnresolvedWorkerStuckEvent, getRunDurationLabel, mergePendingCreatedConversationSnapshots, mergePendingSentConversationMessages, parseBrowserConversationRoute, parseCollapsedProjectPaths, reorderExplicitProjectPaths, resolveComposerEffortForPair, resolveComposerEffortLabel, resolveComposerEffortValue, resolveComposerModelAfterWorkerChange, resolveComposerModelValue, resolveOptimisticSentConversationMessage, resolveSavedComposerModel, resolveSelectedWorkerModel, shouldClearMissingSelectedRunFromAuthoritativeSnapshot, shouldOpenExecutionDetailsForRun, shouldRenderMessageInMainConversation, shouldShowExecutionEventInRunLog, shouldShowLatestRecoveryAction, shouldShowRecoverableRunningState } from "@/interface/home/utils";
import type { EventStreamState, ExecutionEventRecord, MessageRecord, RunRecord } from "@/interface/home/types";

function buildRun(overrides: Partial<RunRecord>): RunRecord {
  return {
    id: "run-1",
    planId: "plan-1",
    status: "running",
    createdAt: "2026-04-27T00:00:00.000Z",
    updatedAt: "2026-04-27T00:00:00.000Z",
    projectPath: null,
    title: null,
    ...overrides,
  };
}

function buildExecutionEvent(overrides: Partial<ExecutionEventRecord>): ExecutionEventRecord {
  return {
    id: "event-1",
    runId: "run-1",
    eventType: "worker_prompted",
    details: JSON.stringify({ summary: "Sent follow-up to worker-1" }),
    createdAt: "2026-04-27T00:00:10.000Z",
    ...overrides,
  };
}

function buildMessage(overrides: Partial<MessageRecord>): MessageRecord {
  return {
    id: "message-1",
    runId: "run-1",
    role: "system",
    kind: "supervisor_action",
    content: "worker-1 is already busy; waiting before sending another prompt.",
    createdAt: "2026-04-27T00:00:10.000Z",
    ...overrides,
  };
}

describe("home utils", () => {
  it("reorders explicit projects without adding or removing configured roots", () => {
    const projects = ["/workspace/api", "/workspace/web", "/workspace/docs"];

    expect(reorderExplicitProjectPaths(projects, {
      draggedPath: "/workspace/docs",
      targetPath: "/workspace/api",
      placement: "before",
    })).toEqual(["/workspace/docs", "/workspace/api", "/workspace/web"]);

    expect(reorderExplicitProjectPaths(projects, {
      draggedPath: "/workspace/api",
      targetPath: "/workspace/docs",
      placement: "after",
    })).toEqual(["/workspace/web", "/workspace/docs", "/workspace/api"]);

    expect(reorderExplicitProjectPaths(projects, {
      draggedPath: "/workspace/api",
      targetPath: "other",
      placement: "before",
    })).toBe(projects);
  });

  it("parses the browser route as the source of truth for selected sessions", () => {
    expect(parseBrowserConversationRoute({
      pathname: "/session/12345678-1234-1234-1234-123456789abc",
      search: "?run=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa&project=/tmp/app&pair=token",
    })).toEqual({
      selectedRunId: "12345678-1234-1234-1234-123456789abc",
      draftProjectPath: null,
      pairTokenFromUrl: "token",
    });

    expect(parseBrowserConversationRoute({
      pathname: "/",
      search: "?project=/tmp/app",
    })).toEqual({
      selectedRunId: null,
      draftProjectPath: "/tmp/app",
      pairTokenFromUrl: null,
    });
  });

  it("clears missing selected runs only after an authoritative complete server catalog excludes them", () => {
    expect(shouldClearMissingSelectedRunFromAuthoritativeSnapshot({
      selectedRunId: "archived-run",
      selectedRunExists: false,
      snapshotSource: "server",
      catalogComplete: true,
      snapshotRunId: null,
    })).toBe(true);

    expect(shouldClearMissingSelectedRunFromAuthoritativeSnapshot({
      selectedRunId: "run-a",
      selectedRunExists: true,
      snapshotSource: "server",
      catalogComplete: true,
      snapshotRunId: "run-a",
    })).toBe(false);
    expect(shouldClearMissingSelectedRunFromAuthoritativeSnapshot({
      selectedRunId: "run-a",
      selectedRunExists: false,
      snapshotSource: "cache",
      catalogComplete: true,
      snapshotRunId: null,
    })).toBe(false);
    expect(shouldClearMissingSelectedRunFromAuthoritativeSnapshot({
      selectedRunId: "run-a",
      selectedRunExists: false,
      snapshotSource: "server",
      catalogComplete: false,
      snapshotRunId: null,
    })).toBe(false);
    expect(shouldClearMissingSelectedRunFromAuthoritativeSnapshot({
      selectedRunId: "run-a",
      selectedRunExists: false,
      snapshotSource: "server",
      catalogComplete: false,
      snapshotRunId: "run-a",
    })).toBe(true);
  });

  it("uses ids as deterministic tie-breakers for equal timestamps", () => {
    const records = [
      { id: "b", createdAt: "2026-04-27T00:00:10.000Z" },
      { id: "a", createdAt: "2026-04-27T00:00:10.000Z" },
      { id: "c", createdAt: "2026-04-27T00:00:11.000Z" },
    ];

    expect([...records].sort(compareOldestByCreatedAtThenId).map((record) => record.id)).toEqual(["a", "b", "c"]);
    expect([...records].sort(compareNewestByCreatedAtThenId).map((record) => record.id)).toEqual(["c", "b", "a"]);
  });

  it("formats completed supervisor run duration from the completion timestamp", () => {
    expect(getRunDurationLabel(
      buildRun({ status: "done", updatedAt: "2026-04-27T03:00:00.000Z" }),
      "2026-04-27T02:32:00.000Z",
    )).toBe("Completed in 2 hours, 32 minutes");
  });

  it("formats in-progress supervisor run duration from now", () => {
    expect(getRunDurationLabel(
      buildRun({ status: "running" }),
      null,
      new Date("2026-04-27T00:45:00.000Z").getTime(),
    )).toBe("Running for 45 minutes");
  });

  it("does not show latest recovery while the selected conversation is still loading", () => {
    expect(shouldShowLatestRecoveryAction({
      selectedRun: buildRun({ status: "running" }),
      canRetryConversation: true,
      isSelectedConversationLoaded: false,
      latestUserCheckpoint: buildMessage({ role: "user", kind: "checkpoint" }),
      showRecoverableRunningState: true,
      hasStuckWorker: true,
    })).toBe(false);
  });

  it("does not show latest recovery for awaiting-user conversations even with stale stuck-worker state", () => {
    expect(shouldShowLatestRecoveryAction({
      selectedRun: buildRun({ status: "awaiting_user" }),
      canRetryConversation: true,
      isSelectedConversationLoaded: true,
      latestUserCheckpoint: buildMessage({ role: "user", kind: "checkpoint" }),
      showRecoverableRunningState: true,
      hasStuckWorker: true,
    })).toBe(false);
  });

  it("shows latest recovery for loaded failed or stuck running conversations", () => {
    const latestUserCheckpoint = buildMessage({ role: "user", kind: "checkpoint" });

    expect(shouldShowLatestRecoveryAction({
      selectedRun: buildRun({ status: "failed" }),
      canRetryConversation: true,
      isSelectedConversationLoaded: true,
      latestUserCheckpoint,
      showRecoverableRunningState: false,
      hasStuckWorker: false,
    })).toBe(true);

    expect(shouldShowLatestRecoveryAction({
      selectedRun: buildRun({ status: "running" }),
      canRetryConversation: true,
      isSelectedConversationLoaded: true,
      latestUserCheckpoint,
      showRecoverableRunningState: false,
      hasStuckWorker: true,
    })).toBe(true);
  });

  it("opens supervisor activity details automatically for failed conversations", () => {
    expect(shouldOpenExecutionDetailsForRun({
      selectedRun: buildRun({ status: "failed" }),
      executionEventCount: 1,
    })).toBe(true);
  });

  it("classifies routine supervisor and worker events away from the transcript", () => {
    expect(classifyExecutionEvent(buildExecutionEvent({ eventType: "worker_prompt_deferred" }))).toBe("dynamic_status");
    expect(classifyExecutionEvent(buildExecutionEvent({ eventType: "worker_spawned" }))).toBe("inline_event");
    expect(classifyExecutionEvent(buildExecutionEvent({ eventType: "worker_stuck" }))).toBe("run_log");
    expect(classifyExecutionEvent(buildExecutionEvent({ eventType: "worker_session_missing" }))).toBe("run_log");
    expect(classifyExecutionEvent(buildExecutionEvent({ eventType: "worker_session_recreated" }))).toBe("run_log");
    expect(classifyExecutionEvent(buildExecutionEvent({ eventType: "worker_spawn_blocked" }))).toBe("run_log");
    expect(classifyExecutionEvent(buildExecutionEvent({ eventType: "run_failed" }))).toBe("run_log");
    expect(classifyExecutionEvent(buildExecutionEvent({ eventType: "supervisor_file_read" }))).toBe("run_log");
    expect(classifyExecutionEvent(buildExecutionEvent({ eventType: "supervisor_turn_stopped" }))).toBe("run_log");
    expect(classifyExecutionEvent(buildExecutionEvent({ eventType: "supervisor_wait" }))).toBe("run_log");
    expect(classifyExecutionEvent(buildExecutionEvent({ eventType: "worker_prompted" }))).toBe("run_log");
    expect(classifyExecutionEvent(buildExecutionEvent({ eventType: "worker_output_changed" }))).toBe("run_log");
    expect(classifyExecutionEvent(buildExecutionEvent({ eventType: "worker_turn_completed" }))).toBe("run_log");
    expect(classifyExecutionEvent(buildExecutionEvent({ eventType: "worker_idle" }))).toBe("run_log");
  });

  it("does not treat a worker as stuck after newer output from the same worker", () => {
    const latestStuckEvent = getLatestUnresolvedWorkerStuckEvent([
      buildExecutionEvent({
        id: "output-after-stuck",
        workerId: "worker-3",
        eventType: "worker_output_changed",
        createdAt: "2026-05-04T14:31:55.000Z",
      }),
      buildExecutionEvent({
        id: "stuck-before-output",
        workerId: "worker-3",
        eventType: "worker_stuck",
        details: JSON.stringify({ summary: "worker-3 appears stuck" }),
        createdAt: "2026-05-04T14:30:08.000Z",
      }),
    ]);

    expect(latestStuckEvent).toBeNull();
  });

  it("does not treat a worker as stuck after a newer completed turn from the same worker", () => {
    const latestStuckEvent = getLatestUnresolvedWorkerStuckEvent([
      buildExecutionEvent({
        id: "completed-after-stuck",
        workerId: "worker-3",
        eventType: "worker_turn_completed",
        createdAt: "2026-05-04T14:31:55.000Z",
      }),
      buildExecutionEvent({
        id: "stuck-before-completed",
        workerId: "worker-3",
        eventType: "worker_stuck",
        details: JSON.stringify({ summary: "worker-3 appears stuck" }),
        createdAt: "2026-05-04T14:30:08.000Z",
      }),
    ]);

    expect(latestStuckEvent).toBeNull();
  });

  it("does not treat a worker as stuck after the run completed", () => {
    const latestStuckEvent = getLatestUnresolvedWorkerStuckEvent([
      buildExecutionEvent({
        id: "run-completed-after-stuck",
        eventType: "run_completed",
        createdAt: "2026-05-04T14:35:00.000Z",
      }),
      buildExecutionEvent({
        id: "stuck-before-run-completed",
        workerId: "worker-3",
        eventType: "worker_stuck",
        details: JSON.stringify({ summary: "worker-3 appears stuck" }),
        createdAt: "2026-05-04T14:30:08.000Z",
      }),
    ]);

    expect(latestStuckEvent).toBeNull();
  });

  it("keeps retryable worker poll failures out of the run log", () => {
    expect(shouldShowExecutionEventInRunLog(buildExecutionEvent({
      eventType: "worker_poll_failed",
      details: JSON.stringify({
        summary: "Observer polling failed for worker-2",
        reason: "Get agent failed: fetch failed (caused by: read ECONNRESET)",
        retryable: true,
      }),
    }))).toBe(false);

    expect(shouldShowExecutionEventInRunLog(buildExecutionEvent({
      eventType: "worker_poll_failed",
      details: JSON.stringify({
        summary: "Observer polling failed for worker-2",
        reason: "Get agent failed: not_found",
        retryable: false,
      }),
    }))).toBe(true);
  });

  it("keeps internal self-healing lifecycle breadcrumbs out of the visible run log", () => {
    for (const eventType of [
      "supervisor_turn_stopped",
      "worker_spawn_blocked",
      "worker_stuck",
      "worker_session_missing",
    ]) {
      expect(shouldShowExecutionEventInRunLog(buildExecutionEvent({
        eventType,
        workerId: "worker-1",
        details: JSON.stringify({ summary: `${eventType} summary` }),
      }))).toBe(false);
    }
  });

  it("hides legacy operational system messages from the main conversation", () => {
    expect(shouldRenderMessageInMainConversation(buildMessage({
      content: "worker-1 is already busy; waiting before sending another prompt.",
    }))).toBe(false);
    expect(shouldRenderMessageInMainConversation(buildMessage({
      content: "Waiting 5s before the next check: Worker is actively checking dependencies.",
    }))).toBe(false);
    expect(shouldRenderMessageInMainConversation(buildMessage({
      content: "Spawned worker. CLI: OpenCode | Worker: worker-1 | Purpose: implement.",
    }))).toBe(false);
    expect(shouldRenderMessageInMainConversation(buildMessage({
      content: "Inspected repository with rg supervisor_wait.\n\nExit code: 0\nresult",
    }))).toBe(false);
    expect(shouldRenderMessageInMainConversation(buildMessage({
      role: "user",
      kind: "checkpoint",
      content: "Please implement the spec.",
    }))).toBe(true);
    expect(shouldRenderMessageInMainConversation(buildMessage({
      role: "supervisor",
      kind: "completion",
      content: "Implemented and verified.",
    }))).toBe(true);
  });

  it("does not show recovery for a freshly created running conversation before execution events hydrate", () => {
    expect(shouldShowRecoverableRunningState({
      selectedRun: buildRun({
        status: "running",
        createdAt: "2026-04-27T00:00:00.000Z",
      }),
      latestUserCheckpoint: {
        id: "message-1",
        runId: "run-1",
        role: "user",
        kind: "checkpoint",
        content: "Start this",
        createdAt: "2026-04-27T00:00:00.000Z",
      },
      hasPendingPermission: false,
      hasPendingElicitation: false,
      hasActiveWorker: false,
      hasStuckWorker: false,
      activeWorkerCount: 0,
      latestExecutionEventCreatedAt: null,
      nowMs: new Date("2026-04-27T00:00:02.000Z").getTime(),
    })).toBe(false);
  });

  it("shows recovery when a running conversation has had no attached execution long enough", () => {
    expect(shouldShowRecoverableRunningState({
      selectedRun: buildRun({
        status: "running",
        createdAt: "2026-04-27T00:00:00.000Z",
      }),
      latestUserCheckpoint: {
        id: "message-1",
        runId: "run-1",
        role: "user",
        kind: "checkpoint",
        content: "Start this",
        createdAt: "2026-04-27T00:00:00.000Z",
      },
      hasPendingPermission: false,
      hasPendingElicitation: false,
      hasActiveWorker: false,
      hasStuckWorker: false,
      activeWorkerCount: 0,
      latestExecutionEventCreatedAt: null,
      nowMs: new Date("2026-04-27T00:00:31.000Z").getTime(),
    })).toBe(true);
  });

  it("does not show recovery while a worker question is pending", () => {
    expect(shouldShowRecoverableRunningState({
      selectedRun: buildRun({
        status: "running",
        createdAt: "2026-04-27T00:00:00.000Z",
      }),
      latestUserCheckpoint: {
        id: "message-1",
        runId: "run-1",
        role: "user",
        kind: "checkpoint",
        content: "Start this",
        createdAt: "2026-04-27T00:00:00.000Z",
      },
      hasPendingPermission: false,
      hasPendingElicitation: true,
      hasActiveWorker: false,
      hasStuckWorker: false,
      activeWorkerCount: 0,
      latestExecutionEventCreatedAt: null,
      nowMs: new Date("2026-04-27T00:00:31.000Z").getTime(),
    })).toBe(false);
  });

  it("does not show recovery right after a fresh user checkpoint even when execution events are stale", () => {
    expect(shouldShowRecoverableRunningState({
      selectedRun: buildRun({
        status: "running",
        createdAt: "2026-04-27T00:00:00.000Z",
      }),
      latestUserCheckpoint: {
        id: "message-2",
        runId: "run-1",
        role: "user",
        kind: "checkpoint",
        content: "Yes, implement it",
        createdAt: "2026-04-27T00:15:00.000Z",
      },
      hasPendingPermission: false,
      hasPendingElicitation: false,
      hasActiveWorker: false,
      hasStuckWorker: false,
      activeWorkerCount: 0,
      latestExecutionEventCreatedAt: "2026-04-27T00:10:00.000Z",
      nowMs: new Date("2026-04-27T00:15:05.000Z").getTime(),
    })).toBe(false);
  });

  it("optimistically appends a sent follow-up message and revives the run status", () => {
    const liveState: EventStreamState = {
      messages: [],
      plans: [],
      runs: [buildRun({ status: "cancelled" })],
      accounts: [],
      agents: [],
      workers: [],
      executionEvents: [],
    };

    const next = appendSentConversationMessageSnapshot(liveState, {
      id: "message-1",
      runId: "run-1",
      role: "user",
      kind: "checkpoint",
      content: "Continue",
      createdAt: "2026-04-27T00:01:00.000Z",
    });

    expect(next.messages.map((message) => message.content)).toEqual(["Continue"]);
    expect(next.runs[0]?.status).toBe("running");
    expect(appendSentConversationMessageSnapshot(next, next.messages[0]).messages).toHaveLength(1);
  });

  it("does not revive a terminal run from a stale sent message after the server completed it", () => {
    const liveState: EventStreamState = {
      messages: [],
      plans: [],
      runs: [buildRun({
        id: "run-1",
        status: "done",
        updatedAt: "2026-04-27T00:02:00.000Z",
      })],
      accounts: [],
      agents: [],
      workers: [],
      executionEvents: [],
    };

    const next = appendSentConversationMessageSnapshot(liveState, {
      id: "message-1",
      runId: "run-1",
      role: "user",
      kind: "checkpoint",
      content: "Already handled",
      createdAt: "2026-04-27T00:01:00.000Z",
    });

    expect(next.messages.map((message) => message.content)).toEqual(["Already handled"]);
    expect(next.runs[0]?.status).toBe("done");
  });

  it("preserves sent conversation messages until the event stream catches up", () => {
    const message = {
      id: "message-1",
      runId: "run-1",
      role: "user",
      kind: "clarification_answer",
      content: "Use the existing API.",
      createdAt: "2026-04-27T00:00:05.000Z",
    };
    const pendingMessages = new Map([[message.id, message]]);
    const staleState: EventStreamState = {
      messages: [],
      runs: [buildRun({ id: "run-1", status: "awaiting_user" })],
      plans: [],
      accounts: [],
      agents: [],
      workers: [],
      executionEvents: [],
    };

    const preserved = mergePendingSentConversationMessages(staleState, pendingMessages);

    expect(preserved.state.messages).toEqual([message]);
    expect(preserved.state.runs[0]?.status).toBe("running");
    expect(preserved.settledMessageIds).toEqual([]);

    const caughtUp = mergePendingSentConversationMessages({
      ...staleState,
      messages: [message],
    }, pendingMessages);

    expect(caughtUp.state.messages).toEqual([message]);
    expect(caughtUp.settledMessageIds).toEqual([message.id]);
  });

  it("drops stale pending sent messages instead of resurrecting a server-terminal sidebar row", () => {
    const message = {
      id: "message-1",
      runId: "run-1",
      role: "user",
      kind: "checkpoint",
      content: "Already completed",
      createdAt: "2026-04-27T00:01:00.000Z",
    };
    const pendingMessages = new Map([[message.id, message]]);
    const terminalServerState: EventStreamState = {
      messages: [],
      runs: [buildRun({
        id: "run-1",
        status: "done",
        updatedAt: "2026-04-27T00:02:00.000Z",
      })],
      plans: [],
      accounts: [],
      agents: [],
      workers: [],
      executionEvents: [],
      messageScope: { runIds: ["other-run"], complete: true },
    };

    const preserved = mergePendingSentConversationMessages(terminalServerState, pendingMessages);

    expect(preserved.state.messages).toEqual([]);
    expect(preserved.state.runs[0]?.status).toBe("done");
    expect(preserved.settledMessageIds).toEqual([message.id]);
  });

  it("keeps an in-flight sent message even when the run looks terminal and newer", () => {
    // The runner clock can run ahead of the browser clock, which made the
    // staleness check reject a message the user had just sent: the bubble
    // vanished on the next frame and only returned when the POST resolved.
    const message = {
      id: "message-1",
      runId: "run-1",
      role: "user",
      kind: "checkpoint",
      content: "Just sent this",
      createdAt: "2026-04-27T00:01:00.000Z",
    };
    const pendingMessages = new Map([[message.id, message]]);
    const skewedServerState: EventStreamState = {
      messages: [],
      runs: [buildRun({
        id: "run-1",
        status: "done",
        updatedAt: "2026-04-27T00:02:00.000Z",
      })],
      plans: [],
      accounts: [],
      agents: [],
      workers: [],
      executionEvents: [],
      messageScope: { runIds: ["run-1"], complete: true },
    };

    const preserved = mergePendingSentConversationMessages(
      skewedServerState,
      pendingMessages,
      new Set([message.id]),
    );

    expect(preserved.state.messages).toEqual([message]);
    expect(preserved.settledMessageIds).toEqual([]);
  });

  it("optimistically appends a newly created conversation with its sidebar records", () => {
    const liveState: EventStreamState = {
      messages: [],
      plans: [],
      runs: [],
      accounts: [],
      agents: [],
      workers: [],
      executionEvents: [],
    };

    const next = appendCreatedConversationSnapshot(liveState, {
      plan: {
        id: "plan-1",
        path: "vibes/ad-hoc/new.md",
      },
      run: buildRun({
        id: "run-1",
        planId: "plan-1",
        projectPath: "/workspace/app",
        title: "New conversation",
      }),
      message: {
        id: "message-1",
        runId: "run-1",
        role: "user",
        kind: "checkpoint",
        content: "Start this",
        createdAt: "2026-04-27T00:01:00.000Z",
      },
    });

    expect(next.plans.map((plan) => plan.id)).toEqual(["plan-1"]);
    expect(next.runs.map((run) => run.id)).toEqual(["run-1"]);
    expect(next.messages.map((message) => message.content)).toEqual(["Start this"]);
    expect(appendCreatedConversationSnapshot(next, {
      plan: next.plans[0],
      run: next.runs[0],
      message: next.messages[0],
    }).runs).toHaveLength(1);
  });

  it("can protect a submitted conversation before the create response returns", () => {
    const optimisticSnapshot = buildOptimisticCreatedConversationSnapshot({
      runId: "run-1",
      content: "Start a direct control session",
      projectPath: "/workspace/app",
      now: new Date("2026-04-27T00:01:00.000Z"),
    });
    const pendingSnapshots = new Map([["run-1", optimisticSnapshot]]);
    const staleState: EventStreamState = {
      messages: [],
      plans: [],
      runs: [],
      accounts: [],
      agents: [],
      workers: [],
      executionEvents: [],
    };

    const preserved = mergePendingCreatedConversationSnapshots(staleState, pendingSnapshots);

    expect(preserved.runs[0]).toMatchObject({
      id: "run-1",
      status: "starting",
      projectPath: "/workspace/app",
      title: "Start a direct control session",
    });
    expect(preserved.plans).toEqual([{
      id: "run-1:optimistic-plan",
      path: "/workspace/app/.omniharness/pending/run-1.md",
    }]);
  });

  it("replaces the optimistic plan when the server create response arrives", () => {
    const optimisticSnapshot = buildOptimisticCreatedConversationSnapshot({
      runId: "run-1",
      content: "Start this",
      projectPath: "/workspace/app",
      now: new Date("2026-04-27T00:01:00.000Z"),
    });
    const optimisticState = appendCreatedConversationSnapshot({
      messages: [],
      plans: [],
      runs: [],
      accounts: [],
      agents: [],
      workers: [],
      executionEvents: [],
    }, optimisticSnapshot);

    const serverState = appendCreatedConversationSnapshot(optimisticState, {
      plan: { id: "plan-1", path: "vibes/ad-hoc/server.md" },
      run: buildRun({ id: "run-1", planId: "plan-1", title: "Server title" }),
    });

    expect(serverState.plans.map((plan) => plan.id)).toEqual(["plan-1"]);
    expect(serverState.runs[0]).toMatchObject({
      id: "run-1",
      planId: "plan-1",
      title: "Server title",
    });
  });

  it("keeps a newly created conversation through stale event payloads until the server includes it", () => {
    const pendingSnapshots = new Map([
      ["run-1", {
        plan: { id: "plan-1", path: "vibes/ad-hoc/new.md" },
        run: buildRun({ id: "run-1", planId: "plan-1" }),
        message: {
          id: "message-1",
          runId: "run-1",
          role: "user",
          kind: "checkpoint",
          content: "Start this",
          createdAt: "2026-04-27T00:01:00.000Z",
        },
      }],
    ]);
    const staleState: EventStreamState = {
      messages: [],
      plans: [],
      runs: [],
      accounts: [],
      agents: [],
      workers: [],
      executionEvents: [],
    };

    const preserved = mergePendingCreatedConversationSnapshots(staleState, pendingSnapshots);

    expect(preserved.runs.map((run) => run.id)).toEqual(["run-1"]);
    expect(pendingSnapshots.has("run-1")).toBe(true);

    const caughtUpAtMs = 1_000;
    const caughtUp = mergePendingCreatedConversationSnapshots({
      ...staleState,
      plans: [{ id: "plan-1", path: "vibes/ad-hoc/new.md" }],
      runs: [buildRun({ id: "run-1", planId: "plan-1" })],
      messages: [{
        id: "message-1",
        runId: "run-1",
        role: "user",
        kind: "checkpoint",
        content: "Start this",
        createdAt: "2026-04-27T00:01:00.000Z",
      }],
    }, pendingSnapshots, caughtUpAtMs);

    expect(caughtUp.runs.map((run) => run.id)).toEqual(["run-1"]);
    expect(pendingSnapshots.has("run-1")).toBe(true);

    mergePendingCreatedConversationSnapshots({
      ...staleState,
      plans: [{ id: "plan-1", path: "vibes/ad-hoc/new.md" }],
      runs: [buildRun({ id: "run-1", planId: "plan-1" })],
      messages: [{
        id: "message-1",
        runId: "run-1",
        role: "user",
        kind: "checkpoint",
        content: "Start this",
        createdAt: "2026-04-27T00:01:00.000Z",
      }],
    }, pendingSnapshots, caughtUpAtMs + 10_000);

    expect(pendingSnapshots.has("run-1")).toBe(true);
  });

  it("keeps a newly created conversation through late stale payloads after the server first includes it", () => {
    const pendingSnapshots = new Map([
      ["run-1", {
        plan: { id: "plan-1", path: "vibes/ad-hoc/new.md" },
        run: buildRun({ id: "run-1", planId: "plan-1" }),
        message: {
          id: "message-1",
          runId: "run-1",
          role: "user",
          kind: "checkpoint",
          content: "Start this",
          createdAt: "2026-04-27T00:01:00.000Z",
        },
      }],
    ]);
    const staleState: EventStreamState = {
      messages: [],
      plans: [],
      runs: [],
      accounts: [],
      agents: [],
      workers: [],
      executionEvents: [],
    };

    mergePendingCreatedConversationSnapshots({
      ...staleState,
      plans: [{ id: "plan-1", path: "vibes/ad-hoc/new.md" }],
      runs: [buildRun({ id: "run-1", planId: "plan-1" })],
      messages: [{
        id: "message-1",
        runId: "run-1",
        role: "user",
        kind: "checkpoint",
        content: "Start this",
        createdAt: "2026-04-27T00:01:00.000Z",
      }],
    }, pendingSnapshots);

    const lateStale = mergePendingCreatedConversationSnapshots(staleState, pendingSnapshots);

    expect(lateStale.runs.map((run) => run.id)).toEqual(["run-1"]);
    expect(pendingSnapshots.has("run-1")).toBe(true);
  });

  it("does not restore a stale running status when a selected-run snapshot omits another run's message", () => {
    const pendingMessage = {
      id: "message-b",
      runId: "run-b",
      role: "user" as const,
      kind: "checkpoint",
      content: "Start session B",
      createdAt: "2026-04-27T00:01:00.000Z",
    };
    const pendingSnapshots = new Map([
      ["run-b", {
        plan: { id: "plan-b", path: "vibes/ad-hoc/b.md" },
        run: buildRun({ id: "run-b", planId: "plan-b", status: "running" }),
        message: pendingMessage,
      }],
    ]);
    const terminalRun = buildRun({
      id: "run-b",
      planId: "plan-b",
      status: "done",
      updatedAt: "2026-04-27T00:02:00.000Z",
    });
    const fullyVisibleState: EventStreamState = {
      messages: [pendingMessage],
      plans: [{ id: "plan-b", path: "vibes/ad-hoc/b.md" }],
      runs: [terminalRun],
      accounts: [],
      agents: [],
      workers: [],
      executionEvents: [],
      messageScope: { runIds: ["run-b"], complete: true },
    };

    mergePendingCreatedConversationSnapshots(fullyVisibleState, pendingSnapshots, 1_000);

    const selectedRunSnapshot: EventStreamState = {
      ...fullyVisibleState,
      messages: [{
        id: "message-a",
        runId: "run-a",
        role: "user",
        kind: "checkpoint",
        content: "Continue session A",
        createdAt: "2026-04-27T00:03:00.000Z",
      }],
      messageScope: { runIds: ["run-a"], complete: true },
    };

    const merged = mergePendingCreatedConversationSnapshots(selectedRunSnapshot, pendingSnapshots, 2_000);

    expect(merged.runs.find((run) => run.id === "run-b")?.status).toBe("done");
    expect(merged.messages.map((message) => message.id)).toEqual(["message-a", "message-b"]);
  });

  it("does not restore a stale running status when another run's stream frame leaves the created run out", () => {
    // Session 74b271da861a: created in this tab, then the user moved to another
    // conversation. Stream frames for that conversation carry only its own run,
    // so every frame re-inserted the creation-time row and the finished session
    // read as running until the tab reloaded.
    const pendingMessage = {
      id: "message-b",
      runId: "run-b",
      role: "user" as const,
      kind: "checkpoint",
      content: "Start session B",
      createdAt: "2026-04-27T00:01:00.000Z",
    };
    const pendingSnapshots = new Map([
      ["run-b", {
        plan: { id: "plan-b", path: "vibes/ad-hoc/b.md" },
        run: buildRun({ id: "run-b", planId: "plan-b", status: "running" }),
        message: pendingMessage,
      }],
    ]);
    const emptyState: EventStreamState = {
      messages: [],
      plans: [],
      runs: [],
      accounts: [],
      agents: [],
      workers: [],
      executionEvents: [],
    };

    mergePendingCreatedConversationSnapshots({
      ...emptyState,
      messages: [pendingMessage],
      plans: [{ id: "plan-b", path: "vibes/ad-hoc/b.md" }],
      runs: [buildRun({ id: "run-b", planId: "plan-b", status: "running" })],
    }, pendingSnapshots, 1_000);
    // The run finishes while another conversation is selected: the frame that
    // carries the change has the run and its plan, but not its messages.
    mergePendingCreatedConversationSnapshots({
      ...emptyState,
      plans: [{ id: "plan-b", path: "vibes/ad-hoc/b.md" }],
      runs: [
        buildRun({ id: "run-a", planId: "plan-a" }),
        buildRun({ id: "run-b", planId: "plan-b", status: "done", updatedAt: "2026-04-27T00:02:00.000Z" }),
      ],
      messageScope: { runIds: ["run-a"], complete: true },
    }, pendingSnapshots, 2_000);

    const otherRunFrame = mergePendingCreatedConversationSnapshots({
      ...emptyState,
      runs: [buildRun({ id: "run-a", planId: "plan-a" })],
      messageScope: { runIds: ["run-a"], complete: true },
    }, pendingSnapshots, 3_000);

    expect(otherRunFrame.runs.find((run) => run.id === "run-b")?.status).toBe("done");
  });

  it("does not restore a stale running status for a run the server listed before its first message", () => {
    const pendingSnapshots = new Map([
      ["run-b", {
        plan: { id: "plan-b", path: "vibes/ad-hoc/b.md" },
        run: buildRun({ id: "run-b", planId: "plan-b", status: "running" }),
        message: {
          id: "message-b",
          runId: "run-b",
          role: "user" as const,
          kind: "checkpoint",
          content: "Start session B",
          createdAt: "2026-04-27T00:01:00.000Z",
        },
      }],
    ]);
    const emptyState: EventStreamState = {
      messages: [],
      plans: [],
      runs: [],
      accounts: [],
      agents: [],
      workers: [],
      executionEvents: [],
    };

    const finished = mergePendingCreatedConversationSnapshots({
      ...emptyState,
      plans: [{ id: "plan-b", path: "vibes/ad-hoc/b.md" }],
      runs: [buildRun({ id: "run-b", planId: "plan-b", status: "done" })],
      messageScope: { runIds: ["run-a"], complete: true },
    }, pendingSnapshots, 1_000);
    const otherRunFrame = mergePendingCreatedConversationSnapshots({
      ...emptyState,
      runs: [buildRun({ id: "run-a", planId: "plan-a" })],
      messageScope: { runIds: ["run-a"], complete: true },
    }, pendingSnapshots, 2_000);

    expect(finished.runs.find((run) => run.id === "run-b")?.status).toBe("done");
    expect(finished.messages.map((message) => message.id)).toEqual(["message-b"]);
    expect(otherRunFrame.runs.find((run) => run.id === "run-b")?.status).toBe("done");
  });

  it("drops the placeholder plan once the server lists the run before the create response returns", () => {
    const pendingSnapshots = new Map([["run-1", buildOptimisticCreatedConversationSnapshot({
      runId: "run-1",
      content: "Start this",
      projectPath: "/workspace/app",
      now: new Date("2026-04-27T00:01:00.000Z"),
    })]]);
    const emptyState: EventStreamState = {
      messages: [],
      plans: [],
      runs: [],
      accounts: [],
      agents: [],
      workers: [],
      executionEvents: [],
    };

    const listed = mergePendingCreatedConversationSnapshots({
      ...emptyState,
      plans: [{ id: "plan-1", path: "vibes/ad-hoc/server.md" }],
      runs: [buildRun({ id: "run-1", planId: "plan-1", status: "running" })],
    }, pendingSnapshots, 1_000);
    const stale = mergePendingCreatedConversationSnapshots(emptyState, pendingSnapshots, 2_000);

    expect(listed.plans.map((plan) => plan.id)).toEqual(["plan-1"]);
    expect(stale.plans.map((plan) => plan.id)).toEqual(["plan-1"]);
    expect(stale.runs[0]).toMatchObject({ id: "run-1", planId: "plan-1", status: "running" });
  });

  it("keeps a newly created conversation through stale payloads after a stable server-visible window", () => {
    const pendingSnapshots = new Map([
      ["run-1", {
        plan: { id: "plan-1", path: "vibes/ad-hoc/new.md" },
        run: buildRun({ id: "run-1", planId: "plan-1" }),
        message: {
          id: "message-1",
          runId: "run-1",
          role: "user",
          kind: "checkpoint",
          content: "Start this",
          createdAt: "2026-04-27T00:01:00.000Z",
        },
      }],
    ]);
    const staleState: EventStreamState = {
      messages: [],
      plans: [],
      runs: [],
      accounts: [],
      agents: [],
      workers: [],
      executionEvents: [],
    };
    const visibleState: EventStreamState = {
      ...staleState,
      plans: [{ id: "plan-1", path: "vibes/ad-hoc/new.md" }],
      runs: [buildRun({ id: "run-1", planId: "plan-1" })],
      messages: [{
        id: "message-1",
        runId: "run-1",
        role: "user",
        kind: "checkpoint",
        content: "Start this",
        createdAt: "2026-04-27T00:01:00.000Z",
      }],
    };

    mergePendingCreatedConversationSnapshots(visibleState, pendingSnapshots, 1_000);
    mergePendingCreatedConversationSnapshots(visibleState, pendingSnapshots, 11_000);

    const lateStale = mergePendingCreatedConversationSnapshots(staleState, pendingSnapshots, 11_001);

    expect(lateStale.runs.map((run) => run.id)).toEqual(["run-1"]);
    expect(pendingSnapshots.has("run-1")).toBe(true);
  });

  it("keeps pending deleted conversations out of live event stream snapshots", () => {
    const liveState: EventStreamState = {
      messages: [
        { id: "message-1", runId: "run-1", role: "user", content: "keep", createdAt: "2026-04-27T00:00:00.000Z" },
        { id: "message-2", runId: "run-2", role: "user", content: "delete", createdAt: "2026-04-27T00:00:00.000Z" },
      ],
      plans: [
        { id: "plan-1", path: "vibes/keep.md" },
        { id: "plan-2", path: "vibes/delete.md" },
      ],
      runs: [
        buildRun({ id: "run-1", planId: "plan-1" }),
        buildRun({ id: "run-2", planId: "plan-2" }),
      ],
      accounts: [],
      agents: [],
      workers: [
        { id: "worker-1", runId: "run-1", type: "codex", status: "idle", createdAt: "", updatedAt: "" },
        { id: "worker-2", runId: "run-2", type: "codex", status: "idle", createdAt: "", updatedAt: "" },
      ],
      executionEvents: [
        { id: "event-1", runId: "run-1", workerId: "worker-1", eventType: "keep", createdAt: "" },
        { id: "event-2", runId: "run-2", workerId: "worker-2", eventType: "delete", createdAt: "" },
      ],
    };

    const filtered = filterOptimisticallyDeletedRuns(liveState, new Set(["run-2"]));

    expect(filtered.runs.map((run) => run.id)).toEqual(["run-1"]);
    expect(filtered.messages.map((message) => message.id)).toEqual(["message-1"]);
    expect(filtered.workers.map((worker) => worker.id)).toEqual(["worker-1"]);
    expect(filtered.plans.map((plan) => plan.id)).toEqual(["plan-1"]);
    expect(filtered.executionEvents.map((event) => event.id)).toEqual(["event-1"]);
  });

  it("builds an optimistic created conversation snapshot for the sidebar before the server responds", () => {
    const createdAt = "2026-05-26T00:00:00.000Z";
    const snapshot = buildOptimisticCreatedConversationSnapshot({
      runId: "client-run-1",
      projectPath: "/workspace/app",
      preferredWorkerType: "codex",
      createdAt,
    });

    const next = appendCreatedConversationSnapshot({
      messages: [],
      plans: [{ id: "existing-plan", path: "/workspace/app/.omniharness/existing.md" }],
      runs: [buildRun({
        id: "existing-run",
        planId: "existing-plan",
        projectPath: "/workspace/app",
      })],
      accounts: [],
      agents: [],
      workers: [],
      executionEvents: [],
    }, snapshot);

    expect(snapshot.run).toEqual(expect.objectContaining({
      id: "client-run-1",
      planId: "client-run-1:optimistic-plan",
      status: "starting",
      projectPath: "/workspace/app",
      title: "New conversation",
      preferredWorkerType: "codex",
      createdAt,
      updatedAt: createdAt,
    }));
    expect(snapshot.plan).toEqual({
      id: "client-run-1:optimistic-plan",
      path: "/workspace/app/.omniharness/pending/client-run-1.md",
    });
    expect(next.runs.map((run) => run.id)).toEqual(["client-run-1", "existing-run"]);
  });

  it("keeps the explicitly selected account in an optimistic conversation snapshot", () => {
    const snapshot = buildOptimisticCreatedConversationSnapshot({
      runId: "run-account-selection",
      content: "Start with my selected Claude account",
      projectPath: null,
      preferredWorkerType: "claude",
      preferredWorkerAccountId: "claude-sub-1",
      createdAt: "2026-07-11T12:00:00.000Z",
    });

    expect(snapshot.run?.preferredWorkerAccountId).toBe("claude-sub-1");
  });

  it("restores persisted collapsed project paths from localStorage JSON", () => {
    expect(parseCollapsedProjectPaths('["/workspace/app","other",42,""]')).toEqual(new Set(["/workspace/app", "other"]));
    expect(parseCollapsedProjectPaths("{bad json")).toEqual(new Set());
  });

});

describe("optimistic sent conversation messages", () => {
  const emptyState = (): EventStreamState => ({
    messages: [],
    runs: [buildRun({ id: "run-1", status: "running" })],
    plans: [],
    accounts: [],
    agents: [],
    workers: [],
    executionEvents: [],
  });

  it("builds a user message row that renders through the direct conversation path", () => {
    const optimistic = buildOptimisticSentConversationMessage({
      runId: "run-1",
      content: "hello there",
      attachments: [{ id: "a1", kind: "image", name: "shot.png", mimeType: "image/png", size: 10 }],
    });

    // A plain uuid, not a recognisably-optimistic id: it is sent as
    // `clientMessageId` and adopted verbatim as the persisted row id, so the
    // bubble keeps one React key from send through delivery.
    expect(optimistic.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(optimistic).toMatchObject({
      runId: "run-1",
      role: "user",
      content: "hello there",
    });
    expect(optimistic.attachments).toHaveLength(1);
    expect(Number.isNaN(Date.parse(optimistic.createdAt))).toBe(false);
  });

  it("swaps the optimistic row for the server message in place", () => {
    const optimistic = buildOptimisticSentConversationMessage({ runId: "run-1", content: "hello" });
    const withOptimistic = appendSentConversationMessageSnapshot(emptyState(), optimistic);
    const serverMessage: MessageRecord = {
      id: "message-1",
      runId: "run-1",
      role: "user",
      content: "hello",
      createdAt: "2026-08-01T10:00:01.000Z",
    };

    const resolved = resolveOptimisticSentConversationMessage(withOptimistic, optimistic.id, serverMessage);

    expect(resolved.messages.map((message) => message.id)).toEqual(["message-1"]);
  });

  it("removes the optimistic row when the server produced no message row", () => {
    const optimistic = buildOptimisticSentConversationMessage({ runId: "run-1", content: "hello" });
    const withOptimistic = appendSentConversationMessageSnapshot(emptyState(), optimistic);

    const resolved = resolveOptimisticSentConversationMessage(withOptimistic, optimistic.id, null);

    expect(resolved.messages).toEqual([]);
  });

  it("does not duplicate a server message the snapshot already contains", () => {
    const optimistic = buildOptimisticSentConversationMessage({ runId: "run-1", content: "hello" });
    const serverMessage: MessageRecord = {
      id: "message-1",
      runId: "run-1",
      role: "user",
      content: "hello",
      createdAt: "2026-08-01T10:00:01.000Z",
    };
    const state = appendSentConversationMessageSnapshot(
      appendSentConversationMessageSnapshot(emptyState(), optimistic),
      serverMessage,
    );

    const resolved = resolveOptimisticSentConversationMessage(state, optimistic.id, serverMessage);

    expect(resolved.messages.map((message) => message.id)).toEqual(["message-1"]);
  });
});

describe("worker model normalization", () => {
  it("does not carry a saved effort from one worker/model pair into another", () => {
    expect(resolveComposerEffortForPair(null)).toBe("High");
    expect(resolveComposerEffortForPair("Low")).toBe("Low");
  });

  it("separates the Extra High display label from the xhigh protocol value", () => {
    expect(resolveComposerEffortValue("Extra High")).toBe("xhigh");
    expect(resolveComposerEffortValue("extra high")).toBe("xhigh");
    expect(resolveComposerEffortValue("extra-high")).toBe("xhigh");
    expect(resolveComposerEffortValue("Max")).toBe("max");
    expect(resolveComposerEffortLabel("xhigh")).toBe("Extra High");
    expect(resolveComposerEffortLabel("extra high")).toBe("Extra High");
    expect(resolveComposerEffortLabel("extra-high")).toBe("Extra High");
    expect(resolveComposerEffortLabel("max")).toBe("Max");
  });

  it("maps the GPT-5.6 family between Codex and OpenCode ids", () => {
    expect(resolveSelectedWorkerModel("opencode", "gpt-5.6-sol")).toBe("openai/gpt-5.6-sol");
    expect(resolveSelectedWorkerModel("opencode", "GPT-5.6 Terra")).toBe("openai/gpt-5.6-terra");
    expect(resolveSelectedWorkerModel("codex", "openai/gpt-5.6-luna")).toBe("gpt-5.6-luna");
  });

  it("maps the GPT-6 family between Codex and OpenCode ids", () => {
    expect(resolveSelectedWorkerModel("opencode", "gpt-6-sol")).toBe("openai/gpt-6-sol");
    expect(resolveSelectedWorkerModel("opencode", "GPT-6 Luna")).toBe("openai/gpt-6-luna");
    expect(resolveSelectedWorkerModel("codex", "openai/gpt-6-sol")).toBe("gpt-6-sol");
    expect(resolveSelectedWorkerModel("opencode", "GPT-6.1 Sol")).toBe("openai/gpt-6.1-sol");
    expect(resolveSelectedWorkerModel("codex", "openai/gpt-6.1-sol")).toBe("gpt-6.1-sol");
    expect(resolveSelectedWorkerModel("opencode", "GPT-6.1 Terra")).toBe("openai/gpt-6.1-terra");
    expect(resolveSelectedWorkerModel("codex", "openai/gpt-6.1-terra")).toBe("gpt-6.1-terra");
    expect(resolveSelectedWorkerModel("opencode", "GPT-6.2 Sol")).toBe("openai/gpt-6.2-sol");
    expect(resolveSelectedWorkerModel("codex", "openai/gpt-6.2-sol")).toBe("gpt-6.2-sol");
    expect(resolveSelectedWorkerModel("codex", "GPT-6.2 Astra")).toBe("gpt-6.2-astra");
  });

  it("restores GPT-5.6 selections using the provider's id shape", () => {
    expect(resolveComposerModelValue("gpt-5.6-sol")).toBe("gpt-5.6-sol");
    expect(resolveComposerModelValue("openai/gpt-5.6-sol")).toBe("openai/gpt-5.6-sol");
  });

  it("preserves explicit saved model choices without cross-provider substitution", () => {
    expect(resolveSavedComposerModel("claude-opus-5")).toBe("claude-opus-5");
    expect(resolveSavedComposerModel("gpt-5.4")).toBe("gpt-5.4");
    expect(resolveSavedComposerModel("  ")).toBe("");
  });

  it("chooses a valid model when the user explicitly switches workers", () => {
    const catalog = {
      codex: [{ value: "gpt-current", label: "GPT Current" }],
      claude: [{ value: "claude-current", label: "Claude Current" }],
    };

    expect(resolveComposerModelAfterWorkerChange({
      catalog,
      workerType: "claude",
      selectedModel: "gpt-current",
    })).toBe("claude-current");
  });

  it("keeps an equivalent model when the next worker supports its normalized id", () => {
    expect(resolveComposerModelAfterWorkerChange({
      catalog: undefined,
      workerType: "opencode",
      selectedModel: "gpt-5.6-sol",
    })).toBe("openai/gpt-5.6-sol");
  });
});
