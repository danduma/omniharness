/**
 * Reported regression from session 806276d790d6:
 * editing a delivered direct-control message replaced the provider session but
 * sent only the edited text, while the UI continued rendering the old worker
 * transcript. The replacement provider must receive the visible prefix before
 * the edited checkpoint and must not receive the abandoned branch.
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
import {
  conversationMessagesRouteModule,
  conversationsRouteModule,
  eventsRouteModule,
  runRouteModule,
} from "@/../tests/helpers/runtime-routes";
import { __resetNamedEventsForTests } from "@/server/events/named-events";
import { appendWorkerEntry } from "@/server/workers/output-store";
import { updateDirectRunStatusFromWorkerOutput } from "@/server/conversations/direct-run-status";
import { startLifecycleHarness, type LifecycleServer } from "../harness/server";
import { LifecycleClient } from "../harness/client";
import { Chaos, NO_CHAOS } from "../harness/chaos";

const { mockAskAgent, mockCancelAgent, mockGetAgent, mockSpawnAgent } = vi.hoisted(() => ({
  mockAskAgent: vi.fn(),
  mockCancelAgent: vi.fn(),
  mockGetAgent: vi.fn(),
  mockSpawnAgent: vi.fn(),
}));

function agent(workerId: string, sessionId: string) {
  return {
    name: workerId,
    type: "claude",
    state: "idle",
    currentText: "",
    lastText: "",
    sessionId,
    sessionMode: "full-access",
    pendingPermissions: [],
    pendingElicitations: [],
    outputEntries: [],
    stderrBuffer: [],
    stopReason: null,
    cwd: process.cwd(),
  };
}

vi.mock("@/server/bridge-client", () => ({
  askAgent: mockAskAgent,
  cancelAgent: mockCancelAgent,
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
  mockGetAgent.mockReset();
  mockSpawnAgent.mockReset();
  await db.delete(executionEvents);
  await db.delete(messages);
  await db.delete(workers);
  await db.delete(workerCounters);
  await db.delete(runs);
  await db.delete(plans);

  mockSpawnAgent.mockImplementation(async ({ name }: { name: string }) => agent(name, `${name}-session`));
  mockGetAgent.mockImplementation(async (workerId: string) => agent(workerId, `${workerId}-session`));
  mockCancelAgent.mockResolvedValue(undefined);
  mockAskAgent
    .mockResolvedValueOnce({ response: "Safari fast-path diagnosis.", state: "idle" })
    .mockResolvedValueOnce({ response: "Answer from the abandoned branch.", state: "idle" })
    .mockResolvedValueOnce({ response: "Continued with restored context.", state: "idle" });

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
    chaos: new Chaos(806276, NO_CHAOS),
  });
});

afterEach(async () => {
  await client.close();
  await server.stop();
  vi.clearAllMocks();
});

describe("lifecycle harness — direct edit context replay", () => {
  it("replays the visible prefix and excludes the edited message's abandoned branch", async () => {
    await client.bootstrapSnapshot();
    await client.subscribe({});

    const createResponse = await client.fetch("/api/conversations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: "direct",
        command: "Diagnose the Safari export failure.",
        preferredWorkerType: "claude",
        allowedWorkerTypes: ["claude"],
      }),
    });
    expect(createResponse.status).toBe(200);
    const { runId } = await createResponse.json() as { runId: string };
    const originalWorker = await db.select().from(workers).where(eq(workers.runId, runId)).get();
    expect(originalWorker).toBeDefined();
    await appendWorkerEntry(runId, originalWorker!.id, {
      id: "safari-diagnosis",
      type: "message",
      text: "Safari fast-path diagnosis.",
      timestamp: "2026-08-26T11:16:00.000Z",
    });

    const followUpResponse = await client.fetch(`/api/conversations/${runId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "Is Safari the issue?" }),
    });
    expect(followUpResponse.status).toBe(200);
    const followUp = await followUpResponse.json() as { message: { id: string } };
    await appendWorkerEntry(runId, originalWorker!.id, {
      id: "abandoned-answer",
      type: "message",
      text: "Answer from the abandoned branch.",
      timestamp: "2026-08-26T11:17:00.000Z",
    });

    const editResponse = await client.fetch(`/api/runs/${runId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "edit",
        targetMessageId: followUp.message.id,
        content: "Is Safari the issue? Run Safari locally and add it to the tests.",
      }),
    });
    expect(editResponse.status).toBe(200);
    await waitUntil(() => mockAskAgent.mock.calls.length === 3);

    const replayPrompt = String(mockAskAgent.mock.calls.at(-1)?.[1] ?? "");
    expect(replayPrompt).toContain("User: Diagnose the Safari export failure.");
    expect(replayPrompt).toContain("Assistant: Safari fast-path diagnosis.");
    expect(replayPrompt).toContain(
      "Next user prompt:\nIs Safari the issue? Run Safari locally and add it to the tests.",
    );
    expect(replayPrompt).not.toContain("User: Is Safari the issue?");
    expect(replayPrompt).not.toContain("Answer from the abandoned branch.");

    const events = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId));
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ eventType: "worker_session_recreated_from_transcript" }),
    ]));
    await client.waitFor("worker.recreated", {
      predicate: (frame) => (frame.payload as { runId?: string } | null)?.runId === runId,
      timeoutMs: 10_000,
    });

    // A late completion from the cancelled source worker must not finish the
    // replacement run after delivery has begun.
    await updateDirectRunStatusFromWorkerOutput({
      runId,
      workerId: originalWorker!.id,
      workerStatus: "idle",
      responseText: "Late completion from the abandoned worker.",
    });
    const persistedRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
    expect(persistedRun?.status).toBe("running");
    await client.waitFor("worker.stale_status_ignored", {
      predicate: (frame) => (frame.payload as { runId?: string } | null)?.runId === runId,
      timeoutMs: 10_000,
    });
  });
});
