/**
 * Pin the full failover named-event transcript and prove it survives
 * SSE reconnect via Last-Event-ID. Drives the named-event ring directly
 * via emitNamedEvent (the same primitive attemptWorkerFailover uses);
 * the supervisor-level integration is exercised in
 * tests/supervisor/worker-failover*.test.ts.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { executionEvents, recoveryIncidents } from "@/server/db/schema";

import * as eventsRoute from "@/app/api/events/route";

import { startLifecycleHarness, type LifecycleServer } from "../../harness/server";
import { LifecycleClient } from "../../harness/client";
import { Chaos, NO_CHAOS } from "../../harness/chaos";
import { clearLifecycleSchema, seedDirectRun } from "../../harness/fixtures";
import { __resetNamedEventsForTests, emitNamedEvent } from "@/server/events/named-events";

let server: LifecycleServer;
let client: LifecycleClient;

beforeEach(async () => {
  __resetNamedEventsForTests();
  await db.delete(executionEvents);
  await db.delete(recoveryIncidents);
  await clearLifecycleSchema();
  server = await startLifecycleHarness({
    routes: [{ pattern: "/api/events", module: eventsRoute }],
  });
  client = new LifecycleClient({
    baseUrl: server.baseUrl,
    chaos: new Chaos(1, NO_CHAOS),
  });
});

afterEach(async () => {
  await client.close();
  await server.stop();
});

describe("lifecycle — worker failover transcript", () => {
  it("delivers worker.failover_* frames in id order on the wire", async () => {
    const { runId } = await seedDirectRun();
    await client.bootstrapSnapshot(runId);
    await client.subscribe({ runId });

    emitNamedEvent({ kind: "worker.spawned", runId, workerId: "w-out", workerType: "codex" });
    emitNamedEvent({ kind: "worker.failover_started", runId, outgoingWorkerId: "w-out", outgoingType: "codex", reason: "quota_exhausted" });
    emitNamedEvent({ kind: "worker.handoff_emitted", runId, outgoingWorkerId: "w-out", source: "worker" });
    emitNamedEvent({ kind: "worker.spawned", runId, workerId: "w-in", workerType: "claude" });
    emitNamedEvent({ kind: "worker.failover_completed", runId, outgoingWorkerId: "w-out", newWorkerId: "w-in", newType: "claude" });

    const completed = await client.waitFor("worker.failover_completed", { timeoutMs: 10_000 });
    expect(completed.payload).toMatchObject({
      kind: "worker.failover_completed",
      runId,
      outgoingWorkerId: "w-out",
      newWorkerId: "w-in",
      newType: "claude",
    });

    const started = client.events.filterByEvent("worker.failover_started")[0]!;
    const handoff = client.events.filterByEvent("worker.handoff_emitted")[0]!;
    const spawnIn = client.events.filterByEvent("worker.spawned")[1]!;
    expect(Number(started.id)).toBeLessThan(Number(handoff.id));
    expect(Number(handoff.id)).toBeLessThan(Number(spawnIn.id));
    expect(Number(spawnIn.id)).toBeLessThan(Number(completed.id));
  });

  it("replays failover events on reconnect with Last-Event-ID", async () => {
    const { runId } = await seedDirectRun();
    await client.bootstrapSnapshot(runId);
    await client.subscribe({ runId });

    const startedEntry = emitNamedEvent({
      kind: "worker.failover_started",
      runId,
      outgoingWorkerId: "w-out",
      outgoingType: "codex",
      reason: "quota_exhausted",
    });
    await client.waitFor("worker.failover_started", { timeoutMs: 10_000 });

    // Drop the connection and reconnect from the recorded last event id.
    await client.close();
    client = new LifecycleClient({
      baseUrl: server.baseUrl,
      chaos: new Chaos(1, NO_CHAOS),
    });
    await client.subscribe({ runId, resumeFrom: String(startedEntry.id) });

    emitNamedEvent({
      kind: "worker.failover_completed",
      runId,
      outgoingWorkerId: "w-out",
      newWorkerId: "w-in",
      newType: "claude",
    });

    const completed = await client.waitFor("worker.failover_completed", { timeoutMs: 10_000 });
    expect(Number(completed.id)).toBeGreaterThan(startedEntry.id);
  });

  it("emits worker.failover_failed and an error.surfaced when failover gives up", async () => {
    const { runId } = await seedDirectRun();
    await client.bootstrapSnapshot(runId);
    await client.subscribe({ runId });

    emitNamedEvent({
      kind: "worker.failover_failed",
      runId,
      outgoingWorkerId: "w-out",
      stage: "spawn",
      reason: "replacement workers all quota-blocked",
    });
    emitNamedEvent({
      kind: "error.surfaced",
      code: "worker.failover.failed",
      message: "Worker failover failed: replacement workers all quota-blocked",
      surface: "banner",
      runId,
      workerId: "w-out",
    });

    const failed = await client.waitFor("worker.failover_failed", { timeoutMs: 10_000 });
    expect(failed.payload).toMatchObject({
      kind: "worker.failover_failed",
      stage: "spawn",
    });
    const surfaced = await client.waitFor("error.surfaced", { timeoutMs: 10_000 });
    expect(surfaced.payload).toMatchObject({ code: "worker.failover.failed" });
  });
});
