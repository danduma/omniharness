/**
 * Seeded HTTP-flake chaos: a configurable percentage of POST/GET calls
 * return a transient 503 instead of reaching the server.
 *
 * Asserts:
 *   - The harness's flake injection is deterministic given the seed.
 *   - The server's state stays consistent when a follow-up message
 *     POST is flaked — the conversation row from the initial create
 *     is intact, and a retry of the POST succeeds and lands in the DB.
 *
 * This is the contract a real client must honor: flake-aware code
 * retries until a non-flake response, and the server tolerates
 * silently-dropped client requests without corrupt half-state.
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
import { Chaos } from "../harness/chaos";
import { __resetNamedEventsForTests } from "@/server/events/named-events";

vi.mock("@/server/bridge-client", () => ({
  spawnAgent: vi.fn().mockResolvedValue({
    name: "test-agent", type: "codex", state: "idle",
    currentText: "", lastText: "", sessionId: "test-session", sessionMode: null,
    pendingPermissions: [], outputEntries: [], stderrBuffer: [], stopReason: null, cwd: "/tmp",
  }),
  askAgent: vi.fn().mockResolvedValue({ response: "ok", state: "idle" }),
  getAgent: vi.fn().mockResolvedValue({
    name: "test-agent", type: "codex", state: "idle",
    currentText: "", lastText: "", sessionId: "test-session", sessionMode: null,
    pendingPermissions: [], outputEntries: [], stderrBuffer: [], stopReason: null, cwd: "/tmp",
  }),
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
      { pattern: "/api/conversations/:id/messages", module: messagesRoute },
    ],
  });
});

afterEach(async () => {
  await client.close();
  await server.stop();
  vi.clearAllMocks();
});

describe("lifecycle harness — flaky network", () => {
  it("survives a flaked follow-up message via retry; server state remains consistent", async () => {
    // Phase 1: low-flake client for the create call so the conversation
    // exists deterministically.
    client = new LifecycleClient({
      baseUrl: server.baseUrl,
      chaos: new Chaos(13, { dropSseRate: 0, flakeFetchRate: 0, flakeStatuses: [] }),
    });
    await client.bootstrapSnapshot();
    await client.subscribe({});

    const createRes = await client.fetch("/api/conversations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "direct", command: "set up" }),
    });
    expect(createRes.status).toBe(200);
    const { runId } = (await createRes.json()) as { runId: string };

    // Phase 2: switch to a flaky client. Seeded to deterministically
    // flake the first POST and let the second through.
    const flakyClient = new LifecycleClient({
      baseUrl: server.baseUrl,
      chaos: new Chaos(13, { dropSseRate: 0, flakeFetchRate: 1, flakeStatuses: [503] }),
    });

    const flaked = await flakyClient.fetch(`/api/conversations/${runId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "first attempt" }),
    });
    expect(flaked.status).toBe(503);
    // The server never saw this request — message rows count is unchanged.
    const rowsAfterFlake = (await db.select().from(messages))
      .filter((m) => m.runId === runId && m.role === "user");
    expect(rowsAfterFlake.map((r) => r.content)).toEqual(["set up"]);

    // Retry via the non-flaky client to model "user retries".
    const retry = await client.fetch(`/api/conversations/${runId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "first attempt" }),
    });
    expect([200, 202]).toContain(retry.status);

    const rowsAfterRetry = (await db.select().from(messages))
      .filter((m) => m.runId === runId && m.role === "user")
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    expect(rowsAfterRetry.map((r) => r.content)).toEqual(["set up", "first attempt"]);
  });

  it("is deterministic across seeded reruns", async () => {
    client = new LifecycleClient({
      baseUrl: server.baseUrl,
      chaos: new Chaos(99, { dropSseRate: 0, flakeFetchRate: 0.5, flakeStatuses: [503, 504] }),
    });
    const flakeStatuses: number[] = [];
    for (let i = 0; i < 10; i++) {
      const res = await client.fetch("/api/events?snapshot=1&persisted=1");
      flakeStatuses.push(res.status);
    }
    // Same seed → same pattern.
    const client2 = new LifecycleClient({
      baseUrl: server.baseUrl,
      chaos: new Chaos(99, { dropSseRate: 0, flakeFetchRate: 0.5, flakeStatuses: [503, 504] }),
    });
    const flakeStatuses2: number[] = [];
    for (let i = 0; i < 10; i++) {
      const res = await client2.fetch("/api/events?snapshot=1&persisted=1");
      flakeStatuses2.push(res.status);
    }
    expect(flakeStatuses).toEqual(flakeStatuses2);
    expect(flakeStatuses).toContain(200); // some let through
    expect(flakeStatuses.some((s) => s === 503 || s === 504)).toBe(true); // some flaked
  });
});
