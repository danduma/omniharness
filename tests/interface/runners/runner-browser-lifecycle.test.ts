import { describe, expect, it, vi } from "vitest";
import * as providerModule from "@/interface/runners/RunnerRegistryProvider";

describe("server connection browser lifecycle", () => {
  it("provides browser lifecycle recovery wiring", () => {
    expect(providerModule.installRunnerBrowserLifecycleRecovery).toBeTypeOf("function");
  });

  it("retries recoverable connections when the app returns or the browser comes online", () => {
    const retryRecoverableConnections = vi.fn();
    const windowTarget = new EventTarget();
    const documentTarget = new EventTarget();
    const cleanup = providerModule.installRunnerBrowserLifecycleRecovery({
      registry: { retryRecoverableConnections },
      windowTarget,
      documentTarget,
      isVisible: () => true,
    });

    windowTarget.dispatchEvent(new Event("pageshow"));
    windowTarget.dispatchEvent(new Event("online"));
    documentTarget.dispatchEvent(new Event("visibilitychange"));

    expect(retryRecoverableConnections).toHaveBeenCalledTimes(3);
    cleanup();
  });

  it("does not retry while the app is hidden and removes its listeners on cleanup", () => {
    const retryRecoverableConnections = vi.fn();
    const windowTarget = new EventTarget();
    const documentTarget = new EventTarget();
    let visible = false;
    const cleanup = providerModule.installRunnerBrowserLifecycleRecovery({
      registry: { retryRecoverableConnections },
      windowTarget,
      documentTarget,
      isVisible: () => visible,
    });

    documentTarget.dispatchEvent(new Event("visibilitychange"));
    expect(retryRecoverableConnections).not.toHaveBeenCalled();

    visible = true;
    cleanup();
    windowTarget.dispatchEvent(new Event("pageshow"));
    windowTarget.dispatchEvent(new Event("online"));
    documentTarget.dispatchEvent(new Event("visibilitychange"));
    expect(retryRecoverableConnections).not.toHaveBeenCalled();
  });
});
