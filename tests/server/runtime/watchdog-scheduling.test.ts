import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetNamedEventsForTests,
  getNamedEventsSince,
} from "@/server/events/named-events";
import { createRuntimeWatchdogSweepRunner } from "@/server/runtime/watchdog";

describe("runtime watchdog scheduling", () => {
  beforeEach(() => {
    __resetNamedEventsForTests();
  });

  it("shares an in-flight sweep instead of starting overlapping database work", async () => {
    let finishSweep!: () => void;
    const sweep = vi.fn()
      .mockImplementationOnce(() => new Promise<void>((resolve) => {
        finishSweep = resolve;
      }))
      .mockResolvedValue(undefined);
    const runSweep = createRuntimeWatchdogSweepRunner(sweep);

    const first = runSweep();
    const second = runSweep();

    await Promise.resolve();
    expect(sweep).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);

    finishSweep();
    await first;

    await runSweep();
    expect(sweep).toHaveBeenCalledTimes(2);
  });

  it("reports a failed background sweep without rejecting the timer task", async () => {
    const writeSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const runSweep = createRuntimeWatchdogSweepRunner(async () => {
      throw new Error("SQLITE_BUSY: database is locked");
    });

    await expect(runSweep()).resolves.toBeUndefined();

    expect(getNamedEventsSince(0).events.map((entry) => entry.event)).toContainEqual({
      kind: "runtime.watchdog_sweep_failed",
      reason: "SQLITE_BUSY: database is locked",
    });
    expect(writeSpy).toHaveBeenCalledWith(
      "[runtime-watchdog] sweep failed: SQLITE_BUSY: database is locked\n",
    );
  });
});
