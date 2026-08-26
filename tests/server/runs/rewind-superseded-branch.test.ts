import { randomUUID } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { executionEvents, messages, plans, recoveryIncidents, runs, workerCounters, workers } from "@/server/db/schema";
import { parseSupersededSeqRanges } from "@/lib/superseded-entries";
import { __resetNamedEventsForTests, getNamedEventsSince } from "@/server/events/named-events";

const {
  mockSpawnAgent,
  mockAskAgent,
  mockGetAgent,
  mockCancelAgent,
  mockStartSupervisorRun,
} = vi.hoisted(() => ({
  mockSpawnAgent: vi.fn(),
  mockAskAgent: vi.fn(),
  mockGetAgent: vi.fn(),
  mockCancelAgent: vi.fn().mockResolvedValue(undefined),
  mockStartSupervisorRun: vi.fn(),
}));

vi.mock("@/server/runs/ad-hoc-plan", () => ({
  createAdHocPlan: vi.fn(),
  rewriteAdHocPlan: vi.fn(),
}));

vi.mock("@/server/bridge-client", () => ({
  spawnAgent: mockSpawnAgent,
  askAgent: mockAskAgent,
  getAgent: mockGetAgent,
  cancelAgent: mockCancelAgent,
}));

vi.mock("@/server/supervisor/start", () => ({
  startSupervisorRun: mockStartSupervisorRun,
}));

import { recoverRun } from "@/server/runs/recovery";
import {
  appendWorkerEntry,
  readWorkerEntriesSince,
  withWorkerOutputWriteFence,
  writeWorkerOutputEntries,
} from "@/server/workers/output-store";
import {
  advanceWorkerTurnGeneration,
  runConversationMutation,
  runWorkerTurn,
} from "@/server/conversations/worker-turn-gate";

