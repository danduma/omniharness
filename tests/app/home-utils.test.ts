import { describe, expect, it } from "vitest";
import { filterOptimisticallyDeletedRuns, getRunDurationLabel } from "@/app/home/utils";
import type { EventStreamState, RunRecord } from "@/app/home/types";

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
        { runId: "run-2" },
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
    expect(filtered.planItems.map((item) => item.id)).toEqual(["item-1"]);
    expect(filtered.clarifications).toEqual([]);
    expect(filtered.validationRuns).toEqual([]);
    expect(filtered.executionEvents.map((event) => event.id)).toEqual(["event-1"]);
  });
});
