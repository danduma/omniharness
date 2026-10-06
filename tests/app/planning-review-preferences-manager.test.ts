import { describe, expect, it, vi } from "vitest";
import { PlanningReviewPreferencesManager } from "@/interface/home/PlanningReviewPreferencesManager";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe("PlanningReviewPreferencesManager", () => {
  it("does not let an older failed save roll back a newer successful choice", async () => {
    const older = deferred<void>();
    const newer = deferred<void>();
    const save = vi.fn().mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
    const manager = new PlanningReviewPreferencesManager();
    manager.configure(save);

    const first = manager.setRounds(2);
    const second = manager.setRounds(3);
    newer.resolve();
    await second;
    expect(manager.getSnapshot()).toMatchObject({ rounds: 3, isSaving: true });

    older.reject(new Error("old request failed"));
    await first;

    expect(manager.getSnapshot()).toMatchObject({ rounds: 3, isSaving: false, saveError: null });
  });
});
