import { describe, expect, it, vi } from "vitest";
import { RunnerReadinessManager } from "@/server/runner/readiness-manager";
import type {
  ManagedBridgeSnapshot,
} from "@/server/runner/managed-bridge-controller";

function createBridgeSnapshot(): ManagedBridgeSnapshot {
  return {
    status: "idle",
    ownership: "none",
    bridgeUrl: "http://127.0.0.1:7800",
    reason: null,
    attempt: 0,
  };
}

describe("RunnerReadinessManager", () => {
  it("keeps HTTP available while accurately reporting a degraded bridge", () => {
    let bridge = createBridgeSnapshot();
    let notify = () => {};
    const manager = new RunnerReadinessManager({
      getSnapshot: () => bridge,
      subscribe(listener) {
        notify = listener;
        return () => {};
      },
    });
    const listener = vi.fn();
    manager.subscribe(listener);

    manager.markHttpListening("http://127.0.0.1:3050");
    bridge = {
      ...bridge,
      status: "unavailable",
      reason: "ECONNREFUSED",
    };
    notify();

    expect(manager.getSnapshot()).toEqual({
      status: "degraded",
      origin: "http://127.0.0.1:3050",
      bridgeStatus: "unavailable",
      bridgeReason: "ECONNREFUSED",
    });
    expect(listener).toHaveBeenCalled();
  });

  it("becomes ready when both the HTTP listener and bridge are ready", () => {
    let bridge = { ...createBridgeSnapshot(), status: "ready" as const };
    let notify = () => {};
    const manager = new RunnerReadinessManager({
      getSnapshot: () => bridge,
      subscribe(listener) {
        notify = listener;
        return () => {};
      },
    });

    manager.markHttpListening("http://127.0.0.1:3050");
    notify();

    expect(manager.getSnapshot().status).toBe("ready");
    manager.markStopping();
    expect(manager.getSnapshot().status).toBe("stopping");
  });
});
