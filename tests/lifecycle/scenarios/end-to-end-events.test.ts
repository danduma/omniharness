/**
 * Bootstrap a snapshot, subscribe to the SSE tail, trigger a named
 * event server-side, observe it arrive on the wire with the expected
 * envelope (id, event, JSON payload).
 *
 * Proves the harness can host the real /api/events route, parse SSE
 * frames, and resolve named-event waits — the foundation every other
 * scenario depends on.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { executionEvents, recoveryIncidents } from "@/server/db/schema";

import * as eventsRoute from "@/app/api/events/route";

import { startLifecycleHarness, type LifecycleServer } from "../harness/server";
import { LifecycleClient } from "../harness/client";
import { Chaos, NO_CHAOS } from "../harness/chaos";
import { clearLifecycleSchema, seedDirectRun } from "../harness/fixtures";
import { __resetNamedEventsForTests, emitNamedEvent } from "@/server/events/named-events";
import { openRecoveryIncident } from "@/server/runs/recovery-incidents";

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

describe("lifecycle harness — end-to-end events", () => {
  it("bootstraps a snapshot and tails named events emitted after subscribe", async () => {
    const { runId } = await seedDirectRun();

    const bootstrap = await client.bootstrapSnapshot(runId);
    expect(bootstrap.lastEventId).not.toBeNull();

    await client.subscribe({ runId });

    // Server-side, emit a named event a moment after the subscribe is
    // established. Use a real domain event (recovery.opened) so we
    // exercise the production emit path, not just the test-only
    // `emitNamedEvent` shortcut.
    await openRecoveryIncident({
      runId,
      kind: "worker_lost",
      lastError: "harness scenario probe",
    });

    const frame = await client.waitFor("recovery.opened", { timeoutMs: 4_000 });
    expect(frame.id).toBeTruthy();
    expect(frame.payload).toMatchObject({
      kind: "recovery.opened",
      runId,
      recoveryKind: "worker_lost",
    });
  });

  it("preserves event id ordering on the wire", async () => {
    const { runId } = await seedDirectRun();
    await client.bootstrapSnapshot(runId);
    await client.subscribe({ runId });

    emitNamedEvent({ kind: "worker.spawned", runId, workerId: "w1", workerType: "codex" });
    emitNamedEvent({ kind: "worker.status", runId, workerId: "w1", prev: "starting", next: "running" });
    emitNamedEvent({ kind: "worker.terminal", runId, workerId: "w1", status: "completed" });

    const terminal = await client.waitFor("worker.terminal", { timeoutMs: 4_000 });
    const spawned = client.events.filterByEvent("worker.spawned")[0]!;
    const status = client.events.filterByEvent("worker.status")[0]!;
    expect(Number(spawned.id)).toBeLessThan(Number(status.id));
    expect(Number(status.id)).toBeLessThan(Number(terminal.id));
  });
});
