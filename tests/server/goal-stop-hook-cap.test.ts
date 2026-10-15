import { beforeEach, describe, expect, it, vi } from "vitest";
import { db, dbClient } from "@/server/db";
import { plans, runGoalOperations, runGoalOutbox, runGoals, runs, workers } from "@/server/db/schema";
import {
  initializeWorkerGoalSession,
  isStopHookBlockCapNotice,
  parkGoalAfterStopHookBlockCap,
} from "@/server/agent-runtime/acp/goal-state";
import { __resetNamedEventsForTests, getNamedEventsSince } from "@/server/events/named-events";
import { goalControl } from "@/server/runs/goal-control";
import { recoveryAction } from "@/server/runs/goal-control-dispatch";
import type { GoalSnapshot } from "@/shared/goal-plan";

const bridgeMocks = vi.hoisted(() => ({
  getAgent: vi.fn(),
  invokeAgentAcpMethod: vi.fn(),
  askAgent: vi.fn(),
}));

vi.mock("@/server/bridge-client", () => bridgeMocks);

const RUN_ID = "stop-cap-run";
const WORKER_ID = "stop-cap-worker";
const SESSION_ID = "stop-cap-session";
const CLAUDE_GOAL_CAPABILITIES = {
  set: true,
  edit: true,
  pause: false,
  resume: false,
  clear: true,
  fallbackMethod: "/goal",
};

const CAP_NOTICE = {
  sessionUpdate: "agent_message_chunk",
  content: {
    type: "text",
    text: "**Warning:** A hook blocked the turn from ending 9 consecutive times — overriding and ending turn. For Stop/SubagentStop hooks, check stop_hook_active in the input and return success while it's true. Set CLAUDE_CODE_STOP_HOOK_BLOCK_CAP to raise this limit.",
  },
  _meta: { claudeCode: { kind: "informational", level: "warning" } },
};

async function pursuedGoal(): Promise<GoalSnapshot> {
  const created = await goalControl.putGoal({
    runId: RUN_ID,
    goalId: "stop-cap-goal",
    expectedRevision: 0,
    operationId: "stop-cap-op",
    principalId: "test",
    endpoint: "goal.put",
    objective: "Finish the plans",
  });
  if (!created.ok) throw new Error(created.message);
  const attached = await goalControl.attachLease({
    runId: RUN_ID,
    goalId: created.snapshot.goalId,
    expectedRevision: created.snapshot.revision,
    workerId: WORKER_ID,
    acpSessionId: SESSION_ID,
  });
  if (!attached.ok) throw new Error(attached.message);
  const pursuing = await goalControl.applyProviderUpdate({
    runId: RUN_ID,
    goalId: attached.snapshot.goalId,
    expectedRevision: attached.snapshot.revision,
    workerId: WORKER_ID,
    acpSessionId: SESSION_ID,
    leaseGeneration: attached.snapshot.leaseGeneration,
    status: "pursuing",
    capabilities: CLAUDE_GOAL_CAPABILITIES,
  });
  if (!pursuing.ok) throw new Error(pursuing.message);
  await goalControl.markControlApplied(pursuing.snapshot, "slash");
  return pursuing.snapshot;
}

function eventKinds() {
  return getNamedEventsSince(0).events.map((entry) => entry.event.kind);
}

