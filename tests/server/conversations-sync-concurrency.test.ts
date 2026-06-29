import { randomUUID } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { plans, runs, workers } from "@/server/db/schema";

const syncProbe = vi.hoisted(() => ({
  activeWrites: 0,
  maxActiveWrites: 0,
  calls: 0,
}));

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

vi.mock("@/server/workers/output-store", () => ({
  readWorkerOutputEntries: vi.fn(async () => []),
  writeWorkerOutputEntries: vi.fn(async () => {
    syncProbe.calls += 1;
    syncProbe.activeWrites += 1;
    syncProbe.maxActiveWrites = Math.max(syncProbe.maxActiveWrites, syncProbe.activeWrites);
    try {
      await delay(30);
    } finally {
      syncProbe.activeWrites -= 1;
    }
  }),
}));

vi.mock("@/server/supervisor/start", () => ({
  startSupervisorRun: vi.fn(),
}));

import { __resetSyncConversationSessionsQueueForTests, syncConversationSessions } from "@/server/conversations/sync";

describe("syncConversationSessions concurrency", () => {
  beforeEach(async () => {
    __resetSyncConversationSessionsQueueForTests();
    syncProbe.activeWrites = 0;
    syncProbe.maxActiveWrites = 0;
    syncProbe.calls = 0;
    await db.delete(workers);
    await db.delete(runs);
    await db.delete(plans);
  });

  it("serializes concurrent live syncs so selected and global snapshots cannot overlap SQLite writes", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const now = new Date(0);

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/direct.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      status: "running",
      title: "Direct live sync",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "claude",
      status: "working",
      cwd: "/workspace/app",
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "",
      createdAt: now,
      updatedAt: now,
    });

    const liveAgent = {
      name: workerId,
      type: "claude",
      cwd: "/workspace/app",
      state: "working",
      outputEntries: [{ id: "msg-1", type: "message", text: "Still working", timestamp: now.toISOString() }],
      renderedOutput: "Still working",
      lastText: "Still working",
      currentText: "Still working",
      stderrBuffer: [],
      stopReason: null,
    };

    await Promise.all([
      syncConversationSessions([liveAgent], { selectedRunId: runId }),
      syncConversationSessions([liveAgent]),
    ]);

    expect(syncProbe.calls).toBeGreaterThanOrEqual(2);
    expect(syncProbe.maxActiveWrites).toBe(1);
  });
});
