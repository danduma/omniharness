import { describe, expect, it } from "vitest";
import {
  __resetWorkerTurnAbortsForTests,
  abortWorkerTurn,
  currentWorkerTurnSignal,
  hasLiveWorkerTurn,
  isWorkerTurnAbortedError,
  runWorkerTurn,
} from "@/server/conversations/worker-turn-gate";

describe("worker turn abort", () => {
  it("publishes the running turn's signal to everything the turn calls", async () => {
    __resetWorkerTurnAbortsForTests();
    let nestedSignal: AbortSignal | undefined;

    await runWorkerTurn("worker-signal", async (signal) => {
      // Deeply nested callers read it ambiently rather than threading a param.
      const nested = async () => {
        nestedSignal = currentWorkerTurnSignal();
      };
      await nested();
      expect(nestedSignal).toBe(signal);
    });

    expect(nestedSignal).toBeDefined();
    expect(currentWorkerTurnSignal()).toBeUndefined();
  });

  it("ends a turn that would otherwise never finish, without waiting on the agent", async () => {
    __resetWorkerTurnAbortsForTests();
    // Stands in for a wedged agent: an ask whose stream never produces another
    // byte. Before the abort path existed this could only end when the agent
    // decided to end it, so stop and steer had to wait for it.
    const wedgedTurn = runWorkerTurn("worker-wedged", (signal) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    }));

    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(hasLiveWorkerTurn("worker-wedged")).toBe(true);

    const abortedAt = Date.now();
    expect(abortWorkerTurn("worker-wedged", "user stop")).toBe(true);
    await expect(wedgedTurn).rejects.toSatisfy(isWorkerTurnAbortedError);
    expect(Date.now() - abortedAt).toBeLessThan(200);
    expect(hasLiveWorkerTurn("worker-wedged")).toBe(false);
  });

  it("lets the next turn start immediately after the previous one is aborted", async () => {
    __resetWorkerTurnAbortsForTests();
    const wedgedTurn = runWorkerTurn("worker-replace", (signal) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    }));
    wedgedTurn.catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 5));

    // This is what steer does: abort, then deliver the replacement turn.
    const requestedAt = Date.now();
    abortWorkerTurn("worker-replace", "user steer");
    const replacement = await runWorkerTurn("worker-replace", async () => "replacement ran");

    expect(replacement).toBe("replacement ran");
    expect(Date.now() - requestedAt).toBeLessThan(200);
  });

  it("reports no live turn to abort when the worker is idle", () => {
    __resetWorkerTurnAbortsForTests();
    expect(abortWorkerTurn("worker-idle")).toBe(false);
    expect(hasLiveWorkerTurn("worker-idle")).toBe(false);
  });

  it("does not abort a turn twice", async () => {
    __resetWorkerTurnAbortsForTests();
    const turn = runWorkerTurn("worker-once", (signal) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    }));
    turn.catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(abortWorkerTurn("worker-once")).toBe(true);
    expect(abortWorkerTurn("worker-once")).toBe(false);
    await expect(turn).rejects.toSatisfy(isWorkerTurnAbortedError);
  });
});
