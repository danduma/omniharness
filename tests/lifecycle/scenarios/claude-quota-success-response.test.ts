import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { executionEvents, messages, queuedConversationMessages, recoveryIncidents, runs, supervisorInterventions, supervisorScheduledWakes, workers } from "@/server/db/schema";
import { readWorkerOutputEntries } from "@/server/workers/output-store";
import { waitForConversationBackgroundTasksForTests } from "@/server/conversations/worker-turn-gate";
import { cleanupRunArtifacts } from "@/server/artifacts/cleanup";
import { __resetNamedEventsForTests } from "@/server/events/named-events";
import { executeSupervisorWake } from "@/server/supervisor/wake";
import { pollRunWorkers, stopRunObserver } from "@/server/supervisor/observer";
import { resetDurableSupervisorWakeSchedulerForTests } from "@/server/supervisor/wake-schedule";
import { conversationMessagesRouteModule, eventsRouteModule } from "@/../tests/helpers/runtime-routes";
import { clearLifecycleSchema, seedDirectRun } from "../harness/fixtures";
import { startLifecycleHarness, type LifecycleServer } from "../harness/server";
import { LifecycleClient } from "../harness/client";

vi.mock("@/server/bridge-client", async () => {
  const actual = await vi.importActual<typeof import("@/server/bridge-client")>("@/server/bridge-client");
  return { ...actual, getAgent: vi.fn(), spawnAgent: vi.fn(), listAgents: vi.fn().mockResolvedValue([]) };
});
vi.mock("@/server/supervisor/start", () => ({ startSupervisorRun: vi.fn() }));

import { BRIDGE_URL, getAgent, spawnAgent } from "@/server/bridge-client";

const originalFetch = global.fetch;
const notice = "You've hit your session limit · resets 1am (Europe/Madrid)";
let server: LifecycleServer;
let client: LifecycleClient;
let runId: string;
let resumed = false;
const deliveredPrompts: string[] = [];

async function cleanup() {
  await waitForConversationBackgroundTasksForTests();
  if (runId) stopRunObserver(runId, { reason: "explicit" });
  resetDurableSupervisorWakeSchedulerForTests();
  if (runId) expect((await cleanupRunArtifacts(runId)).errors).toEqual([]);
  await db.delete(supervisorScheduledWakes);
  await db.delete(recoveryIncidents);
  await db.delete(executionEvents);
  await db.delete(queuedConversationMessages);
  await db.delete(messages);
  await db.delete(supervisorInterventions);
  await clearLifecycleSchema();
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-04T21:46:49.000Z"));
  __resetNamedEventsForTests();
  await cleanup();
  resumed = false;
  deliveredPrompts.length = 0;
  server = await startLifecycleHarness({ routes: [
    { pattern: "/api/events", module: eventsRouteModule },
    { pattern: "/api/conversations/:id/messages", module: conversationMessagesRouteModule },
  ] });
  client = new LifecycleClient({ baseUrl: server.baseUrl });
  ({ runId } = await seedDirectRun());
  const workerId = `${runId}-worker-1`;
  const now = new Date();
  await db.update(runs).set({ status: "done", preferredWorkerType: "claude" }).where(eq(runs.id, runId));
  await db.insert(workers).values({
    id: workerId, runId, type: "claude", status: "idle", cwd: process.env.OMNIHARNESS_ROOT!,
    bridgeSessionId: "saved-claude-session", bridgeSessionMode: "full-access", workerNumber: 1,
    createdAt: now, updatedAt: now, outputLog: "",
  });
  const snapshot = () => ({
    name: workerId, type: "claude", state: "idle", cwd: process.env.OMNIHARNESS_ROOT!,
    sessionId: "saved-claude-session", sessionMode: "full-access", currentText: "",
    lastText: resumed ? "Continued the implementation." : "", outputEntries: [],
    pendingPermissions: [], pendingElicitations: [], stderrBuffer: [], stopReason: "end_turn",
  });
  vi.mocked(getAgent).mockImplementation(async () => snapshot());
  vi.mocked(spawnAgent).mockImplementation(async () => {
    resumed = true;
    return snapshot();
  });
  global.fetch = vi.fn(async (input, init) => {
    if (String(input).startsWith(`${BRIDGE_URL}/agents/`) && String(input).includes("/ask?")) {
      deliveredPrompts.push(JSON.parse(String(init?.body)).prompt);
      const response = resumed ? "Continued the implementation." : notice.repeat(2);
      return new Response(`event: done\ndata: ${JSON.stringify({ response, state: "idle", stopReason: "end_turn" })}\n\n`, {
        headers: { "Content-Type": "text/event-stream" },
      });
    }
    return originalFetch(input, init);
  }) as typeof fetch;
});

