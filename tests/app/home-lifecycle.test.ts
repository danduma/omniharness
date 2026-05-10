import { describe, expect, it } from "vitest";
import { shouldStartLiveEventConnection } from "@/app/home/useHomeLifecycle";

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
});
