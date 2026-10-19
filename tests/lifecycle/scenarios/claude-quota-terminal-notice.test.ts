import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { executionEvents, recoveryIncidents, runs, supervisorScheduledWakes, workers } from "@/server/db/schema";
import { syncConversationSessions } from "@/server/conversations/sync";
import { __resetNamedEventsForTests } from "@/server/events/named-events";
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

describe("Claude successful terminal quota notice", () => {
  it("publishes the incident, arms one wake, and preserves it when the runtime disappears", async () => {
    const { runId } = await seedDirectRun();
    const workerId = `${runId}-worker-1`;
    const now = new Date();
    await db.update(runs).set({ status: "running" }).where(eq(runs.id, runId));
    await db.insert(workers).values({
      id: workerId, runId, type: "claude", status: "working", cwd: "/tmp",
      bridgeSessionId: "saved-claude-session", outputLog: "", outputEntriesJson: "[]",
      currentText: "", lastText: "", createdAt: now, updatedAt: now,
    });
    await client.bootstrapSnapshot(runId);
    await client.subscribe({ runId });
    const agent = {
      name: workerId, type: "claude", cwd: "/tmp", state: "idle", sessionId: "saved-claude-session",
      currentText: "", lastText: "Plan 034 is written.You've hit your session limit · resets 3:30pm (Europe/Madrid)",
      stopReason: "end_turn", outputEntries: [], pendingPermissions: [], pendingElicitations: [], stderrBuffer: [],
    };
    for (const snapshots of [[agent], [agent], []]) {
      const response = await client.fetch("/snapshot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(snapshots) });
      expect(response.status).toBe(200);
    }
    const opened = await client.waitFor("recovery.opened", { timeoutMs: 10_000 });
    expect(opened.payload).toMatchObject({ runId, recoveryKind: "quota_exhausted" });
    expect((await db.select().from(runs).where(eq(runs.id, runId)).get())?.status).toBe("quota_waiting");
    expect((await db.select().from(workers).where(eq(workers.id, workerId)).get())?.status).toBe("cred-exhausted");
    const incidents = await db.select().from(recoveryIncidents).where(eq(recoveryIncidents.runId, runId));
    expect(incidents).toHaveLength(1);
    const wake = await db.select().from(supervisorScheduledWakes).where(eq(supervisorScheduledWakes.runId, runId)).get();
    expect(wake).toMatchObject({ reason: "quota_wait", incidentId: incidents[0].id });
    expect(wake!.wakeAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("does not re-admit the parked notice of a session just resumed after the reset", async () => {
    const { runId } = await seedDirectRun();
    const workerId = `${runId}-worker-1`;
    const now = new Date();
    const notice = "You've hit your session limit · resets 7:10pm (Europe/Madrid)";
    await db.update(runs).set({ status: "running" }).where(eq(runs.id, runId));
    // The quota resume claims the worker as `working` and copies the resumed
    // session's last text — still the notice that parked it — before prompting.
    await db.insert(workers).values({
      id: workerId, runId, type: "claude", status: "working", cwd: "/tmp",
      bridgeSessionId: "saved-claude-session", outputLog: "", outputEntriesJson: "[]",
      currentText: notice, lastText: notice, createdAt: now, updatedAt: now,
    });
    const agent = {
      name: workerId, type: "claude", cwd: "/tmp", state: "idle", sessionId: "saved-claude-session",
      currentText: notice, lastText: notice,
      stopReason: "end_turn", outputEntries: [], pendingPermissions: [], pendingElicitations: [], stderrBuffer: [],
    };
    const response = await client.fetch("/snapshot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify([agent]) });
    expect(response.status).toBe(200);
    expect(await db.select().from(recoveryIncidents).where(eq(recoveryIncidents.runId, runId))).toHaveLength(0);
    expect(await db.select().from(supervisorScheduledWakes).where(eq(supervisorScheduledWakes.runId, runId))).toHaveLength(0);
    expect((await db.select().from(runs).where(eq(runs.id, runId)).get())?.status).not.toBe("quota_waiting");
  });
});
