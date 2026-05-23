import { describe, expect, it } from "vitest";
import { buildSupervisorActivityCard } from "@/app/home/supervisor-activity";
import type { AgentSnapshot, ExecutionEventRecord, RunRecord } from "@/app/home/types";
import type { ConversationWorkerRecord } from "@/lib/conversation-workers";

const run: RunRecord = {
  id: "run-1",
  planId: "plan-1",
  mode: "implementation",
  status: "running",
  createdAt: "2026-05-21T00:00:00.000Z",
  projectPath: "/repo",
  title: "Implement plan",
};

const liveExecutionStatus = {
  label: "Working",
  detail: "Worker 2 is running the verification pass.",
  tone: "active" as const,
};

function event(overrides: Partial<ExecutionEventRecord>): ExecutionEventRecord {
  return {
    id: overrides.id ?? "event-1",
    runId: overrides.runId ?? "run-1",
    eventType: overrides.eventType ?? "supervisor_turn_ended",
    details: overrides.details ?? JSON.stringify({ summary: "Checking the workers." }),
    createdAt: overrides.createdAt ?? "2026-05-21T00:05:00.000Z",
    workerId: overrides.workerId ?? null,
    planItemId: overrides.planItemId ?? null,
  };
}

describe("buildSupervisorActivityCard", () => {
  it("shows every active worker and excludes finished workers", () => {
    const workers: ConversationWorkerRecord[] = [
      { id: "run-1-worker-1", runId: "run-1", type: "codex", status: "working", workerNumber: 1, title: "Implement renderer" },
      { id: "run-1-worker-2", runId: "run-1", type: "codex", status: "idle", workerNumber: 2, title: "Validate renderer" },
      { id: "run-1-worker-3", runId: "run-1", type: "codex", status: "cancelled", workerNumber: 3, title: "Old attempt" },
    ];
    const agents: AgentSnapshot[] = [
      { name: "run-1-worker-1", state: "working", currentText: "Editing the shader resolver tests." },
      { name: "run-1-worker-2", state: "idle", lastText: "Waiting for supervisor review." },
      { name: "run-1-worker-3", state: "cancelled", lastText: "Stale text." },
    ];

    const card = buildSupervisorActivityCard({
      selectedRun: run,
      liveExecutionStatus,
      activeWorkers: workers.filter((worker) => worker.status !== "cancelled"),
      agents,
      executionEvents: [],
      nowMs: new Date("2026-05-21T00:06:00.000Z").getTime(),
    });

    expect(card.workers.map((worker) => worker.workerId)).toEqual(["run-1-worker-1", "run-1-worker-2"]);
    expect(card.workers[0]).toMatchObject({
      title: "Implement renderer",
      workerType: "codex",
      statusKey: "supervisor.activity.worker.status.working",
      activityText: "Editing the shader resolver tests.",
    });
    expect(card.workers[1]).toMatchObject({
      title: "Validate renderer",
      statusKey: "supervisor.activity.worker.status.idle",
    });
  });

  it("prioritizes attention signals over ordinary worker output", () => {
    const workers: ConversationWorkerRecord[] = [
      { id: "run-1-worker-1", runId: "run-1", type: "codex", status: "working", workerNumber: 1, title: "Implement renderer" },
      { id: "run-1-worker-2", runId: "run-1", type: "codex", status: "stuck", workerNumber: 2, title: "Validate renderer" },
    ];
    const agents: AgentSnapshot[] = [
      {
        name: "run-1-worker-1",
        state: "working",
        currentText: "Still writing code.",
        pendingPermissions: [{ requestId: 1, requestedAt: "2026-05-21T00:05:00.000Z" }],
      },
      { name: "run-1-worker-2", state: "stuck", currentText: "Running tests." },
    ];

    const card = buildSupervisorActivityCard({
      selectedRun: run,
      liveExecutionStatus,
      activeWorkers: workers,
      agents,
      executionEvents: [],
    });

    expect(card.workers[0]).toMatchObject({
      attentionKey: "supervisor.activity.attention.permission",
      activityKey: "supervisor.activity.worker.permission",
      tone: "warning",
    });
    expect(card.workers[1]).toMatchObject({
      attentionKey: "supervisor.activity.attention.stuck",
      activityKey: "supervisor.activity.worker.stuck",
      tone: "warning",
    });
  });

  it("uses the implementing phase when workers are running normally", () => {
    const workers: ConversationWorkerRecord[] = [
      { id: "run-1-worker-4", runId: "run-1", type: "codex", status: "working", workerNumber: 4, title: "Validator: final plan check" },
    ];

    const card = buildSupervisorActivityCard({
      selectedRun: run,
      liveExecutionStatus,
      activeWorkers: workers,
      agents: [{ name: "run-1-worker-4", state: "working", currentText: "Checking acceptance criteria." }],
      executionEvents: [event({ details: JSON.stringify({ summary: "Worker 4 is checking acceptance criteria." }) })],
    });

    expect(card.phaseKey).toBe("supervisor.activity.phase.implementing");
    expect(card.detailText).toBe("Worker 2 is running the verification pass.");
  });

  it("uses a supervisor-only phase before any worker exists", () => {
    const card = buildSupervisorActivityCard({
      selectedRun: run,
      liveExecutionStatus: {
        label: "Working",
        detail: "Omni is deciding how to start the implementation.",
        tone: "active",
      },
      activeWorkers: [],
      agents: [],
      executionEvents: [],
    });

    expect(card.phaseKey).toBe("supervisor.activity.phase.supervisorThinking");
    expect(card.workers).toEqual([]);
  });

  it("prefers the latest user-facing worker message over raw current text", () => {
    const workers: ConversationWorkerRecord[] = [
      { id: "run-1-worker-7", runId: "run-1", type: "gemini", status: "working", workerNumber: 7, title: "Implement filters" },
    ];

    const card = buildSupervisorActivityCard({
      selectedRun: run,
      liveExecutionStatus,
      activeWorkers: workers,
      agents: [{
        name: "run-1-worker-7",
        type: "gemini",
        state: "working",
        currentText: "Raw streaming scratch text from the CLI.",
        outputEntries: [
          {
            id: "msg-1",
            type: "message",
            text: "I updated the resolver and am running the focused regression tests.",
            timestamp: "2026-05-21T00:05:00.000Z",
          },
        ],
      }],
      executionEvents: [event({ workerId: "run-1-worker-7", details: JSON.stringify({ summary: "worker output changed" }) })],
    });

    expect(card.workers[0]).toMatchObject({
      workerType: "gemini",
      activityText: "I updated the resolver and am running the focused regression tests.",
    });
  });

  it("does not infer an unblocking phase from incidental supervisor text", () => {
    const workers: ConversationWorkerRecord[] = [
      { id: "run-1-worker-5", runId: "run-1", type: "codex", status: "working", workerNumber: 5, title: "Implement plan" },
    ];

    const card = buildSupervisorActivityCard({
      selectedRun: run,
      liveExecutionStatus,
      activeWorkers: workers,
      agents: [{ name: "run-1-worker-5", state: "working", currentText: "Waiting for the planner to recover the latest blocked items." }],
      executionEvents: [event({ details: JSON.stringify({ summary: "Supervisor is waiting on a recover step." }) })],
    });

    expect(card.phaseKey).toBe("supervisor.activity.phase.implementing");
  });

  it("does not treat a normal end_turn stopReason as a worker error", () => {
    const workers: ConversationWorkerRecord[] = [
      { id: "run-1-worker-end", runId: "run-1", type: "codex", status: "idle", workerNumber: 1, title: "Implement plan" },
    ];

    const card = buildSupervisorActivityCard({
      selectedRun: run,
      liveExecutionStatus,
      activeWorkers: workers,
      agents: [{
        name: "run-1-worker-end",
        state: "idle",
        stopReason: "end_turn",
        lastText: "All done.",
      }],
      executionEvents: [],
    });

    expect(card.workers[0]?.activityKey).not.toBe("supervisor.activity.worker.error");
    expect(card.workers[0]?.attentionKey).not.toBe("supervisor.activity.attention.error");
    expect(card.workers[0]?.tone).not.toBe("error");
  });

  it("flags unblocking when an agent has a pending permission request", () => {
    const workers: ConversationWorkerRecord[] = [
      { id: "run-1-worker-6", runId: "run-1", type: "codex", status: "working", workerNumber: 6, title: "Implement plan" },
    ];

    const card = buildSupervisorActivityCard({
      selectedRun: run,
      liveExecutionStatus,
      activeWorkers: workers,
      agents: [{
        name: "run-1-worker-6",
        state: "working",
        currentText: "Working.",
        pendingPermissions: [{ requestId: 1, requestedAt: "2026-05-21T00:05:00.000Z" }],
      }],
      executionEvents: [],
    });

    expect(card.phaseKey).toBe("supervisor.activity.phase.unblocking");
  });
});
