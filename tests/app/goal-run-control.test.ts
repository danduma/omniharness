import { describe, expect, it } from "vitest";
import { resolveGoalRunControl } from "@/components/home/GoalPlanCard";
import { canTransitionGoalStatus, type GoalCapabilities, type GoalSnapshot, type GoalStatus } from "@/shared/goal-plan";

function goal(status: GoalStatus, capabilities: Partial<GoalCapabilities> = {}): GoalSnapshot {
  return {
    schemaVersion: 1,
    runId: "run-1",
    goalId: "goal-1",
    revision: 3,
    leaseGeneration: 1,
    objective: "Ship it",
    status,
    startedAt: "2026-09-06T10:00:00.000Z",
    pausedAt: null,
    resumedAt: null,
    completedAt: null,
    clearedAt: null,
    updatedAt: "2026-09-06T10:00:00.000Z",
    workerId: "worker-1",
    acpSessionId: "session-1",
    plan: [],
    planSource: { kind: "none" },
    capabilities: {
      set: false,
      edit: false,
      pause: false,
      resume: false,
      clear: false,
      fallbackMethod: null,
      ...capabilities,
    },
    lastError: null,
    validationState: null,
    visible: true,
    provenance: { source: "server", complete: true, eventCursor: null },
  };
}

describe("goal run control", () => {
  it("offers a resume on every stalled status, including an agent with no capabilities", () => {
    for (const status of ["pending", "paused", "waiting_user", "blocked", "limited", "error"] as GoalStatus[]) {
      expect(resolveGoalRunControl(goal(status))).toEqual({
        action: "retry",
        labelKey: "goal.action.resume",
      });
    }
  });

  it("sends resume rather than retry when the agent advertises the capability", () => {
    expect(resolveGoalRunControl(goal("paused", { resume: true }))).toEqual({
      action: "resume",
      labelKey: "goal.action.resume",
    });
  });

  it("offers pause only while the goal is being pursued by an agent that can pause", () => {
    expect(resolveGoalRunControl(goal("pursuing", { pause: true }))).toEqual({
      action: "pause",
      labelKey: "goal.action.pause",
    });
    expect(resolveGoalRunControl(goal("pursuing"))).toBeNull();
  });

  it("offers nothing once the goal is settled or mid-validation", () => {
    for (const status of ["validating", "completed", "cleared", "absent"] as GoalStatus[]) {
      expect(resolveGoalRunControl(goal(status))).toBeNull();
    }
  });

  it("only offers a control the durable state machine would accept", () => {
    for (const status of ["pending", "paused", "waiting_user", "blocked", "limited", "error"] as GoalStatus[]) {
      expect(canTransitionGoalStatus(status, "pursuing")).toBe(true);
    }
  });
});
