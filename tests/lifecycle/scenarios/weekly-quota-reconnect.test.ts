import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { executionEvents, recoveryIncidents, runs, supervisorScheduledWakes, workers } from "@/server/db/schema";
import { updateDirectRunStatusFromWorkerOutput } from "@/server/conversations/direct-run-status";
import { handleWorkerQuotaExhaustion } from "@/server/quota/recovery";
import { syncConversationSessions } from "@/server/conversations/sync";
import { __resetNamedEventsForTests } from "@/server/events/named-events";
import { resolveRecoveryIncidentsDisprovedByActiveWork, resolveRecoveryIncidentsAfterHealthyTurn } from "@/server/runs/recovery-incidents";
import { resetDurableSupervisorWakeSchedulerForTests } from "@/server/supervisor/wake-schedule";
import { eventsRouteModule as eventsRoute } from "@/../tests/helpers/runtime-routes";
import { startLifecycleHarness, type LifecycleServer } from "../harness/server";
import { LifecycleClient } from "../harness/client";
import { Chaos, NO_CHAOS } from "../harness/chaos";
import { clearLifecycleSchema, seedDirectRun } from "../harness/fixtures";

let server: LifecycleServer;
let client: LifecycleClient;

beforeEach(async () => {
  __resetNamedEventsForTests();
  await db.delete(supervisorScheduledWakes);
  await db.delete(recoveryIncidents);
  await db.delete(executionEvents);
  await clearLifecycleSchema();
  server = await startLifecycleHarness({ routes: [
    { pattern: "/api/events", module: eventsRoute },
    // Provider snapshots enter through the normal reconciliation owner.
    { pattern: "/snapshot", module: { POST: async (request: Request) => {
      await syncConversationSessions(await request.json());
      return Response.json({ ok: true });
    } } },
  ] });
  client = new LifecycleClient({ baseUrl: server.baseUrl, chaos: new Chaos(13, NO_CHAOS) });
});

afterEach(async () => {
  resetDurableSupervisorWakeSchedulerForTests();
  await client.close();
  await server.stop();
  await db.delete(supervisorScheduledWakes);
  await db.delete(recoveryIncidents);
  await db.delete(executionEvents);
  await clearLifecycleSchema();
});

describe("weekly quota reconnect regression", () => {
  it("preserves manual weekly-quota recovery across reconnect snapshots and working claims", async () => {
    const { runId } = await seedDirectRun();
    const workerId = `${runId}-worker-1`;
    const now = new Date();
    const reset = new Date(now.getTime() + 3 * 24 * 60 * 60_000);
    const notice = `Internal error: You've hit your weekly limit · resets ${reset.toISOString()}`;
    await db.update(runs).set({ status: "running" }).where(eq(runs.id, runId));
    await db.insert(workers).values({
      id: workerId, runId, type: "claude", status: "idle", cwd: "/tmp",
      bridgeSessionId: "saved-claude-session", outputLog: "", outputEntriesJson: "[]",
      currentText: "", lastText: "", createdAt: now, updatedAt: now,
    });
    const agent = {
      name: workerId, type: "claude", cwd: "/tmp", state: "error", sessionId: "saved-claude-session",
      currentText: "", lastText: notice, stopReason: "end_turn", outputEntries: [],
      pendingPermissions: [], pendingElicitations: [], stderrBuffer: [],
    };
    const sendSnapshot = async (snapshots: unknown[]) => {
      const response = await client.fetch("/snapshot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(snapshots) });
      expect(response.status).toBe(200);
    };
    await handleWorkerQuotaExhaustion({ runId, workerId, text: notice, provider: "claude" });
    const incident = await db.select().from(recoveryIncidents).where(eq(recoveryIncidents.runId, runId)).get();
    expect(incident).toMatchObject({ kind: "quota_exhausted", status: "needs_user" });

    // Merely entering working precedes the provider response and proves no credit availability.
    expect(await resolveRecoveryIncidentsDisprovedByActiveWork({
      runId, workerId, since: new Date(now.getTime() + 10_000),
    })).toBe(0);
    for (const reason of ["worker_session_resumed", "run_reconciled_healthy"]) {
      expect(await resolveRecoveryIncidentsAfterHealthyTurn({ runId, workerId, summary: "Runtime available", reason })).toBe(0);
    }
    expect(await updateDirectRunStatusFromWorkerOutput({ runId, workerId, workerStatus: "idle", lastText: "Previous turn" })).toBe("needs_recovery");
    for (const snapshot of [[{ ...agent, state: "working", lastText: "" }], [], [agent]]) {
      await sendSnapshot(snapshot);
      expect((await db.select().from(runs).where(eq(runs.id, runId)).get())?.status).toBe("needs_recovery");
      expect((await db.select().from(recoveryIncidents).where(eq(recoveryIncidents.id, incident!.id)).get())?.status).toBe("needs_user");
    }
    expect(await db.select().from(recoveryIncidents).where(eq(recoveryIncidents.runId, runId))).toHaveLength(1);
    expect(await db.select().from(supervisorScheduledWakes).where(eq(supervisorScheduledWakes.runId, runId))).toHaveLength(0);
    // A real successful turn can still settle the quota incident after manual recovery.
    expect(await resolveRecoveryIncidentsAfterHealthyTurn({ runId, workerId, summary: "Turn succeeded", reason: "worker_turn_succeeded" })).toBe(1);
  });

});
