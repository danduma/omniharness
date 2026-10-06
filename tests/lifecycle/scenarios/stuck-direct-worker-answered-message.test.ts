/**
 * Reproduces session 3d628f9b568a: the user's "yes go ahead with plan" was
 * answered, then Claude ran a turn on its own after a background-task
 * notification and finished it with "Say the word and I'll start on Task 0."
 * The runtime never reported that unprompted turn as idle, so five minutes
 * later the stuck-worker reaper cancelled the session, resumed it, and
 * re-sent the answered message. The agent read the replay as fresh consent and
 * started implementing.
 *
 * The rule: a message the agent already responded to is never re-sent.
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

async function seedAnsweredConversation() {
  const planId = `plan-${randomUUID()}`;
  const runId = `run-${randomUUID()}`;
  const workerId = `${runId}-worker-1`;
  const userMessageId = randomUUID();
  const askedAt = new Date(Date.now() - 36 * 60_000);
  const lastTurnEndedAt = new Date(Date.now() - 6 * 60_000);
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
    type: "claude",
    cwd: "/tmp",
    status: "working",
    workerNumber: 1,
    bridgeSessionId: "session-3d628f9b568a",
    createdAt: now,
    updatedAt: lastTurnEndedAt,
  });
  await db.insert(messages).values({
    id: userMessageId,
    runId,
    role: "user",
    kind: "checkpoint",
    content: "web too why not, as long as it works\n\nv2 first\n\nyes go ahead with plan",
    createdAt: askedAt,
  });
  await writeWorkerOutputEntries(runId, workerId, [
    {
      id: userMessageId,
      type: "user_input",
      text: "web too why not, as long as it works\n\nv2 first\n\nyes go ahead with plan",
      timestamp: askedAt.toISOString(),
      authorRole: "user",
      channel: "stdin",
      seq: 1,
    },
    {
      id: randomUUID(),
      type: "message",
      text: "Launching the research agents in the background.",
      timestamp: new Date(askedAt.getTime() + 60_000).toISOString(),
      seq: 2,
    },
    // The unprompted task-notification turn: tools, then its closing text.
    {
      id: randomUUID(),
      type: "tool_call",
      text: "Edit",
      status: "pending",
      timestamp: new Date(lastTurnEndedAt.getTime() - 20_000).toISOString(),
      seq: 3,
    },
    {
      id: randomUUID(),
      type: "message",
      text: "Say the word and I'll start on Task 0.",
      timestamp: lastTurnEndedAt.toISOString(),
      seq: 4,
    },
  ]);

  return { runId, workerId, lastTurnEndedAt };
}

function claudeAgent(workerId: string, state: string, updatedAt: Date) {
  return {
    name: workerId,
    type: "claude",
    cwd: "/tmp",
    state,
    stopReason: state === "idle" ? "end_turn" : null,
    currentText: "",
    lastText: "Say the word and I'll start on Task 0.",
    stderrBuffer: [],
    outputEntries: [],
    pendingPermissions: [],
    pendingElicitations: [],
    updatedAt: updatedAt.toISOString(),
  };
}

describe("lifecycle — stuck direct-worker reaper and an answered message", () => {
  it("settles the conversation without re-sending once the unprompted turn has ended", async () => {
    const { runId, workerId, lastTurnEndedAt } = await seedAnsweredConversation();
    mockGetAgent.mockResolvedValue(claudeAgent(workerId, "idle", lastTurnEndedAt));

    await expect(reapStuckDirectWorkers()).resolves.toMatchObject({ ok: true });

    expect(mockAskAgent).not.toHaveBeenCalled();
    expect(mockCancelAgent).not.toHaveBeenCalled();
    expect(mockResumeMissingDirectWorker).not.toHaveBeenCalled();
    const worker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    expect(worker?.status).toBe("idle");
    expect(run?.status).toBe("done");
  });

  it("never re-sends the answered message even when the runtime still claims the turn is running", async () => {
    const { runId, workerId, lastTurnEndedAt } = await seedAnsweredConversation();
    mockGetAgent.mockResolvedValue(claudeAgent(workerId, "working", lastTurnEndedAt));
    mockCancelAgent.mockResolvedValue({ ok: true });
    mockResumeMissingDirectWorker.mockResolvedValue({ name: workerId, state: "idle" });

    await expect(reapStuckDirectWorkers()).resolves.toMatchObject({ ok: true });

    expect(mockAskAgent).not.toHaveBeenCalled();
    const worker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    expect(worker?.status).toBe("idle");
    const events = getNamedEventsSince(null, { runId }).events.map((entry) => entry.event);
    expect(events).toContainEqual(expect.objectContaining({
      kind: "worker.recovery_redelivery_skipped",
      runId,
      workerId,
      reason: "already_answered",
    }));
    expect(events.map((event) => event.kind)).not.toContain("worker.recovery_continuation_started");
  });
});
