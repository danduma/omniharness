import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { settings } from "@/server/db/schema";
import { __resetNamedEventsForTests, getNamedEventsSince } from "@/server/events/named-events";

describe("supervisor wake lease", () => {
  beforeEach(async () => {
    __resetNamedEventsForTests();
    await db.delete(settings);
  });

  it("allows only one active lease per run until it is released", async () => {
    const { acquireSupervisorWakeLease, releaseSupervisorWakeLease } = await import("@/server/supervisor/lease");

    const firstLease = await acquireSupervisorWakeLease("run-1");
    const secondLease = await acquireSupervisorWakeLease("run-1");

    expect(firstLease).toEqual(expect.any(String));
    expect(secondLease).toBeNull();

    await releaseSupervisorWakeLease("run-1", firstLease!);

    await expect(acquireSupervisorWakeLease("run-1")).resolves.toEqual(expect.any(String));
  });

  it("emits named events for acquire, blocked acquire, skipped release, and release decisions", async () => {
    const { acquireSupervisorWakeLease, releaseSupervisorWakeLease } = await import("@/server/supervisor/lease");

    const leaseId = await acquireSupervisorWakeLease("run-lease-events", 1_000);
    await acquireSupervisorWakeLease("run-lease-events", 1_001);
    await releaseSupervisorWakeLease("run-lease-events", "wrong-owner");
    await releaseSupervisorWakeLease("run-lease-events", leaseId!);

    const events = getNamedEventsSince(0, { runId: "run-lease-events" }).events.map((entry) => entry.event);
    expect(events).toContainEqual({
      kind: "supervisor.wake_lease_acquired",
      runId: "run-lease-events",
      source: "insert",
    });
    expect(events).toContainEqual({
      kind: "supervisor.wake_lease_blocked",
      runId: "run-lease-events",
      reason: "active_lease",
    });
    expect(events).toContainEqual({
      kind: "supervisor.wake_lease_release_skipped",
      runId: "run-lease-events",
      reason: "not_owner",
    });
    expect(events).toContainEqual({
      kind: "supervisor.wake_lease_released",
      runId: "run-lease-events",
    });
  });

  it("emits whether an expired or malformed lease was replaced", async () => {
    const { acquireSupervisorWakeLease } = await import("@/server/supervisor/lease");

    await db.insert(settings).values({
      key: "SUPERVISOR_WAKE_LEASE:run-expired",
      value: JSON.stringify({ leaseId: "old-lease", expiresAt: 1_000 }),
      updatedAt: new Date(1_000),
    });
    await db.insert(settings).values({
      key: "SUPERVISOR_WAKE_LEASE:run-malformed",
      value: "{bad json",
      updatedAt: new Date(1_000),
    });

    await expect(acquireSupervisorWakeLease("run-expired", 2_000)).resolves.toEqual(expect.any(String));
    await expect(acquireSupervisorWakeLease("run-malformed", 2_000)).resolves.toEqual(expect.any(String));

    const expiredEvents = getNamedEventsSince(0, { runId: "run-expired" }).events.map((entry) => entry.event);
    expect(expiredEvents).toContainEqual({
      kind: "supervisor.wake_lease_acquired",
      runId: "run-expired",
      source: "replace_expired",
    });
    const malformedEvents = getNamedEventsSince(0, { runId: "run-malformed" }).events.map((entry) => entry.event);
    expect(malformedEvents).toContainEqual({
      kind: "supervisor.wake_lease_acquired",
      runId: "run-malformed",
      source: "replace_malformed",
    });
  });
});
