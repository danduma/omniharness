import { randomUUID } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { plans, recoveryIncidents, runs, workers } from "@/server/db/schema";
import { appendWorkerSessionMetadata } from "@/server/workers/session-metadata";

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

import { reconcilePersistedReloadZombies } from "@/server/runs/persisted-zombie-reconciler";

async function setupStaleStartingWorker(opts: {
  runMode?: "direct" | "implementation";
  runStatus?: string;
  workerUpdatedAt?: Date;
  bridgeSessionId?: string | null;
  streamSessionId?: string | null;
} = {}) {
  const planId = randomUUID();
  const runId = randomUUID();
  const workerId = `${runId}-worker-1`;
  const stale = opts.workerUpdatedAt ?? new Date(Date.now() - 60_000);
  await db.insert(plans).values({
    id: planId,
    path: "docs/example.md",
    status: "running",
    createdAt: stale,
    updatedAt: stale,
  });
  await db.insert(runs).values({
    id: runId,
    planId,
    mode: opts.runMode ?? "direct",
    status: opts.runStatus ?? "running",
    createdAt: stale,
    updatedAt: stale,
  });
  await db.insert(workers).values({
    id: workerId,
    runId,
    type: "codex",
    cwd: "/tmp",
    status: "starting",
    workerNumber: 1,
    bridgeSessionId: opts.bridgeSessionId ?? null,
    createdAt: stale,
    updatedAt: stale,
  });
  if (opts.streamSessionId) {
    await appendWorkerSessionMetadata({
      runId,
      workerId,
      sessionId: opts.streamSessionId,
      sessionMode: "full-access",
      source: "test",
    });
  }
  return { runId, workerId };
}

