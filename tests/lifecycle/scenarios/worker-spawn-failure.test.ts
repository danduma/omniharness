/**
 * The "we said spawned but never followed up" silent failure mode.
 *
 * Before the fix, when bridge `spawnAgent` rejected mid-conversation
 * creation, the worker row was left in `starting` and no further
 * lifecycle events fired — the wire just went quiet. Now we emit
 * `error.surfaced` with code `worker.spawn.failed` so the UI can
 * surface a toast and the chaos harness can assert the failure.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
  executionEvents,
  messages,
  plans,
  runs,
  workerCounters,
  workers,
} from "@/server/db/schema";

import * as eventsRoute from "@/app/api/events/route";
import * as conversationsRoute from "@/app/api/conversations/route";

import { startLifecycleHarness, type LifecycleServer } from "../harness/server";
import { LifecycleClient } from "../harness/client";
import { Chaos, NO_CHAOS } from "../harness/chaos";
import { __resetNamedEventsForTests } from "@/server/events/named-events";

vi.mock("@/server/bridge-client", () => ({
  spawnAgent: vi.fn().mockRejectedValue(new Error("bridge unreachable")),
  askAgent: vi.fn().mockResolvedValue({ response: "ok", state: "idle" }),
  getAgent: vi.fn().mockResolvedValue({}),
  cancelAgent: vi.fn().mockResolvedValue(undefined),
  cancelAgentTerminalProcess: vi.fn().mockResolvedValue(undefined),
  BRIDGE_URL: "http://localhost:0",
}));
vi.mock("@/server/git/auto-commit", () => ({ captureGitBaseline: vi.fn(() => null) }));
vi.mock("@/server/workers/snapshots", () => ({ persistWorkerSnapshot: vi.fn().mockResolvedValue(undefined) }));

let server: LifecycleServer;
let client: LifecycleClient;

beforeEach(async () => {
  __resetNamedEventsForTests();
  await db.delete(executionEvents);
  await db.delete(messages);
  await db.delete(workers);
  await db.delete(workerCounters);
  await db.delete(runs);
  await db.delete(plans);
  server = await startLifecycleHarness({
    routes: [
      { pattern: "/api/events", module: eventsRoute },
      { pattern: "/api/conversations", module: conversationsRoute },
    ],
  });
  client = new LifecycleClient({
    baseUrl: server.baseUrl,
    chaos: new Chaos(15, NO_CHAOS),
  });
});

afterEach(async () => {
  await client.close();
  await server.stop();
  vi.clearAllMocks();
});

describe("lifecycle harness — worker spawn failure", () => {
  it("emits error.surfaced(worker.spawn.failed) when bridge spawn rejects in planning mode", async () => {
    await client.bootstrapSnapshot();
    await client.subscribe({});

    const res = await client.fetch("/api/conversations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "planning", command: "this will fail to spawn" }),
    });
    // Planning conversation creation returns immediately; spawn failures
    // surface asynchronously through the named event stream.
    expect(res.status).toBe(200);

    const surfaced = await client.waitFor("error.surfaced", {
      predicate: (frame) => (frame.payload as { code?: string } | null)?.code === "worker.spawn.failed",
      timeoutMs: 10_000,
    });
    const runId = (surfaced.payload as { runId?: string }).runId;
    const workerId = (surfaced.payload as { workerId?: string }).workerId;
    expect(runId).toBeTruthy();
    expect(workerId).toBeTruthy();

    const run = await db.select().from(runs).where(eq(runs.id, runId!)).get();
    const worker = await db.select().from(workers).where(eq(workers.id, workerId!)).get();

    expect(surfaced.payload).toMatchObject({
      code: "worker.spawn.failed",
      surface: "toast",
      cause: expect.objectContaining({ message: "bridge unreachable" }),
    });
    expect(run).toEqual(expect.objectContaining({
      status: "failed",
      lastError: "bridge unreachable",
    }));
    expect(worker).toEqual(expect.objectContaining({
      status: "error",
      outputLog: "bridge unreachable",
    }));
  });
});
