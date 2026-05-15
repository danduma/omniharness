/**
 * Reproduces the original bug: "session fails to reconnect and gives up
 * after first attempt".
 *
 * The architecture doc rule says: a recovery cap is a *terminal*
 * server-side decision; it must emit `recovery.gave_up` AND
 * `error.surfaced` with a stable code so the user sees a banner
 * instead of a silent failure. This scenario drives the full lifecycle
 * — open, attempt N times, exhaust — and asserts the wire carries the
 * expected sequence in order.
 *
 * Catches a regression where any of:
 *   - retries are skipped,
 *   - the cap is hit but no terminal event fires,
 *   - the user-visible `error.surfaced` is missing,
 * silently re-introduces the original bug.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { executionEvents, recoveryIncidents, workers } from "@/server/db/schema";

import * as eventsRoute from "@/app/api/events/route";

import { startLifecycleHarness, type LifecycleServer } from "../harness/server";
import { LifecycleClient } from "../harness/client";
import { Chaos, NO_CHAOS } from "../harness/chaos";
import { clearLifecycleSchema, seedDirectRun } from "../harness/fixtures";
import { __resetNamedEventsForTests } from "@/server/events/named-events";
import {
  markRecoveryIncidentFailed,
  markRecoveryIncidentRecovering,
  openRecoveryIncident,
} from "@/server/runs/recovery-incidents";

let server: LifecycleServer;
let client: LifecycleClient;

beforeEach(async () => {
  __resetNamedEventsForTests();
  await db.delete(executionEvents);
  await db.delete(recoveryIncidents);
  await db.delete(workers);
  await clearLifecycleSchema();
  server = await startLifecycleHarness({
    routes: [{ pattern: "/api/events", module: eventsRoute }],
  });
  client = new LifecycleClient({
    baseUrl: server.baseUrl,
    chaos: new Chaos(0xBEEF, NO_CHAOS),
  });
});

afterEach(async () => {
  await client.close();
  await server.stop();
});

describe("lifecycle harness — recovery exhaustion", () => {
  it("emits opened → attempt(1..N) → gave_up + error.surfaced(recovery.gave_up)", async () => {
    const { runId } = await seedDirectRun();
    const now = new Date();
    await db.insert(workers).values({
      id: "w-recovery",
      runId,
      type: "codex",
      status: "stopped",
      cwd: "/tmp",
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "",
      createdAt: now,
      updatedAt: now,
    });

    await client.bootstrapSnapshot(runId);
    await client.subscribe({ runId });

    // 1. Incident opens.
    const incident = await openRecoveryIncident({
      runId,
      workerId: "w-recovery",
      kind: "worker_lost",
      lastError: "agent process exited",
    });
    const opened = await client.waitFor("recovery.opened", { timeoutMs: 10_000 });
    expect(opened.payload).toMatchObject({
      kind: "recovery.opened",
      runId,
      incidentId: incident.id,
      recoveryKind: "worker_lost",
    });

    // 2. Three retry attempts — each must surface as recovery.attempt(N).
    for (let attempt = 1; attempt <= 3; attempt++) {
      await markRecoveryIncidentRecovering({
        incidentId: incident.id,
        runId,
        workerId: "w-recovery",
        decision: "respawn",
      });
      await client.waitFor("recovery.attempt", {
        predicate: (frame) => (frame.payload as { attempt?: number } | null)?.attempt === attempt,
        timeoutMs: 10_000,
      });
    }

    // 3. Cap reached → terminal gave_up + user-visible error.surfaced.
    await markRecoveryIncidentFailed({
      incidentId: incident.id,
      runId,
      workerId: "w-recovery",
      reason: "Bridge never returned after 3 attempts.",
    });

    const gaveUp = await client.waitFor("recovery.gave_up", { timeoutMs: 10_000 });
    expect(gaveUp.payload).toMatchObject({
      kind: "recovery.gave_up",
      runId,
      incidentId: incident.id,
      attempts: 3,
    });

    const surfaced = await client.waitFor("error.surfaced", {
      predicate: (frame) => (frame.payload as { code?: string } | null)?.code === "recovery.gave_up",
      timeoutMs: 10_000,
    });
    expect(surfaced.payload).toMatchObject({
      code: "recovery.gave_up",
      runId,
      workerId: "w-recovery",
      surface: "banner",
    });

    // 4. Ordering on the wire matches the architectural rule: every
    //    attempt fired before the terminal event.
    const recoveryFrames = client.events.frames.filter((frame) =>
      frame.event.startsWith("recovery."),
    );
    const kindsInOrder = recoveryFrames.map((frame) => frame.event);
    expect(kindsInOrder).toEqual([
      "recovery.opened",
      "recovery.attempt",
      "recovery.attempt",
      "recovery.attempt",
      "recovery.gave_up",
    ]);
  });
});
