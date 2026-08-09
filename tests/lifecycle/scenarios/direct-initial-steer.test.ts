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

const { mockAskAgent, mockCancelAgent, mockGetAgent, mockSpawnAgent } = vi.hoisted(() => ({
  mockAskAgent: vi.fn(),
  mockCancelAgent: vi.fn(),
  mockGetAgent: vi.fn(),
  mockSpawnAgent: vi.fn(),
}));

vi.mock("@/server/bridge-client", () => ({
  askAgent: mockAskAgent,
  cancelAgent: mockCancelAgent,
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

  it("replaces a Claude session when steer exposes an incomplete ACP diagnostic", async () => {
    mockAskAgent.mockReset();
    mockAskAgent
      .mockImplementationOnce(() => {
        const signal = currentWorkerTurnSignal();
        return new Promise((_resolve, reject) => {
          signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
        });
      })
      .mockRejectedValueOnce(new Error("Ask failed: Internal error: [ede_diagnostic] result_type=user last_content_type=n/a stop_reason=null"))
      .mockResolvedValueOnce({ response: "The steer was applied.", state: "idle" });
    mockSpawnAgent.mockImplementation(async ({ name, resumeSessionId }: { name: string; resumeSessionId?: string }) => (
      agent(name, "working", resumeSessionId ? "resumed-session" : "fresh-session")
    ));

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

    await waitUntil(async () => {
      const queued = await db
        .select()
        .from(queuedConversationMessages)
        .where(eq(queuedConversationMessages.runId, runId));
      return queued.length === 1 && queued[0]?.status === "delivered";
    });

    const [run, events, errorMessages] = await Promise.all([
      db.select().from(runs).where(eq(runs.id, runId)).get(),
      db.select().from(executionEvents).where(eq(executionEvents.runId, runId)),
      db.select().from(messages).where(eq(messages.runId, runId)),
    ]);
    expect(run?.status).not.toBe("failed");
    expect(run?.lastError).toBeNull();
    expect(mockCancelAgent).toHaveBeenCalledWith(`${runId}-worker-1`);
    expect(mockSpawnAgent.mock.calls.some(([params]) => !params.resumeSessionId)).toBe(true);
    expect(events.some((event) => event.eventType === "worker_session_recreated_from_transcript")).toBe(true);
    expect(events.some((event) => event.eventType === "run_failed")).toBe(false);
    expect(errorMessages.some((message) => message.kind === "error")).toBe(false);
  });

  it("replaces a Claude session when a direct follow-up exposes an incomplete ACP diagnostic", async () => {
    mockAskAgent.mockReset();
    mockAskAgent
      .mockResolvedValueOnce({ response: "The first turn finished.", state: "idle" })
      .mockRejectedValueOnce(new Error("Ask failed: Internal error: [ede_diagnostic] result_type=user last_content_type=n/a stop_reason=null"))
      .mockResolvedValueOnce({ response: "The follow-up was applied.", state: "idle" });
    mockSpawnAgent.mockImplementation(async ({ name, resumeSessionId }: { name: string; resumeSessionId?: string }) => (
      agent(name, "working", resumeSessionId ? "resumed-session" : "fresh-session")
    ));

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

    const followUpResponse = await client.fetch(`/api/conversations/${runId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "continue" }),
    });
    expect(followUpResponse.status).toBe(200);

    await waitUntil(() => mockAskAgent.mock.calls.length === 3);
    await waitUntil(async () => {
      const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
      return run?.status !== "running";
    });

    const [run, events] = await Promise.all([
      db.select().from(runs).where(eq(runs.id, runId)).get(),
      db.select().from(executionEvents).where(eq(executionEvents.runId, runId)),
    ]);
    expect(run?.status).not.toBe("failed");
    expect(run?.lastError).toBeNull();
    expect(mockCancelAgent).toHaveBeenCalledWith(`${runId}-worker-1`);
    expect(events.some((event) => event.eventType === "worker_session_recreated_from_transcript")).toBe(true);
    expect(events.some((event) => event.eventType === "run_failed")).toBe(false);
  });
});
