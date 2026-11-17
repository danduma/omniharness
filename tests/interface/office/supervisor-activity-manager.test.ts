import { describe, expect, it } from "vitest";
import { SupervisorActivityManager, supervisorActivityOf } from "@/interface/office/SupervisorActivityManager";

const run = "run-1";

describe("SupervisorActivityManager", () => {
  it("follows a supervisor turn from thinking back to idle", () => {
    const manager = new SupervisorActivityManager();
    expect(manager.activityFor(run)).toBe("idle");
    manager.onSupervisorEvent({ kind: "supervisor.wake_lease_acquired", runId: run, source: "insert" });
    expect(manager.activityFor(run)).toBe("thinking");
    manager.onSupervisorEvent({ kind: "supervisor.wake_lease_released", runId: run });
    expect(manager.activityFor(run)).toBe("idle");
  });

  it("remembers a later check-back scheduled during the turn", () => {
    const manager = new SupervisorActivityManager();
    manager.onSupervisorEvent({ kind: "supervisor.wake_lease_acquired", runId: run, source: "insert" });
    manager.onSupervisorEvent({ kind: "supervisor.wake_scheduled", runId: run, delayMs: 120_000, source: "volatile" });
    expect(manager.activityFor(run)).toBe("thinking");
    manager.onSupervisorEvent({ kind: "supervisor.wake_lease_released", runId: run });
    expect(manager.activityFor(run)).toBe("scheduled");
    // The scheduled wake firing starts a new turn.
    manager.onSupervisorEvent({ kind: "supervisor.wake_lease_acquired", runId: run, source: "insert" });
    manager.onSupervisorEvent({ kind: "supervisor.wake_lease_released", runId: run });
    expect(manager.activityFor(run)).toBe("idle");
  });

  it("ignores immediate wakes and short lease retries", () => {
    const manager = new SupervisorActivityManager();
    manager.onSupervisorEvent({ kind: "supervisor.wake_scheduled", runId: run, delayMs: 0, source: "volatile" });
    manager.onSupervisorEvent({ kind: "supervisor.wake_scheduled", runId: run, delayMs: 5_000, source: "lease_retry" });
    expect(manager.activityFor(run)).toBe("idle");
  });

  it("shows a stop until the next turn, keeps runs separate, and resets", () => {
    const manager = new SupervisorActivityManager();
    manager.onSupervisorEvent({ kind: "supervisor.wake_lease_acquired", runId: run, source: "insert" });
    manager.onSupervisorEvent({ kind: "supervisor.wake_lease_acquired", runId: "run-2", source: "insert" });
    manager.onSupervisorEvent({ kind: "supervisor.stopped", runId: run, reason: "explicit" });
    expect(manager.activityFor(run)).toBe("stopped");
    expect(manager.activityFor("run-2")).toBe("thinking");
    manager.onSupervisorEvent({ kind: "supervisor.wake_lease_acquired", runId: run, source: "insert" });
    expect(manager.activityFor(run)).toBe("thinking");

    manager.onSupervisorEvent(null);
    manager.onSupervisorEvent({ kind: "supervisor.wake_lease_acquired" });
    manager.reset();
    expect(manager.getSnapshot()).toEqual({});
    expect(manager.activityFor(null)).toBe("idle");
  });

  it("does not notify when nothing changes", () => {
    const manager = new SupervisorActivityManager();
    manager.onSupervisorEvent({ kind: "supervisor.wake_lease_released", runId: run });
    const snapshot = manager.getSnapshot();
    manager.onSupervisorEvent({ kind: "supervisor.wake_lease_released", runId: run });
    expect(manager.getSnapshot()).toBe(snapshot);
    expect(supervisorActivityOf(undefined)).toBe("idle");
  });
});
