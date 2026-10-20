import { afterEach, describe, expect, it } from "vitest";
import { __resetNamedEventsForTests, getNamedEventsSince } from "@/server/events/named-events";
import { runSyncPassWithStallGuard } from "@/server/conversations/sync-pass-guard";

function events(kind: string) {
  return getNamedEventsSince(0).events
    .map((entry) => entry.event)
    .filter((event) => event.kind === kind);
}

afterEach(() => {
  __resetNamedEventsForTests();
});

describe("runSyncPassWithStallGuard", () => {
  it("resolves with the pass when it finishes in time and reports nothing", async () => {
    let ran = false;
    await runSyncPassWithStallGuard(async (progress) => {
      progress.at("live_run", "run-1");
      ran = true;
    }, { stallMs: 1_000 });
    expect(ran).toBe(true);
    expect(events("sync.pass_stalled")).toEqual([]);
  });

  it("propagates a pass failure that happens before the stall window", async () => {
    await expect(runSyncPassWithStallGuard(async () => {
      throw new Error("boom");
    }, { stallMs: 1_000 })).rejects.toThrow("boom");
  });

  it("releases a hung pass, names its step, and reports when it finally settles", async () => {
    let finishHungPass!: () => void;
    const hung = new Promise<void>((resolve) => { finishHungPass = resolve; });

    // A queue shaped like syncConversationSessions: each pass waits for the last.
    let queue: Promise<void> = Promise.resolve();
    const enqueue = (pass: Parameters<typeof runSyncPassWithStallGuard>[0]) => {
      const next = queue.then(() => runSyncPassWithStallGuard(pass, { stallMs: 50 }));
      queue = next.catch(() => undefined);
      return next;
    };

    const first = enqueue(async (progress) => {
      progress.at("persist_worker_output", "run-1", "run-1-worker-2");
      await hung;
    });
    let secondRan = false;
    const second = enqueue(async () => {
      secondRan = true;
    });

    await first;
    await second;
    expect(secondRan).toBe(true);
    expect(events("sync.pass_stalled")).toEqual([
      expect.objectContaining({
        step: "persist_worker_output",
        runId: "run-1",
        workerId: "run-1-worker-2",
      }),
    ]);
    expect(events("error.surfaced")).toEqual([
      expect.objectContaining({ code: "sync.pass_stalled", surface: "log", runId: "run-1", workerId: "run-1-worker-2" }),
    ]);

    finishHungPass();
    await hung;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(events("sync.stalled_pass_settled")).toEqual([
      expect.objectContaining({ step: "persist_worker_output", outcome: "resolved" }),
    ]);
  });
});
