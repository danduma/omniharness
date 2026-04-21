import { describe, expect, it } from "vitest";
import { deriveWorkerEvents } from "@/server/supervisor/observer";

describe("deriveWorkerEvents", () => {
  it("records output changes without waking the supervisor immediately", () => {
    const { nextState, events } = deriveWorkerEvents({
      workerId: "worker-1",
      snapshot: {
        state: "working",
        currentText: "running tests",
        lastText: "editing files",
        stderrBuffer: [],
        stopReason: null,
      },
      previous: undefined,
      now: 1_000,
    });

    expect(nextState.idleNotified).toBe(false);
    expect(events).toEqual([
      expect.objectContaining({
        type: "worker_output_changed",
        shouldWakeSupervisor: false,
        updatesActivity: true,
      }),
    ]);
  });

  it("wakes the supervisor when a worker has been idle for thirty seconds", () => {
    const { events } = deriveWorkerEvents({
      workerId: "worker-1",
      snapshot: {
        state: "working",
        currentText: "same output",
        lastText: "same output",
        stderrBuffer: [],
        stopReason: null,
      },
      previous: {
        fingerprint: JSON.stringify({
          state: "working",
          currentText: "same output",
          lastText: "same output",
          stopReason: null,
          stderrTail: [],
        }),
        lastChangedAt: 0,
        idleNotified: false,
      },
      now: 30_000,
    });

    expect(events).toEqual([
      expect.objectContaining({
        type: "worker_idle",
        shouldWakeSupervisor: true,
        updatesActivity: false,
      }),
    ]);
  });
});