describe("rewinding a conversation supersedes the discarded branch", () => {
  beforeEach(async () => {
    mockSpawnAgent.mockReset();
    mockAskAgent.mockReset();
    mockGetAgent.mockReset();
    mockCancelAgent.mockClear();
    mockStartSupervisorRun.mockClear();
    __resetNamedEventsForTests();
    await db.delete(executionEvents);
    await db.delete(messages);
    await db.delete(workers);
    await db.delete(workerCounters);
    await db.delete(recoveryIncidents);
    await db.delete(runs);
    await db.delete(plans);
  });

  it("marks everything the edited message already produced, and leaves earlier turns alone", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const firstMessageId = randomUUID();
    const editedMessageId = randomUUID();
    const laterMessageId = randomUUID();
    const start = new Date("2026-07-25T08:40:00.000Z");

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/direct.md",
      status: "running",
      createdAt: start,
      updatedAt: start,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      title: "Direct",
      projectPath: process.cwd(),
      preferredWorkerType: "claude",
      allowedWorkerTypes: JSON.stringify(["claude"]),
      status: "running",
      createdAt: start,
      updatedAt: start,
    });
    await db.insert(messages).values([
      {
        id: firstMessageId,
        runId,
        role: "user",
        kind: "checkpoint",
        content: "first question",
        createdAt: start,
      },
      {
        id: editedMessageId,
        runId,
        role: "user",
        kind: "checkpoint",
        content: "original wording",
        createdAt: new Date(start.getTime() + 60_000),
      },
      {
        id: laterMessageId,
        runId,
        role: "assistant",
        kind: "message",
        content: "answer that the edit discards",
        createdAt: new Date(start.getTime() + 120_000),
      },
    ]);
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "claude",
      status: "idle",
      cwd: process.cwd(),
      workerNumber: 1,
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "",
      createdAt: start,
      updatedAt: start,
    });

    await appendWorkerEntry(runId, workerId, {
      id: firstMessageId,
      type: "user_input",
      text: "first question",
      timestamp: start.toISOString(),
    });
    await appendWorkerEntry(runId, workerId, {
      id: "answer-to-first",
      type: "message",
      text: "answer to the first question",
      timestamp: new Date(start.getTime() + 30_000).toISOString(),
    });
    await appendWorkerEntry(runId, workerId, {
      id: editedMessageId,
      type: "user_input",
      text: "original wording",
      timestamp: new Date(start.getTime() + 60_000).toISOString(),
    });
    await appendWorkerEntry(runId, workerId, {
      id: "discarded-answer",
      type: "message",
      text: "answer that the edit discards",
      timestamp: new Date(start.getTime() + 120_000).toISOString(),
    });

    mockSpawnAgent.mockResolvedValue({
      name: `${runId}-worker-2`,
      type: "claude",
      cwd: process.cwd(),
      state: "idle",
      sessionId: "session-2",
      sessionMode: "full-access",
      outputEntries: [],
      currentText: "",
      lastText: "",
    });
    mockAskAgent.mockResolvedValue({ response: "answer after the edit", state: "idle" });
    mockGetAgent.mockResolvedValue(null);

    let markBlockedTurnStarted!: () => void;
    const blockedTurnStarted = new Promise<void>((resolve) => { markBlockedTurnStarted = resolve; });
    const blockedMutation = runConversationMutation(runId, () => runWorkerTurn(workerId, (signal) => (
      new Promise<never>((_resolve, reject) => {
        markBlockedTurnStarted();
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      })
    )));
    const blockedOutcome = blockedMutation.then(() => null, (error: unknown) => error);
    await blockedTurnStarted;

    await recoverRun({
      runId,
      action: "edit",
      targetMessageId: editedMessageId,
      content: "edited wording",
    });
    expect(await blockedOutcome).toBeInstanceOf(Error);

    expect(mockAskAgent).toHaveBeenCalledWith(
      `${runId}-worker-2`,
      expect.stringContaining("User: first question"),
      undefined,
      { expectedTurnGeneration: 0 },
    );
    const replayPrompt = String(mockAskAgent.mock.calls.at(-1)?.[1] ?? "");
    expect(replayPrompt).toContain("Assistant: answer to the first question");
    expect(replayPrompt).toContain("Next user prompt:\nedited wording");
    expect(replayPrompt).not.toContain("original wording");
    expect(replayPrompt).not.toContain("discarded-answer");
    expect(replayPrompt).not.toContain("answer that the edit discards");

    const recoveryEvents = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId));
    expect(recoveryEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        workerId: `${runId}-worker-2`,
        eventType: "worker_session_recreated_from_transcript",
        details: expect.stringContaining(workerId),
      }),
    ]));
    expect(getNamedEventsSince(0, { runId }).events.map((entry) => entry.event)).toContainEqual(
      expect.objectContaining({
        kind: "worker.recreated",
        runId,
        workerId: `${runId}-worker-2`,
      }),
    );
    expect(getNamedEventsSince(0, { runId }).events.map((entry) => entry.event)).toContainEqual(
      expect.objectContaining({
        kind: "worker.turn_preempted",
        runId,
        workerId,
        reason: "conversation_recovery",
      }),
    );

    const rewoundWorker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    const ranges = parseSupersededSeqRanges(rewoundWorker?.supersededSeqRanges);
    expect(ranges).toEqual([{ from: 3, through: 4 }]);
    expect(rewoundWorker?.turnGeneration).toBe(1);

    // The turns before the edited message stay visible; the discarded attempt
    // and the original copy of the edited message do not.
    const stream = await readWorkerEntriesSince(runId, workerId, 0);
    const visible = stream.entries.filter((entry) => !ranges.some(
      (range) => (entry.seq ?? 0) >= range.from && (entry.seq ?? 0) <= range.through,
    ));
    expect(visible.map((entry) => entry.text)).toEqual([
      "first question",
      "answer to the first question",
    ]);
  });

  it("replays visible history spread across every worker before a later edited checkpoint", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const firstWorkerId = `${runId}-worker-1`;
    const secondWorkerId = `${runId}-worker-2`;
    const editedMessageId = randomUUID();
    const start = new Date("2026-07-25T08:40:00.000Z");

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/direct.md",
      status: "running",
      createdAt: start,
      updatedAt: start,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      title: "Direct",
      projectPath: process.cwd(),
      preferredWorkerType: "claude",
      allowedWorkerTypes: JSON.stringify(["claude"]),
      status: "running",
      createdAt: start,
      updatedAt: start,
    });
    await db.insert(messages).values({
      id: editedMessageId,
      runId,
      role: "user",
      kind: "checkpoint",
      content: "later original wording",
      createdAt: new Date(start.getTime() + 120_000),
    });
    await db.insert(workers).values([
      {
        id: firstWorkerId,
        runId,
        type: "claude",
        status: "cancelled",
        cwd: process.cwd(),
        workerNumber: 1,
        outputLog: "",
        outputEntriesJson: "[]",
        currentText: "",
        lastText: "",
        createdAt: start,
        updatedAt: start,
      },
      {
        id: secondWorkerId,
        runId,
        type: "claude",
        status: "idle",
        cwd: process.cwd(),
        workerNumber: 2,
        outputLog: "",
        outputEntriesJson: "[]",
        currentText: "",
        lastText: "",
        createdAt: new Date(start.getTime() + 60_000),
        updatedAt: new Date(start.getTime() + 60_000),
      },
    ]);
    await appendWorkerEntry(runId, firstWorkerId, {
      id: "first-worker-user",
      type: "user_input",
      text: "question retained only on worker one",
      timestamp: start.toISOString(),
    });
    await appendWorkerEntry(runId, firstWorkerId, {
      id: "first-worker-answer",
      type: "message",
      text: "answer retained only on worker one",
      timestamp: new Date(start.getTime() + 30_000).toISOString(),
    });
    await writeWorkerOutputEntries(runId, firstWorkerId, [{
      id: "streaming-answer",
      type: "message",
      text: "partial streaming fragment",
      timestamp: new Date(start.getTime() + 40_000).toISOString(),
    }]);
    await writeWorkerOutputEntries(runId, firstWorkerId, [{
      id: "streaming-answer",
      type: "message",
      text: "complete streaming answer",
      timestamp: new Date(start.getTime() + 45_000).toISOString(),
    }]);
    await appendWorkerEntry(runId, secondWorkerId, {
      id: "second-worker-answer",
      type: "message",
      text: "context retained only on worker two",
      timestamp: new Date(start.getTime() + 90_000).toISOString(),
    });
    await appendWorkerEntry(runId, secondWorkerId, {
      id: editedMessageId,
      type: "user_input",
      text: "later original wording",
      timestamp: new Date(start.getTime() + 120_000).toISOString(),
    });
    await appendWorkerEntry(runId, secondWorkerId, {
      id: "later-discarded-answer",
      type: "message",
      text: "later abandoned branch",
      timestamp: new Date(start.getTime() + 150_000).toISOString(),
    });

    mockSpawnAgent.mockResolvedValue({
      name: `${runId}-worker-3`,
      type: "claude",
      cwd: process.cwd(),
      state: "idle",
      sessionId: "session-3",
      sessionMode: "full-access",
      outputEntries: [],
      currentText: "",
      lastText: "",
    });
    mockAskAgent.mockResolvedValue({ response: "continued", state: "idle" });
    mockGetAgent.mockResolvedValue(null);

    await recoverRun({
      runId,
      action: "edit",
      targetMessageId: editedMessageId,
      content: "later edited wording",
    });

    const replayPrompt = String(mockAskAgent.mock.calls.at(-1)?.[1] ?? "");
    expect(replayPrompt).toContain("User: question retained only on worker one");
    expect(replayPrompt).toContain("Assistant: answer retained only on worker one");
    expect(replayPrompt).toContain("Assistant: complete streaming answer");
    expect(replayPrompt).not.toContain("partial streaming fragment");
    expect(replayPrompt).toContain("Assistant: context retained only on worker two");
    expect(replayPrompt).toContain("Next user prompt:\nlater edited wording");
    expect(replayPrompt).not.toContain("later original wording");
    expect(replayPrompt).not.toContain("later abandoned branch");
  });

  it("keeps retry from selecting a recovery worker created after its worker snapshot", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const firstWorkerId = `${runId}-worker-1`;
    const editedMessageId = randomUUID();
    const start = new Date("2026-07-25T08:40:00.000Z");

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/direct.md",
      status: "running",
      createdAt: start,
      updatedAt: start,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      title: "Direct",
      projectPath: process.cwd(),
      preferredWorkerType: "claude",
      allowedWorkerTypes: JSON.stringify(["claude"]),
      status: "running",
      createdAt: start,
      updatedAt: start,
    });
    await db.insert(messages).values({
      id: editedMessageId,
      runId,
      role: "user",
      kind: "checkpoint",
      content: "original wording",
      createdAt: start,
    });
    await db.insert(workers).values({
      id: firstWorkerId,
      runId,
      type: "claude",
      status: "idle",
      cwd: process.cwd(),
      workerNumber: 1,
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "",
      createdAt: start,
      updatedAt: start,
    });
    await appendWorkerEntry(runId, firstWorkerId, {
      id: "retained-question",
      type: "user_input",
      text: "retained question",
      timestamp: new Date(start.getTime() - 20_000).toISOString(),
    });
    await appendWorkerEntry(runId, firstWorkerId, {
      id: "retained-answer",
      type: "message",
      text: "retained answer",
      timestamp: new Date(start.getTime() - 10_000).toISOString(),
    });
    await appendWorkerEntry(runId, firstWorkerId, {
      id: editedMessageId,
      type: "user_input",
      text: "original wording",
      timestamp: start.toISOString(),
    });

    let releaseFirstCancellation!: () => void;
    const firstCancellation = new Promise<void>((resolve) => {
      releaseFirstCancellation = resolve;
    });
    mockCancelAgent.mockImplementationOnce(() => firstCancellation);
    mockSpawnAgent.mockImplementation(async ({ name }: { name: string }) => ({
      name,
      type: "claude",
      cwd: process.cwd(),
      state: "idle",
      sessionId: `session-${name}`,
      sessionMode: "full-access",
      outputEntries: [],
      currentText: "",
      lastText: "",
    }));
    mockAskAgent.mockResolvedValue({ response: "latest answer", state: "idle" });
    mockGetAgent.mockResolvedValue(null);

    const firstRecovery = recoverRun({
      runId,
      action: "edit",
      targetMessageId: editedMessageId,
      content: "first edited wording",
    });
    await vi.waitFor(() => expect(mockCancelAgent).toHaveBeenCalledTimes(1));

    const secondRecovery = recoverRun({
      runId,
      action: "retry",
      targetMessageId: editedMessageId,
    });
    await vi.waitFor(async () => {
      const firstWorker = await db.select().from(workers).where(eq(workers.id, firstWorkerId)).get();
      expect(firstWorker?.turnGeneration).toBe(2);
    });
    releaseFirstCancellation();

    await Promise.all([firstRecovery, secondRecovery]);

    expect(mockAskAgent).toHaveBeenCalledTimes(1);
    expect(mockAskAgent).toHaveBeenCalledWith(
      `${runId}-worker-3`,
      expect.stringContaining("User: retained question"),
      undefined,
      { expectedTurnGeneration: 0 },
    );
    const replayPrompt = String(mockAskAgent.mock.calls[0]?.[1] ?? "");
    expect(replayPrompt).toContain("Assistant: retained answer");
    expect(replayPrompt).toContain("Next user prompt:\nfirst edited wording");
    const storedWorkers = await db.select().from(workers).where(eq(workers.runId, runId));
    const missedWorker = storedWorkers.find((worker) => worker.id === `${runId}-worker-2`);
    expect(missedWorker?.status).toBe("cancelled");
    expect(missedWorker?.bridgeSessionId).toBeNull();
    expect(storedWorkers.find((worker) => worker.id === `${runId}-worker-3`)?.status).toBe("idle");
    const storedMessage = await db.select().from(messages).where(eq(messages.id, editedMessageId)).get();
    expect(storedMessage?.content).toBe("first edited wording");
  });

  it("rejects old-turn output that reaches persistence after the rewind fence", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const start = new Date("2026-07-25T08:40:00.000Z");

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/direct.md",
      status: "running",
      createdAt: start,
      updatedAt: start,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      title: "Direct",
      projectPath: process.cwd(),
      preferredWorkerType: "claude",
      allowedWorkerTypes: JSON.stringify(["claude"]),
      status: "running",
      createdAt: start,
      updatedAt: start,
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "claude",
      status: "working",
      cwd: process.cwd(),
      workerNumber: 1,
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "",
      createdAt: start,
      updatedAt: start,
    });

    let enterFence!: () => void;
    let releaseFence!: () => void;
    const fenceEntered = new Promise<void>((resolve) => { enterFence = resolve; });
    const fenceRelease = new Promise<void>((resolve) => { releaseFence = resolve; });
    const heldFence = withWorkerOutputWriteFence(runId, workerId, async () => {
      enterFence();
      await fenceRelease;
    });
    await fenceEntered;

    // Both operations queue behind the held fence. The rewind owns the queue
    // first, so the late snapshot must observe generation 1 while expecting 0.
    const rewind = withWorkerOutputWriteFence(runId, workerId, () => (
      advanceWorkerTurnGeneration(workerId, {
        status: "cancelled",
        clearCurrentText: true,
      })
    ));
    const lateSnapshot = writeWorkerOutputEntries(runId, workerId, [{
      id: "late-old-turn-output",
      type: "message",
      text: "must never become visible",
      timestamp: new Date(start.getTime() + 30_000).toISOString(),
    }], { expectedTurnGeneration: 0 });

    releaseFence();
    await heldFence;
    await rewind;
    expect(await lateSnapshot).toBe(false);

    const stream = await readWorkerEntriesSince(runId, workerId, 0);
    expect(stream.entries.map((entry) => entry.id)).not.toContain("late-old-turn-output");
    expect(getNamedEventsSince(0, { runId }).events.map((entry) => entry.event)).toContainEqual(
      expect.objectContaining({
        kind: "worker.stale_output_ignored",
        runId,
        workerId,
        expectedTurnGeneration: 0,
        currentTurnGeneration: 1,
        source: "snapshot_batch",
      }),
    );
    const persistedEvents = await db.select().from(executionEvents).where(eq(executionEvents.runId, runId));
    expect(persistedEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        workerId,
        eventType: "stale_worker_output_ignored",
      }),
    ]));
  });

  it("keeps the rewound message visible when the rerun never delivers it", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const editedMessageId = randomUUID();
    const start = new Date("2026-07-25T08:40:00.000Z");

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/direct.md",
      status: "running",
      createdAt: start,
      updatedAt: start,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      title: "Direct",
      projectPath: process.cwd(),
      preferredWorkerType: "claude",
      allowedWorkerTypes: JSON.stringify(["claude"]),
      status: "running",
      createdAt: start,
      updatedAt: start,
    });
    await db.insert(messages).values({
      id: editedMessageId,
      runId,
      role: "user",
      kind: "checkpoint",
      content: "original wording",
      createdAt: start,
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "claude",
      status: "idle",
      cwd: process.cwd(),
      workerNumber: 1,
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "",
      createdAt: start,
      updatedAt: start,
    });

    await appendWorkerEntry(runId, workerId, {
      id: editedMessageId,
      type: "user_input",
      text: "original wording",
      timestamp: start.toISOString(),
    });
    await appendWorkerEntry(runId, workerId, {
      id: "discarded-answer",
      type: "message",
      text: "answer that the edit discards",
      timestamp: new Date(start.getTime() + 30_000).toISOString(),
    });

    mockSpawnAgent.mockRejectedValue(new Error("Agent is busy"));

    await expect(recoverRun({
      runId,
      action: "edit",
      targetMessageId: editedMessageId,
      content: "edited wording",
    })).rejects.toThrow();

    const rewoundWorker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    // Only the discarded answer is hidden. The message itself has nowhere else
    // to live yet, so it must keep rendering.
    expect(parseSupersededSeqRanges(rewoundWorker?.supersededSeqRanges)).toEqual([{ from: 2, through: 2 }]);
  });
});
