/**
 * The "reconnect forever against a revoked token" failure mode.
 *
 * A Claude subscription whose OAuth token had been revoked answered every
 * prompt with "401 OAuth access token has been revoked". The server already
 * probed the credential and learned it was dead, then threw that verdict away:
 * `runs.last_error` kept only the raw provider text, so the UI fell back to
 * generic copy and told the user to "send a message to reconnect" — advice
 * that respawns a worker against the same dead token, forever.
 *
 * Now a dead verdict is stamped into the failure with the account it belongs
 * to and surfaced as `account.login_required`, and the transcript row stays
 * free of the internal marker.
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

import { eventsRouteModule as eventsRoute } from "@/../tests/helpers/runtime-routes";
import { conversationsRouteModule as conversationsRoute } from "@/../tests/helpers/runtime-routes";
import { conversationMessagesRouteModule as messagesRoute } from "@/../tests/helpers/runtime-routes";

import { startLifecycleHarness, type LifecycleServer } from "../harness/server";
import { LifecycleClient } from "../harness/client";
import { Chaos, NO_CHAOS } from "../harness/chaos";
import { __resetNamedEventsForTests } from "@/server/events/named-events";
import { askAgent } from "@/server/bridge-client";

const { AGENT_SNAPSHOT } = vi.hoisted(() => ({
  AGENT_SNAPSHOT: {
    name: "test-agent",
    type: "claude",
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
  },
}));

const REVOKED = "Ask failed: Internal error: Failed to authenticate. API Error: 401 OAuth access token has been revoked.";

vi.mock("@/server/bridge-client", () => ({
  spawnAgent: vi.fn().mockResolvedValue(AGENT_SNAPSHOT),
  askAgent: vi.fn().mockResolvedValue({ response: "ok", state: "idle" }),
  getAgent: vi.fn().mockResolvedValue(AGENT_SNAPSHOT),
  cancelAgent: vi.fn().mockResolvedValue(undefined),
  cancelAgentTerminalProcess: vi.fn().mockResolvedValue(undefined),
  respondElicitation: vi.fn().mockResolvedValue(undefined),
  updateRuntimeSettings: vi.fn().mockResolvedValue(undefined),
  BRIDGE_URL: "http://localhost:0",
}));

// The real probe shells out to `claude -p ok`; here it stands in for the
// provider rejecting the credential a second time.
vi.mock("@/server/accounts/credential-verification", () => ({
  supportsCredentialLivenessProbe: vi.fn(() => true),
  verifyAccountCredentialLiveness: vi.fn().mockResolvedValue({
    liveness: "dead",
    detail: "Probe request was rejected: 401 OAuth access token has been revoked.",
  }),
}));

vi.mock("@/server/git/auto-commit", () => ({
  autoCommitMilestone: vi.fn(() => ({ status: "skipped", reason: "disabled" })),
  captureGitBaseline: vi.fn(() => null),
  parseGitBaselineJson: vi.fn(() => null),
}));
vi.mock("@/server/supervisor/start", () => ({ startSupervisorRun: vi.fn() }));
vi.mock("@/server/workers/snapshots", () => ({ persistWorkerSnapshot: vi.fn().mockResolvedValue(undefined) }));

async function waitForErrorMessages(runId: string, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const rows = (await db.select().from(messages))
      .filter((row) => row.runId === runId && row.kind === "error");
    if (rows.length > 0 || Date.now() > deadline) {
      return rows;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

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

describe("lifecycle harness — revoked provider credential", () => {
  it("surfaces account.login_required and marks the failure as verified dead", async () => {
    await client.bootstrapSnapshot();
    await client.subscribe({});

    const createRes = await client.fetch("/api/conversations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "direct", command: "hello", workerType: "claude" }),
    });
    expect(createRes.status).toBe(200);
    const { runId } = (await createRes.json()) as { runId: string };

    await client.waitFor("worker.spawned", {
      predicate: (frame) => (frame.payload as { runId?: string } | null)?.runId === runId,
      timeoutMs: 10_000,
    });

    // The worker's account is what the notice names, so pin one.
    await db.update(runs).set({ preferredWorkerAccountId: "claude-sub-1" }).where(eq(runs.id, runId));

    vi.mocked(askAgent).mockRejectedValue(new Error(REVOKED));
    const followUpRes = await client.fetch(`/api/conversations/${runId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "are you there?" }),
    });
    expect([200, 202]).toContain(followUpRes.status);

    // The turn retries auth-shaped failures twice with backoff before giving
    // up, so this wait covers ~8s of real sleeping.
    const surfaced = await client.waitFor("error.surfaced", {
      predicate: (frame) => (frame.payload as { code?: string } | null)?.code === "account.login_required",
      timeoutMs: 18_000,
    });
    expect((surfaced.payload as { runId?: string }).runId).toBe(runId);

    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    expect(run?.status).toBe("failed");
    expect(run?.lastError).toContain("401 OAuth access token has been revoked");
    expect(run?.lastError).toContain("[credential_verified_dead:claude-sub-1]");

    // The transcript is read by a human; the marker is not for them.
    // `error.surfaced` is emitted before the row is inserted, so poll for it
    // rather than racing the same tick.
    const errorRows = await waitForErrorMessages(runId);
    expect(errorRows.length).toBeGreaterThan(0);
    for (const row of errorRows) {
      expect(row.content).toContain("401 OAuth access token has been revoked");
      expect(row.content).not.toContain("credential_verified");
    }
  });
});
