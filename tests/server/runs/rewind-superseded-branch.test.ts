import { randomUUID } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { executionEvents, messages, plans, recoveryIncidents, runs, workerCounters, workers } from "@/server/db/schema";
import { parseSupersededSeqRanges } from "@/lib/superseded-entries";

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
import { appendWorkerEntry, readWorkerEntriesSince } from "@/server/workers/output-store";

describe("rewinding a conversation supersedes the discarded branch", () => {
  beforeEach(async () => {
    mockSpawnAgent.mockReset();
    mockAskAgent.mockReset();
    mockGetAgent.mockReset();
    mockCancelAgent.mockClear();
    mockStartSupervisorRun.mockClear();
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

    await recoverRun({
      runId,
      action: "edit",
      targetMessageId: editedMessageId,
      content: "edited wording",
    });

    const rewoundWorker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    const ranges = parseSupersededSeqRanges(rewoundWorker?.supersededSeqRanges);
    expect(ranges).toEqual([{ from: 3, through: 4 }]);

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
