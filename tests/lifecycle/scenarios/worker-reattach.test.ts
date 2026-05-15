/**
 * Drives the observer's "revive worker from saved session" branch and
 * asserts `worker.reattached` is emitted on the wire.
 *
 * Mirrors the "session fails to reconnect" bug: previously this branch
 * could quietly give up after one attempt with no user feedback. The
 * fix is that every reattach (success path) emits a typed event, so a
 * future regression — silent give-up, infinite retry, wrong branch
 * taken — is detectable from outside.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { executionEvents, runs, workers } from "@/server/db/schema";

import * as eventsRoute from "@/app/api/events/route";

import { startLifecycleHarness, type LifecycleServer } from "../harness/server";
import { LifecycleClient } from "../harness/client";
import { Chaos, NO_CHAOS } from "../harness/chaos";
import { clearLifecycleSchema, seedDirectRun } from "../harness/fixtures";
import { __resetNamedEventsForTests } from "@/server/events/named-events";

vi.mock("@/server/bridge-client", () => ({
  // The observer queries the bridge for each worker. We simulate a
  // worker whose bridge process is gone but whose session is still
  // resumable — exactly the post-restart shape.
  getAgent: vi.fn().mockRejectedValue(new Error("agent not found")),
  spawnAgent: vi.fn().mockImplementation(async (args: { name: string }) => ({
    name: args.name,
    type: "codex",
    state: "idle",
    currentText: "",
    lastText: "",
    sessionId: "session-resumed",
    sessionMode: null,
    pendingPermissions: [],
    outputEntries: [],
    stderrBuffer: [],
    stopReason: null,
    cwd: "/tmp",
  })),
  cancelAgent: vi.fn().mockResolvedValue(undefined),
  cancelAgentTerminalProcess: vi.fn().mockResolvedValue(undefined),
  approvePermission: vi.fn().mockResolvedValue(undefined),
  BRIDGE_URL: "http://localhost:0",
}));

vi.mock("@/server/workers/snapshots", () => ({
  persistWorkerSnapshot: vi.fn().mockResolvedValue(undefined),
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
    chaos: new Chaos(0xCAFE, NO_CHAOS),
  });
});

afterEach(async () => {
  await client.close();
  await server.stop();
  vi.clearAllMocks();
});

describe("lifecycle harness — worker reattach via observer", () => {
  it("emits worker.reattached when the observer revives a worker from a saved session", async () => {
    const { runId } = await seedDirectRun();
    // Mark the run as running implementation so the observer treats it
    // as active.
    await db.update(runs).set({ mode: "implementation", status: "working" }).where(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      (await import("drizzle-orm")).eq(runs.id, runId) as never,
    );

    const now = new Date();
    await db.insert(workers).values({
      id: "w-reattach",
      runId,
      type: "codex",
      status: "working",
      cwd: "/tmp",
      bridgeSessionId: "saved-session-xyz",
      bridgeSessionMode: null,
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "",
      createdAt: now,
      updatedAt: now,
    });

    await client.bootstrapSnapshot(runId);
    await client.subscribe({ runId });

    // Drive the observer poll directly. In production this is on an
    // interval; here we invoke it once to exercise the revive branch.
    const { pollRunWorkers } = await import("@/server/supervisor/observer");
    const wakeSupervisor = vi.fn();
    await pollRunWorkers(runId, wakeSupervisor);

    const frame = await client.waitFor("worker.reattached", { timeoutMs: 10_000 });
    expect(frame.payload).toMatchObject({
      kind: "worker.reattached",
      runId,
      workerId: "w-reattach",
    });
  });
});
