import { describe, expect, it, vi } from "vitest";
import {
  getEventStreamNotificationVersion,
  notifyEventStreamSubscribers,
  waitForEventStreamNotification,
} from "@/server/events/live-updates";

describe("live update notifications", () => {
  it("does not miss notifications emitted while a stream payload is being built", async () => {
    vi.useFakeTimers();
    const versionBeforePayloadBuild = getEventStreamNotificationVersion();
    notifyEventStreamSubscribers();

    const wait = waitForEventStreamNotification(15_000, versionBeforePayloadBuild);
    await expect(wait).resolves.toEqual({ notified: true });

    vi.useRealTimers();
  });

  it("waits for a new notification when none arrived after the observed version", async () => {
    vi.useFakeTimers();
    const version = getEventStreamNotificationVersion();
    let waitResult: unknown = null;
    let resolved = false;
    const wait = waitForEventStreamNotification(15_000, version).then((result) => {
      waitResult = result;
      resolved = true;
    });

    await vi.advanceTimersByTimeAsync(14_999);
    expect(resolved).toBe(false);

    notifyEventStreamSubscribers();
    await wait;
    expect(resolved).toBe(true);
    expect(waitResult).toEqual({ notified: true });

    vi.useRealTimers();
  });

  it("reports timeout waits separately from notification waits", async () => {
    vi.useFakeTimers();
    const version = getEventStreamNotificationVersion();
    const wait = waitForEventStreamNotification(15_000, version);

    await vi.advanceTimersByTimeAsync(15_000);
    await expect(wait).resolves.toEqual({ notified: false });

    vi.useRealTimers();
  });
});
