import { randomUUID } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { plans, recoveryIncidents, runs, workers } from "@/server/db/schema";

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
    const { runId, workerId } = await setupStaleStartingWorker();
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
    const { runId, workerId } = await setupStaleStartingWorker();
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
