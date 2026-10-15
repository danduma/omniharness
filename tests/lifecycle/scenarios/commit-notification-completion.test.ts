import { afterEach, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { runs, workers } from "@/server/db/schema";
import { syncConversationSessions } from "@/server/conversations/sync";
import { hasLiveWorkerTurn, waitForConversationBackgroundTasksForTests } from "@/server/conversations/worker-turn-gate";
import { ConversationNotificationManager } from "@/interface/home/ConversationNotificationManager";
import type { EventStreamState } from "@/interface/home/types";
import { conversationsRouteModule, eventsRouteModule, workerEntriesRoute, runRouteModule } from "@/../tests/helpers/runtime-routes";
import { startLifecycleHarness, type LifecycleServer } from "../harness/server";
import { LifecycleClient } from "../harness/client";

const bridge = vi.hoisted(() => ({ ask: vi.fn(), get: vi.fn(), spawn: vi.fn() }));
vi.mock("@/server/bridge-client", async (original) => ({
  ...await original<typeof import("@/server/bridge-client")>(),
  askAgent: bridge.ask,
  getAgent: bridge.get,
  spawnAgent: bridge.spawn,
}));

let server: LifecycleServer | undefined;
let client: LifecycleClient | undefined;
let createdRunId: string | undefined;
let finish: (() => void) | undefined;
afterEach(async () => {
  finish?.();
  await waitForConversationBackgroundTasksForTests();
  if (createdRunId && client) {
    const removed = await client.fetch(`/api/runs/${createdRunId}`, { method: "DELETE" });
    expect(removed.ok).toBe(true);
  }
  await client?.close();
  await server?.stop();
});

it("does not announce completion during a commit worker's transient idle gap", async () => {
  server = await startLifecycleHarness({ routes: [
    { pattern: "/api/conversations", module: conversationsRouteModule },
    { pattern: "/api/events", module: eventsRouteModule },
    { pattern: "/api/runs/:id", module: runRouteModule },
    { pattern: "/api/workers/:workerId/entries", module: { GET: workerEntriesRoute } },
  ] });
  client = new LifecycleClient({ baseUrl: server.baseUrl });
  let workerId = "";
  const snapshot = (state: string, text: string) => ({
    name: workerId, type: "codex", cwd: server!.omniRoot, state,
    currentText: "", lastText: text, stopReason: state === "idle" ? "end_turn" : null,
    sessionId: "commit-notification-session", sessionMode: "full-access", stderrBuffer: [],
    outputEntries: text ? [{ id: "result", type: "message", text, timestamp: new Date().toISOString() }] : [],
  });
  bridge.spawn.mockImplementation(async (args: { name: string }) => {
    workerId = args.name;
    return snapshot("idle", "");
  });
  const pending = new Promise<void>((resolve) => { finish = resolve; });
  bridge.ask.mockImplementation(async () => {
    await pending;
    return { response: "Pushed the commits to origin/master.", state: "idle", stopReason: "end_turn" };
  });
  bridge.get.mockImplementation(async () => snapshot("idle", "Pushed the commits to origin/master."));
  const response = await client.fetch("/api/conversations", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode: "commit", command: "commit and push", projectPath: server.omniRoot }),
  });
  expect(response.status).toBe(200);
  const { runId } = await response.json() as { runId: string };
  createdRunId = runId;
  await vi.waitFor(() => expect(hasLiveWorkerTurn(workerId)).toBe(true));

  const notify = vi.fn().mockResolvedValue(undefined);
  const manager = new ConversationNotificationManager({
    listEntries: async ({ workerId }) => {
      const res = await client!.fetch(`/api/workers/${workerId}/entries?limit=100`);
      expect(res.ok).toBe(true);
      return res.json();
    },
    storage: null, notifier: { notify }, visibilityProvider: () => "hidden",
    permissionProvider: { isSupported: () => true, getPermission: () => "granted", requestPermission: async () => "granted" },
    pushClient: { isSupported: () => false, subscribe: vi.fn(), unsubscribe: vi.fn() },
  });
  await manager.requestEnable();
  const observe = async () => {
    const { snapshot: state } = await client!.bootstrapSnapshot(runId);
    manager.handleEventStreamState(state as EventStreamState);
  };
  await observe();
  await syncConversationSessions([{ ...snapshot("idle", "I’ll inspect the branch, then commit and push."), stopReason: null }], { selectedRunId: runId });
  await observe();
  expect(notify).not.toHaveBeenCalled();
  expect((await db.select().from(runs).where(eq(runs.id, runId)).get())?.status).toBe("running");
  expect((await db.select().from(workers).where(eq(workers.id, workerId)).get())?.status).toBe("working");

  finish!();
  await waitForConversationBackgroundTasksForTests();
  await observe();
  await vi.waitFor(() => expect(notify).toHaveBeenCalledTimes(1));
  expect(notify).toHaveBeenCalledWith(expect.objectContaining({ body: "Pushed the commits to origin/master." }));
});
