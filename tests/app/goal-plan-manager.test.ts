import { describe, expect, it } from "vitest";
import { GoalPlanManager } from "@/interface/home/GoalPlanManager";

describe("GoalPlanManager", () => {
  it("owns presentation state without storing a goal snapshot", () => {
    const manager = new GoalPlanManager(100);
    manager.toggleExpanded("run-1");
    manager.beginEdit("run-1", "Initial");
    manager.setEditDraft("run-1", "Edited");
    expect(manager.getSnapshot()).toMatchObject({ editingRunId: "run-1", editDraft: "Edited", displayNowMs: 100 });
    expect(manager.getSnapshot().expandedRunIds.has("run-1")).toBe(true);
    expect(manager.getSnapshot()).not.toHaveProperty("goal");
  });

  it("suppresses duplicate operations and settles only the matching operation", () => {
    const manager = new GoalPlanManager();
    const operation = manager.beginOperation({ runId: "run-1", goalId: "goal-1", action: "pause", baseRevision: 3, objective: null, operationId: "op-1" });
    expect(operation).toMatchObject({ operationId: "op-1" });
    expect(manager.beginOperation({ runId: "run-1", goalId: "goal-1", action: "clear", baseRevision: 3, objective: null })).toBeNull();
    expect(manager.completeOperation("run-1", "other", 4)).toBe(false);
    expect(manager.completeOperation("run-1", "op-1", 4)).toBe(true);
    expect(manager.getSnapshot().pending).toBeNull();
  });

  it("retains a failed action for an explicit retry", () => {
    const manager = new GoalPlanManager();
    manager.beginOperation({ runId: "run-1", goalId: "goal-1", action: "resume", baseRevision: 5, objective: null, operationId: "op-1" });
    manager.failOperation("run-1", "op-1", "request_failed");
    const retry = manager.retryFailed();
    expect(retry).toMatchObject({ runId: "run-1", action: "resume", baseRevision: 5 });
    expect(retry?.operationId).not.toBe("op-1");
  });

  it("rebases an explicit retry onto the newest conflict snapshot", () => {
    const manager = new GoalPlanManager();
    manager.beginOperation({
      runId: "run-1",
      goalId: "goal-1",
      action: "edit",
      baseRevision: 3,
      objective: "Keep this edit",
      operationId: "op-1",
    });
    manager.failOperation("run-1", "op-1", "revision_conflict", {
      goalId: "goal-1",
      revision: 5,
    });

    expect(manager.retryFailed()).toMatchObject({
      goalId: "goal-1",
      baseRevision: 5,
      objective: "Keep this edit",
    });
  });

  it("drops a failed operation when a different goal replaces it", () => {
    const manager = new GoalPlanManager();
    manager.beginOperation({
      runId: "run-1", goalId: "goal-1", action: "edit", baseRevision: 2,
      objective: "Old edit", operationId: "op-1",
    });
    manager.failOperation("run-1", "op-1", "request_failed");

    expect(manager.observeServerRevision("run-1", 3, "goal-2")).toBe(true);
    expect(manager.getSnapshot()).toMatchObject({ failedOperation: null, actionError: null });
  });

  it("clears unconfirmed pending state on reconnect", () => {
    const manager = new GoalPlanManager();
    manager.beginOperation({ runId: "run-1", goalId: "goal-1", action: "edit", baseRevision: 2, objective: "Edited", operationId: "op-1" });
    manager.reconnect();
    expect(manager.getSnapshot()).toMatchObject({ pending: null, actionError: "request_failed" });
    expect(manager.observeServerRevision("run-1", 4, "goal-1")).toBe(true);
    expect(manager.retryFailed()).toMatchObject({ goalId: "goal-1", baseRevision: 4 });
  });

  it("resets presentation-only state when the selected run changes", () => {
    const manager = new GoalPlanManager();
    manager.switchRun("run-1");
    manager.toggleExpanded("run-1");
    manager.beginEdit("run-1", "Initial");
    manager.setClearConfirmation("run-1", true);
    manager.beginOperation({
      runId: "run-1",
      goalId: "goal-1",
      action: "edit",
      baseRevision: 2,
      objective: "Edited",
      operationId: "op-1",
    });

    expect(manager.switchRun("run-2")).toBe(true);
    expect(manager.getSnapshot()).toMatchObject({
      editingRunId: null,
      editDraft: "",
      pending: null,
      failedOperation: null,
      actionError: null,
      focusRunId: null,
      confirmingClearRunId: null,
    });
    expect(manager.getSnapshot().expandedRunIds.size).toBe(0);
    expect(manager.switchRun("run-2")).toBe(false);
  });
});
