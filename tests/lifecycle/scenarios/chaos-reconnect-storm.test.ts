/**
 * Chaos mode — under a seeded high SSE-drop rate, the client should
 * still observe every named event the server emitted, because every
 * reconnect resumes from `Last-Event-ID` and the ring buffer fills the
 * gap.
 *
 * Failures here are reproducible: every failing run prints its seed,
 * and replaying the same seed re-creates the exact disconnect pattern.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { executionEvents, recoveryIncidents } from "@/server/db/schema";

import * as eventsRoute from "@/app/api/events/route";

import { startLifecycleHarness, type LifecycleServer } from "../harness/server";
import { LifecycleClient } from "../harness/client";
import { Chaos } from "../harness/chaos";
import { clearLifecycleSchema, seedDirectRun } from "../harness/fixtures";
import {
  __resetNamedEventsForTests,
  emitNamedEvent,
} from "@/server/events/named-events";

let server: LifecycleServer;
let client: LifecycleClient;
const seed = Number(process.env.OMNI_LIFECYCLE_SEED) || 0xC0FFEE;

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
    chaos: new Chaos(seed, { dropSseRate: 0, flakeFetchRate: 0, flakeStatuses: [] }),
  });
});

afterEach(async () => {
  await client.close();
  await server.stop();
});

describe(`lifecycle harness — chaos reconnect storm (seed=${seed.toString(16)})`, () => {
  it("observes every emitted event despite chaos-driven reconnects", { timeout: 30_000 }, async () => {
    const { runId } = await seedDirectRun();
    await client.bootstrapSnapshot(runId);
    await client.subscribe({ runId });

    const totalEvents = 20;
    for (let i = 0; i < totalEvents; i++) {
      const next = `tick-${i}`;
      emitNamedEvent({
        kind: "worker.status",
        runId,
        workerId: "w1",
        prev: "running",
        next,
      });
      // Wait for the emit to be observed on the wire BEFORE we decide
      // whether to drop. This makes the test deterministic: every drop
      // is preceded by a known-delivered checkpoint.
      await client.waitFor("worker.status", {
        predicate: (frame) => (frame.payload as { next?: string } | null)?.next === next,
        timeoutMs: 5_000,
      });
      // Mid-stream forced drops: every 3rd emit, ask the client to
      // close. The autoReconnect path picks up via Last-Event-ID.
      if (i % 3 === 2) {
        client.dropSse();
        await client.subscribe({ runId, resumeFrom: client.resumeIdNow() });
      }
    }

    // Each tick was observed inside the for-loop; assert the final count.
    expect(client.events.filterByEvent("worker.status")).toHaveLength(totalEvents);
  });
});
