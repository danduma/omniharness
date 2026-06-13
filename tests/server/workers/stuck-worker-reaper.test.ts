import { randomUUID } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { messages, plans, runs, workers } from "@/server/db/schema";
import {
  __resetOutputStoreCachesForTests,
  writeWorkerOutputEntries,
} from "@/server/workers/output-store";

const {
  mockAskAgent,
  mockCancelAgent,
  mockSpawnAgent,
  mockGetAgent,
} = vi.hoisted(() => ({
  mockAskAgent: vi.fn(),
  mockCancelAgent: vi.fn(),
  mockSpawnAgent: vi.fn(),
  mockGetAgent: vi.fn(),
}));

vi.mock("@/server/bridge-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/bridge-client")>();
  return {
    ...actual,
    askAgent: mockAskAgent,
    cancelAgent: mockCancelAgent,
    spawnAgent: mockSpawnAgent,
    getAgent: mockGetAgent,
  };
});

// resumeMissingDirectWorker pulls in skill-link cleanup, env reads, etc. that
// touch the filesystem and settings. For unit tests we just want to verify the
// reaper's orchestration: did it cancel, did it call respawn, did it redeliver?
// Stub resumeMissingDirectWorker to a controllable vi.fn.
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

const FIVE_MIN_MS = 5 * 60_000;

