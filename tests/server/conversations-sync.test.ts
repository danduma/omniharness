import { randomUUID } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { executionEvents, messages, plans, recoveryIncidents, runs, settings, workers } from "@/server/db/schema";

const { mockStartSupervisorRun } = vi.hoisted(() => ({
  mockStartSupervisorRun: vi.fn(),
}));

vi.mock("@/server/supervisor/start", () => ({
  startSupervisorRun: mockStartSupervisorRun,
}));

import { syncConversationSessions } from "@/server/conversations/sync";

describe("syncConversationSessions", () => {
  beforeEach(async () => {
    mockStartSupervisorRun.mockReset();
    await db.delete(recoveryIncidents);
    await db.delete(executionEvents);
    await db.delete(messages);
    await db.delete(workers);
    await db.delete(runs);
    await db.delete(plans);
    await db.delete(settings);
  });

  it("marks a selected direct run as needing recovery when its active worker is missing", async () => {
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
      title: "Direct recovery",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(messages).values({
      id: randomUUID(),
      runId,
      role: "user",
      kind: "checkpoint",
      content: "Commit the changes",
      createdAt: now,
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "codex",
      status: "working",
      cwd: process.cwd(),
      bridgeSessionId: "session-direct",
      bridgeSessionMode: "full-access",
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "",
      createdAt: now,
      updatedAt: now,
    });

    await syncConversationSessions([], { selectedRunId: runId });

    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const incident = await db.select().from(recoveryIncidents).where(eq(recoveryIncidents.runId, runId)).get();

    expect(run?.status).toBe("needs_recovery");
    expect(run?.lastError).toBe("Automatic recovery is disabled for this conversation mode.");
    expect(incident).toMatchObject({
      workerId,
      kind: "session_missing",
      status: "needs_user",
    });
    expect(incident?.details).toContain("\"recoveryState\":\"lost_worker_resumable\"");
    expect(incident?.details).toContain("\"recommendedAction\":\"resume_session\"");
    expect(mockStartSupervisorRun).not.toHaveBeenCalled();
  });
});
