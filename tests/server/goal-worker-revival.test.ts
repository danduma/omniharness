import { beforeEach, describe, expect, it, vi } from "vitest";
import { __resetNamedEventsForTests, getNamedEventsSince } from "@/server/events/named-events";
import { reviveGoalWorker } from "@/server/runs/goal-worker-revival";
import type { GoalSnapshot } from "@/shared/goal-plan";

function snapshot(overrides: Partial<GoalSnapshot> = {}): GoalSnapshot {
  return {
    schemaVersion: 1,
    runId: "run-1",
    goalId: "goal-1",
    revision: 2,
    leaseGeneration: 1,
    objective: "fix all of the bugs",
    status: "pending",
    startedAt: "2026-09-26T20:43:22.046Z",
    pausedAt: null,
    resumedAt: null,
    completedAt: null,
    clearedAt: null,
    updatedAt: "2026-09-26T20:43:22.079Z",
    workerId: "worker-1",
    acpSessionId: "session-1",
    plan: [],
    planSource: { kind: "none" },
    capabilities: { set: false, edit: false, pause: false, resume: false, clear: false, fallbackMethod: null },
    lastError: null,
    validationState: null,
    visible: true,
    provenance: { source: "server", complete: true, eventCursor: null },
    ...overrides,
  };
}

function dependencies(overrides: { mode?: string; runStatus?: string; workerStatus?: string } = {}) {
  return {
    loadRun: vi.fn(async () => ({ id: "run-1", mode: overrides.mode ?? "direct", status: overrides.runStatus ?? "running" }) as never),
    loadWorker: vi.fn(async () => ({ id: "worker-1", runId: "run-1", status: overrides.workerStatus ?? "idle" }) as never),
    resumeWorker: vi.fn(async () => ({})),
  };
}

function eventKinds() {
  return getNamedEventsSince(0).events.map((entry) => entry.event.kind);
}

describe("reviveGoalWorker", () => {
  beforeEach(() => {
    __resetNamedEventsForTests();
  });

  it("resumes the leased direct worker a reaped session left without a runtime", async () => {
    const deps = dependencies();

    await reviveGoalWorker(snapshot(), deps);

    expect(deps.resumeWorker).toHaveBeenCalledWith(
      expect.objectContaining({ id: "run-1" }),
      expect.objectContaining({ id: "worker-1" }),
    );
    expect(eventKinds()).toEqual(["goal.worker_revival.started", "goal.worker_revival.completed"]);
  });

  it("shares one resume between concurrent requests for the same run", async () => {
    const deps = dependencies();
    let release!: () => void;
    deps.resumeWorker.mockImplementation(() => new Promise((resolve) => { release = () => resolve({}); }));

    const first = reviveGoalWorker(snapshot(), deps);
    const second = reviveGoalWorker(snapshot({ status: "pursuing", revision: 3 }), deps);
    await vi.waitFor(() => expect(deps.resumeWorker).toHaveBeenCalledTimes(1));
    release();
    await Promise.all([first, second]);

    expect(deps.resumeWorker).toHaveBeenCalledTimes(1);
  });

  it.each([
    [{ status: "paused" as const }, {}, "goal_paused"],
    [{ workerId: null }, {}, "no_leased_worker"],
    [{}, { mode: "implementation" }, "not_direct_run"],
    [{}, { runStatus: "cancelled" }, "run_cancelled"],
    [{}, { workerStatus: "cancelled" }, "worker_cancelled"],
  ])("does not resume when %o / %o", async (goalOverrides, depOverrides, reason) => {
    const deps = dependencies(depOverrides);

    await reviveGoalWorker(snapshot(goalOverrides), deps);

    expect(deps.resumeWorker).not.toHaveBeenCalled();
    expect(getNamedEventsSince(0).events.map((entry) => entry.event)).toEqual([
      expect.objectContaining({ kind: "goal.worker_revival.skipped", reason }),
    ]);
  });

  it("surfaces a resume failure instead of leaving the goal silently parked", async () => {
    const deps = dependencies();
    deps.resumeWorker.mockRejectedValue(new Error("Spawn failed: boom"));

    await reviveGoalWorker(snapshot(), deps);

    expect(eventKinds()).toEqual([
      "goal.worker_revival.started",
      "goal.reconciliation.failed",
      "error.surfaced",
    ]);
    expect(getNamedEventsSince(0).events.at(-1)?.event).toMatchObject({
      code: "goal.reconciliation.failed",
      surface: "banner",
      workerId: "worker-1",
    });
  });
});
