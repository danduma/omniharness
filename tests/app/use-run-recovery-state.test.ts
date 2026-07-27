import { describe, expect, it } from "vitest";
import { resolveSelectedRecoveryState } from "@/app/home/useRunRecoveryState";
import type { EventStreamState } from "@/app/home/types";

function baseState(overrides: Partial<EventStreamState> = {}): EventStreamState {
  return {
    messages: [],
    readMarkers: {},
    plans: [],
    runs: [],
    accounts: [],
    agents: [],
    workers: [],
    planItems: [],
    clarifications: [],
    executionEvents: [],
    supervisorInterventions: [],
    queuedMessages: [],
    recoveryIncidents: [],
    recoveryState: null,
    frontendErrors: [],
    ...overrides,
  };
}

describe("resolveSelectedRecoveryState", () => {
  it("drops stale quota recovery state once the selected run is terminal", () => {
    const state = baseState({
      runs: [{
        id: "run-1",
        planId: "plan-1",
        mode: "direct",
        status: "done",
        createdAt: "2026-07-09T13:00:00.000Z",
        updatedAt: "2026-07-09T13:20:09.000Z",
        projectPath: null,
        title: "Finished run",
      }],
      recoveryState: {
        kind: "quota_waiting",
        status: "open",
        workerId: "run-1-worker-1",
        recommendedAction: "wait_for_quota_reset",
        resumeAt: "2026-07-09T13:20:01.000Z",
      },
    });

    expect(resolveSelectedRecoveryState(state, "run-1")).toBeNull();
  });

  it("keeps quota recovery state while the selected run is still waiting", () => {
    const recoveryState = {
      kind: "quota_waiting",
      status: "open",
      workerId: "run-1-worker-1",
      recommendedAction: "wait_for_quota_reset",
      resumeAt: "2026-07-09T13:20:01.000Z",
    };
    const state = baseState({
      runs: [{
        id: "run-1",
        planId: "plan-1",
        mode: "direct",
        status: "quota_waiting",
        createdAt: "2026-07-09T13:00:00.000Z",
        updatedAt: "2026-07-09T13:03:00.000Z",
        projectPath: null,
        title: "Waiting run",
      }],
      recoveryState,
    });

    expect(resolveSelectedRecoveryState(state, "run-1")).toBe(recoveryState);
  });
});
