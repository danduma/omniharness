/**
 * Reported regression from session 8d81f64ca066:
 * steering an initial direct turn intentionally aborts that turn, but the
 * abort must not be persisted as a run failure or strand the queue row.
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
import { currentWorkerTurnSignal } from "@/server/conversations/worker-turn-gate";
import { __resetNamedEventsForTests } from "@/server/events/named-events";
import { startLifecycleHarness, type LifecycleServer } from "../harness/server";
import { LifecycleClient } from "../harness/client";
import { Chaos, NO_CHAOS } from "../harness/chaos";

const { mockAskAgent, mockGetAgent, mockSpawnAgent } = vi.hoisted(() => ({
  mockAskAgent: vi.fn(),
  mockGetAgent: vi.fn(),
  mockSpawnAgent: vi.fn(),
}));

vi.mock("@/server/bridge-client", () => ({
  askAgent: mockAskAgent,
  cancelAgent: vi.fn().mockResolvedValue(undefined),
  cancelAgentTurn: vi.fn().mockResolvedValue({ ok: true, cancelledPermissions: 0 }),
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

function agent(workerId: string, state: string) {
  return {
    name: workerId,
    type: "claude",
    state,
    currentText: "",
    lastText: "",
    sessionId: "initial-steer-session",
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
  await server.stop();
  vi.clearAllMocks();
});

describe("lifecycle harness — steer during the initial direct turn", () => {
  it("delivers the replacement without emitting run_failed", async () => {
    await client.bootstrapSnapshot();
    await client.subscribe({});

    const createResponse = await client.fetch("/api/conversations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: "direct",
        command: "Find the bug, then ask before fixing.",
        preferredWorkerType: "claude",
        allowedWorkerTypes: ["claude"],
      }),
    });
    expect(createResponse.status).toBe(200);
    const { runId } = await createResponse.json() as { runId: string };
    await waitUntil(() => mockAskAgent.mock.calls.length === 1);

    const steerResponse = await client.fetch(
      `/api/conversations/${runId}/queued-messages/interrupt-next`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: "yes fix" }),
      },
    );
    expect(steerResponse.status).toBe(200);

    try {
      await waitUntil(async () => {
        const queued = await db
          .select()
          .from(queuedConversationMessages)
          .where(eq(queuedConversationMessages.runId, runId));
        return queued.length === 1 && queued[0]?.status === "delivered";
      });
    } catch (error) {
      const [queued, run, events] = await Promise.all([
        db.select().from(queuedConversationMessages).where(eq(queuedConversationMessages.runId, runId)),
        db.select().from(runs).where(eq(runs.id, runId)).get(),
        db.select().from(executionEvents).where(eq(executionEvents.runId, runId)),
      ]);
      throw new Error(
        `${error instanceof Error ? error.message : String(error)}: ${JSON.stringify({
          askCalls: mockAskAgent.mock.calls.length,
          queued: queued.map((record) => ({ status: record.status, lastError: record.lastError })),
          run: run ? { status: run.status, lastError: run.lastError } : null,
          eventTypes: events.map((event) => event.eventType),
        })}`,
      );
    }
    await waitUntil(async () => {
      const events = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId));
      return events.some((event) => event.eventType === "queued_message_interrupt_delivered");
    });

    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const events = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId));
    expect(run?.status).not.toBe("failed");
    expect(run?.lastError).toBeNull();
    expect(events.some((event) => event.eventType === "run_failed")).toBe(false);
    expect(events.some((event) => event.eventType === "queued_message_interrupt_delivered")).toBe(true);
  });
});
