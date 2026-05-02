import { describe, expect, it, vi } from "vitest";
import { AppRequestError } from "@/lib/app-errors";
import { LiveEventConnectionManager } from "@/app/home/LiveEventConnectionManager";
import type { EventStreamState } from "@/app/home/types";

function createState(id: string): EventStreamState {
  return {
    messages: [],
    plans: [],
    runs: [{
      id,
      planId: "plan-1",
      mode: "implementation",
      status: "running",
      createdAt: new Date(0).toISOString(),
      projectPath: null,
      title: id,
    }],
    accounts: [],
    agents: [],
    workers: [],
    planItems: [],
    clarifications: [],
    validationRuns: [],
    executionEvents: [],
    supervisorInterventions: [],
    frontendErrors: [],
  };
}

class MockEventSource {
  static instances: MockEventSource[] = [];

  readonly listeners = new Map<string, Array<(event: MessageEvent) => void>>();
  onerror: (() => void) | null = null;
  onopen: (() => void) | null = null;
  closed = false;

  constructor(readonly url: string) {
    MockEventSource.instances.push(this);
  }

  addEventListener(event: string, listener: (event: MessageEvent) => void) {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]);
  }

  emit(event: string, data: unknown) {
    for (const listener of this.listeners.get(event) ?? []) {
      listener({ data: JSON.stringify(data) } as MessageEvent);
    }
  }

  close() {
    this.closed = true;
  }
}

describe("LiveEventConnectionManager", () => {
  it("polls the persisted snapshot endpoint without reporting transient connectivity loss", async () => {
    vi.useFakeTimers();
    MockEventSource.instances = [];
    const applyUpdate = vi.fn();
    const reportError = vi.fn();
    const requestJson = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(createState("persisted-recovery"));

    const manager = new LiveEventConnectionManager({
      selectedRunId: "run-1",
      EventSourceConstructor: MockEventSource as unknown as typeof EventSource,
      requestJson,
      applyUpdate,
      reportError,
      fallbackIntervalMs: 100,
      fallbackCooldownMs: 0,
    });

    manager.start();
    expect(MockEventSource.instances[0]?.url).toBe("/api/events?runId=run-1");
    expect(requestJson).toHaveBeenCalledWith(
      "/api/events?snapshot=1&persisted=1&runId=run-1",
      undefined,
      expect.objectContaining({ action: "Load live state snapshot" }),
    );

    await vi.runAllTicks();
    await Promise.resolve();
    expect(reportError).not.toHaveBeenCalled();

    MockEventSource.instances[0]?.onerror?.();
    await vi.advanceTimersByTimeAsync(100);
    expect(reportError).not.toHaveBeenCalled();
    expect(applyUpdate).toHaveBeenCalledWith(expect.objectContaining({
      runs: [expect.objectContaining({ id: "persisted-recovery" })],
    }));

    manager.stop();
    vi.useRealTimers();
  });

  it("reports non-connectivity snapshot failures", async () => {
    vi.useFakeTimers();
    MockEventSource.instances = [];
    const reportError = vi.fn();
    const requestJson = vi
      .fn()
      .mockRejectedValue(new AppRequestError({ message: "Request failed with status 530", status: 530 }));

    const manager = new LiveEventConnectionManager({
      EventSourceConstructor: MockEventSource as unknown as typeof EventSource,
      requestJson,
      applyUpdate: vi.fn(),
      reportError,
      fallbackCooldownMs: 0,
    });

    manager.start();
    await vi.runAllTicks();
    await Promise.resolve();

    expect(reportError).toHaveBeenCalledWith(expect.objectContaining({
      action: "Load live state snapshot",
      status: 530,
    }));

    manager.stop();
    vi.useRealTimers();
  });

  it("stops fallback polling after a live update arrives", async () => {
    vi.useFakeTimers();
    MockEventSource.instances = [];
    const applyUpdate = vi.fn();
    const requestJson = vi.fn().mockResolvedValue(createState("persisted-initial"));
    const manager = new LiveEventConnectionManager({
      EventSourceConstructor: MockEventSource as unknown as typeof EventSource,
      requestJson,
      applyUpdate,
      reportError: vi.fn(),
      fallbackIntervalMs: 100,
      fallbackCooldownMs: 0,
    });

    manager.start();
    MockEventSource.instances[0]?.onerror?.();
    MockEventSource.instances[0]?.emit("update", createState("stream-restored"));

    await vi.advanceTimersByTimeAsync(350);

    expect(applyUpdate).toHaveBeenCalledWith(expect.objectContaining({
      runs: [expect.objectContaining({ id: "stream-restored" })],
    }));
    expect(requestJson).toHaveBeenCalledTimes(1);

    manager.stop();
    vi.useRealTimers();
  });
});
