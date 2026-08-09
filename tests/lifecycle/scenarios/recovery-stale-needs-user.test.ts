/**
 * Reproduces the original bug: "session still shows 'needs recovery,
 * authentication required' after I authenticated and the conversation
 * carried on working".
 *
 * The recovery banner is derived purely from incident rows — any incident
 * in open/recovering/needs_user/failed renders it. Nothing closed a
 * `needs_user` incident once the user fixed the underlying problem
 * themselves: `markRecoveryIncidentResolved` was only reachable from an
 * automatic recovery attempt, a quota resume, or the user *stopping* the
 * conversation. So the row outlived the very turn that disproved it and the
 * banner became permanent.
 *
 * This scenario replays the exact sequence observed in the field —
 * session_missing → auto-resume resolves → continuation fails with
 * "Ask failed: Authentication required" → needs_user — and then asserts a
 * subsequent healthy turn clears the banner.
 *
 * Catches a regression where a leftover incident is left dangling after the
 * run goes healthy again, in which case `recoveryState` stays non-null on
 * the snapshot and the user is stuck looking at a stale warning.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
  artifactStreams,
  conversationReadMarkers,
  executionEvents,
  messages,
  queuedConversationMessages,
  recoveryIncidents,
  workerCounters,
  workers,
} from "@/server/db/schema";

import { eventsRouteModule as eventsRoute } from "@/../tests/helpers/runtime-routes";

import { startLifecycleHarness, type LifecycleServer } from "../harness/server";
import { LifecycleClient } from "../harness/client";
import { Chaos, NO_CHAOS } from "../harness/chaos";
import { clearLifecycleSchema, seedDirectRun } from "../harness/fixtures";
import { __getRingForTests, __resetNamedEventsForTests } from "@/server/events/named-events";
import {
  markRecoveryIncidentFailed,
  markRecoveryIncidentNeedsUser,
  markRecoveryIncidentResolved,
  openRecoveryIncident,
  resolveRecoveryIncidentsAfterHealthyTurn,
} from "@/server/runs/recovery-incidents";

let server: LifecycleServer;
let client: LifecycleClient;

type SnapshotWithRecovery = {
  recoveryState: { status?: string; lastError?: string } | null;
};

async function snapshotRecoveryState(runId: string) {
  const { snapshot } = await client.bootstrapSnapshot(runId);
  return (snapshot as SnapshotWithRecovery).recoveryState;
}

beforeEach(async () => {
  __resetNamedEventsForTests();
  // This file runs several scenarios, so the run rows from the previous one
  // have to go before `clearLifecycleSchema` can drop `runs`.
  await db.delete(executionEvents);
  await db.delete(recoveryIncidents);
  await db.delete(queuedConversationMessages);
  await db.delete(conversationReadMarkers);
  await db.delete(artifactStreams);
  await db.delete(messages);
  await db.delete(workerCounters);
  await db.delete(workers);
  await clearLifecycleSchema();
  server = await startLifecycleHarness({
    routes: [{ pattern: "/api/events", module: eventsRoute }],
  });
  client = new LifecycleClient({
    baseUrl: server.baseUrl,
    chaos: new Chaos(0xC0FFEE, NO_CHAOS),
  });
});

afterEach(async () => {
  await client.close();
  await server.stop();
});

async function seedRunWithWorker() {
  const { runId } = await seedDirectRun();
  const now = new Date();
  await db.insert(workers).values({
    id: "w-stale",
    runId,
    type: "claude",
    status: "idle",
    cwd: "/tmp",
    outputLog: "",
    outputEntriesJson: "[]",
    currentText: "",
    lastText: "",
    createdAt: now,
    updatedAt: now,
  });
  return runId;
}

describe("lifecycle harness — stale needs_user recovery incident", () => {
  it("clears the banner once a worker turn completes normally", async () => {
    const runId = await seedRunWithWorker();

    // 1. The session goes missing and auto-resume brings it back.
    const incident = await openRecoveryIncident({
      runId,
      workerId: "w-stale",
      kind: "session_missing",
      details: { recoveryState: "lost_worker_resumable", recommendedAction: "resume_session" },
    });
    await markRecoveryIncidentResolved({
      incidentId: incident.id,
      runId,
      workerId: "w-stale",
      summary: "Resumed w-stale from saved session.",
      details: { continuationPending: true },
    });

    // 2. The continuation turn dies on expired credentials — the incident
    //    reopens as needs_user and the banner goes up.
    await markRecoveryIncidentNeedsUser({
      incidentId: incident.id,
      runId,
      workerId: "w-stale",
      reason: "Ask failed: Authentication required",
      details: { continuationFailed: true },
    });

    expect(await snapshotRecoveryState(runId)).toMatchObject({
      status: "needs_user",
      lastError: "Ask failed: Authentication required",
    });

    // 3. The user authenticates out of band and simply carries on. The next
    //    turn completing normally is the proof that recovery is moot.
    const resolvedCount = await resolveRecoveryIncidentsAfterHealthyTurn({
      runId,
      workerId: "w-stale",
      summary: "w-stale completed a turn normally after recovery was pending.",
      reason: "worker_turn_succeeded",
    });
    expect(resolvedCount).toBe(1);

    // The clearing is a server-side decision, so it has to reach the wire.
    const resolvedEvents = __getRingForTests().filter((entry) => {
      const event = entry.event as { kind?: string; incidentId?: string };
      return event.kind === "recovery.resolved" && event.incidentId === incident.id;
    });
    expect(resolvedEvents).toHaveLength(2); // the auto-resume in step 1, then this one

    // 4. The banner is gone, and the row records why.
    expect(await snapshotRecoveryState(runId)).toBeNull();

    const stored = await db.select().from(recoveryIncidents).where(eq(recoveryIncidents.id, incident.id)).get();
    expect(stored?.status).toBe("resolved");
    expect(stored?.resolvedAt).not.toBeNull();
    expect(stored?.lastError).toBeNull();
  });

  it("clears a gave-up incident too, since the banner treats failed as active", async () => {
    const runId = await seedRunWithWorker();

    const incident = await openRecoveryIncident({
      runId,
      workerId: "w-stale",
      kind: "worker_lost",
    });
    await markRecoveryIncidentFailed({
      incidentId: incident.id,
      runId,
      workerId: "w-stale",
      reason: "Bridge never returned.",
    });
    expect(await snapshotRecoveryState(runId)).toMatchObject({ status: "failed" });

    await resolveRecoveryIncidentsAfterHealthyTurn({
      runId,
      workerId: "w-stale",
      summary: "w-stale completed a turn normally after recovery was pending.",
      reason: "worker_turn_succeeded",
    });

    expect(await snapshotRecoveryState(runId)).toBeNull();
  });

  it("leaves a sibling worker's incident alone", async () => {
    const runId = await seedRunWithWorker();
    const now = new Date();
    await db.insert(workers).values({
      id: "w-sibling",
      runId,
      type: "claude",
      status: "lost",
      cwd: "/tmp",
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "",
      createdAt: now,
      updatedAt: now,
    });

    const sibling = await openRecoveryIncident({
      runId,
      workerId: "w-sibling",
      kind: "worker_lost",
      lastError: "agent process exited",
    });
    await markRecoveryIncidentNeedsUser({
      incidentId: sibling.id,
      runId,
      workerId: "w-sibling",
      reason: "agent process exited",
    });

    const resolvedCount = await resolveRecoveryIncidentsAfterHealthyTurn({
      runId,
      workerId: "w-stale",
      summary: "w-stale completed a turn normally after recovery was pending.",
      reason: "worker_turn_succeeded",
    });

    expect(resolvedCount).toBe(0);
    const stored = await db.select().from(recoveryIncidents).where(eq(recoveryIncidents.id, sibling.id)).get();
    expect(stored?.status).toBe("needs_user");
  });
});
