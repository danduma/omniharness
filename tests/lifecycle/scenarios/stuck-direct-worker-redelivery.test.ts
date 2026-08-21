/**
 * Reproduces session 054dc5ddea78: the stuck-worker reaper recreated an idle
 * bridge session, persisted the run as done, then re-delivered the interrupted
 * prompt through a long-lived ask. The agent was still working, but every
 * durable/UI status surface said the conversation had stopped.
 *
 * The recovery ownership rule is that the worker and run must be persisted as
 * active, and the continuation-started event must be visible, before the
 * re-delivered ask begins.
 */
import { randomUUID } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { artifactStreams, executionEvents, messages, plans, runs, workers } from "@/server/db/schema";
import {
  __resetNamedEventsForTests,
  getNamedEventsSince,
} from "@/server/events/named-events";
import {
  __resetOutputStoreCachesForTests,
  writeWorkerOutputEntries,
} from "@/server/workers/output-store";
import { clearLifecycleSchema } from "../harness/fixtures";

const { mockAskAgent, mockCancelAgent, mockGetAgent } = vi.hoisted(() => ({
  mockAskAgent: vi.fn(),
  mockCancelAgent: vi.fn(),
  mockGetAgent: vi.fn(),
}));

vi.mock("@/server/bridge-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/bridge-client")>();
  return {
    ...actual,
    askAgent: mockAskAgent,
    cancelAgent: mockCancelAgent,
    getAgent: mockGetAgent,
  };
});

const { mockResumeMissingDirectWorker } = vi.hoisted(() => ({
  mockResumeMissingDirectWorker: vi.fn(),
}));

vi.mock("@/server/conversations/send-message", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/conversations/send-message")>();
  return {
    ...actual,
    resumeMissingDirectWorker: mockResumeMissingDirectWorker,
  };
});

import { reapStuckDirectWorkers } from "@/server/workers/stuck-worker-reaper";

beforeEach(async () => {
  __resetNamedEventsForTests();
  __resetOutputStoreCachesForTests();
  mockAskAgent.mockReset();
  mockCancelAgent.mockReset();
  mockGetAgent.mockReset();
  mockResumeMissingDirectWorker.mockReset();
  await db.delete(executionEvents);
  await db.delete(artifactStreams);
  await db.delete(messages);
  await clearLifecycleSchema();
});

afterEach(async () => {
  await db.delete(executionEvents);
  await db.delete(artifactStreams);
  await db.delete(messages);
  await clearLifecycleSchema();
});

describe("lifecycle — stuck direct-worker redelivery", () => {
  it("claims active ownership before awaiting the recovered prompt", async () => {
    const planId = `plan-${randomUUID()}`;
    const runId = `run-${randomUUID()}`;
    const workerId = `${runId}-worker-1`;
    const userMessageId = randomUUID();
    const staleAt = new Date(Date.now() - 10 * 60_000);
    const now = new Date();

    await db.insert(plans).values({
      id: planId,
      path: `/tmp/${planId}.md`,
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "codex",
      cwd: "/tmp",
      status: "working",
      workerNumber: 1,
      bridgeSessionId: "session-054dc5ddea78",
      createdAt: now,
      updatedAt: staleAt,
    });
    await db.insert(messages).values({
      id: userMessageId,
      runId,
      role: "user",
      kind: "checkpoint",
      content: "continue",
      createdAt: staleAt,
    });
    await writeWorkerOutputEntries(runId, workerId, [{
      id: userMessageId,
      type: "user_input",
      text: "continue",
      timestamp: staleAt.toISOString(),
      authorRole: "user",
      channel: "stdin",
      seq: 1,
    }]);

    mockGetAgent.mockResolvedValue(null);
    mockCancelAgent.mockResolvedValue({ ok: true });
    mockResumeMissingDirectWorker.mockImplementation(async () => {
      await db.update(workers).set({ status: "idle" }).where(eq(workers.id, workerId));
      await db.update(runs).set({ status: "done" }).where(eq(runs.id, runId));
      return { name: workerId, state: "idle" };
    });

    let resolveAsk!: (value: { response: string; state: string }) => void;
    let signalAskStarted!: () => void;
    const askStarted = new Promise<void>((resolve) => {
      signalAskStarted = resolve;
    });
    const askResult = new Promise<{ response: string; state: string }>((resolve) => {
      resolveAsk = resolve;
    });
    mockAskAgent.mockImplementation(async () => {
      signalAskStarted();
      return askResult;
    });

    const sweep = reapStuckDirectWorkers();
    await askStarted;

    const workerDuringAsk = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    const runDuringAsk = await db.select().from(runs).where(eq(runs.id, runId)).get();
    resolveAsk({ response: "finished", state: "idle" });
    await expect(sweep).resolves.toMatchObject({ ok: true, recovered: 1 });

    expect(workerDuringAsk?.status).toBe("working");
    expect(runDuringAsk?.status).toBe("running");

    const started = getNamedEventsSince(null, { runId }).events
      .find((entry) => entry.event.kind === "worker.recovery_continuation_started");
    expect(started?.event).toMatchObject({ runId, workerId });
  });
});
