import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
  executionEvents,
  messages,
  plans,
  queuedConversationMessages,
  runs,
  settings,
  workerCounters,
  workers,
} from "@/server/db/schema";

const {
  mockAskAgent,
  mockCancelAgentTurn,
  mockGetAgent,
  mockSpawnAgent,
} = vi.hoisted(() => ({
  mockAskAgent: vi.fn(),
  mockCancelAgentTurn: vi.fn(),
  mockGetAgent: vi.fn(),
  mockSpawnAgent: vi.fn(),
}));

vi.mock("@/server/runs/ad-hoc-plan", () => ({
  createAdHocPlan: vi.fn(() => "vibes/ad-hoc/create-steer-test.md"),
  rewriteAdHocPlan: vi.fn(),
}));

vi.mock("@/server/bridge-client", () => ({
  askAgent: mockAskAgent,
  cancelAgent: vi.fn(() => Promise.resolve()),
  cancelAgentTurn: mockCancelAgentTurn,
  getAgent: mockGetAgent,
  spawnAgent: mockSpawnAgent,
}));

import { createConversation } from "@/server/conversations/create";
import { interruptWithDraftMessage } from "@/server/conversations/queued-message-interrupt";
import {
  __resetWorkerTurnChainsForTests,
  waitForConversationBackgroundTasksForTests,
  WorkerTurnAbortedError,
} from "@/server/conversations/worker-turn-gate";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

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

describe("steering an initial direct worker turn", () => {
  beforeEach(async () => {
    mockAskAgent.mockReset();
    mockCancelAgentTurn.mockReset();
    mockCancelAgentTurn.mockResolvedValue({ ok: true, name: "worker", cancelledPermissions: 0 });
    mockGetAgent.mockReset();
    mockSpawnAgent.mockReset();
    __resetWorkerTurnChainsForTests();

    await db.delete(executionEvents);
    await db.delete(queuedConversationMessages);
    await db.delete(messages);
    await db.delete(workers);
    await db.delete(workerCounters);
    await db.delete(runs);
    await db.delete(plans);
    await db.delete(settings);
  });

  it("does not record a user-requested steer abort as an initial worker failure", async () => {
    const initialAsk = deferred<{ response: string; state: string }>();
    mockAskAgent
      .mockReturnValueOnce(initialAsk.promise)
      .mockResolvedValueOnce({ response: "I am applying the fix now.", state: "idle" });
    mockSpawnAgent.mockImplementation(async ({ name, cwd }: { name: string; cwd: string }) => ({
      ...idleSnapshot(name),
      cwd,
      state: "working",
    }));
    mockGetAgent.mockImplementation(async (workerId: string) => idleSnapshot(workerId));

    const created = await createConversation({
      mode: "direct",
      command: "Find the scrolling bug, then ask before fixing it.",
      projectPath: process.cwd(),
      preferredWorkerType: "claude",
      allowedWorkerTypes: ["claude"],
    });
    const worker = await db.select().from(workers).where(eq(workers.runId, created.runId)).get();
    expect(worker).toBeDefined();

    const steer = await interruptWithDraftMessage({
      runId: created.runId,
      targetWorkerId: worker!.id,
      content: "yes fix",
      source: "api",
    });
    initialAsk.reject(new WorkerTurnAbortedError(worker!.id, "user steer"));
    await waitForConversationBackgroundTasksForTests();

    const storedRun = await db.select().from(runs).where(eq(runs.id, created.runId)).get();
    const storedQueue = await db
      .select()
      .from(queuedConversationMessages)
      .where(eq(queuedConversationMessages.id, steer.queuedMessage.id))
      .get();
    const events = await db.select().from(executionEvents).where(eq(executionEvents.runId, created.runId));

    expect(storedRun?.status).not.toBe("failed");
    expect(storedRun?.lastError).toBeNull();
    expect(storedQueue?.status).toBe("delivered");
    expect(events.some((event) => event.eventType === "run_failed")).toBe(false);
  });
});
