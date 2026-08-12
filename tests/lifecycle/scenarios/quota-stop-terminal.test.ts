import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
  executionEvents,
  recoveryIncidents,
  runs,
  supervisorScheduledWakes,
  workers,
} from "@/server/db/schema";
import { __resetNamedEventsForTests } from "@/server/events/named-events";
import { syncConversationSessions } from "@/server/conversations/sync";
import { handleWorkerQuotaExhaustion } from "@/server/quota/recovery";

import { eventsRouteModule as eventsRoute } from "@/../tests/helpers/runtime-routes";
import { runRouteModule as runRoute } from "@/../tests/helpers/runtime-routes";

import { startLifecycleHarness, type LifecycleServer } from "../harness/server";
import { LifecycleClient } from "../harness/client";
import { Chaos, NO_CHAOS } from "../harness/chaos";
import { clearLifecycleSchema, seedDirectRun } from "../harness/fixtures";

vi.mock("@/server/bridge-client", async () => {
  const actual = await vi.importActual<typeof import("@/server/bridge-client")>("@/server/bridge-client");
  return {
    ...actual,
    getAgent: vi.fn(),
    spawnAgent: vi.fn(),
    cancelAgent: vi.fn().mockResolvedValue({ ok: true }),
    BRIDGE_URL: "http://localhost:0",
  };
});

let server: LifecycleServer;
let client: LifecycleClient;

async function clearScenarioRows() {
  await db.delete(supervisorScheduledWakes);
  await db.delete(recoveryIncidents);
  await db.delete(executionEvents);
  await clearLifecycleSchema();
}

beforeEach(async () => {
  __resetNamedEventsForTests();
  await clearScenarioRows();
  server = await startLifecycleHarness({
    routes: [
      { pattern: "/api/events", module: eventsRoute },
      { pattern: "/api/runs/:id", module: runRoute },
    ],
  });
  client = new LifecycleClient({
    baseUrl: server.baseUrl,
    chaos: new Chaos(29, NO_CHAOS),
  });
});

afterEach(async () => {
  await client.close();
  await server.stop();
  await clearScenarioRows();
  vi.clearAllMocks();
});

