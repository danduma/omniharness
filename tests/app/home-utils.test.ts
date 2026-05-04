import { describe, expect, it } from "vitest";
import { appendCreatedConversationSnapshot, appendSentConversationMessageSnapshot, buildConversationTimelineItems, classifyExecutionEvent, filterOptimisticallyDeletedRuns, formatExecutionWorkerLabel, getExecutionEventDetailRows, getRunDurationLabel, mergePendingCreatedConversationSnapshots, mergePendingSentConversationMessages, parseCollapsedProjectPaths, shouldOpenExecutionDetailsForRun, shouldRenderMessageInMainConversation, shouldShowConversationExecutionPanel, shouldShowRecoverableRunningState, summarizeExecutionEvent, summarizeInlineEvent } from "@/app/home/utils";
import type { EventStreamState, ExecutionEventRecord, MessageRecord, RunRecord } from "@/app/home/types";

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

  it("keeps supervisor activity visible for failed conversations with execution events", () => {
    expect(shouldShowConversationExecutionPanel({
      selectedRun: buildRun({ status: "failed" }),
      isConversationThinking: false,
      executionEventCount: 1,
    })).toBe(true);
  });

  it("opens supervisor activity details automatically for failed conversations", () => {
    expect(shouldOpenExecutionDetailsForRun({
      selectedRun: buildRun({ status: "failed" }),
      executionEventCount: 1,
    })).toBe(true);
  });

  it("summarizes clarification activity without repeating the full question", () => {
    expect(summarizeExecutionEvent({
      id: "event-1",
      runId: "run-1",
      eventType: "clarification_requested",
      details: JSON.stringify({ summary: "Do you want me to implement the design?" }),
      createdAt: "2026-04-27T00:00:00.000Z",
    })).toBe("Waiting for your reply");
  });

  it("intersperses useful supervisor activity with conversation messages by timestamp", () => {
    const timeline = buildConversationTimelineItems({
      messages: [
        {
          id: "message-1",
          runId: "run-1",
          role: "user",
          kind: "checkpoint",
          content: "Start this",
          createdAt: "2026-04-27T00:00:00.000Z",
        },
        {
          id: "message-2",
          runId: "run-1",
          role: "worker",
          kind: "worker_output",
          workerId: "worker-1",
          content: "Prompted worker-1:\nDo the thing\n\nResponse:\nDone",
          createdAt: "2026-04-27T00:00:20.000Z",
        },
      ],
      executionEvents: [
        buildExecutionEvent({
          id: "event-1",
          workerId: "worker-1",
          eventType: "worker_prompted",
          details: JSON.stringify({ summary: "Sent follow-up to worker-1" }),
          createdAt: "2026-04-27T00:00:10.000Z",
        }),
        buildExecutionEvent({
          id: "event-2",
          workerId: "worker-1",
          eventType: "worker_output_changed",
          details: JSON.stringify({ summary: "worker-1 produced new output" }),
          createdAt: "2026-04-27T00:00:15.000Z",
        }),
      ],
    });

    expect(timeline.map((item) => `${item.type}:${item.id}`)).toEqual([
      "message:message-1",
      "message:message-2",
    ]);
  });

  it("omits supervisor wait chatter from the main conversation timeline", () => {
    const timeline = buildConversationTimelineItems({
      messages: [
        {
          id: "message-1",
          runId: "run-1",
          role: "system",
          kind: "supervisor_action",
          content: "Waiting 5s before the next check: Worker is actively checking available browser tooling/deps.",
          createdAt: "2026-04-27T00:00:10.000Z",
        },
      ],
      executionEvents: [
        buildExecutionEvent({
          id: "event-1",
          eventType: "supervisor_wait",
          details: JSON.stringify({
            seconds: 5,
            summary: "Worker is actively checking available browser tooling/deps.",
          }),
          createdAt: "2026-04-27T00:00:10.000Z",
        }),
      ],
    });

    expect(timeline).toEqual([]);
  });

  it("keeps routine supervisor logs out of the main conversation timeline", () => {
    const timeline = buildConversationTimelineItems({
      messages: [],
      executionEvents: [
        buildExecutionEvent({
          id: "event-inspected",
          eventType: "supervisor_repo_inspected",
          details: JSON.stringify({ summary: "Inspected repository with rg supervisor_wait." }),
          createdAt: "2026-04-27T00:00:10.000Z",
        }),
        buildExecutionEvent({
          id: "event-prompted",
          workerId: "worker-1",
          eventType: "worker_prompted",
          details: JSON.stringify({ summary: "Sent follow-up to worker-1" }),
          createdAt: "2026-04-27T00:00:11.000Z",
        }),
        buildExecutionEvent({
          id: "event-read",
          eventType: "supervisor_file_read",
          details: JSON.stringify({ path: "docs/plan.md", summary: "Read docs/plan.md for supervisor context." }),
          createdAt: "2026-04-27T00:00:12.000Z",
        }),
        buildExecutionEvent({
          id: "event-blocked",
          workerId: "worker-1",
          eventType: "worker_spawn_blocked",
          details: JSON.stringify({ summary: "Blocked duplicate worker spawn because worker-1 is active." }),
          createdAt: "2026-04-27T00:00:13.000Z",
        }),
      ],
    });

    expect(timeline.map((item) => `${item.type}:${item.id}:${item.type === "activity" ? item.text : ""}`)).toEqual([
      "activity:event-read:Read docs/plan.md",
      "activity:event-blocked:Blocked duplicate worker spawn because worker-1 is active.",
    ]);
  });

  it("classifies routine supervisor and worker events away from the transcript", () => {
    expect(classifyExecutionEvent(buildExecutionEvent({ eventType: "worker_prompt_deferred" }))).toBe("dynamic_status");
    expect(classifyExecutionEvent(buildExecutionEvent({ eventType: "worker_stuck" }))).toBe("dynamic_status");
    expect(classifyExecutionEvent(buildExecutionEvent({ eventType: "supervisor_wait" }))).toBe("run_log");
    expect(classifyExecutionEvent(buildExecutionEvent({ eventType: "worker_prompted" }))).toBe("run_log");
    expect(classifyExecutionEvent(buildExecutionEvent({ eventType: "worker_output_changed" }))).toBe("run_log");
    expect(classifyExecutionEvent(buildExecutionEvent({ eventType: "worker_idle" }))).toBe("run_log");
  });

  it("classifies actionable events as inline feed signals with summaries", () => {
    const actionableEvents = [
      "worker_spawn_blocked",
      "worker_permission_requested",
      "worker_permission_approved",
      "worker_permission_denied",
      "run_validation_failed",
      "worker_environment_mismatch",
      "worker_session_missing",
      "run_failed",
    ];

    for (const eventType of actionableEvents) {
      const event = buildExecutionEvent({
        eventType,
        workerId: "worker-1",
        details: JSON.stringify({ summary: `${eventType} summary`, reason: `${eventType} reason` }),
      });
      expect(classifyExecutionEvent(event)).toBe("inline_event");
      expect(summarizeInlineEvent(event)).toBeTruthy();
    }
  });

  it("keeps duplicate stuck worker events out of the main conversation timeline", () => {
    const timeline = buildConversationTimelineItems({
      messages: [],
      executionEvents: [
        buildExecutionEvent({
          id: "stuck-1",
          workerId: "worker-1",
          eventType: "worker_stuck",
          details: JSON.stringify({ summary: "worker-1 appears stuck after 90 seconds without meaningful progress" }),
          createdAt: "2026-04-27T00:00:10.000Z",
        }),
        buildExecutionEvent({
          id: "stuck-2",
          workerId: "worker-1",
          eventType: "worker_stuck",
          details: JSON.stringify({ summary: "worker-1 appears stuck after 90 seconds without meaningful progress" }),
          createdAt: "2026-04-27T00:00:11.000Z",
        }),
        buildExecutionEvent({
          id: "stuck-3",
          workerId: "worker-1",
          eventType: "worker_stuck",
          details: JSON.stringify({ summary: "worker-1 appears stuck after 90 seconds without meaningful progress" }),
          createdAt: "2026-04-27T00:00:12.000Z",
        }),
      ],
    });

    expect(timeline).toEqual([]);
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
      hasActiveWorker: false,
      hasStuckWorker: false,
      activeWorkerCount: 0,
      latestExecutionEventCreatedAt: null,
      nowMs: new Date("2026-04-27T00:00:31.000Z").getTime(),
    })).toBe(true);
  });

  it("optimistically appends a sent follow-up message and revives the run status", () => {
    const liveState: EventStreamState = {
      messages: [],
      plans: [],
      runs: [buildRun({ status: "cancelled" })],
      accounts: [],
      agents: [],
      workers: [],
      planItems: [],
      clarifications: [],
      validationRuns: [],
      executionEvents: [],
      supervisorInterventions: [],
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
      planItems: [],
      clarifications: [],
      validationRuns: [],
      executionEvents: [],
      supervisorInterventions: [],
    };

    const preserved = mergePendingSentConversationMessages(staleState, pendingMessages);

    expect(preserved.messages).toEqual([message]);
    expect(preserved.runs[0]?.status).toBe("running");
    expect(pendingMessages.has(message.id)).toBe(true);

    const caughtUp = mergePendingSentConversationMessages({
      ...staleState,
      messages: [message],
    }, pendingMessages);

    expect(caughtUp.messages).toEqual([message]);
    expect(pendingMessages.has(message.id)).toBe(false);
  });

  it("optimistically appends a newly created conversation with its sidebar records", () => {
    const liveState: EventStreamState = {
      messages: [],
      plans: [],
      runs: [],
      accounts: [],
      agents: [],
      workers: [],
      planItems: [],
      clarifications: [],
      validationRuns: [],
      executionEvents: [],
      supervisorInterventions: [],
    };

    const next = appendCreatedConversationSnapshot(liveState, {
      plan: {
        id: "plan-1",
        path: "vibes/ad-hoc/new.md",
      },
      run: buildRun({
        id: "run-1",
        planId: "plan-1",
        mode: "implementation",
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
      planItems: [],
      clarifications: [],
      validationRuns: [],
      executionEvents: [],
      supervisorInterventions: [],
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

    expect(pendingSnapshots.has("run-1")).toBe(false);
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
      planItems: [],
      clarifications: [],
      validationRuns: [],
      executionEvents: [],
      supervisorInterventions: [],
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
      planItems: [
        { id: "item-1", planId: "plan-1", title: "keep", phase: null, status: "pending" },
        { id: "item-2", planId: "plan-2", title: "delete", phase: null, status: "pending" },
      ],
      clarifications: [
        { id: "clarification-1", runId: "run-2", question: "delete?", answer: null, status: "pending" },
      ],
      validationRuns: [
        { id: "validation-1", runId: "run-2", planItemId: null, status: "pending", summary: null, evidence: null },
      ],
      executionEvents: [
        { id: "event-1", runId: "run-1", workerId: "worker-1", eventType: "keep", createdAt: "" },
        { id: "event-2", runId: "run-2", workerId: "worker-2", eventType: "delete", createdAt: "" },
      ],
      supervisorInterventions: [
        { id: "intervention-1", runId: "run-1", workerId: "worker-1", interventionType: "continue", prompt: "keep", createdAt: "" },
        { id: "intervention-2", runId: "run-2", workerId: "worker-2", interventionType: "continue", prompt: "delete", createdAt: "" },
      ],
    };

    const filtered = filterOptimisticallyDeletedRuns(liveState, new Set(["run-2"]));

    expect(filtered.runs.map((run) => run.id)).toEqual(["run-1"]);
    expect(filtered.messages.map((message) => message.id)).toEqual(["message-1"]);
    expect(filtered.workers.map((worker) => worker.id)).toEqual(["worker-1"]);
    expect(filtered.plans.map((plan) => plan.id)).toEqual(["plan-1"]);
    expect(filtered.planItems.map((item) => item.id)).toEqual(["item-1"]);
    expect(filtered.clarifications).toEqual([]);
    expect(filtered.validationRuns).toEqual([]);
    expect(filtered.executionEvents.map((event) => event.id)).toEqual(["event-1"]);
    expect(filtered.supervisorInterventions.map((event) => event.id)).toEqual(["intervention-1"]);
  });

  it("restores persisted collapsed project paths from localStorage JSON", () => {
    expect(parseCollapsedProjectPaths('["/workspace/app","other",42,""]')).toEqual(new Set(["/workspace/app", "other"]));
    expect(parseCollapsedProjectPaths("{bad json")).toEqual(new Set());
  });

  it("summarizes missing saved worker sessions without presenting them as bridge failures", () => {
    expect(summarizeExecutionEvent({
      id: "event-1",
      runId: "run-1",
      workerId: "worker-1",
      eventType: "worker_session_missing",
      details: JSON.stringify({
        summary: "Saved bridge session for worker-1 is no longer available",
      }),
      createdAt: "2026-04-27T00:00:00.000Z",
    })).toBe("worker-1 session is no longer available");
  });

  it("uses short worker labels in execution event summaries", () => {
    const workerId = "5b1bf465-75cc-4484-b4b0-514d04a0ddf4-worker-3";

    expect(formatExecutionWorkerLabel(workerId)).toBe("worker-3");
    expect(summarizeExecutionEvent(buildExecutionEvent({
      workerId,
      eventType: "worker_stopped",
      details: JSON.stringify({
        summary: `${workerId} stopped`,
      }),
    }))).toBe("worker-3 stopped");
  });

  it("renders useful execution event details without repeating the summary", () => {
    const rows = getExecutionEventDetailRows(buildExecutionEvent({
      workerId: "run-1-worker-3",
      eventType: "worker_environment_mismatch",
      details: JSON.stringify({
        summary: "run-1-worker-3 launched in the wrong directory",
        workerCwd: ".",
        resolvedWorkerCwd: "/workspace/app",
        cancelError: null,
      }),
    }));

    expect(rows).toEqual([
      expect.objectContaining({ key: "workerCwd", label: "Worker cwd", value: "." }),
      expect.objectContaining({ key: "resolvedWorkerCwd", label: "Resolved cwd", value: "/workspace/app" }),
    ]);
  });
});
