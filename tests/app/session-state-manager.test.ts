import { describe, expect, it } from "vitest";
import { SessionStateManager } from "@/app/home/SessionStateManager";
import type { EventStreamState } from "@/app/home/types";

function baseState(): EventStreamState {
  return {
    messages: [],
    plans: [],
    runs: [],
    accounts: [],
    agents: [],
    workers: [],
    planItems: [],
    clarifications: [],
    executionEvents: [],
    supervisorInterventions: [],
    sessions: [],
  };
}

describe("SessionStateManager", () => {
  it("indexes selected session capabilities from event snapshots", () => {
    const manager = new SessionStateManager();
    manager.ingestSnapshot({
      ...baseState(),
      sessions: [{
        id: "r1",
        runId: "r1",
        sessionType: "process",
        status: "running",
        capabilities: ["send_input", "stop"],
        primaryActorId: "w1",
        title: "node script.js",
        projectPath: "/tmp",
      }],
    }, "r1");

    expect(manager.getSelectedSession()?.sessionType).toBe("process");
    expect(manager.hasCapability("send_input")).toBe(true);
    expect(manager.hasCapability("fork_session")).toBe(false);
  });
});