describe("lifecycle harness — quota wait remains terminal after user stop", () => {
  it("preserves quota waiting across reset, reload reconciliation, and stale worker state", async () => {
    const { runId } = await seedDirectRun();
    const workerId = `${runId}-worker-1`;
    const incidentId = `${runId}-quota`;
    const now = new Date();

    // This is the state observed in the reported session at reset time: the
    // old observer had left a failed run row, while the quota incident still
    // owned the right to resume it.
    await db.update(runs).set({
      status: "failed",
      lastError: "stale provider error",
      failedAt: now,
      updatedAt: now,
    }).where(eq(runs.id, runId));
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "claude",
      status: "cred-exhausted",
      cwd: "/tmp",
      outputLog: "",
      bridgeSessionId: "quota-session",
      bridgeSessionMode: "direct",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(recoveryIncidents).values({
      id: incidentId,
      runId,
      workerId,
      kind: "quota_exhausted",
      status: "open",
      details: JSON.stringify({
        recoveryState: "quota_waiting",
        // Keep the lifecycle harness from auto-running the watchdog during
        // this snapshot assertion; the elapsed-reset/lost-wake handoff is
        // exercised deterministically in the quota-resume scenario tests.
        resumeAt: new Date(now.getTime() + 60_000).toISOString(),
      }),
      detectedAt: now,
      updatedAt: now,
    });

    await client.bootstrapSnapshot(runId);
    await client.subscribe({ runId });

    await syncConversationSessions([{
      name: workerId,
      type: "claude",
      state: "working",
      cwd: "/tmp",
      sessionId: "quota-session",
      sessionMode: "direct",
      currentText: "stale live work",
      lastText: "",
      outputEntries: [],
      pendingPermissions: [],
      pendingElicitations: [],
      stderrBuffer: [],
      stopReason: null,
    }], { selectedRunId: runId });

    const preserved = await client.waitFor("recovery.quota_wait_preserved", {
      predicate: (frame) => (frame.payload as { incidentId?: string } | null)?.incidentId === incidentId,
      timeoutMs: 10_000,
    });
    expect(preserved.payload).toMatchObject({
      kind: "recovery.quota_wait_preserved",
      runId,
      incidentId,
    });
    expect(["failed", "running"]).toContain(
      (preserved.payload as { previousStatus?: string }).previousStatus,
    );

    const snapshot = await client.bootstrapSnapshot(runId);
    const payload = snapshot.snapshot as {
      runs?: Array<{ id: string; status: string }>;
      recoveryState?: { kind?: string; status?: string } | null;
    };
    expect(payload.runs?.find((run) => run.id === runId)?.status).toBe("quota_waiting");
    expect(payload.recoveryState).toMatchObject({ kind: "quota_waiting", status: "open" });
  });

  it("refuses a late quota callback after the user stops the supervisor", async () => {
    const { runId } = await seedDirectRun();
    const workerId = `${runId}-worker-1`;
    const incidentId = `${runId}-quota`;
    const now = new Date();
    const resumeAt = new Date(now.getTime() + 60_000);

    await db.update(runs).set({ status: "quota_waiting", updatedAt: now }).where(eq(runs.id, runId));
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "claude",
      status: "cred-exhausted",
      cwd: "/tmp",
      outputLog: "",
      bridgeSessionId: "quota-session",
      bridgeSessionMode: "direct",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(recoveryIncidents).values({
      id: incidentId,
      runId,
      workerId,
      kind: "quota_exhausted",
      status: "open",
      details: JSON.stringify({ resumeAt: resumeAt.toISOString() }),
      detectedAt: now,
      updatedAt: now,
    });
    await db.insert(supervisorScheduledWakes).values({
      runId,
      wakeAt: resumeAt,
      reason: "quota_wait",
      source: "lifecycle-test",
      incidentId,
      createdAt: now,
      updatedAt: now,
    });

    await client.bootstrapSnapshot(runId);
    await client.subscribe({ runId });

    const response = await client.fetch(`/api/runs/${runId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "stop_supervisor" }),
    });
    expect(response.status).toBe(200);

    const result = await handleWorkerQuotaExhaustion({
      runId,
      workerId,
      text: "Internal error: You've hit your session limit · resets 5:10pm (Europe/Madrid)",
      provider: "claude",
      now: new Date(now.getTime() + 1_000),
    });
    const refusedFrame = await client.waitFor("recovery.refused", {
      predicate: (frame) => (frame.payload as { workerId?: string } | null)?.workerId === workerId,
      timeoutMs: 10_000,
    });

    const storedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const storedWorker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    const storedIncidents = await db.select().from(recoveryIncidents).where(eq(recoveryIncidents.runId, runId));
    const storedWake = await db.select().from(supervisorScheduledWakes).where(eq(supervisorScheduledWakes.runId, runId)).get();
    const storedEvents = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId));

    expect(result).toMatchObject({ state: "ignored", reason: "run_terminal", runId });
    expect(storedRun?.status).toBe("cancelled");
    expect(storedWorker?.status).toBe("cancelled");
    expect(storedIncidents).toHaveLength(1);
    expect(storedIncidents[0]).toMatchObject({ id: incidentId, status: "resolved" });
    expect(storedWake).toBeUndefined();
    expect(storedEvents.some((event) => event.eventType === "quota_recovery_refused")).toBe(true);
    expect(refusedFrame.payload).toMatchObject({
      kind: "recovery.refused",
      runId,
      workerId,
      reason: "run_terminal",
      runStatus: "cancelled",
    });
  });

  it("retires recovery ownership before a later live sync can reactivate the run", async () => {
    const { runId } = await seedDirectRun();
    const workerId = `${runId}-worker-1`;
    const incidentId = `${runId}-quota`;
    const now = new Date();
    const resumeAt = new Date(now.getTime() + 60_000);

    await db.update(runs).set({ status: "quota_waiting", updatedAt: now }).where(eq(runs.id, runId));
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "claude",
      status: "cred-exhausted",
      cwd: "/tmp",
      outputLog: "",
      bridgeSessionId: "quota-session",
      bridgeSessionMode: "direct",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(recoveryIncidents).values({
      id: incidentId,
      runId,
      workerId,
      kind: "quota_exhausted",
      status: "open",
      details: JSON.stringify({ resumeAt: resumeAt.toISOString() }),
      detectedAt: now,
      updatedAt: now,
    });
    await db.insert(supervisorScheduledWakes).values({
      runId,
      wakeAt: resumeAt,
      reason: "quota_wait",
      source: "lifecycle-test",
      incidentId,
      createdAt: now,
      updatedAt: now,
    });

    await client.bootstrapSnapshot(runId);
    await client.subscribe({ runId });

    const response = await client.fetch(`/api/runs/${runId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "stop_worker", workerId }),
    });
    expect(response.status).toBe(200);

    const resolved = await client.waitFor("recovery.resolved", {
      predicate: (frame) => (frame.payload as { incidentId?: string } | null)?.incidentId === incidentId,
      timeoutMs: 10_000,
    });
    expect(resolved.payload).toMatchObject({ kind: "recovery.resolved", runId, incidentId });

    await syncConversationSessions([{
      name: workerId,
      type: "claude",
      state: "working",
      cwd: "/tmp",
      sessionId: "quota-session",
      sessionMode: "direct",
      currentText: "late live state",
      lastText: "",
      outputEntries: [],
      pendingPermissions: [],
      pendingElicitations: [],
      stderrBuffer: [],
      stopReason: null,
    }], { selectedRunId: runId });

    const storedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const storedWorker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    const storedIncident = await db.select().from(recoveryIncidents).where(eq(recoveryIncidents.id, incidentId)).get();
    const storedWake = await db.select().from(supervisorScheduledWakes).where(eq(supervisorScheduledWakes.runId, runId)).get();

    expect(storedRun?.status).toBe("cancelled");
    expect(storedWorker?.status).toBe("cancelled");
    expect(storedIncident?.status).toBe("resolved");
    expect(storedWake).toBeUndefined();
  });
});
