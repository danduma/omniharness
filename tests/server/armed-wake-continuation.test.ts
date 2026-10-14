import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { plans, runs, workers } from "@/server/db/schema";
import { __resetNamedEventsForTests, getNamedEventsSince } from "@/server/events/named-events";
import {
  ARMED_WAKE_CONTINUATION_PROMPT,
  continueArmedWakeWorkers,
  defaultArmedWakeContinuationDependencies,
  persistWorkerArmedWake,
  type ArmedWakeContinuationDependencies,
} from "@/server/runs/armed-wake-continuation";
import { __resetGoalContinuationForTests } from "@/server/runs/goal-worker-continuation";

const NOW = Date.parse("2026-10-14T03:31:00.000Z");
const WAKE_AT = Date.parse("2026-10-14T03:53:18.000Z");

type Overrides = {
  agent?: { state: string } | Error;
  goalHolders?: string[];
  send?: () => Promise<unknown>;
};

function dependencies(overrides: Overrides = {}) {
  const deps = {
    listArmedWakes: vi.fn(async () => [{ runId: "dc6098ddbf64", workerId: "dc6098ddbf64-worker-1", wakeAt: WAKE_AT }]),
    listGoalHolders: vi.fn(async () => new Set(overrides.goalHolders ?? [])),
    clearArmedWake: vi.fn(async () => {}),
    loadRun: vi.fn(async () => ({
      id: "dc6098ddbf64",
      mode: "direct",
      status: "done",
      archivedAt: null,
      lastActivityAt: new Date(NOW - 40 * 60_000),
    }) as never),
    loadWorker: vi.fn(async () => ({
      id: "dc6098ddbf64-worker-1",
      runId: "dc6098ddbf64",
      status: "idle",
      bridgeSessionId: "b6a9be1b-d152-4ada-8f9f-a61263516768",
      updatedAt: new Date(NOW - 40 * 60_000),
    }) as never),
    hasUndeliveredMessages: vi.fn(async () => false),
    hasResumableQuotaIncident: vi.fn(async () => false),
    hasOpenRecoveryIncident: vi.fn(async () => false),
    getAgent: vi.fn(async () => {
      const agent = overrides.agent ?? new Error("Get agent failed: 404 Agent not found: dc6098ddbf64-worker-1");
      if (agent instanceof Error) throw agent;
      return agent;
    }),
    sendContinuation: vi.fn(overrides.send ?? (async () => ({ ok: true }))),
    now: () => NOW,
  };
  return deps as typeof deps & ArmedWakeContinuationDependencies;
}

function eventKinds() {
  return getNamedEventsSince(0).events.map((entry) => entry.event.kind);
}

describe("continueArmedWakeWorkers", () => {
  beforeEach(() => {
    __resetNamedEventsForTests();
    __resetGoalContinuationForTests();
  });

  // dc6098ddbf64: the agent armed a Monitor on its greenhorn workers, the
  // nightly restart killed it, and the workers' results sat uncollected for
  // hours until the user asked for an update.
  it("resumes an agent whose process died before its armed wake ran, then clears the wake", async () => {
    const deps = dependencies();

    await expect(continueArmedWakeWorkers(deps)).resolves.toEqual({ continued: 1 });

    expect(deps.sendContinuation).toHaveBeenCalledWith("dc6098ddbf64", ARMED_WAKE_CONTINUATION_PROMPT);
    expect(deps.clearArmedWake).toHaveBeenCalledWith("dc6098ddbf64-worker-1");
    expect(eventKinds()).toEqual([
      "worker.armed_wake_continuation.started",
      "worker.armed_wake_continuation.completed",
    ]);
  });

  it("leaves a live agent alone, since its wake can still run", async () => {
    const deps = dependencies({ agent: { state: "idle" } });

    await expect(continueArmedWakeWorkers(deps)).resolves.toEqual({ continued: 0 });
    expect(deps.sendContinuation).not.toHaveBeenCalled();
    expect(deps.clearArmedWake).not.toHaveBeenCalled();
  });

  it("leaves agents holding a goal to the goal sweep", async () => {
    const deps = dependencies({ goalHolders: ["dc6098ddbf64-worker-1"] });

    await expect(continueArmedWakeWorkers(deps)).resolves.toEqual({ continued: 0 });
    expect(deps.getAgent).not.toHaveBeenCalled();
  });

  it("sends one continuation per run within the cooldown", async () => {
    const deps = dependencies();

    await continueArmedWakeWorkers(deps);
    await expect(continueArmedWakeWorkers(deps)).resolves.toEqual({ continued: 0 });
    expect(deps.sendContinuation).toHaveBeenCalledTimes(1);
  });

  it("keeps the wake and surfaces the failure when the continuation cannot be sent", async () => {
    const deps = dependencies({ send: async () => { throw new Error("session resume failed"); } });

    await expect(continueArmedWakeWorkers(deps)).resolves.toEqual({ continued: 0 });

    expect(deps.clearArmedWake).not.toHaveBeenCalled();
    const events = getNamedEventsSince(0).events.map((entry) => entry.event);
    expect(events).toContainEqual(expect.objectContaining({
      kind: "error.surfaced",
      code: "worker.armed_wake_continuation.failed",
      runId: "dc6098ddbf64",
      workerId: "dc6098ddbf64-worker-1",
    }));
  });
});

describe("armed wake persistence", () => {
  beforeEach(() => {
    __resetNamedEventsForTests();
    __resetGoalContinuationForTests();
  });

  it("finds a stored wake after the agent is gone, continues it once and clears it", async () => {
    const now = new Date();
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    await db.insert(plans).values({ id: planId, path: "vibes/ad-hoc/armed-wake.md", status: "running", createdAt: now, updatedAt: now });
    await db.insert(runs).values({ id: runId, planId, mode: "direct", status: "done", createdAt: now, updatedAt: now });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "claude",
      status: "idle",
      cwd: "/tmp",
      workerNumber: 1,
      bridgeSessionId: "session-1",
      createdAt: now,
      updatedAt: now,
    });
    const wakeAt = now.getTime() + 30 * 60_000;
    await persistWorkerArmedWake(workerId, wakeAt);
    const sendContinuation = vi.fn(async () => ({ ok: true }));
    const deps = {
      ...defaultArmedWakeContinuationDependencies,
      listArmedWakes: async () => (await defaultArmedWakeContinuationDependencies.listArmedWakes())
        .filter((lease) => lease.runId === runId),
      listGoalHolders: async () => new Set<string>(),
      hasResumableQuotaIncident: async () => false,
      getAgent: async () => { throw new Error(`Get agent failed: 404 Agent not found: ${workerId}`); },
      sendContinuation,
    } satisfies ArmedWakeContinuationDependencies;

    await expect(deps.listArmedWakes()).resolves.toEqual([{ runId, workerId, wakeAt }]);
    await expect(continueArmedWakeWorkers(deps)).resolves.toEqual({ continued: 1 });

    expect(sendContinuation).toHaveBeenCalledWith(runId, ARMED_WAKE_CONTINUATION_PROMPT);
    const stored = await db.select({ armedWakeAt: workers.armedWakeAt }).from(workers).where(eq(workers.id, workerId)).get();
    expect(stored?.armedWakeAt).toBeNull();
    await expect(deps.listArmedWakes()).resolves.toEqual([]);
  });
});
