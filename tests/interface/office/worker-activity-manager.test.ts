import { describe, expect, it } from "vitest";
import { WorkerActivityManager } from "@/interface/office/WorkerActivityManager";

function frame(workerId: string, activity: string, entrySeq: number, source = "tool_kind") {
  return { kind: "worker.activity", runId: "run-1", workerId, activity, prev: null, source, entrySeq };
}

describe("WorkerActivityManager", () => {
  it("keeps the latest activity per worker", () => {
    const manager = new WorkerActivityManager();
    manager.onActivityEvent(frame("w1", "researching", 2));
    manager.onActivityEvent(frame("w2", "writing", 5));
    manager.onActivityEvent(frame("w1", "testing", 7, "command_pattern"));
    expect(manager.get("w1")).toEqual({ activity: "testing", source: "command_pattern", entrySeq: 7 });
    expect(manager.get("w2")?.activity).toBe("writing");
    expect(manager.get("missing")).toBeNull();
  });

  it("ignores replayed frames older than what it already holds", () => {
    const manager = new WorkerActivityManager();
    manager.onActivityEvent(frame("w1", "testing", 7));
    const before = manager.getSnapshot();
    manager.onActivityEvent(frame("w1", "researching", 2));
    manager.onActivityEvent(frame("w1", "testing", 7));
    expect(manager.getSnapshot()).toBe(before);
  });

  it("rejects malformed payloads", () => {
    const manager = new WorkerActivityManager();
    manager.onActivityEvent(null);
    manager.onActivityEvent({ workerId: "w1", activity: "dancing", entrySeq: 1 });
    manager.onActivityEvent({ workerId: "w1", activity: "writing" });
    manager.onActivityEvent({ activity: "writing", entrySeq: 1 });
    expect(manager.getSnapshot()).toEqual({});
  });
});
