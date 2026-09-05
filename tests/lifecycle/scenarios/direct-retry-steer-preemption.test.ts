/**
 * Reported regression from sessions ffdac7e6cc0a / 3a001eb5ba98:
 * a retry held the conversation mutation for its entire provider turn, so a
 * later "steer" request queued behind that turn until the proxy returned 524.
 * An interrupt must preempt the recovery turn before waiting on the mutex.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
  executionEvents,
  messages,
  plans,
  queuedConversationMessages,
  recoveryIncidents,
  runs,
  workerCounters,
  workers,
} from "@/server/db/schema";
import {
  conversationMessagesRouteModule,
  conversationsRouteModule,
  eventsRouteModule,
  runRouteModule,
} from "@/../tests/helpers/runtime-routes";
import { currentWorkerTurnSignal } from "@/server/conversations/worker-turn-gate";
import { __resetNamedEventsForTests } from "@/server/events/named-events";
import { startLifecycleHarness, type LifecycleServer } from "../harness/server";
import { LifecycleClient } from "../harness/client";
import { Chaos, NO_CHAOS } from "../harness/chaos";

const { mockAskAgent, mockCancelAgent, mockCancelAgentTurn, mockGetAgent, mockSpawnAgent } = vi.hoisted(() => ({
  mockAskAgent: vi.fn(),
  mockCancelAgent: vi.fn(),
  mockCancelAgentTurn: vi.fn(),
  mockGetAgent: vi.fn(),
  mockSpawnAgent: vi.fn(),
}));

function agent(workerId: string, state = "idle") {
  return {
    name: workerId,
    type: "claude",
    state,
    currentText: "",
    lastText: "",
    sessionId: "retry-steer-session",
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

vi.mock("@/server/bridge-client", () => ({
  askAgent: mockAskAgent,
  cancelAgent: mockCancelAgent,
  cancelAgentTurn: mockCancelAgentTurn,
  cancelAgentTerminalProcess: vi.fn().mockResolvedValue(undefined),
  getAgent: mockGetAgent,
  spawnAgent: mockSpawnAgent,
  BRIDGE_URL: "http://localhost:0",
}));

vi.mock("@/server/git/auto-commit", () => ({
  captureGitBaseline: vi.fn(() => null),
}));

let server: LifecycleServer;
let client: LifecycleClient;

async function waitUntil(predicate: () => boolean | Promise<boolean>, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (!(await predicate())) {
    if (Date.now() >= deadline) throw new Error("Timed out waiting for lifecycle state");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

beforeEach(async () => {
  __resetNamedEventsForTests();
  mockAskAgent.mockReset();
  mockCancelAgent.mockReset();
  mockCancelAgentTurn.mockReset();
  mockGetAgent.mockReset();
  mockSpawnAgent.mockReset();
  await db.delete(executionEvents);
  await db.delete(queuedConversationMessages);
  await db.delete(recoveryIncidents);
  await db.delete(messages);
  await db.delete(workers);
  await db.delete(workerCounters);
  await db.delete(runs);
  await db.delete(plans);

  mockSpawnAgent.mockImplementation(async ({ name }: { name: string }) => agent(name));
  mockGetAgent.mockImplementation(async (workerId: string) => agent(workerId));
  mockCancelAgent.mockResolvedValue(undefined);
  mockCancelAgentTurn.mockResolvedValue({ ok: true, cancelledPermissions: 0 });
  mockAskAgent
    .mockResolvedValueOnce({ response: "Initial turn completed.", state: "idle" })
    .mockImplementationOnce(() => {
      const signal = currentWorkerTurnSignal();
      return new Promise((_resolve, reject) => {
        if (!signal) {
          reject(new Error("Recovery ask did not receive its worker-turn abort signal."));
          return;
        }
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
    })
    .mockResolvedValueOnce({ response: "Replacement steer completed.", state: "idle" });

  server = await startLifecycleHarness({
    routes: [
      { pattern: "/api/events", module: eventsRouteModule },
      { pattern: "/api/conversations", module: conversationsRouteModule },
      { pattern: "/api/conversations/:id/messages", module: conversationMessagesRouteModule },
      { pattern: "/api/runs/:id", module: runRouteModule },
    ],
  });
  client = new LifecycleClient({
    baseUrl: server.baseUrl,
    chaos: new Chaos(524, NO_CHAOS),
  });
});

afterEach(async () => {
  await client.close();
  await server.stop();
  vi.clearAllMocks();
});

describe("lifecycle harness — steer preempts a mutex-holding retry", () => {
  it("returns the steer promptly and delivers it after aborting the recovery turn", async () => {
    await client.bootstrapSnapshot();
    await client.subscribe({});

    const createResponse = await client.fetch("/api/conversations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: "direct",
        command: "Start the task.",
        preferredWorkerType: "claude",
        allowedWorkerTypes: ["claude"],
      }),
    });
    expect(createResponse.status).toBe(200);
    const { runId } = await createResponse.json() as { runId: string };
    await waitUntil(() => mockAskAgent.mock.calls.length === 1);
    const originalMessage = await db.select().from(messages)
      .where(eq(messages.runId, runId))
      .get();
    expect(originalMessage?.role).toBe("user");

    const retryRequest = client.fetch(`/api/runs/${runId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "retry", targetMessageId: originalMessage!.id }),
    });
    await waitUntil(() => mockAskAgent.mock.calls.length === 2);

    const steerStartedAt = Date.now();
    const steerResponse = await client.fetch(`/api/conversations/${runId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        content: "Interrupt the retry and do this instead.",
        busyAction: "steer",
      }),
    });
    const steerDurationMs = Date.now() - steerStartedAt;

    expect(steerResponse.status).toBe(200);
    expect(steerDurationMs).toBeLessThan(1_000);
    expect((await retryRequest).status).toBe(200);
    await waitUntil(() => mockAskAgent.mock.calls.length === 3);
    expect(String(mockAskAgent.mock.calls[2]?.[1] ?? "")).toContain("Interrupt the retry and do this instead.");

    const [run, events, persistedMessages] = await Promise.all([
      db.select().from(runs).where(eq(runs.id, runId)).get(),
      db.select().from(executionEvents).where(eq(executionEvents.runId, runId)),
      db.select().from(messages).where(eq(messages.runId, runId)),
    ]);
    expect(run?.status).not.toBe("failed");
    expect(run?.lastError).toBeNull();
    expect(persistedMessages.some((message) => message.content === "Interrupt the retry and do this instead.")).toBe(true);
    expect(events.some((event) => event.eventType === "run_failed")).toBe(false);
  }, 10_000);
});
