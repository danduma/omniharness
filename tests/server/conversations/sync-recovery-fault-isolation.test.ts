import { randomUUID } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { plans, runs, workers } from "@/server/db/schema";
import { HandoffInProgressError } from "@/server/handoff/fence";

const { mockReconcileRunRecovery } = vi.hoisted(() => ({
  mockReconcileRunRecovery: vi.fn(),
}));

vi.mock("@/server/runs/recovery-reconciler", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/runs/recovery-reconciler")>();
  return {
    ...actual,
    reconcileRunRecovery: mockReconcileRunRecovery,
  };
});

import { syncConversationSessions } from "@/server/conversations/sync";
import { RunNotFoundError, isRunReconciliationStandDown } from "@/server/runs/recovery-reconciler";

/**
 * A `lost` worker with no live agent is what routes a run into the sync's
 * recovery branch on an unscoped pass, which is where the throw used to escape.
 */
async function setupLostWorkerRun(label: string) {
  const planId = randomUUID();
  const runId = randomUUID();
  const workerId = `${runId}-worker-1`;
  const now = new Date();

  await db.insert(plans).values({
    id: planId,
    path: `vibes/ad-hoc/${label}.md`,
    status: "running",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(runs).values({
    id: runId,
    planId,
    mode: "direct",
    status: "running",
    title: label,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(workers).values({
    id: workerId,
    runId,
    type: "codex",
    status: "lost",
    cwd: process.cwd(),
    outputLog: "",
    outputEntriesJson: "[]",
    currentText: "",
    lastText: "",
    workerNumber: 1,
    createdAt: now,
    updatedAt: now,
  });
  return { runId, workerId };
}

beforeEach(() => {
  mockReconcileRunRecovery.mockReset();
});

describe("isRunReconciliationStandDown", () => {
  it("recognises a run deleted underneath the pass", () => {
    expect(isRunReconciliationStandDown(new RunNotFoundError("run-1"))).toBe(true);
  });

  it("recognises a run fenced by an in-flight handoff", () => {
    expect(isRunReconciliationStandDown(new HandoffInProgressError("run-1", "handoff-1"))).toBe(true);
  });

  it("does not swallow an ordinary reconciliation failure", () => {
    expect(isRunReconciliationStandDown(new Error("disk exploded"))).toBe(false);
  });
});

describe("syncConversationSessions — recovery fault isolation", () => {
  it("finishes the pass when one run was deleted mid-sweep", async () => {
    const deleted = await setupLostWorkerRun("deleted-mid-sweep");
    const survivor = await setupLostWorkerRun("survivor");

    mockReconcileRunRecovery.mockImplementation(async ({ runId }: { runId: string }) => {
      if (runId === deleted.runId) {
        throw new RunNotFoundError(runId);
      }
      return { action: "none" as const, runId };
    });

    // Used to reject here, abandoning every run after the unlucky one and
    // escaping to the events route, which showed the user
    // "Stream live agent state / Run not found" on whatever they had open.
    await expect(syncConversationSessions([])).resolves.toBeUndefined();

    // The survivor was still reconciled down to its real state.
    const survivorRun = await db.select().from(runs).where(eq(runs.id, survivor.runId)).get();
    expect(survivorRun?.status).toBe("needs_recovery");
  });

  it("finishes the pass when reconciliation fails outright", async () => {
    const broken = await setupLostWorkerRun("reconcile-threw");
    const survivor = await setupLostWorkerRun("survivor-after-throw");

    mockReconcileRunRecovery.mockImplementation(async ({ runId }: { runId: string }) => {
      if (runId === broken.runId) {
        throw new Error("recovery blew up");
      }
      return { action: "none" as const, runId };
    });

    await expect(syncConversationSessions([])).resolves.toBeUndefined();

    const survivorRun = await db.select().from(runs).where(eq(runs.id, survivor.runId)).get();
    expect(survivorRun?.status).toBe("needs_recovery");
  });
});