beforeEach(() => {
  mockResumeMissingDirectWorker.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("reconcilePersistedReloadZombies — auto-recovery path", () => {
  it("calls resumeMissingDirectWorker and reports 'recovered' when the respawn succeeds", async () => {
    const { runId, workerId } = await setupStaleStartingWorker({
      streamSessionId: "saved-session-id",
    });
    mockResumeMissingDirectWorker.mockResolvedValue({ name: workerId, state: "idle" });

    const outcome = await reconcilePersistedReloadZombies({ selectedRunId: runId });

    expect(outcome.action).toBe("recovered");
    if (outcome.action === "recovered") {
      expect(outcome.runId).toBe(runId);
      expect(outcome.workerId).toBe(workerId);
    }
    expect(mockResumeMissingDirectWorker).toHaveBeenCalledTimes(1);

    // No recovery incident should have been opened.
    const incidents = await db
      .select()
      .from(recoveryIncidents)
      .where(eq(recoveryIncidents.runId, runId));
    expect(incidents).toHaveLength(0);

    // Run should NOT have been marked needs_recovery.
    const after = await db.select().from(runs).where(eq(runs.id, runId)).get();
    expect(after?.status).toBe("running");
  });

  it("falls through to needs_user incident when auto-recovery throws", async () => {
    const { runId, workerId } = await setupStaleStartingWorker({
      streamSessionId: "saved-session-id",
    });
    mockResumeMissingDirectWorker.mockRejectedValue(new Error("agent CLI not on PATH"));

    const outcome = await reconcilePersistedReloadZombies({ selectedRunId: runId });

    expect(outcome.action).toBe("needs_user");
    expect(mockResumeMissingDirectWorker).toHaveBeenCalledTimes(1);

    // An incident should now exist for this run.
    const incidents = await db
      .select()
      .from(recoveryIncidents)
      .where(eq(recoveryIncidents.runId, runId));
    expect(incidents).toHaveLength(1);
    expect(incidents[0].workerId).toBe(workerId);
    expect(incidents[0].lastError).toContain("agent CLI not on PATH");

    // Run was marked needs_recovery.
    const after = await db.select().from(runs).where(eq(runs.id, runId)).get();
    expect(after?.status).toBe("needs_recovery");
  });

  it("does nothing when no run is selected", async () => {
    const outcome = await reconcilePersistedReloadZombies({ selectedRunId: null });
    expect(outcome.action).toBe("none");
    expect(mockResumeMissingDirectWorker).not.toHaveBeenCalled();
  });

  it("does nothing when the worker is fresh (within the 30s grace window)", async () => {
    const { runId } = await setupStaleStartingWorker({
      workerUpdatedAt: new Date(),
    });

    const outcome = await reconcilePersistedReloadZombies({ selectedRunId: runId });
    expect(outcome.action).toBe("none");
    expect(mockResumeMissingDirectWorker).not.toHaveBeenCalled();
  });

  it("does nothing when the worker still has a bridge_session_id (not yet a zombie)", async () => {
    const { runId } = await setupStaleStartingWorker({
      bridgeSessionId: "live-session-id",
    });

    const outcome = await reconcilePersistedReloadZombies({ selectedRunId: runId });
    expect(outcome.action).toBe("none");
    expect(mockResumeMissingDirectWorker).not.toHaveBeenCalled();
  });

  it("does nothing for runs already in a terminal state", async () => {
    const { runId } = await setupStaleStartingWorker({ runStatus: "done" });

    const outcome = await reconcilePersistedReloadZombies({ selectedRunId: runId });
    expect(outcome.action).toBe("none");
    expect(mockResumeMissingDirectWorker).not.toHaveBeenCalled();
  });
});

describe("reconcilePersistedReloadZombies — bridge-orphaned working workers", () => {
  async function setupWorkingWorkerOrphanedByBridge(opts: {
    workerStatus?: string;
    bridgeSessionId?: string | null;
    updatedAt?: Date;
  } = {}) {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const recent = opts.updatedAt ?? new Date(Date.now() - 60_000);
    await db.insert(plans).values({
      id: planId,
      path: "docs/example.md",
      status: "running",
      createdAt: recent,
      updatedAt: recent,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      status: "running",
      createdAt: recent,
      updatedAt: recent,
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "gemini",
      cwd: "/tmp",
      status: opts.workerStatus ?? "working",
      workerNumber: 1,
      bridgeSessionId: opts.bridgeSessionId === undefined ? "saved-session-id" : opts.bridgeSessionId,
      createdAt: recent,
      updatedAt: recent,
    });
    return { runId, workerId };
  }

  it("recovers a 'working' worker whose session is missing from the bridge", async () => {
    const { runId, workerId } = await setupWorkingWorkerOrphanedByBridge();
    mockResumeMissingDirectWorker.mockResolvedValue({ name: workerId, state: "working" });

    const outcome = await reconcilePersistedReloadZombies({
      selectedRunId: runId,
      bridgeAgentNames: new Set<string>(), // bridge has no agents — it just restarted
    });

    expect(outcome.action).toBe("recovered");
    expect(mockResumeMissingDirectWorker).toHaveBeenCalledTimes(1);
  });

  it("recovers a 'stuck' worker whose session is missing from the bridge", async () => {
    const { runId, workerId } = await setupWorkingWorkerOrphanedByBridge({ workerStatus: "stuck" });
    mockResumeMissingDirectWorker.mockResolvedValue({ name: workerId, state: "working" });

    const outcome = await reconcilePersistedReloadZombies({
      selectedRunId: runId,
      bridgeAgentNames: new Set<string>(),
    });

    expect(outcome.action).toBe("recovered");
    expect(mockResumeMissingDirectWorker).toHaveBeenCalledTimes(1);
  });

  it("does NOT recover when the bridge has a live agent for the worker", async () => {
    const { runId, workerId } = await setupWorkingWorkerOrphanedByBridge();

    const outcome = await reconcilePersistedReloadZombies({
      selectedRunId: runId,
      bridgeAgentNames: new Set([workerId]),
    });

    expect(outcome.action).toBe("none");
    expect(mockResumeMissingDirectWorker).not.toHaveBeenCalled();
  });

  it("does NOT recover a 'cancelled' worker even when missing from the bridge", async () => {
    const { runId } = await setupWorkingWorkerOrphanedByBridge({ workerStatus: "cancelled" });

    const outcome = await reconcilePersistedReloadZombies({
      selectedRunId: runId,
      bridgeAgentNames: new Set<string>(),
    });

    expect(outcome.action).toBe("none");
    expect(mockResumeMissingDirectWorker).not.toHaveBeenCalled();
  });

  it("skips the orphan check when bridgeAgentNames is omitted (caller doesn't yet know what the bridge sees)", async () => {
    const { runId } = await setupWorkingWorkerOrphanedByBridge();

    const outcome = await reconcilePersistedReloadZombies({ selectedRunId: runId });

    expect(outcome.action).toBe("none");
    expect(mockResumeMissingDirectWorker).not.toHaveBeenCalled();
  });

  it("does not recover a fresh worker before the runtime list has caught up", async () => {
    const { runId } = await setupWorkingWorkerOrphanedByBridge({
      updatedAt: new Date(),
    });

    const outcome = await reconcilePersistedReloadZombies({
      selectedRunId: runId,
      bridgeAgentNames: new Set<string>(),
    });

    expect(outcome.action).toBe("none");
    expect(mockResumeMissingDirectWorker).not.toHaveBeenCalled();
  });

  it("surfaces needs_user for an old working worker missing from the bridge without session metadata", async () => {
    const { runId, workerId } = await setupWorkingWorkerOrphanedByBridge({
      bridgeSessionId: null,
    });
    const outcome = await reconcilePersistedReloadZombies({
      selectedRunId: runId,
      bridgeAgentNames: new Set<string>(),
    });

    expect(outcome.action).toBe("needs_user");
    expect(mockResumeMissingDirectWorker).not.toHaveBeenCalled();

    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const worker = await db.select().from(workers).where(eq(workers.id, workerId)).get();
    const incidents = await db.select().from(recoveryIncidents).where(eq(recoveryIncidents.runId, runId));

    expect(run?.status).toBe("needs_recovery");
    expect(worker?.status).toBe("lost");
    expect(incidents).toHaveLength(1);
    expect(incidents[0]).toMatchObject({
      workerId,
      kind: "worker_lost",
      status: "needs_user",
    });
  });

  it("recovers an old starting worker with a saved session when the bridge no longer has it", async () => {
    const { runId, workerId } = await setupStaleStartingWorker({
      bridgeSessionId: "starting-session-id",
    });
    mockResumeMissingDirectWorker.mockResolvedValue({ name: workerId, state: "working" });

    const outcome = await reconcilePersistedReloadZombies({
      selectedRunId: runId,
      bridgeAgentNames: new Set<string>(),
    });

    expect(outcome.action).toBe("recovered");
    expect(mockResumeMissingDirectWorker).toHaveBeenCalledTimes(1);
  });
});
