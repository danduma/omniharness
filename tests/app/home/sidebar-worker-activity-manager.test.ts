import { describe, expect, it, beforeEach } from "vitest";
import { SidebarWorkerActivityManager } from "@/app/home/SidebarWorkerActivityManager";

describe("SidebarWorkerActivityManager", () => {
  let manager: SidebarWorkerActivityManager;

  beforeEach(() => {
    manager = new SidebarWorkerActivityManager();
  });

  describe("baseline handling", () => {
    it("does not record an observation for the initial snapshot seq", () => {
      manager.onKnownSeqs({ "worker-1": 5 });
      expect(manager.getRunOutputAt("run-1")).toBeNull();
    });

    it("sets baseline from onKnownSeqs and ignores seqs <= baseline", () => {
      manager.onKnownSeqs({ "worker-1": 5 });
      manager.onWakeUp({ workerId: "worker-1", seq: 5, runId: "run-1" });
      expect(manager.getRunOutputAt("run-1")).toBeNull();
    });

    it("records an observation when seq exceeds baseline", () => {
      manager.onKnownSeqs({ "worker-1": 5 });
      manager.onWakeUp({ workerId: "worker-1", seq: 6, runId: "run-1" });
      expect(manager.getRunOutputAt("run-1")).toBeTruthy();
    });

    it("treats first wakeUp without baseline as the baseline (not an observation)", () => {
      manager.onWakeUp({ workerId: "worker-1", seq: 3, runId: "run-1" });
      expect(manager.getRunOutputAt("run-1")).toBeNull();
    });

    it("records observation for seq increase after implicit baseline from first wakeUp", () => {
      manager.onWakeUp({ workerId: "worker-1", seq: 3, runId: "run-1" });
      manager.onWakeUp({ workerId: "worker-1", seq: 4, runId: "run-1" });
      expect(manager.getRunOutputAt("run-1")).toBeTruthy();
    });
  });

  describe("live seq increases", () => {
    it("updates observedAt timestamp on each new seq increase", () => {
      manager.onKnownSeqs({ "worker-1": 0 });
      manager.onWakeUp({ workerId: "worker-1", seq: 1, runId: "run-1" });
      const first = manager.getRunOutputAt("run-1");
      expect(first).toBeTruthy();

      manager.onWakeUp({ workerId: "worker-1", seq: 2, runId: "run-1" });
      const second = manager.getRunOutputAt("run-1");
      // Both are timestamps; second should be >= first
      expect(new Date(second!).getTime()).toBeGreaterThanOrEqual(new Date(first!).getTime());
    });

    it("no-op for repeated seq", () => {
      manager.onKnownSeqs({ "worker-1": 0 });
      manager.onWakeUp({ workerId: "worker-1", seq: 1, runId: "run-1" });
      const first = manager.getRunOutputAt("run-1");
      manager.onWakeUp({ workerId: "worker-1", seq: 1, runId: "run-1" });
      expect(manager.getRunOutputAt("run-1")).toBe(first);
    });

    it("no-op for lower seq than already observed", () => {
      manager.onKnownSeqs({ "worker-1": 0 });
      manager.onWakeUp({ workerId: "worker-1", seq: 5, runId: "run-1" });
      const ts = manager.getRunOutputAt("run-1");
      manager.onWakeUp({ workerId: "worker-1", seq: 3, runId: "run-1" });
      expect(manager.getRunOutputAt("run-1")).toBe(ts);
    });
  });

  describe("runId association", () => {
    it("associates runId from wakeUp event", () => {
      manager.onKnownSeqs({ "worker-1": 0 });
      manager.onWakeUp({ workerId: "worker-1", seq: 1, runId: "run-42" });
      expect(manager.getRunOutputAt("run-42")).toBeTruthy();
      expect(manager.getRunOutputAt("run-1")).toBeNull();
    });

    it("uses existing runId if new wakeUp has no runId", () => {
      manager.onKnownSeqs({ "worker-1": 0 });
      manager.onWakeUp({ workerId: "worker-1", seq: 1, runId: "run-42" });
      manager.onWakeUp({ workerId: "worker-1", seq: 2, runId: null });
      expect(manager.getRunOutputAt("run-42")).toBeTruthy();
    });

    it("multiple workers can map to the same run", () => {
      manager.onKnownSeqs({ "worker-a": 0, "worker-b": 0 });
      manager.onWakeUp({ workerId: "worker-a", seq: 1, runId: "run-1" });
      manager.onWakeUp({ workerId: "worker-b", seq: 1, runId: "run-1" });
      expect(manager.getRunOutputAt("run-1")).toBeTruthy();
    });
  });

  describe("getRunOutputAtRecord", () => {
    it("returns empty object when no observations", () => {
      expect(manager.getRunOutputAtRecord()).toEqual({});
    });

    it("returns record of all run timestamps after observations", () => {
      manager.onKnownSeqs({ "worker-a": 0, "worker-b": 0 });
      manager.onWakeUp({ workerId: "worker-a", seq: 1, runId: "run-1" });
      manager.onWakeUp({ workerId: "worker-b", seq: 1, runId: "run-2" });
      const record = manager.getRunOutputAtRecord();
      expect(Object.keys(record)).toContain("run-1");
      expect(Object.keys(record)).toContain("run-2");
    });
  });
});
