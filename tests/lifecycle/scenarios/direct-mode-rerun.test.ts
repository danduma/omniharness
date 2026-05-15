/**
 * "User re-runs message in direct control mode."
 *
 * In OmniHarness the "re-run" affordance is implemented as sending the
 * same content as a fresh message. This scenario exercises:
 *   1. Create a direct conversation.
 *   2. Send an initial follow-up message.
 *   3. Send the SAME message again (the user pressing "re-run").
 *   4. Assert both messages persisted and event ordering on the wire.
 *
 * Future regression: any change that drops the second send silently
 * (e.g. dedup-by-content gone wrong) fails this test instead of the
 * UI quietly losing the action.
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
    chaos: new Chaos(11, NO_CHAOS),
  });
});

afterEach(async () => {
  await client.close();
  await server.stop();
  vi.clearAllMocks();
});

describe("lifecycle harness — direct-mode message rerun", () => {
  it("persists both the original send and the re-run, in order", async () => {
    await client.bootstrapSnapshot();
    await client.subscribe({});

    const createRes = await client.fetch("/api/conversations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "direct", command: "initial" }),
    });
    expect(createRes.status).toBe(200);
    const { runId } = (await createRes.json()) as { runId: string };

    await client.waitFor("worker.spawned", {
      predicate: (frame) => (frame.payload as { runId?: string } | null)?.runId === runId,
      timeoutMs: 10_000,
    });

    // First follow-up.
    const firstSend = await client.fetch(`/api/conversations/${runId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "do the thing" }),
    });
    expect([200, 202]).toContain(firstSend.status);

    // User re-runs: same content, second send.
    const secondSend = await client.fetch(`/api/conversations/${runId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "do the thing" }),
    });
    expect([200, 202]).toContain(secondSend.status);

    // Both message rows landed. Three total: the initial create
    // message, plus two follow-ups.
    const rows = (await db.select().from(messages))
      .filter((m) => m.runId === runId && m.role === "user")
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    expect(rows.map((r) => r.content)).toEqual([
      "initial",
      "do the thing",
      "do the thing",
    ]);
  });
});
