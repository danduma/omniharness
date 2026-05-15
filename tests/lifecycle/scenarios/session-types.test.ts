/**
 * End-to-end scenarios for the three session types the user explicitly
 * called out: direct, planning, implementation.
 *
 * Each scenario POSTs to /api/conversations, asserts the run/plan is
 * created with the right shape, and observes `worker.spawned` (and any
 * downstream lifecycle events) on the SSE stream.
 *
 * The bridge-client and supervisor are mocked: the goal here is the
 * control-plane wiring + named-event emissions, not the actual agent
 * runtime. The day we want real agent runtime coverage, swap the
 * mocks for a fake bridge subprocess.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  spawnAgent: vi.fn().mockResolvedValue({
    name: "test-agent",
    type: "codex",
    state: "idle",
    currentText: "",
    lastText: "",
    sessionId: "test-session",
    sessionMode: null,
    pendingPermissions: [],
    outputEntries: [],
    stderrBuffer: [],
    stopReason: null,
    cwd: "/tmp",
  }),
  askAgent: vi.fn().mockResolvedValue({
    response: "ok",
    state: "idle",
  }),
  getAgent: vi.fn().mockResolvedValue({
    name: "test-agent",
    type: "codex",
    state: "idle",
    currentText: "",
    lastText: "",
    sessionId: "test-session",
    sessionMode: null,
    pendingPermissions: [],
    outputEntries: [],
    stderrBuffer: [],
    stopReason: null,
    cwd: "/tmp",
  }),
  cancelAgent: vi.fn().mockResolvedValue(undefined),
  cancelAgentTerminalProcess: vi.fn().mockResolvedValue(undefined),
  BRIDGE_URL: "http://localhost:0",
}));

vi.mock("@/server/git/workspaces", async () => {
  const actual = await vi.importActual<typeof import("@/server/git/workspaces")>(
    "@/server/git/workspaces",
  );
  return { ...actual, createBranchWorktree: vi.fn() };
});

vi.mock("@/server/git/auto-commit", () => ({
  captureGitBaseline: vi.fn(() => null),
}));

vi.mock("@/server/supervisor/start", () => ({
  startSupervisorRun: vi.fn(),
}));

vi.mock("@/server/workers/snapshots", () => ({
  persistWorkerSnapshot: vi.fn().mockResolvedValue(undefined),
}));

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
    chaos: new Chaos(7, NO_CHAOS),
  });
});

afterEach(async () => {
  await client.close();
  await server.stop();
  vi.clearAllMocks();
});

async function createConversation(mode: "direct" | "planning" | "implementation", command: string) {
  const res = await client.fetch("/api/conversations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode, command }),
  });
  expect(res.status).toBe(200);
  return (await res.json()) as { ok: true; runId: string; planId: string; messageId: string };
}

describe("lifecycle harness — session types", () => {
  it("direct: creates a run+worker, emits worker.spawned", async () => {
    // No specific runId yet; subscribe unscoped so we catch the create.
    await client.bootstrapSnapshot();
    await client.subscribe({});

    const { runId } = await createConversation("direct", "hello world");

    const spawned = await client.waitFor("worker.spawned", {
      predicate: (frame) => (frame.payload as { runId?: string } | null)?.runId === runId,
      timeoutMs: 10_000,
    });
    expect(spawned.payload).toMatchObject({
      kind: "worker.spawned",
      runId,
      workerType: expect.any(String),
    });

    // Persistence check: the run row exists in "direct" mode and a
    // worker row was created in "starting".
    const runRow = (await db.select().from(runs)).find((r) => r.id === runId);
    expect(runRow?.mode).toBe("direct");
    const workerRows = (await db.select().from(workers)).filter((w) => w.runId === runId);
    expect(workerRows).toHaveLength(1);
    // Status may have advanced past "starting" by the time we read it
    // (direct mode kicks off askAgent asynchronously). The important
    // thing is the row exists and `worker.spawned` was emitted above.
  });

  it("planning: creates a run in planning mode and emits worker.spawned for the planner", async () => {
    await client.bootstrapSnapshot();
    await client.subscribe({});

    const { runId } = await createConversation("planning", "draft a plan for X");

    const spawned = await client.waitFor("worker.spawned", {
      predicate: (frame) => (frame.payload as { runId?: string } | null)?.runId === runId,
      timeoutMs: 10_000,
    });
    expect(spawned.payload).toMatchObject({
      kind: "worker.spawned",
      runId,
    });

    const runRow = (await db.select().from(runs)).find((r) => r.id === runId);
    expect(runRow?.mode).toBe("planning");
  });

  it("implementation: creates a run and hands off to the supervisor (no immediate worker.spawned)", async () => {
    await client.bootstrapSnapshot();
    await client.subscribe({});

    const { runId } = await createConversation("implementation", "implement Y");

    // We deliberately do NOT assert worker.spawned here — implementation
    // mode delegates to startSupervisorRun (mocked), which is what
    // would actually create workers later. The visible synchronous
    // assertion is the run row landing in "running".
    const runRow = (await db.select().from(runs)).find((r) => r.id === runId);
    expect(runRow?.mode).toBe("implementation");
    expect(runRow?.status).toBe("running");

    const { startSupervisorRun } = await import("@/server/supervisor/start");
    expect(startSupervisorRun).toHaveBeenCalledWith(runId);
  });
});
