import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ManagedBridgeController,
  type BridgeChild,
  type ManagedBridgeDependencies,
  type BridgeProbeResult,
} from "@/server/runner/managed-bridge-controller";
import {
  __resetNamedEventsForTests,
  getNamedEventsSince,
} from "@/server/events/named-events";

function createHarness(initialProbe: BridgeProbeResult) {
  let probeResult = initialProbe;
  let exitListener: ((exit: { code: number | null; signal: string | null }) => void) | null = null;
  const child: BridgeChild = {
    pid: 4242,
    stop: vi.fn().mockResolvedValue(undefined),
    onExit(listener) {
      exitListener = listener;
      return () => {
        exitListener = null;
      };
    },
  };
  const dependencies: ManagedBridgeDependencies & {
    probe: ReturnType<typeof vi.fn>;
    acquireLock: ReturnType<typeof vi.fn>;
    releaseLock: ReturnType<typeof vi.fn>;
    spawn: ReturnType<typeof vi.fn>;
    schedule: ReturnType<typeof vi.fn>;
  } = {
    probe: vi.fn(async () => probeResult),
    acquireLock: vi.fn(() => ({ status: "acquired" as const })),
    releaseLock: vi.fn(),
    spawn: vi.fn(async () => child),
    schedule: vi.fn((_delayMs: number, callback: () => void) => {
      return { cancel: vi.fn(), run: callback };
    }),
  };
  const controller = new ManagedBridgeController({
    bridgeUrl: "http://127.0.0.1:7800",
    manage: true,
    dependencies,
  });
  return {
    child,
    controller,
    dependencies,
    setProbe(result: BridgeProbeResult) {
      probeResult = result;
    },
    exit(exit = { code: 1, signal: null as string | null }) {
      exitListener?.(exit);
    },
  };
}

describe("ManagedBridgeController", () => {
  beforeEach(() => {
    __resetNamedEventsForTests();
  });

  it("adopts an already healthy bridge without spawning or owning it", async () => {
    const harness = createHarness({ status: "ready" });

    await harness.controller.start();

    expect(harness.controller.getSnapshot()).toMatchObject({
      status: "ready",
      ownership: "adopted",
    });
    expect(harness.dependencies.spawn).not.toHaveBeenCalled();
    await harness.controller.stop();
    expect(harness.child.stop).not.toHaveBeenCalled();
  });

  it("spawns and owns a missing bridge, then becomes ready after a retry probe", async () => {
    const harness = createHarness({ status: "unavailable", reason: "ECONNREFUSED" });
    harness.dependencies.probe
      .mockResolvedValueOnce({ status: "unavailable", reason: "ECONNREFUSED" })
      .mockResolvedValueOnce({ status: "ready" });

    await harness.controller.start();

    expect(harness.dependencies.acquireLock).toHaveBeenCalledOnce();
    expect(harness.dependencies.spawn).toHaveBeenCalledOnce();
    expect(harness.controller.getSnapshot()).toMatchObject({
      status: "ready",
      ownership: "owned",
    });
    await harness.controller.stop();
    expect(harness.child.stop).toHaveBeenCalledOnce();
    expect(harness.dependencies.releaseLock).toHaveBeenCalledOnce();
  });

  it("keeps the runner degraded when bridge management is disabled", async () => {
    const harness = createHarness({ status: "unavailable", reason: "missing" });
    const controller = new ManagedBridgeController({
      bridgeUrl: "http://bridge.invalid",
      manage: false,
      dependencies: harness.dependencies,
    });

    await controller.start();

    expect(controller.getSnapshot()).toMatchObject({
      status: "unavailable",
      ownership: "none",
      reason: "missing",
    });
    expect(harness.dependencies.spawn).not.toHaveBeenCalled();
  });

  it("does not replace a reachable but unhealthy bridge", async () => {
    const harness = createHarness({ status: "unhealthy", reason: "doctor failed" });

    await harness.controller.start();

    expect(harness.controller.getSnapshot()).toMatchObject({
      status: "unavailable",
      reason: "doctor failed",
    });
    expect(harness.dependencies.acquireLock).not.toHaveBeenCalled();
    expect(harness.dependencies.spawn).not.toHaveBeenCalled();
  });

  it("waits when another live runner owns the bridge lock", async () => {
    const harness = createHarness({ status: "unavailable", reason: "missing" });
    harness.dependencies.acquireLock.mockReturnValue({
      status: "locked",
      ownerPid: 99,
    });

    await harness.controller.start();

    expect(harness.controller.getSnapshot()).toMatchObject({
      status: "starting",
      ownership: "none",
    });
    expect(harness.dependencies.spawn).not.toHaveBeenCalled();
    expect(harness.dependencies.schedule).toHaveBeenCalledWith(
      250,
      expect.any(Function),
    );
  });

  it("retries with backoff after an owned child crashes", async () => {
    const harness = createHarness({ status: "unavailable", reason: "missing" });
    harness.dependencies.probe
      .mockResolvedValueOnce({ status: "unavailable", reason: "missing" })
      .mockResolvedValueOnce({ status: "ready" });
    await harness.controller.start();

    harness.setProbe({ status: "unavailable", reason: "child exited" });
    harness.exit();

    await vi.waitFor(() => {
      expect(harness.controller.getSnapshot().status).toBe("unavailable");
    });
    expect(harness.dependencies.schedule).toHaveBeenLastCalledWith(
      250,
      expect.any(Function),
    );
    expect(
      getNamedEventsSince(0).events.some(
        (entry) => entry.event.kind === "runner.bridge_unavailable",
      ),
    ).toBe(true);
  });
});
