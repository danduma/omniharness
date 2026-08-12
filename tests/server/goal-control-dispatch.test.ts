import { describe, expect, it, vi } from "vitest";
import { createGoalControlDispatchCoordinator } from "@/server/runs/goal-control-dispatch";
import type { GoalSnapshot } from "@/shared/goal-plan";

function snapshot(revision: number, objective: string): GoalSnapshot {
  return {
    schemaVersion: 1,
    runId: "run-1",
    goalId: "goal-1",
    revision,
    leaseGeneration: 1,
    objective,
    status: "pursuing",
    startedAt: "2026-08-10T10:00:00.000Z",
    pausedAt: null,
    resumedAt: null,
    completedAt: null,
    clearedAt: null,
    updatedAt: "2026-08-10T10:00:00.000Z",
    workerId: "worker-1",
    acpSessionId: "session-1",
    plan: [],
    planSource: { kind: "none" },
    capabilities: { set: true, edit: true, pause: true, resume: true, clear: true, fallbackMethod: null },
    lastError: null,
    validationState: null,
    visible: true,
    provenance: { source: "server", complete: true, eventCursor: null },
  };
}

describe("GoalControlDispatchCoordinator", () => {
  it("replaces a stale outbound command with the newest canonical objective", async () => {
    const newest = snapshot(2, "Newest objective");
    const dispatch = vi.fn(async () => ({ kind: "dispatched" as const, method: "extension" as const }));
    const coordinator = createGoalControlDispatchCoordinator({
      getGoal: vi.fn(async () => newest),
      isControlSettled: vi.fn(async () => false),
      dispatch,
      markControlApplied: vi.fn(async () => true),
    });

    const result = await coordinator.dispatch(snapshot(1, "Stale objective"), "edit");

    expect(result).toMatchObject({ kind: "dispatched", snapshot: { revision: 2 }, action: "set" });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ revision: 2, objective: "Newest objective" }), "set");
  });

  it("serializes one run and reapplies the newest state after an in-flight revision changes", async () => {
    let current = snapshot(1, "First objective");
    let settledRevision: number | null = null;
    let releaseFirst!: () => void;
    let signalFirstStarted!: () => void;
    const firstStarted = new Promise<void>((resolve) => { signalFirstStarted = resolve; });
    const firstRelease = new Promise<void>((resolve) => { releaseFirst = resolve; });
    let activeDispatches = 0;
    let maximumActiveDispatches = 0;
    const dispatchedObjectives: string[] = [];
    const dispatch = vi.fn(async (goal: GoalSnapshot) => {
      activeDispatches += 1;
      maximumActiveDispatches = Math.max(maximumActiveDispatches, activeDispatches);
      dispatchedObjectives.push(goal.objective);
      if (goal.revision === 1) {
        signalFirstStarted();
        await firstRelease;
      }
      activeDispatches -= 1;
      return { kind: "dispatched" as const, method: "extension" as const };
    });
    const coordinator = createGoalControlDispatchCoordinator({
      getGoal: vi.fn(async () => current),
      isControlSettled: vi.fn(async (goal) => settledRevision === goal.revision),
      dispatch,
      markControlApplied: vi.fn(async (goal) => {
        if (goal.revision !== current.revision) return false;
        settledRevision = goal.revision;
        return true;
      }),
    });

    const first = coordinator.dispatch(current, "edit");
    await firstStarted;
    current = snapshot(2, "Second objective");
    const second = coordinator.dispatch(current, "edit");
    releaseFirst();
    await Promise.all([first, second]);

    expect(maximumActiveDispatches).toBe(1);
    expect(dispatchedObjectives).toEqual(["First objective", "Second objective"]);
    expect(settledRevision).toBe(2);
  });
});
