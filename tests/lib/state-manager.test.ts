import { describe, expect, test } from "vitest";
import { StateManager } from "@/lib/state-manager";

describe("StateManager", () => {
  test("does not notify listeners when setting a key to the existing value", () => {
    const manager = new StateManager({ count: 1, label: "ready" });
    let notificationCount = 0;
    manager.subscribe(() => {
      notificationCount += 1;
    });

    const snapshotBefore = manager.getSnapshot();
    const snapshotAfter = manager.setKey("count", 1);

    expect(snapshotAfter).toBe(snapshotBefore);
    expect(notificationCount).toBe(0);
  });
});
