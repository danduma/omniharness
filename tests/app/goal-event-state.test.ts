import { describe, expect, it } from "vitest";
import { EventStreamStateManager } from "@/interface/home/EventStreamStateManager";
import type { EventStreamState } from "@/shared/home-types";
import type { GoalSnapshot } from "@/shared/goal-plan";

function state(overrides: Partial<EventStreamState> = {}): EventStreamState {
  return {
    messages: [],
    plans: [],
    runs: [{ id: "run-1", planId: "plan-1", status: "running", createdAt: "2026-08-10T10:00:00.000Z", projectPath: null, title: null }],
    accounts: [],
    agents: [],
    workers: [],
    planItems: [],
    clarifications: [],
    executionEvents: [],
    supervisorInterventions: [],
    ...overrides,
  };
}

function goal(revision: number, objective = `Goal ${revision}`): GoalSnapshot {
  return {
    schemaVersion: 1,
    runId: "run-1",
    goalId: "goal-1",
    revision,
    leaseGeneration: 0,
    objective,
    status: "pending",
    startedAt: "2026-08-10T10:00:00.000Z",
    pausedAt: null,
    resumedAt: null,
    completedAt: null,
    clearedAt: null,
    updatedAt: `2026-08-10T10:00:0${revision}.000Z`,
    workerId: null,
    acpSessionId: null,
    plan: [],
    planSource: { kind: "none" },
    capabilities: { set: false, edit: false, pause: false, resume: false, clear: false, fallbackMethod: null },
    lastError: null,
    validationState: null,
    visible: true,
    provenance: { source: "server", complete: true, eventCursor: null },
  };
}

describe("goal event state", () => {
  it("applies only newer canonical goal revisions", () => {
    const manager = new EventStreamStateManager(state({ goalsByRunId: { "run-1": goal(1) } }), { deferCacheHydration: true });
    expect(manager.applyGoalEvent(goal(3), "run-1/3/goal.updated")).toBe(true);
    expect(manager.applyGoalEvent(goal(2), "run-1/2/goal.updated")).toBe(false);
    expect(manager.getSnapshot().goalsByRunId?.["run-1"]?.revision).toBe(3);
  });

  it("does not let a stale snapshot overwrite a newer event", () => {
    const manager = new EventStreamStateManager(state({ goalsByRunId: { "run-1": goal(3, "Newest") } }), { deferCacheHydration: true });
    manager.updateFromServer(state({
      snapshotRunId: "run-1",
      snapshotSource: "server",
      goalsByRunId: { "run-1": goal(2, "Stale") },
    }));
    expect(manager.getSnapshot().goalsByRunId?.["run-1"]).toMatchObject({ revision: 3, objective: "Newest" });
  });

  it("lets a complete selected-run server snapshot clear an absent goal", () => {
    const manager = new EventStreamStateManager(state({ goalsByRunId: { "run-1": goal(1) } }), { deferCacheHydration: true });
    manager.updateFromServer(state({ snapshotRunId: "run-1", snapshotSource: "server", goalsByRunId: {} }));
    expect(manager.getSnapshot().goalsByRunId?.["run-1"]).toBeUndefined();
  });
});
