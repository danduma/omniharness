import { describe, expect, it } from "vitest";
import {
  shouldStartLiveEventConnection,
  shouldSubscribeToRunnerSnapshot,
} from "@/interface/home/useHomeLifecycle";

describe("home lifecycle", () => {
  it("does not start live events before the route has hydrated", () => {
    expect(shouldStartLiveEventConnection({
      appUnlocked: true,
      routeReady: false,
    })).toBe(false);
  });

  it("starts live events after auth and route hydration are ready", () => {
    expect(shouldStartLiveEventConnection({
      appUnlocked: true,
      routeReady: true,
    })).toBe(true);
  });

  it("uses a run-scoped event connection when a runner-backed app selects a conversation", () => {
    expect(shouldSubscribeToRunnerSnapshot({
      hasRunnerConnection: true,
      selectedRunId: null,
    })).toBe(true);

    expect(shouldSubscribeToRunnerSnapshot({
      hasRunnerConnection: true,
      selectedRunId: "run-1",
    })).toBe(false);

    expect(shouldSubscribeToRunnerSnapshot({
      hasRunnerConnection: false,
      selectedRunId: null,
    })).toBe(false);
  });
});
