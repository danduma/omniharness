import { beforeEach, describe, expect, it } from "vitest";
import {
  __getRingCapacity,
  __getRingForTests,
  __resetNamedEventsForTests,
  emitNamedEvent,
  getEventCursor,
  getNamedEventsSince,
  recordSnapshotMarker,
} from "@/server/events/named-events";

describe("named-events ring buffer", () => {
  beforeEach(() => {
    __resetNamedEventsForTests();
  });

  it("assigns monotonically increasing ids across emits and snapshot markers", () => {
    const a = emitNamedEvent({ kind: "worker.spawned", runId: "r1", workerId: "w1", workerType: "agent" });
    const b = recordSnapshotMarker(1, "r1");
    const c = emitNamedEvent({ kind: "worker.status", runId: "r1", workerId: "w1", prev: "starting", next: "running" });
    expect(a.id).toBe(1);
    expect(b.id).toBe(2);
    expect(c.id).toBe(3);
    expect(getEventCursor()).toBe(3);
  });

  it("excludes snapshot markers from getNamedEventsSince by default", () => {
    emitNamedEvent({ kind: "worker.spawned", runId: "r1", workerId: "w1", workerType: "agent" });
    recordSnapshotMarker(1, "r1");
    emitNamedEvent({ kind: "worker.status", runId: "r1", workerId: "w1", prev: "starting", next: "running" });

    const result = getNamedEventsSince(0);
    expect(result.resyncRequired).toBe(false);
    expect(result.events.map((entry) => entry.event.kind)).toEqual(["worker.spawned", "worker.status"]);
    expect(result.lastEventId).toBe(3);
  });

  it("includes snapshot markers when explicitly requested", () => {
    emitNamedEvent({ kind: "worker.spawned", runId: "r1", workerId: "w1", workerType: "agent" });
    recordSnapshotMarker(1, "r1");

    const result = getNamedEventsSince(0, { includeSnapshotMarkers: true });
    expect(result.events.map((entry) => entry.event.kind)).toEqual(["worker.spawned", "snapshot.marker"]);
  });

  it("filters by runId, allowing through unscoped events", () => {
    emitNamedEvent({ kind: "worker.spawned", runId: "r1", workerId: "w1", workerType: "agent" });
    emitNamedEvent({ kind: "worker.spawned", runId: "r2", workerId: "w2", workerType: "agent" });
    emitNamedEvent({ kind: "error.surfaced", code: "internal", message: "no scope", surface: "log" });

    const scoped = getNamedEventsSince(null, { runId: "r1" });
    const kinds = scoped.events.map((entry) => `${entry.event.kind}:${entry.runId}`);
    // r1's worker.spawned and the unscoped error.surfaced; not r2's worker.spawned.
    expect(kinds).toEqual([
      "worker.spawned:r1",
      "error.surfaced:null",
    ]);
  });

  it("returns events strictly after lastEventId", () => {
    const first = emitNamedEvent({ kind: "worker.spawned", runId: "r1", workerId: "w1", workerType: "agent" });
    emitNamedEvent({ kind: "worker.status", runId: "r1", workerId: "w1", prev: "starting", next: "running" });
    emitNamedEvent({ kind: "worker.terminal", runId: "r1", workerId: "w1", status: "completed" });

    const result = getNamedEventsSince(first.id);
    expect(result.events.map((entry) => entry.event.kind)).toEqual(["worker.status", "worker.terminal"]);
  });

  it("can drain only through a marker boundary without leaking later events", () => {
    emitNamedEvent({ kind: "worker.entry_appended", runId: "r1", workerId: "w1", seq: 1 });
    const marker = recordSnapshotMarker(1, "r1");
    emitNamedEvent({ kind: "worker.entry_appended", runId: "r1", workerId: "w1", seq: 2 });

    const beforeMarker = getNamedEventsSince(0, { throughId: marker.id - 1 });
    expect(beforeMarker.events.map((entry) => entry.event)).toEqual([
      expect.objectContaining({ kind: "worker.entry_appended", seq: 1 }),
    ]);

    const afterMarker = getNamedEventsSince(marker.id);
    expect(afterMarker.events.map((entry) => entry.event)).toEqual([
      expect.objectContaining({ kind: "worker.entry_appended", seq: 2 }),
    ]);
  });

  it("signals resyncRequired when lastEventId is older than the oldest buffered entry", () => {
    const capacity = __getRingCapacity();
    for (let i = 0; i < capacity + 5; i++) {
      emitNamedEvent({ kind: "worker.status", runId: "r1", workerId: "w1", prev: "a", next: `s${i}` });
    }
    const oldest = __getRingForTests()[0]!.id;
    expect(oldest).toBeGreaterThan(1);

    const result = getNamedEventsSince(0);
    expect(result.resyncRequired).toBe(true);
    expect(result.events).toEqual([]);
    expect(result.lastEventId).toBe(getEventCursor());
  });

  it("does not signal resync when lastEventId equals oldest - 1", () => {
    const capacity = __getRingCapacity();
    for (let i = 0; i < capacity + 5; i++) {
      emitNamedEvent({ kind: "worker.status", runId: "r1", workerId: "w1", prev: "a", next: `s${i}` });
    }
    const oldest = __getRingForTests()[0]!.id;
    const result = getNamedEventsSince(oldest - 1);
    expect(result.resyncRequired).toBe(false);
    expect(result.events[0]?.id).toBe(oldest);
  });

  it("returns an empty list when no events have been emitted", () => {
    const result = getNamedEventsSince(null);
    expect(result).toEqual({ resyncRequired: false, events: [], lastEventId: 0 });
  });

  it("enforces the ring buffer capacity", () => {
    const capacity = __getRingCapacity();
    for (let i = 0; i < capacity + 50; i++) {
      emitNamedEvent({ kind: "worker.status", runId: "r1", workerId: "w1", prev: "a", next: `s${i}` });
    }
    expect(__getRingForTests().length).toBe(capacity);
  });

  it("buffers and replays worker failover events", () => {
    emitNamedEvent({
      kind: "worker.failover_started",
      runId: "r1",
      outgoingWorkerId: "w1",
      outgoingType: "codex",
      reason: "quota_exhausted",
    });
    emitNamedEvent({
      kind: "worker.handoff_emitted",
      runId: "r1",
      outgoingWorkerId: "w1",
      source: "worker",
    });
    emitNamedEvent({
      kind: "worker.failover_completed",
      runId: "r1",
      outgoingWorkerId: "w1",
      newWorkerId: "w2",
      newType: "claude",
    });

    const result = getNamedEventsSince(0);
    expect(result.events.map((entry) => entry.event.kind)).toEqual([
      "worker.failover_started",
      "worker.handoff_emitted",
      "worker.failover_completed",
    ]);
  });

  it("buffers worker.failover_failed and the matching error.surfaced code", () => {
    emitNamedEvent({
      kind: "worker.failover_failed",
      runId: "r1",
      outgoingWorkerId: "w1",
      stage: "spawn",
      reason: "no replacement available",
    });
    emitNamedEvent({
      kind: "error.surfaced",
      code: "worker.failover.failed",
      message: "Worker failover failed.",
      surface: "banner",
      runId: "r1",
      workerId: "w1",
    });

    const result = getNamedEventsSince(0);
    expect(result.events.map((entry) => entry.event.kind)).toEqual([
      "worker.failover_failed",
      "error.surfaced",
    ]);
  });

  it("buffers provider session events", () => {
    emitNamedEvent({ kind: "session.created", runId: "r1", sessionType: "process", actorIds: ["w1"] });
    emitNamedEvent({ kind: "session.status", runId: "r1", sessionType: "process", prev: "starting", next: "running" });
    emitNamedEvent({ kind: "process.exited", runId: "r1", workerId: "w1", exitCode: 0, signal: null });

    const result = getNamedEventsSince(0);
    expect(result.events.map((entry) => entry.event.kind)).toEqual([
      "session.created",
      "session.status",
      "process.exited",
    ]);
  });
});
