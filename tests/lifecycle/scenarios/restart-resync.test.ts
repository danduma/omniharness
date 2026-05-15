/**
 * After a "server restart" (ring buffer reset), the client's
 * `Last-Event-ID` is no longer resolvable. The server must send
 * `stream.resync_required` rather than silently dropping the gap.
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
    chaos: new Chaos(3, NO_CHAOS),
  });
});

afterEach(async () => {
  await client.close();
  await server.stop();
});

describe("lifecycle harness — restart resync", () => {
  it("sends stream.resync_required when the resume id is gone after restart", async () => {
    const { runId } = await seedDirectRun();
    await client.bootstrapSnapshot(runId);
    await client.subscribe({ runId });

    // Burn through enough events that a fictional resume id far below
    // the new cursor will be unresolvable post-restart.
    for (let i = 0; i < 5; i++) {
      emitNamedEvent({ kind: "worker.status", runId, workerId: "w1", prev: "running", next: `tick-${i}` });
    }
    await client.waitFor("worker.status", { timeoutMs: 4_000 });
    const staleResumeId = client.resumeIdNow();
    expect(staleResumeId).toBeTruthy();

    client.dropSse();

    // Simulate restart: ring + cursor reset to zero. Now the client's
    // resume id (e.g. "6") is way ahead of the new cursor (0) — but
    // semantically equivalent to a real restart: the server has no
    // memory of it.
    server.simulateRestart();
    // Push one event so the new cursor is < staleResumeId.
    emitNamedEvent({ kind: "worker.spawned", runId, workerId: "w2", workerType: "codex" });

    // Reconnect. Because the client's resume id predates the post-reset
    // ring, the route must emit stream.resync_required.
    await client.subscribe({ runId, resumeFrom: "9999" });
    const resync = await client.waitFor("stream.resync_required", { timeoutMs: 4_000 });
    expect(resync.payload).toMatchObject({ reason: "id_out_of_buffer" });
  });
});
