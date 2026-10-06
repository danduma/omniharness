/**
 * Reported regression from sessions fc8d9cb681ef and b5ae9da0acae:
 * a locally aborted request leaves the provider prompt running. A failed
 * cancellation must replace that provider before sending the next prompt.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
  executionEvents,
  messages,
  plans,
  queuedConversationMessages,
  runs,
  workerCounters,
  workers,
} from "@/server/db/schema";
import {
  conversationMessagesRouteModule,
  conversationsRouteModule,
  eventsRouteModule,
  queuedMessageInterruptNextRoute,
} from "@/../tests/helpers/runtime-routes";
import { deleteConversationForApi } from "@/runtime/http/routes/runs";
import { currentWorkerTurnSignal } from "@/server/conversations/worker-turn-gate";
import { __resetNamedEventsForTests } from "@/server/events/named-events";
import { startLifecycleHarness, type LifecycleServer } from "../harness/server";
import { LifecycleClient } from "../harness/client";
import { Chaos, NO_CHAOS } from "../harness/chaos";

const { mockAskAgent, mockCancelAgent, mockCancelTurn, mockGetAgent, mockSpawnAgent } = vi.hoisted(() => ({
  mockAskAgent: vi.fn(),
  mockCancelAgent: vi.fn(),
  mockCancelTurn: vi.fn(),
  mockGetAgent: vi.fn(),
  mockSpawnAgent: vi.fn(),
}));

vi.mock("@/server/bridge-client", () => ({
  askAgent: mockAskAgent,
  cancelAgent: mockCancelAgent,
  cancelAgentTurn: mockCancelTurn,
  getAgent: mockGetAgent,
  spawnAgent: mockSpawnAgent,
  BRIDGE_URL: "http://localhost:0",
}));

vi.mock("@/server/git/auto-commit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/git/auto-commit")>();
  return {
    ...actual,
    autoCommitMilestone: vi.fn(() => ({ status: "skipped", reason: "disabled" })),
    captureGitBaseline: vi.fn(() => null),
  };
});

let server: LifecycleServer;
let client: LifecycleClient;
const createdRunIds: string[] = [];

function agent(workerId: string, state: string, sessionId = "initial-steer-session") {
  return {
    name: workerId,
    type: "claude",
    state,
    currentText: "",
    lastText: "",
    sessionId,
    sessionMode: "full-access",
    pendingPermissions: [],
    pendingElicitations: [],
    outputEntries: [],
    renderedOutput: null,
    stderrBuffer: [],
    stopReason: null,
    cwd: process.cwd(),
  };
}

async function waitUntil(predicate: () => boolean | Promise<boolean>, timeoutMs = 2_000) {
  const deadline = Date.now() + timeoutMs;
  while (!(await predicate())) {
    if (Date.now() >= deadline) {
      throw new Error("Timed out waiting for lifecycle state");
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

beforeEach(async () => {
  __resetNamedEventsForTests();
  mockAskAgent.mockReset();
  mockCancelAgent.mockReset();
  mockCancelTurn.mockReset();
  mockCancelTurn.mockResolvedValue({ ok: true });
  mockGetAgent.mockReset();
  mockSpawnAgent.mockReset();
  await db.delete(executionEvents);
  await db.delete(queuedConversationMessages);
  await db.delete(messages);
  await db.delete(workers);
  await db.delete(workerCounters);
  await db.delete(runs);
  await db.delete(plans);

  mockSpawnAgent.mockImplementation(async ({ name }: { name: string }) => agent(name, "working"));
  mockCancelAgent.mockResolvedValue(undefined);
  mockGetAgent.mockImplementation(async (workerId: string) => agent(workerId, "idle"));
  mockAskAgent
    .mockImplementationOnce(() => {
      const signal = currentWorkerTurnSignal();
      return new Promise((_resolve, reject) => {
        signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
    })
    .mockResolvedValueOnce({ response: "Applying the fix now.", state: "idle" });

  server = await startLifecycleHarness({
    routes: [
      { pattern: "/api/events", module: eventsRouteModule },
      { pattern: "/api/conversations", module: conversationsRouteModule },
      { pattern: "/api/conversations/:id/messages", module: conversationMessagesRouteModule },
      {
        pattern: "/api/conversations/:id/queued-messages/interrupt-next",
        module: { POST: queuedMessageInterruptNextRoute },
      },
    ],
  });
  client = new LifecycleClient({
    baseUrl: server.baseUrl,
    chaos: new Chaos(81, NO_CHAOS),
  });
});

afterEach(async () => {
  await client.close();
  for (const runId of createdRunIds.splice(0)) {
    const deleted = await deleteConversationForApi(runId);
    expect(deleted.ok).toBe(true);
  }
  await server.stop();
  vi.clearAllMocks();
});

describe("lifecycle harness — stuck provider cancellation", () => {
  it("recreates the stuck provider before delivering a replacement", async () => {
    mockCancelTurn.mockRejectedValueOnce(new Error("Agent cancellation did not settle"));
    await client.bootstrapSnapshot();
    await client.subscribe({});
    const created = await client.fetch("/api/conversations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "direct", command: "Start work", preferredWorkerType: "claude", allowedWorkerTypes: ["claude"] }),
    });
    expect(created.status).toBe(200);
    const { runId } = await created.json() as { runId: string };
    createdRunIds.push(runId);
    await waitUntil(() => mockAskAgent.mock.calls.length === 1);
    const response = await client.fetch(`/api/conversations/${runId}/queued-messages/interrupt-next`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "Please respond to this message" }),
    });
    expect(response.status).toBe(200);
    await waitUntil(async () => {
      const rows = await db.select().from(queuedConversationMessages).where(eq(queuedConversationMessages.runId, runId));
      return rows.length === 1 && rows[0]?.status === "delivered";
    });
    expect(mockSpawnAgent).toHaveBeenCalledTimes(2);
    expect(mockCancelAgent).toHaveBeenCalledWith(`${runId}-worker-1`);
    expect(mockAskAgent.mock.calls[1]?.[1]).toContain("Please respond to this message");
    const events = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId));
    expect(events.some((event) => event.eventType === "worker_session_recreated_from_transcript")).toBe(true);
    expect(events.some((event) => event.eventType === "run_failed")).toBe(false);
  });
});
