import { describe, expect, it } from "vitest";
import {
  GOAL_OBJECTIVE_MAX_LENGTH,
  canTransitionGoalStatus,
  createDeterministicGoalPlanItemId,
  normalizeGoalCapabilities,
  parseGoalSnapshot,
  validateGoalObjective,
} from "@/shared/goal-plan";

describe("goal plan shared contract", () => {
  it("accepts a trimmed objective within the bound", () => {
    expect(validateGoalObjective("  Ship durable goals  ")).toEqual({
      ok: true,
      objective: "Ship durable goals",
    });
  });

  it("rejects empty and oversized objectives", () => {
    expect(validateGoalObjective("  ")).toEqual({
      ok: false,
      code: "empty",
      maxLength: GOAL_OBJECTIVE_MAX_LENGTH,
    });
    expect(validateGoalObjective("x".repeat(GOAL_OBJECTIVE_MAX_LENGTH + 1))).toEqual({
      ok: false,
      code: "too_long",
      maxLength: GOAL_OBJECTIVE_MAX_LENGTH,
    });
  });

  it("allows only explicit goal state transitions", () => {
    expect(canTransitionGoalStatus("absent", "pending")).toBe(true);
    expect(canTransitionGoalStatus("pursuing", "paused")).toBe(true);
    expect(canTransitionGoalStatus("validating", "completed")).toBe(true);
    expect(canTransitionGoalStatus("error", "pursuing")).toBe(true);
    expect(canTransitionGoalStatus("cleared", "pursuing")).toBe(false);
    expect(canTransitionGoalStatus("completed", "pursuing")).toBe(false);
    expect(canTransitionGoalStatus("paused", "completed")).toBe(false);
  });

  it("creates stable ids without using an item's array index", () => {
    const first = createDeterministicGoalPlanItemId({
      goalId: "goal-1",
      revision: 3,
      title: "Persist state",
      phase: "storage",
    });
    const second = createDeterministicGoalPlanItemId({
      goalId: "goal-1",
      revision: 3,
      title: "Persist state",
      phase: "storage",
    });
    expect(first).toBe(second);
    expect(first).toMatch(/^goal-item-/);
    expect(createDeterministicGoalPlanItemId({
      goalId: "goal-1",
      revision: 4,
      title: "Persist state",
      phase: "storage",
    })).not.toBe(first);
  });

  it("normalizes partial capability input to an explicit safe set", () => {
    expect(normalizeGoalCapabilities({ set: true, pause: 1, clear: true })).toEqual({
      set: true,
      edit: false,
      pause: false,
      resume: false,
      clear: true,
      fallbackMethod: null,
    });
  });

  it("validates complete snapshots and rejects malformed revisions", () => {
    const valid = {
      schemaVersion: 1,
      runId: "run-1",
      goalId: "goal-1",
      revision: 1,
      leaseGeneration: 0,
      objective: "Ship durable goals",
      status: "pending",
      startedAt: "2026-08-10T10:00:00.000Z",
      pausedAt: null,
      resumedAt: null,
      completedAt: null,
      clearedAt: null,
      updatedAt: "2026-08-10T10:00:00.000Z",
      workerId: null,
      acpSessionId: null,
      plan: [],
      planSource: { kind: "none" },
      capabilities: normalizeGoalCapabilities(null),
      lastError: null,
      validationState: null,
      visible: true,
      provenance: { source: "server", complete: true, eventCursor: 12 },
    } as const;

    expect(parseGoalSnapshot(valid)).toEqual(valid);
    expect(() => parseGoalSnapshot({ ...valid, revision: -1 })).toThrow(/revision/i);
  });
});
