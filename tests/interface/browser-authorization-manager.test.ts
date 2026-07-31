import { describe, expect, it, vi } from "vitest";
import {
  BrowserAuthorizationManager,
  type BrowserAuthorizationWindowAdapter,
} from "@/interface/auth/BrowserAuthorizationManager";

const state = "state_abcdefghijklmnopqrstuvwxyz_0123456789_ABCDEF";

function adapter(openResult: object | null = {}) {
  let listener: ((event: {
    origin: string;
    source: unknown;
    data: unknown;
  }) => void) | null = null;
  const popup = openResult;
  const value: BrowserAuthorizationWindowAdapter & {
    emit(event: { origin: string; source: unknown; data: unknown }): void;
  } = {
    origin: "https://interface.example",
    open: vi.fn(() => popup),
    addMessageListener(next) {
      listener = next;
      return () => {
        listener = null;
      };
    },
    setTimer: vi.fn(() => 1),
    clearTimer: vi.fn(),
    emit(event) {
      listener?.(event);
    },
  };
  return { value, popup };
}

describe("BrowserAuthorizationManager", () => {
  it("reports a blocked popup immediately", async () => {
    const { value } = adapter(null);
    const manager = new BrowserAuthorizationManager(value);

    await expect(manager.authorize({
      runnerUrl: "https://runner.example",
      exchange: vi.fn(),
    })).rejects.toThrow(/popup/i);
    expect(manager.getSnapshot().status).toBe("popup-blocked");
  });

  it("accepts only the expected popup, runner origin, and state", async () => {
    const { value, popup } = adapter();
    const exchange = vi.fn(async () => ({ token: "secret" }));
    const manager = new BrowserAuthorizationManager(value);
    const authorization = manager.authorize({
      runnerUrl: "https://runner.example",
      exchange,
    });
    await vi.waitFor(() => {
      expect(manager.getSnapshot().status).toBe("waiting");
    });
    const pending = manager.getSnapshot();

    value.emit({
      origin: "https://attacker.example",
      source: popup,
      data: { type: "omni.authorization", code: "code", state: pending.state },
    });
    value.emit({
      origin: "https://runner.example",
      source: {},
      data: { type: "omni.authorization", code: "code", state: pending.state },
    });
    expect(exchange).not.toHaveBeenCalled();

    value.emit({
      origin: "https://runner.example",
      source: popup,
      data: { type: "omni.authorization", code: "code", state: pending.state },
    });
    await expect(authorization).resolves.toEqual({ token: "secret" });
    expect(exchange).toHaveBeenCalledWith(expect.objectContaining({
      code: "code",
      state: pending.state,
      origin: "https://interface.example",
      verifier: expect.stringMatching(/^[A-Za-z0-9_-]{43,128}$/),
    }));
  });

  it("surfaces denial, timeout, and opener loss return links", () => {
    const { value } = adapter();
    const manager = new BrowserAuthorizationManager(value);
    expect(manager.buildPlatformReturnLink({
      code: "code",
      state,
    })).toBe(
      `omniharness://authorize?code=code&state=${encodeURIComponent(state)}`,
    );
    manager.markDenied();
    expect(manager.getSnapshot().status).toBe("denied");
    manager.markTimedOut();
    expect(manager.getSnapshot().status).toBe("timed-out");
  });
});