describe("goal stop-hook block cap", () => {
  beforeEach(async () => {
    await db.delete(runGoalOutbox);
    await db.delete(runGoalOperations);
    await db.delete(runGoals);
    await db.delete(workers);
    await db.delete(runs);
    await db.delete(plans);
    const now = Date.now();
    await dbClient.batch([
      { sql: "INSERT INTO plans (id, path, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", args: ["stop-cap-plan", "/tmp/stop-cap.md", "running", now, now] },
      { sql: "INSERT INTO runs (id, plan_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", args: [RUN_ID, "stop-cap-plan", "running", now, now] },
      { sql: "INSERT INTO workers (id, run_id, type, status, cwd, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)", args: [WORKER_ID, RUN_ID, "claude", "working", "/tmp", now, now] },
    ], "write");
    __resetNamedEventsForTests();
    bridgeMocks.getAgent.mockReset();
    bridgeMocks.invokeAgentAcpMethod.mockReset();
    bridgeMocks.askAgent.mockReset();
  });

  it("recognizes Claude's stop-hook cap warning and nothing else", () => {
    expect(isStopHookBlockCapNotice(CAP_NOTICE)).toBe(true);
    expect(isStopHookBlockCapNotice({
      sessionUpdate: "agent_message_chunk",
      content: { type: "text", text: "Still blocked on your inputs." },
    })).toBe(false);
    expect(isStopHookBlockCapNotice({ ...CAP_NOTICE, sessionUpdate: "agent_thought_chunk" })).toBe(false);
  });

  it("parks a pursued Claude goal on the user and clears it in the agent", async () => {
    await pursuedGoal();
    const dispatch = vi.fn(async () => ({ kind: "dispatched" }));

    const result = await parkGoalAfterStopHookBlockCap({ workerId: WORKER_ID, sessionId: SESSION_ID, dispatch });

    expect(result).toMatchObject({ kind: "parked", dispatch: "dispatched" });
    const goal = await goalControl.getGoal(RUN_ID);
    expect(goal).toMatchObject({ status: "waiting_user", visible: true });
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ status: "waiting_user" }), "clear");
    expect(eventKinds()).toContain("goal.parked_on_user");
  });

  it("sends /goal clear through the real dispatcher", async () => {
    await pursuedGoal();
    bridgeMocks.getAgent.mockResolvedValue({ outputEntries: [] });
    bridgeMocks.askAgent.mockImplementation(async (_workerId, _command, _attachments, options) => {
      options?.onAccepted?.();
      return {};
    });

    const result = await parkGoalAfterStopHookBlockCap({ workerId: WORKER_ID, sessionId: SESSION_ID });

    expect(result).toMatchObject({ kind: "parked", dispatch: "dispatched" });
    expect(bridgeMocks.askAgent).toHaveBeenCalledWith(WORKER_ID, "/goal clear", undefined, expect.any(Object));
    const goal = await goalControl.getGoal(RUN_ID);
    expect(goal?.status).toBe("waiting_user");
    expect(await goalControl.isControlSettled(goal!)).toBe(true);
  });

  it("ignores a cap notice from a session that does not hold the goal", async () => {
    await pursuedGoal();
    const dispatch = vi.fn(async () => ({ kind: "dispatched" }));

    const result = await parkGoalAfterStopHookBlockCap({ workerId: WORKER_ID, sessionId: "other-session", dispatch });

    expect(result).toEqual({ kind: "ignored", reason: "stale_lease" });
    expect((await goalControl.getGoal(RUN_ID))?.status).toBe("pursuing");
    expect(dispatch).not.toHaveBeenCalled();
    expect(eventKinds()).toContain("goal.park_skipped");
  });

  it("ignores a cap notice when no goal is being pursued", async () => {
    const dispatch = vi.fn(async () => ({ kind: "dispatched" }));
    const result = await parkGoalAfterStopHookBlockCap({ workerId: WORKER_ID, sessionId: SESSION_ID, dispatch });
    expect(result).toEqual({ kind: "ignored", reason: "goal_absent" });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("does not re-arm a goal waiting on the user when a new session attaches", async () => {
    await pursuedGoal();
    await parkGoalAfterStopHookBlockCap({
      workerId: WORKER_ID,
      sessionId: SESSION_ID,
      dispatch: async () => ({ kind: "dispatched" }),
    });
    bridgeMocks.getAgent.mockResolvedValue({ outputEntries: [] });
    bridgeMocks.askAgent.mockImplementation(async (_workerId, _command, _attachments, options) => {
      options?.onAccepted?.();
      return {};
    });

    const result = await initializeWorkerGoalSession(WORKER_ID, "replacement-session");

    expect(result).toMatchObject({ kind: "accepted" });
    expect(bridgeMocks.askAgent).toHaveBeenCalledTimes(1);
    expect(bridgeMocks.askAgent).toHaveBeenCalledWith(WORKER_ID, "/goal clear", undefined, expect.any(Object));
    expect((await goalControl.getGoal(RUN_ID))?.status).toBe("waiting_user");
  });

  it("resumes a parked goal by sending the objective again", async () => {
    await pursuedGoal();
    const parked = await parkGoalAfterStopHookBlockCap({
      workerId: WORKER_ID,
      sessionId: SESSION_ID,
      dispatch: async () => ({ kind: "dispatched" }),
    });
    if (parked.kind !== "parked") throw new Error("goal was not parked");
    const goal = await goalControl.getGoal(RUN_ID);

    const resumed = await goalControl.actionGoal({
      runId: RUN_ID,
      goalId: goal!.goalId,
      expectedRevision: goal!.revision,
      operationId: "stop-cap-resume",
      principalId: "test",
      endpoint: "goal.actions",
      action: "retry",
    });

    expect(resumed).toMatchObject({ ok: true, snapshot: { status: "pursuing" } });
    if (!resumed.ok) return;
    expect(recoveryAction(resumed.snapshot)).toBe("set");
  });

  it("pauses rather than clears an agent that can pause", () => {
    const base = { status: "waiting_user", capabilities: { ...CLAUDE_GOAL_CAPABILITIES } } as GoalSnapshot;
    expect(recoveryAction(base)).toBe("clear");
    expect(recoveryAction({ ...base, capabilities: { ...base.capabilities, pause: true } })).toBe("pause");
  });
});
