/**
 * Asserts that every observer-stop site emits `supervisor.stopped`
 * with a typed reason. Previously these stops were silent — the run
 * status changed, but no wire-visible event explained "supervision
 * stopped because X."
 *
 * This makes debugging "the worker just went quiet" tractable: the
 * event log shows exactly which decision branch fired and why.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { executionEvents, plans, runs, workers } from "@/server/db/schema";

import * as eventsRoute from "@/app/api/events/route";

import { startLifecycleHarness, type LifecycleServer } from "../harness/server";
import { LifecycleClient } from "../harness/client";
import { Chaos, NO_CHAOS } from "../harness/chaos";
import { clearLifecycleSchema, seedDirectRun } from "../harness/fixtures";
import { __resetNamedEventsForTests } from "@/server/events/named-events";
import { startRunObserver, stopRunObserver } from "@/server/supervisor/observer";

vi.mock("@/server/bridge-client", () => ({
  getAgent: vi.fn().mockResolvedValue({
    state: "idle", currentText: "", lastText: "", sessionId: null, sessionMode: null,
    pendingPermissions: [], outputEntries: [], stderrBuffer: [], stopReason: null, cwd: "/tmp",
  }),
  spawnAgent: vi.fn(),
  cancelAgent: vi.fn(),
  BRIDGE_URL: "http://localhost:0",
}));

let server: LifecycleServer;
let client: LifecycleClient;

beforeEach(async () => {
  __resetNamedEventsForTests();
  await db.delete(executionEvents);
  await db.delete(workers);
  await clearLifecycleSchema();
  server = await startLifecycleHarness({
    routes: [{ pattern: "/api/events", module: eventsRoute }],
  });
  client = new LifecycleClient({
    baseUrl: server.baseUrl,
    chaos: new Chaos(17, NO_CHAOS),
  });
});

afterEach(async () => {
  await client.close();
  await server.stop();
  vi.clearAllMocks();
});

describe("lifecycle harness — supervisor.stopped", () => {
  it("emits supervisor.stopped with reason when the observer is stopped explicitly", async () => {
    const { runId } = await seedDirectRun();
    await db.update(runs).set({ mode: "implementation", status: "working" }).where(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      (await import("drizzle-orm")).eq(runs.id, runId) as never,
    );

    await client.bootstrapSnapshot(runId);
    await client.subscribe({ runId });

    // Start an observer so we have a real interval to stop.
    startRunObserver(runId, () => undefined);

    // Stop it with an explicit reason.
    stopRunObserver(runId, { reason: "explicit" });

    const stopped = await client.waitFor("supervisor.stopped", {
      predicate: (frame) => (frame.payload as { runId?: string } | null)?.runId === runId,
      timeoutMs: 10_000,
    });
    expect(stopped.payload).toMatchObject({
      kind: "supervisor.stopped",
      runId,
      reason: "explicit",
    });
  });

  it("does not emit supervisor.stopped when stopping a never-started run", async () => {
    const { runId } = await seedDirectRun();
    await client.bootstrapSnapshot(runId);
    await client.subscribe({ runId });

    // Stop a runId that was never started — should be a no-op.
    stopRunObserver(runId, { reason: "explicit" });
    await new Promise((r) => setTimeout(r, 200));

    expect(client.events.filterByEvent("supervisor.stopped")).toHaveLength(0);
  });
});
