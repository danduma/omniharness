import { describe, expect, it, vi } from "vitest";
import { LiveEventConnectionManager, LiveEventCursorManager } from "@/interface/home/LiveEventConnectionManager";
import type { EventStreamHandlers, RuntimeAPIs } from "@/runtime-api/types";
import type { GoalSnapshot } from "@/shared/goal-plan";

const snapshot: GoalSnapshot = {
  schemaVersion: 1,
  runId: "run-1",
  goalId: "goal-1",
  revision: 2,
  leaseGeneration: 1,
  objective: "Apply ordered events",
  status: "pursuing",
  startedAt: "2026-08-10T10:00:00.000Z",
  pausedAt: null,
  resumedAt: null,
  completedAt: null,
  clearedAt: null,
  updatedAt: "2026-08-10T10:01:00.000Z",
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

describe("goal live events", () => {
  it("advances the shared cursor and ignores a duplicate named frame", async () => {
    let handlers: EventStreamHandlers | null = null;
    const events = {
      snapshot: vi.fn(async () => ({ data: {
        messages: [], plans: [], runs: [], accounts: [], agents: [], workers: [], planItems: [], clarifications: [], executionEvents: [], supervisorInterventions: [],
      }, lastEventId: "epoch:1" })),
      open: vi.fn((_input, nextHandlers) => {
        handlers = nextHandlers;
        return { close: vi.fn() };
      }),
    } satisfies Pick<RuntimeAPIs["events"], "snapshot" | "open">;
    const cursor = new LiveEventCursorManager("epoch:1");
    const applyGoalEvent = vi.fn(() => true);
    const manager = new LiveEventConnectionManager({
      selectedRunId: "run-1",
      cursor,
      events,
      applyUpdate: vi.fn(),
      applyGoalEvent,
      reportError: vi.fn(),
      snapshotValidationIntervalMs: null,
    });
    manager.start();
    handlers!.onEvent({ kind: "goal.updated", payload: { eventKey: "run-1/2/goal.updated", snapshot }, lastEventId: "epoch:2" });
    handlers!.onEvent({ kind: "goal.updated", payload: { eventKey: "run-1/2/goal.updated", snapshot }, lastEventId: "epoch:2" });

    expect(applyGoalEvent).toHaveBeenCalledTimes(1);
    expect(applyGoalEvent).toHaveBeenCalledWith(snapshot, "run-1/2/goal.updated");
    expect(cursor.getCurrent()).toBe("epoch:2");
    manager.stop();
  });
});
