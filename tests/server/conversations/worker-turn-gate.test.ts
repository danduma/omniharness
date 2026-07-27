import { afterEach, describe, expect, it } from "vitest";
import {
  __resetWorkerTurnChainsForTests,
  completeConversationDeletion,
  isConversationDeletionRequested,
  requestConversationDeletion,
  waitForConversationBackgroundTasks,
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

  it("keeps a deletion fence active until the run's background turn settles", async () => {
    const task = deferred<void>();
    const tracked = trackConversationBackgroundTask(task.promise, { runId: "run-delete-race" });

    requestConversationDeletion("run-delete-race");
    completeConversationDeletion("run-delete-race");
    expect(isConversationDeletionRequested("run-delete-race")).toBe(true);

    task.resolve();
    await tracked;
    await waitForConversationBackgroundTasksForTests();

    expect(isConversationDeletionRequested("run-delete-race")).toBe(false);
  });

  it("waits only for background turns owned by the conversation being deleted", async () => {
    const firstTask = deferred<void>();
    const secondTask = deferred<void>();
    const trackedFirstTask = trackConversationBackgroundTask(firstTask.promise, { runId: "run-a" });
    const trackedSecondTask = trackConversationBackgroundTask(secondTask.promise, { runId: "run-b" });
    let firstWaitSettled = false;
    const firstWait = waitForConversationBackgroundTasks("run-a", 1_000).then(() => {
      firstWaitSettled = true;
    });

    secondTask.resolve();
    await trackedSecondTask;
    await Promise.resolve();
    expect(firstWaitSettled).toBe(false);

    firstTask.resolve();
    await trackedFirstTask;
    await firstWait;

    expect(firstWaitSettled).toBe(true);
  });
});
