"use client";

import { StateManager } from "@/lib/state-manager";
import type { RuntimeAPIs } from "@/runtime-api/types";
import { parseGoalSnapshot, type GoalMutationAction, type GoalSnapshot } from "@/shared/goal-plan";

export type GoalPlanActionError =
  | "invalid_objective"
  | "revision_conflict"
  | "unsupported_action"
  | "request_failed";

export interface GoalPlanPendingOperation {
  runId: string;
  goalId: string;
  operationId: string;
  action: GoalMutationAction;
  baseRevision: number;
  objective: string | null;
}

function operationErrorKind(error: unknown): GoalPlanActionError {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === "goal.objective.invalid") return "invalid_objective";
  if (code === "goal.revision_conflict") return "revision_conflict";
  if (code === "goal.action.unsupported") return "unsupported_action";
  return "request_failed";
}

function operationErrorSnapshot(error: unknown) {
  const details = (error as { details?: unknown } | null)?.details;
  if (!details || typeof details !== "object") return null;
  const goal = (details as { goal?: unknown }).goal;
  if (!goal || typeof goal !== "object") return null;
  try {
    return parseGoalSnapshot(goal);
  } catch {
    return null;
  }
}

interface GoalPlanPresentationState {
  expandedRunIds: ReadonlySet<string>;
  editingRunId: string | null;
  editDraft: string;
  pending: GoalPlanPendingOperation | null;
  failedOperation: GoalPlanPendingOperation | null;
  actionError: GoalPlanActionError | null;
  focusRunId: string | null;
  confirmingClearRunId: string | null;
  displayNowMs: number;
}

