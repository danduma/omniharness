/**
 * Multi-step user journey:
 *   1. Create a direct conversation.
 *   2. Observe worker.spawned.
 *   3. Send a follow-up message via POST /api/conversations/:id/messages.
 *   4. Drop the SSE stream (chaos), reconnect with Last-Event-ID.
 *   5. Continue: verify the message landed in the DB AND assert no
 *      lifecycle events were missed across the disconnect.
 *
 * Mirrors the central scenario from the original bug report: a user
 * conversation that survives a connection drop without silently losing
 * server-side activity.
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
import * as messagesRoute from "@/app/api/conversations/[id]/messages/route";

import { startLifecycleHarness, type LifecycleServer } from "../harness/server";
import { LifecycleClient } from "../harness/client";
import { Chaos, NO_CHAOS } from "../harness/chaos";
import { __resetNamedEventsForTests, emitNamedEvent } from "@/server/events/named-events";

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
  askAgent: vi.fn().mockResolvedValue({ response: "ok", state: "idle" }),
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
      { pattern: "/api/conversations/:id/messages", module: messagesRoute },
    ],
  });
  client = new LifecycleClient({
    baseUrl: server.baseUrl,
    chaos: new Chaos(8, NO_CHAOS),
  });
});

afterEach(async () => {
  await client.close();
  await server.stop();
  vi.clearAllMocks();
});

describe("lifecycle harness — conversation continuation across disconnect", () => {
  it("survives a mid-conversation SSE drop with no events lost", async () => {
    // 1. Create.
    await client.bootstrapSnapshot();
    await client.subscribe({});
    const createRes = await client.fetch("/api/conversations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "direct", command: "hello" }),
    });
    expect(createRes.status).toBe(200);
    const { runId } = (await createRes.json()) as { runId: string };

    // 2. Observe initial worker.spawned.
    await client.waitFor("worker.spawned", {
      predicate: (frame) => (frame.payload as { runId?: string } | null)?.runId === runId,
      timeoutMs: 10_000,
    });

    // 3. Emit a deterministic mid-flight server-side event so we have a
    //    second observable checkpoint *before* dropping. (In production
    //    this would be a real worker.status; we use emitNamedEvent here
    //    to keep the test independent of the bridge-mock state machine.)
    emitNamedEvent({
      kind: "worker.status",
      runId,
      workerId: "fake-mid",
      prev: "starting",
      next: "running",
    });
    await client.waitFor("worker.status", {
      predicate: (frame) => (frame.payload as { next?: string } | null)?.next === "running",
      timeoutMs: 10_000,
    });
    const resumeId = client.resumeIdNow();
    expect(resumeId).toBeTruthy();

    // 4. Drop the connection.
    client.dropSse();

    // 5. Server-side activity during the gap.
    emitNamedEvent({
      kind: "worker.status",
      runId,
      workerId: "fake-mid",
      prev: "running",
      next: "idle",
    });
    const followUpRes = await client.fetch(`/api/conversations/${runId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "follow-up message" }),
    });
    expect([200, 202]).toContain(followUpRes.status);

    // 6. Reconnect from the recorded resume id; the gap must be filled.
    await client.subscribe({ resumeFrom: resumeId });
    await client.waitFor("worker.status", {
      predicate: (frame) => (frame.payload as { next?: string } | null)?.next === "idle",
      timeoutMs: 10_000,
    });

    // 7. Persistence: the follow-up message landed.
    const messageRows = (await db.select().from(messages)).filter((m) => m.runId === runId);
    expect(messageRows.length).toBeGreaterThanOrEqual(2);
    const userMessages = messageRows.filter((m) => m.role === "user");
    expect(userMessages.map((m) => m.content)).toEqual(
      expect.arrayContaining(["hello", "follow-up message"]),
    );

    // 8. No events lost across the disconnect.
    const statusFrames = client.events
      .filterByEvent("worker.status")
      .map((f) => (f.payload as { next?: string } | null)?.next);
    expect(statusFrames).toEqual(["running", "idle"]);
  });
});
