/**
 * Drop the SSE connection mid-flight, reconnect with the recorded
 * `Last-Event-ID`, and assert that events emitted during the gap are
 * replayed in order — none missed, none duplicated.
 *
 * This is the contract the chaos harness leans on. Without it, every
 * disconnect would force a full snapshot refetch and the test couldn't
 * reason about whether the server emitted anything during the gap.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { executionEvents, recoveryIncidents } from "@/server/db/schema";

import * as eventsRoute from "@/app/api/events/route";

import { startLifecycleHarness, type LifecycleServer } from "../harness/server";
import { LifecycleClient } from "../harness/client";
import { Chaos, NO_CHAOS } from "../harness/chaos";
import { clearLifecycleSchema, seedDirectRun } from "../harness/fixtures";
import {
  __resetNamedEventsForTests,
  emitNamedEvent,
  getEventCursor,
} from "@/server/events/named-events";

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
    chaos: new Chaos(2, NO_CHAOS),
  });
});

afterEach(async () => {
  await client.close();
  await server.stop();
});

describe("lifecycle harness — SSE resume", () => {
  it("replays events emitted during a disconnect after reconnect with Last-Event-ID", async () => {
    const { runId } = await seedDirectRun();
    await client.bootstrapSnapshot(runId);
    await client.subscribe({ runId });

    // Pre-drop: emit one event and observe it on the wire so we have a
    // concrete resume point.
    emitNamedEvent({ kind: "worker.spawned", runId, workerId: "w1", workerType: "codex" });
    await client.waitFor("worker.spawned");
    const resumeId = client.resumeIdNow();
    expect(resumeId).toBeTruthy();

    // Mid-flight disconnect.
    client.dropSse();

    // Events emitted while disconnected.
    emitNamedEvent({ kind: "worker.status", runId, workerId: "w1", prev: "starting", next: "running" });
    emitNamedEvent({ kind: "worker.terminal", runId, workerId: "w1", status: "completed" });
    const expectedCursor = getEventCursor();

    // Reconnect from the recorded resume id.
    await client.subscribe({ runId, resumeFrom: resumeId });

    const terminal = await client.waitFor("worker.terminal", { timeoutMs: 10_000 });
    expect(client.events.filterByEvent("worker.status")).toHaveLength(1);
    // Pre-drop events shouldn't have been replayed (we still hold them
    // in the recorder from earlier — that's fine).
    expect(Number(terminal.id)).toBe(expectedCursor);
  });
});
