import { beforeEach, describe, expect, it, vi } from "vitest";
import { __resetNamedEventsForTests, getNamedEventsSince } from "@/server/events/named-events";
import {
  __resetGoalContinuationForTests,
  continueStalledGoals,
  GOAL_CONTINUATION_PROMPT,
  type GoalContinuationDependencies,
} from "@/server/runs/goal-worker-continuation";

const NOW = Date.parse("2026-10-05T19:00:00.000Z");

type Overrides = {
  run?: Record<string, unknown>;
  worker?: Record<string, unknown>;
  agent?: { state: string } | Error;
  undelivered?: boolean;
  quotaIncident?: boolean;
  send?: () => Promise<unknown>;
  now?: () => number;
};

function dependencies(overrides: Overrides = {}) {
  return {
    listPursuedGoals: vi.fn(async () => [{ runId: "run-1", goalId: "goal-1", workerId: "worker-1" }]),
    loadRun: vi.fn(async () => ({
      id: "run-1",
      mode: "direct",
      status: "done",
      archivedAt: null,
      lastActivityAt: new Date(NOW - 60 * 60_000),
      ...overrides.run,
    }) as never),
    loadWorker: vi.fn(async () => ({
      id: "worker-1",
      runId: "run-1",
      status: "idle",
      bridgeSessionId: "session-1",
      updatedAt: new Date(NOW - 60 * 60_000),
      ...overrides.worker,
    }) as never),
    hasUndeliveredMessages: vi.fn(async () => overrides.undelivered ?? false),
    hasResumableQuotaIncident: vi.fn(async () => overrides.quotaIncident ?? false),
    getAgent: vi.fn(async () => {
      const agent = overrides.agent ?? new Error("Get agent failed: 404 Agent not found: worker-1");
      if (agent instanceof Error) throw agent;
      return agent;
    }),
    sendContinuation: vi.fn(overrides.send ?? (async () => ({ ok: true }))),
    now: overrides.now ?? (() => NOW),
  } satisfies GoalContinuationDependencies;
}

function eventKinds() {
  return getNamedEventsSince(0).events.map((entry) => entry.event.kind);
}

describe("continueStalledGoals", () => {
  beforeEach(() => {
    __resetNamedEventsForTests();
    __resetGoalContinuationForTests();
  });

  // fc8d9cb681ef: the runner restarted (power loss) and the goal sat stalled
  // for three hours until the user asked "are you stuck".
  it("continues a pursued goal whose agent process is gone", async () => {
    const deps = dependencies();

    await expect(continueStalledGoals(deps)).resolves.toEqual({ continued: 1 });

    expect(deps.sendContinuation).toHaveBeenCalledWith("run-1", GOAL_CONTINUATION_PROMPT);
    expect(eventKinds()).toEqual(["goal.worker_continuation.started", "goal.worker_continuation.completed"]);
  });

  it("treats a stopped runtime record as a gone agent", async () => {
    const deps = dependencies({ agent: { state: "stopped" } });

    await expect(continueStalledGoals(deps)).resolves.toEqual({ continued: 1 });
  });

  it("leaves a live idle agent alone, since it is waiting for its own background work", async () => {
    const deps = dependencies({ agent: { state: "idle" } });

    await expect(continueStalledGoals(deps)).resolves.toEqual({ continued: 0 });
    expect(deps.sendContinuation).not.toHaveBeenCalled();
  });

  it("retries later when the runtime cannot answer yet", async () => {
    const deps = dependencies({ agent: new Error("connect ECONNREFUSED 127.0.0.1:7800") });

    await expect(continueStalledGoals(deps)).resolves.toEqual({ continued: 0 });
    expect(deps.sendContinuation).not.toHaveBeenCalled();
  });

  it.each([
    ["a stopped conversation", { run: { status: "cancelled" } }],
    ["an archived conversation", { run: { archivedAt: new Date(NOW) } }],
    ["a supervised run", { run: { mode: "implementation" } }],
    ["a quota wait", { run: { status: "quota_waiting" } }],
    ["a busy worker", { worker: { status: "working" } }],
    ["a cancelled worker", { worker: { status: "cancelled" } }],
    ["a quota-blocked worker", { worker: { status: "cred-exhausted" } }],
    ["a worker without a session", { worker: { bridgeSessionId: null } }],
    ["a message already on its way", { undelivered: true }],
    ["an open quota incident", { quotaIncident: true }],
    ["a conversation idle for over a day", {
      run: { lastActivityAt: new Date(NOW - 25 * 60 * 60_000) },
      worker: { updatedAt: new Date(NOW - 25 * 60 * 60_000) },
    }],
  ] as Array<[string, Overrides]>)("skips %s", async (_label, overrides) => {
    const deps = dependencies(overrides);

    await expect(continueStalledGoals(deps)).resolves.toEqual({ continued: 0 });
    expect(deps.sendContinuation).not.toHaveBeenCalled();
  });

  it("sends at most one continuation per run within the cooldown", async () => {
    let now = NOW;
    const deps = dependencies({ now: () => now });

    await continueStalledGoals(deps);
    now += 5 * 60_000;
    await continueStalledGoals(deps);
    expect(deps.sendContinuation).toHaveBeenCalledTimes(1);

    now += 6 * 60_000;
    await continueStalledGoals(deps);
    expect(deps.sendContinuation).toHaveBeenCalledTimes(2);
  });

  it("surfaces a failed continuation instead of failing silently", async () => {
    const deps = dependencies({ send: async () => { throw new Error("spawn failed"); } });

    await expect(continueStalledGoals(deps)).resolves.toEqual({ continued: 0 });

    const events = getNamedEventsSince(0).events.map((entry) => entry.event);
    expect(events).toContainEqual(expect.objectContaining({ kind: "goal.worker_continuation.failed", runId: "run-1" }));
    expect(events).toContainEqual(expect.objectContaining({
      kind: "error.surfaced",
      code: "goal.continuation.failed",
      runId: "run-1",
      workerId: "worker-1",
    }));
  });
});