afterEach(async () => {
  await client?.close();
  await server?.stop();
  global.fetch = originalFetch;
  await cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("Claude quota notice in a successful ACP response", () => {
  it("registers an idle provider-started turn's quota notice through the observer", async () => {
    const workerId = `${runId}-worker-1`;
    await db.update(runs).set({ mode: "implementation", status: "running" }).where(eq(runs.id, runId));
    await db.update(workers).set({ status: "working" }).where(eq(workers.id, workerId));
    const snapshot = await getAgent(workerId);
    vi.mocked(getAgent).mockResolvedValue({ ...snapshot, lastText: notice });
    await client.subscribe({ runId });
    await pollRunWorkers(runId, vi.fn());
    expect((await db.select().from(runs).where(eq(runs.id, runId)).get())?.status).toBe("quota_waiting");
    expect((await db.select().from(workers).where(eq(workers.id, workerId)).get())?.status).toBe("cred-exhausted");
    expect((await db.select().from(supervisorScheduledWakes).where(eq(supervisorScheduledWakes.runId, runId)).get())?.wakeAt.toISOString()).toBe("2026-10-04T23:00:01.000Z");
    await client.waitFor("recovery.opened");
  });

  it("parks the direct session, persists its reset wake, and resumes the saved session when due", async () => {
    await client.subscribe({ runId });
    const response = await client.fetch(`/api/conversations/${runId}/messages`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "Continue the implementation" }),
    });
    expect([200, 202]).toContain(response.status);
    await vi.waitFor(async () => {
      expect((await db.select().from(supervisorScheduledWakes).where(eq(supervisorScheduledWakes.runId, runId)).get())?.reason).toBe("quota_wait");
    });
    const workerId = `${runId}-worker-1`;
    expect((await db.select().from(runs).where(eq(runs.id, runId)).get())?.status).toBe("quota_waiting");
    expect((await db.select().from(workers).where(eq(workers.id, workerId)).get())?.status).toBe("cred-exhausted");
    const incident = await db.select().from(recoveryIncidents).where(eq(recoveryIncidents.runId, runId)).get();
    expect(incident).toMatchObject({ kind: "quota_exhausted", status: "open" });
    const wake = (await db.select().from(supervisorScheduledWakes).where(eq(supervisorScheduledWakes.runId, runId)).get())!;
    expect(wake.wakeAt.toISOString()).toBe("2026-10-04T23:00:01.000Z");
    expect(wake.incidentId).toBe(incident?.id);
    expect(deliveredPrompts).toHaveLength(1);
    await client.waitFor("recovery.opened");
    await waitForConversationBackgroundTasksForTests();

    vi.setSystemTime(wake.wakeAt);
    await executeSupervisorWake(runId);

    expect(spawnAgent).toHaveBeenCalledWith(expect.objectContaining({ name: workerId, resumeSessionId: "saved-claude-session" }));
    expect(deliveredPrompts).toHaveLength(2);
    expect(await db.select().from(recoveryIncidents).where(eq(recoveryIncidents.runId, runId)).get()).toMatchObject({ status: "resolved" });
    expect(await db.select().from(supervisorScheduledWakes).where(eq(supervisorScheduledWakes.runId, runId)).get()).toBeUndefined();
    expect((await readWorkerOutputEntries(runId, workerId)).some((entry) => entry.type === "message" && entry.text === "Continued the implementation.")).toBe(true);
  });
});
