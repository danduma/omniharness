/**
 * Guards the wiring for "session still shows 'needs recovery, authentication
 * required' after I authenticated and carried on".
 *
 * The recovery banner is derived from incident rows alone. Nothing used to
 * close a `needs_user` incident when the user fixed the cause themselves and
 * simply kept talking, so the row — and the banner — outlived the very turn
 * that disproved it.
 *
 * `tests/lifecycle/scenarios/recovery-stale-needs-user.test.ts` covers what
 * the sweep does to the wire. This one covers that the send path still calls
 * it: delete the call from `send-message.ts` and this fails.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
  executionEvents,
  messages,
  plans,
  queuedConversationMessages,
  recoveryIncidents,
  runs,
  settings,
  workerCounters,
  workers,
} from "@/server/db/schema";

const { mockAskAgent, mockGetAgent, mockSpawnAgent } = vi.hoisted(() => ({
  mockAskAgent: vi.fn(),
  mockGetAgent: vi.fn(),
  mockSpawnAgent: vi.fn(),
}));

vi.mock("@/server/runs/ad-hoc-plan", () => ({
  createAdHocPlan: vi.fn(() => "vibes/ad-hoc/recovery-incident-clearing-test.md"),
  rewriteAdHocPlan: vi.fn(),
}));

vi.mock("@/server/bridge-client", () => ({
  askAgent: mockAskAgent,
  cancelAgent: vi.fn(() => Promise.resolve()),
  cancelAgentTurn: vi.fn(() => Promise.resolve({ ok: true, name: "worker", cancelledPermissions: 0 })),
  getAgent: mockGetAgent,
  spawnAgent: mockSpawnAgent,
}));

import { createConversation } from "@/server/conversations/create";
import { sendConversationMessage } from "@/server/conversations/send-message";
import {
  __resetWorkerTurnChainsForTests,
  waitForConversationBackgroundTasksForTests,
} from "@/server/conversations/worker-turn-gate";
import {
  markRecoveryIncidentNeedsUser,
  openRecoveryIncident,
} from "@/server/runs/recovery-incidents";

function idleSnapshot(workerId: string) {
  return {
    name: workerId,
    type: "claude",
    cwd: process.cwd(),
    state: "idle",
    sessionId: "test-session",
    sessionMode: "full-access",
    outputEntries: [],
    renderedOutput: null,
    lastText: "",
    currentText: "",
    stderrBuffer: [],
    stopReason: null,
  };
}

describe("a healthy turn clears a stale recovery incident", () => {
  beforeEach(async () => {
    mockAskAgent.mockReset();
    mockGetAgent.mockReset();
    mockSpawnAgent.mockReset();
    __resetWorkerTurnChainsForTests();

    await db.delete(executionEvents);
    await db.delete(recoveryIncidents);
    await db.delete(queuedConversationMessages);
    await db.delete(messages);
    await db.delete(workers);
    await db.delete(workerCounters);
    await db.delete(runs);
    await db.delete(plans);
    await db.delete(settings);
  });

  it("resolves a needs_user incident when the next message goes through", async () => {
    mockAskAgent.mockResolvedValue({ response: "Done.", state: "idle" });
    mockSpawnAgent.mockImplementation(async ({ name, cwd }: { name: string; cwd: string }) => ({
      ...idleSnapshot(name),
      cwd,
      state: "working",
    }));
    mockGetAgent.mockImplementation(async (workerId: string) => idleSnapshot(workerId));

    const created = await createConversation({
      mode: "direct",
      command: "Start something.",
      projectPath: process.cwd(),
      preferredWorkerType: "claude",
      allowedWorkerTypes: ["claude"],
    });
    await waitForConversationBackgroundTasksForTests();
    const worker = await db.select().from(workers).where(eq(workers.runId, created.runId)).get();
    expect(worker).toBeDefined();

    // The interrupted-turn continuation died on expired credentials, exactly
    // as it does in the field.
    const incident = await openRecoveryIncident({
      runId: created.runId,
      workerId: worker!.id,
      kind: "session_missing",
    });
    await markRecoveryIncidentNeedsUser({
      incidentId: incident.id,
      runId: created.runId,
      workerId: worker!.id,
      reason: "Ask failed: Authentication required",
      details: { continuationFailed: true },
    });

    // The user authenticates out of band and simply carries on.
    await sendConversationMessage({
      runId: created.runId,
      content: "carry on then",
    });
    await waitForConversationBackgroundTasksForTests();

    const stored = await db
      .select()
      .from(recoveryIncidents)
      .where(eq(recoveryIncidents.id, incident.id))
      .get();
    expect(stored?.status).toBe("resolved");
    expect(stored?.resolvedAt).not.toBeNull();
    expect(stored?.lastError).toBeNull();
  });
});