function createOperationId() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `goal-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export class GoalPlanManager extends StateManager<GoalPlanPresentationState> {
  private clockUsers = 0;
  private clockTimer: ReturnType<typeof setInterval> | null = null;
  private selectedRunId: string | null = null;

  constructor(nowMs = Date.now()) {
    super({
      expandedRunIds: new Set(),
      editingRunId: null,
      editDraft: "",
      pending: null,
      failedOperation: null,
      actionError: null,
      focusRunId: null,
      confirmingClearRunId: null,
      displayNowMs: nowMs,
    });
  }

  switchRun(runId: string | null) {
    if (this.selectedRunId === runId) return false;
    this.selectedRunId = runId;
    this.patch({
      expandedRunIds: new Set(),
      editingRunId: null,
      editDraft: "",
      pending: null,
      failedOperation: null,
      actionError: null,
      focusRunId: null,
      confirmingClearRunId: null,
    });
    return true;
  }

  toggleExpanded(runId: string) {
    this.setKey("expandedRunIds", (current) => {
      const next = new Set(current);
      if (next.has(runId)) next.delete(runId);
      else next.add(runId);
      return next;
    });
  }

  beginEdit(runId: string, objective: string) {
    if (this.getSnapshot().pending) return false;
    this.patch({ editingRunId: runId, editDraft: objective, actionError: null, focusRunId: null });
    return true;
  }

  setEditDraft(runId: string, editDraft: string) {
    if (this.getSnapshot().editingRunId !== runId) return;
    this.patch({ editDraft, actionError: null });
  }

  cancelEdit(runId: string) {
    if (this.getSnapshot().editingRunId !== runId) return;
    this.patch({ editingRunId: null, editDraft: "", actionError: null, focusRunId: runId });
  }

  setActionError(actionError: GoalPlanActionError | null) {
    this.setKey("actionError", actionError);
  }

  setClearConfirmation(runId: string, open: boolean) {
    this.setKey("confirmingClearRunId", open ? runId : null);
  }

  beginOperation(args: Omit<GoalPlanPendingOperation, "operationId"> & { operationId?: string }) {
    if (this.getSnapshot().pending) return null;
    const pending = { ...args, operationId: args.operationId ?? createOperationId() };
    this.patch({ pending, failedOperation: null, actionError: null });
    return pending;
  }

  async executeOperation(args: {
    goalsApi: RuntimeAPIs["goals"];
    operation: GoalPlanPendingOperation;
    onSnapshot: (snapshot: GoalSnapshot, eventKey: string | null) => void;
  }): Promise<{ ok: true; snapshot: GoalSnapshot } | { ok: false }> {
    const { goalsApi, operation, onSnapshot } = args;
    try {
      const response = operation.action === "edit" || operation.action === "set"
        ? await goalsApi.put({
            runId: operation.runId,
            body: {
              goalId: operation.goalId,
              expectedRevision: operation.baseRevision,
              operationId: operation.operationId,
              objective: operation.objective ?? "",
            },
          })
        : await goalsApi.act({
            runId: operation.runId,
            body: {
              goalId: operation.goalId,
              expectedRevision: operation.baseRevision,
              operationId: operation.operationId,
              action: operation.action,
            },
          });
      const snapshot = parseGoalSnapshot((response as { goal?: unknown }).goal);
      onSnapshot(snapshot, null);
      this.completeOperation(operation.runId, operation.operationId, snapshot.revision);
      return { ok: true, snapshot };
    } catch (error) {
      const newest = operationErrorSnapshot(error);
      if (newest) onSnapshot(newest, null);
      this.failOperation(
        operation.runId,
        operation.operationId,
        operationErrorKind(error),
        newest ? { goalId: newest.goalId, revision: newest.revision } : undefined,
      );
      return { ok: false };
    }
  }

  completeOperation(runId: string, operationId: string, serverRevision: number) {
    const pending = this.getSnapshot().pending;
    if (!pending || pending.runId !== runId || pending.operationId !== operationId) return false;
    if (serverRevision < pending.baseRevision) return false;
    this.patch({
      pending: null,
      failedOperation: null,
      actionError: null,
      editingRunId: null,
      editDraft: "",
      focusRunId: runId,
      confirmingClearRunId: null,
    });
    return true;
  }

  failOperation(
    runId: string,
    operationId: string,
    error: GoalPlanActionError,
    retrySnapshot?: { goalId: string; revision: number },
  ) {
    const pending = this.getSnapshot().pending;
    if (!pending || pending.runId !== runId || pending.operationId !== operationId) return false;
    this.patch({
      pending: null,
      failedOperation: retrySnapshot
        ? { ...pending, goalId: retrySnapshot.goalId, baseRevision: retrySnapshot.revision }
        : pending,
      actionError: error,
      focusRunId: runId,
    });
    return true;
  }

  observeServerRevision(runId: string, revision: number, goalId?: string) {
    const pending = this.getSnapshot().pending;
    if (pending && pending.runId === runId && revision > pending.baseRevision) {
      return this.completeOperation(runId, pending.operationId, revision);
    }
    const failed = this.getSnapshot().failedOperation;
    if (!failed || failed.runId !== runId || revision <= failed.baseRevision) return false;
    if (goalId && goalId !== failed.goalId) {
      this.patch({ failedOperation: null, actionError: null });
      return true;
    }
    this.setKey("failedOperation", {
      ...failed,
      baseRevision: revision,
    });
    return true;
  }

  retryFailed() {
    const failed = this.getSnapshot().failedOperation;
    if (!failed || this.getSnapshot().pending) return null;
    const pending = { ...failed, operationId: createOperationId() };
    this.patch({ pending, failedOperation: null, actionError: null });
    return pending;
  }

  reconnect() {
    const current = this.getSnapshot();
    if (!current.pending) return;
    this.patch({ pending: null, failedOperation: current.pending, actionError: "request_failed" });
  }

  takeFocusIntent(runId: string) {
    if (this.getSnapshot().focusRunId !== runId) return false;
    this.update((current) => ({ ...current, focusRunId: null }), false);
    return true;
  }

  retainClock() {
    this.clockUsers += 1;
    if (this.clockTimer) return;
    this.clockTimer = setInterval(() => this.setKey("displayNowMs", Date.now()), 1_000);
  }

  releaseClock() {
    this.clockUsers = Math.max(0, this.clockUsers - 1);
    if (this.clockUsers > 0 || !this.clockTimer) return;
    clearInterval(this.clockTimer);
    this.clockTimer = null;
  }
}

export const goalPlanManager = new GoalPlanManager();
