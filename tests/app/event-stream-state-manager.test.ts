import { describe, expect, it } from "vitest";
import { EventStreamStateManager } from "@/app/home/EventStreamStateManager";
import type { EventStreamState } from "@/app/home/types";

function createState(overrides: Partial<EventStreamState> = {}): EventStreamState {
  return {
    messages: [],
    plans: [],
    runs: [],
    accounts: [],
    agents: [],
    workers: [],
    planItems: [],
    clarifications: [],
    validationRuns: [],
    executionEvents: [],
    supervisorInterventions: [],
    frontendErrors: [],
    ...overrides,
  };
}

describe("EventStreamStateManager", () => {
  it("keeps live worker output when a persisted-only snapshot arrives for the same active worker", () => {
    const manager = new EventStreamStateManager(createState());
    manager.update(createState({
      workers: [{ id: "run-1-worker-1", runId: "run-1", type: "codex", status: "working" }],
      agents: [{
        name: "run-1-worker-1",
        type: "codex",
        state: "working",
        currentText: "Reading files",
        displayText: "Reading files",
        bridgeMissing: false,
      }],
    }));

    const next = manager.update(createState({
      workers: [{ id: "run-1-worker-1", runId: "run-1", type: "codex", status: "working" }],
      agents: [{
        name: "run-1-worker-1",
        type: "codex",
        state: "working",
        currentText: "",
        displayText: "",
        lastText: "Older persisted output",
        outputEntries: [],
        bridgeMissing: true,
      }],
    }));

    expect(next.agents[0]).toEqual(expect.objectContaining({
      name: "run-1-worker-1",
      currentText: "Reading files",
      displayText: "Reading files",
      bridgeMissing: false,
    }));
  });

  it("accepts persisted-only snapshots for finished workers", () => {
    const manager = new EventStreamStateManager(createState({
      workers: [{ id: "run-1-worker-1", runId: "run-1", type: "codex", status: "working" }],
      agents: [{
        name: "run-1-worker-1",
        type: "codex",
        state: "working",
        currentText: "Reading files",
        displayText: "Reading files",
        bridgeMissing: false,
      }],
    }));

    const next = manager.update(createState({
      workers: [{ id: "run-1-worker-1", runId: "run-1", type: "codex", status: "done" }],
      agents: [{
        name: "run-1-worker-1",
        type: "codex",
        state: "done",
        currentText: "",
        displayText: "",
        lastText: "Finished",
        bridgeMissing: true,
      }],
    }));

    expect(next.agents[0]).toEqual(expect.objectContaining({
      state: "done",
      lastText: "Finished",
      bridgeMissing: true,
    }));
  });
});
