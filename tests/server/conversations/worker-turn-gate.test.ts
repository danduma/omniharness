import { afterEach, describe, expect, it } from "vitest";
import {
  __resetWorkerTurnChainsForTests,
  waitForConversationBackgroundTasksForTests,
  trackConversationBackgroundTask,
} from "@/server/conversations/worker-turn-gate";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("conversation background task tracking", () => {
  afterEach(() => {
    __resetWorkerTurnChainsForTests();
  });

  it("waits for tracked fire-and-forget turns before cleanup proceeds", async () => {
    const task = deferred<void>();
    const tracked = trackConversationBackgroundTask(task.promise);
    let settled = false;
    const wait = waitForConversationBackgroundTasksForTests(1_000).then(() => {
      settled = true;
    });

    await Promise.resolve();
    expect(settled).toBe(false);

    task.resolve();
    await tracked;
    await wait;

    expect(settled).toBe(true);
  });
});