async function setupRun(opts: {
  mode?: "direct" | "implementation";
  workerStatus?: string;
  workerBridgeSessionId?: string | null;
  workerUpdatedAt?: Date;
} = {}) {
  const planId = randomUUID();
  const runId = randomUUID();
  const workerId = `${runId}-worker-1`;
  await db.insert(plans).values({
    id: planId,
    path: "docs/example.md",
    status: "running",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(runs).values({
    id: runId,
    planId,
    mode: opts.mode ?? "direct",
    status: "running",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(workers).values({
    id: workerId,
    runId,
    type: "codex",
    cwd: "/tmp",
    status: opts.workerStatus ?? "working",
    workerNumber: 1,
    bridgeSessionId: opts.workerBridgeSessionId ?? "saved-session-1",
    createdAt: new Date(),
    updatedAt: opts.workerUpdatedAt ?? new Date(),
  });
  return { runId, workerId };
}

async function writeUserInputEntry(runId: string, workerId: string, opts: {
  id: string;
  text: string;
  timestamp: Date;
}) {
  await writeWorkerOutputEntries(runId, workerId, [
    {
      id: opts.id,
      type: "user_input",
      text: opts.text,
      timestamp: opts.timestamp.toISOString(),
      authorRole: "user",
      channel: "stdin",
      seq: 1,
    },
  ]);
}

beforeEach(() => {
  __resetOutputStoreCachesForTests();
  mockAskAgent.mockReset();
  mockCancelAgent.mockReset();
  mockSpawnAgent.mockReset();
  mockGetAgent.mockReset();
  mockResumeMissingDirectWorker.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("reapStuckDirectWorkers", () => {
  it("recovers a direct-mode worker that has been silent past the stuck timeout", async () => {
    const TEN_MIN_AGO = new Date(Date.now() - 10 * 60_000);
    const { runId, workerId } = await setupRun({
      mode: "direct",
      workerStatus: "working",
      workerUpdatedAt: TEN_MIN_AGO,
    });

    const userMessageId = randomUUID();
    await db.insert(messages).values({
      id: userMessageId,
      runId,
      role: "user",
      kind: "checkpoint",
      content: "continue",
      createdAt: TEN_MIN_AGO,
    });
    await writeUserInputEntry(runId, workerId, {
      id: userMessageId,
      text: "continue",
      timestamp: TEN_MIN_AGO,
    });

    mockCancelAgent.mockResolvedValue({ ok: true });
    mockResumeMissingDirectWorker.mockResolvedValue({ name: workerId, state: "idle" });
    mockAskAgent.mockResolvedValue({ response: "ok", state: "idle" });

    const outcome = await reapStuckDirectWorkers();

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.recovered).toBe(1);
    }
    expect(mockCancelAgent).toHaveBeenCalledWith(workerId);
    expect(mockResumeMissingDirectWorker).toHaveBeenCalledTimes(1);
    expect(mockAskAgent).toHaveBeenCalledWith(workerId, "continue");
  });

  it("does not touch workers whose stream activity is recent", async () => {
    const ONE_MIN_AGO = new Date(Date.now() - 60_000);
    const { runId, workerId } = await setupRun({
      mode: "direct",
      workerStatus: "working",
      workerUpdatedAt: ONE_MIN_AGO,
    });

    const userMessageId = randomUUID();
    await db.insert(messages).values({
      id: userMessageId,
      runId,
      role: "user",
      kind: "checkpoint",
      content: "continue",
      createdAt: ONE_MIN_AGO,
    });
    await writeUserInputEntry(runId, workerId, {
      id: userMessageId,
      text: "continue",
      timestamp: ONE_MIN_AGO,
    });

    const outcome = await reapStuckDirectWorkers();

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.recovered).toBe(0);
    }
    expect(mockCancelAgent).not.toHaveBeenCalled();
    expect(mockResumeMissingDirectWorker).not.toHaveBeenCalled();
    expect(mockAskAgent).not.toHaveBeenCalled();
  });

  it("skips implementation-mode workers entirely (supervisor owns those)", async () => {
    const TEN_MIN_AGO = new Date(Date.now() - 10 * 60_000);
    const { runId, workerId } = await setupRun({
      mode: "implementation",
      workerStatus: "working",
      workerUpdatedAt: TEN_MIN_AGO,
    });

    await writeUserInputEntry(runId, workerId, {
      id: randomUUID(),
      text: "continue",
      timestamp: TEN_MIN_AGO,
    });

    const outcome = await reapStuckDirectWorkers();

    expect(outcome.ok).toBe(true);
    expect(mockCancelAgent).not.toHaveBeenCalled();
    expect(mockResumeMissingDirectWorker).not.toHaveBeenCalled();
  });

  it("skips workers whose status is not 'working' or 'starting'", async () => {
    const TEN_MIN_AGO = new Date(Date.now() - 10 * 60_000);
    const { runId, workerId } = await setupRun({
      mode: "direct",
      workerStatus: "idle",
      workerUpdatedAt: TEN_MIN_AGO,
    });

    await writeUserInputEntry(runId, workerId, {
      id: randomUUID(),
      text: "continue",
      timestamp: TEN_MIN_AGO,
    });

    const outcome = await reapStuckDirectWorkers();

    expect(outcome.ok).toBe(true);
    expect(mockResumeMissingDirectWorker).not.toHaveBeenCalled();
  });

  it("marks the worker as error and records an event when respawn fails", async () => {
    const TEN_MIN_AGO = new Date(Date.now() - 10 * 60_000);
    const { runId, workerId } = await setupRun({
      mode: "direct",
      workerStatus: "working",
      workerUpdatedAt: TEN_MIN_AGO,
    });

    await writeUserInputEntry(runId, workerId, {
      id: randomUUID(),
      text: "continue",
      timestamp: TEN_MIN_AGO,
    });

    mockCancelAgent.mockResolvedValue({ ok: true });
    mockResumeMissingDirectWorker.mockRejectedValue(new Error("spawn failed: ENOENT"));

    const outcome = await reapStuckDirectWorkers();

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.recovered).toBe(0);
    }
    expect(mockAskAgent).not.toHaveBeenCalled();

    const after = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    expect(after?.status).toBe("error");
    void runId;
  });

  it("respawns but does not redeliver when there is no prior user_input in the stream", async () => {
    const TEN_MIN_AGO = new Date(Date.now() - 10 * 60_000);
    const { workerId } = await setupRun({
      mode: "direct",
      workerStatus: "working",
      workerUpdatedAt: TEN_MIN_AGO,
    });

    // No user_input written to the stream — only a lifecycle entry from spawn.
    // The reaper would skip if there are no entries at all, so seed one
    // non-user_input entry with a stale timestamp.
    await writeWorkerOutputEntries(
      (await db.select().from(workers).where(eq(workers.id, workerId)).get())!.runId,
      workerId,
      [
        {
          id: randomUUID(),
          type: "lifecycle",
          text: "Worker spawned",
          timestamp: TEN_MIN_AGO.toISOString(),
          authorRole: "system",
          channel: "system",
          seq: 1,
        },
      ],
    );

    mockCancelAgent.mockResolvedValue({ ok: true });
    mockResumeMissingDirectWorker.mockResolvedValue({ name: workerId, state: "idle" });

    const outcome = await reapStuckDirectWorkers();

    expect(outcome.ok).toBe(true);
    expect(mockResumeMissingDirectWorker).toHaveBeenCalledTimes(1);
    expect(mockAskAgent).not.toHaveBeenCalled(); // no user_input to redeliver
  });

  it("reconciles a lost completion instead of re-delivering when the bridge agent already finished the turn", async () => {
    const TEN_MIN_AGO = new Date(Date.now() - 10 * 60_000);
    const { runId, workerId } = await setupRun({
      mode: "direct",
      workerStatus: "working",
      workerUpdatedAt: TEN_MIN_AGO,
    });

    const userMessageId = randomUUID();
    await db.insert(messages).values({
      id: userMessageId,
      runId,
      role: "user",
      kind: "checkpoint",
      content: "continue",
      createdAt: TEN_MIN_AGO,
    });
    await writeUserInputEntry(runId, workerId, {
      id: userMessageId,
      text: "continue",
      timestamp: TEN_MIN_AGO,
    });

    // The bridge finished the turn after our last persisted stream entry —
    // only the completion was lost (server restart / dropped ask roundtrip).
    mockGetAgent.mockResolvedValue({
      name: workerId,
      type: "codex",
      cwd: "/tmp",
      state: "idle",
      stopReason: "end_turn",
      currentText: "",
      lastText: "All done. The change is committed.",
      stderrBuffer: [],
      outputEntries: [],
      updatedAt: new Date().toISOString(),
    });

    const outcome = await reapStuckDirectWorkers();

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.recovered).toBe(1);
    }
    // Completed work must not be cancelled or re-run.
    expect(mockCancelAgent).not.toHaveBeenCalled();
    expect(mockResumeMissingDirectWorker).not.toHaveBeenCalled();
    expect(mockAskAgent).not.toHaveBeenCalled();

    const workerAfter = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    expect(workerAfter?.status).toBe("idle");
    const runAfter = await db.select().from(runs).where(eq(runs.id, runId)).get();
    expect(runAfter?.status).toBe("done");
  });

  it("re-asks a live idle agent directly when the prompt was dropped before reaching it", async () => {
    const TEN_MIN_AGO = new Date(Date.now() - 10 * 60_000);
    const TWENTY_MIN_AGO = new Date(Date.now() - 20 * 60_000);
    const { runId, workerId } = await setupRun({
      mode: "direct",
      workerStatus: "working",
      workerUpdatedAt: TEN_MIN_AGO,
    });

    const userMessageId = randomUUID();
    await db.insert(messages).values({
      id: userMessageId,
      runId,
      role: "user",
      kind: "checkpoint",
      content: "continue",
      createdAt: TEN_MIN_AGO,
    });
    await writeUserInputEntry(runId, workerId, {
      id: userMessageId,
      text: "continue",
      timestamp: TEN_MIN_AGO,
    });

    // The agent is alive and idle but has not done anything since before the
    // user's message — the ask never reached it. It can be re-asked in place;
    // cancelling and respawning would discard healthy session state.
    mockGetAgent.mockResolvedValue({
      name: workerId,
      type: "codex",
      cwd: "/tmp",
      state: "idle",
      stopReason: "end_turn",
      currentText: "",
      lastText: "Previous turn output.",
      stderrBuffer: [],
      outputEntries: [],
      updatedAt: TWENTY_MIN_AGO.toISOString(),
    });
    mockAskAgent.mockResolvedValue({ response: "ok", state: "idle" });

    const outcome = await reapStuckDirectWorkers();

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.recovered).toBe(1);
    }
    expect(mockCancelAgent).not.toHaveBeenCalled();
    expect(mockResumeMissingDirectWorker).not.toHaveBeenCalled();
    expect(mockAskAgent).toHaveBeenCalledWith(workerId, "continue");
  });

  it("respects OMNIHARNESS_WORKER_STUCK_TIMEOUT_MS override", async () => {
    const TWO_MIN_AGO = new Date(Date.now() - 2 * 60_000);
    const { runId, workerId } = await setupRun({
      mode: "direct",
      workerStatus: "working",
      workerUpdatedAt: TWO_MIN_AGO,
    });

    const userMessageId = randomUUID();
    await db.insert(messages).values({
      id: userMessageId,
      runId,
      role: "user",
      kind: "checkpoint",
      content: "continue",
      createdAt: TWO_MIN_AGO,
    });
    await writeUserInputEntry(runId, workerId, {
      id: userMessageId,
      text: "continue",
      timestamp: TWO_MIN_AGO,
    });

    mockCancelAgent.mockResolvedValue({ ok: true });
    mockResumeMissingDirectWorker.mockResolvedValue({ name: workerId, state: "idle" });
    mockAskAgent.mockResolvedValue({ response: "ok", state: "idle" });

    // Default threshold is 5 min; 2 min idle should be skipped — at least for
    // THIS worker. Other workers carried over from prior tests in the same
    // file may have older idle times, so we don't assert on the total count;
    // we just check this worker wasn't acted on.
    await reapStuckDirectWorkers();
    let after = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    expect(after?.status).toBe("working");

    // Lower threshold to 1 min — now 2 min idle qualifies for THIS worker.
    const prev = process.env.OMNIHARNESS_WORKER_STUCK_TIMEOUT_MS;
    process.env.OMNIHARNESS_WORKER_STUCK_TIMEOUT_MS = "60000";
    try {
      await reapStuckDirectWorkers();
      after = await db.select().from(workers).where(eq(workers.id, workerId)).get();
      // After a successful redelivery the reaper persists the turn outcome.
      // With no live agent snapshot available it lands on "idle" — the turn
      // resolved, so the worker must not stay "working" (that's what caused
      // the endless re-reap loop) nor stay at the transient "stuck".
      expect(after?.status).toBe("idle");
      expect(mockAskAgent).toHaveBeenCalledWith(workerId, "continue");
    } finally {
      if (prev === undefined) delete process.env.OMNIHARNESS_WORKER_STUCK_TIMEOUT_MS;
      else process.env.OMNIHARNESS_WORKER_STUCK_TIMEOUT_MS = prev;
    }

    void FIVE_MIN_MS;
  });
});
