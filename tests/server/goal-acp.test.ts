import { afterEach, describe, expect, it, vi } from "vitest";
import type { GoalSnapshot } from "@/shared/goal-plan";
import { __resetNamedEventsForTests, getNamedEventsSince } from "@/server/events/named-events";
import { createGoalAcpDispatcher, GOAL_EXTENSION_ACCEPTANCE_WINDOW_MS } from "@/server/runs/goal-acp";

function snapshot(overrides: Partial<GoalSnapshot> = {}): GoalSnapshot {
  return {
    schemaVersion: 1,
    runId: "run-1",
    goalId: "goal-1",
    revision: 3,
    leaseGeneration: 1,
    objective: "Ship it",
    status: "pursuing",
    startedAt: "2026-08-10T10:00:00.000Z",
    pausedAt: null,
    resumedAt: null,
    completedAt: null,
    clearedAt: null,
    updatedAt: "2026-08-10T10:00:00.000Z",
    workerId: "worker-1",
    acpSessionId: "session-1",
    plan: [],
    planSource: { kind: "none" },
    capabilities: { set: true, edit: true, pause: true, resume: true, clear: true, fallbackMethod: null },
    lastError: null,
    validationState: null,
    visible: true,
    provenance: { source: "server", complete: true, eventCursor: null },
    ...overrides,
  };
}

const codexCapabilities = { set: true, edit: true, pause: true, resume: true, clear: true, fallbackMethod: "/goal" };

function codexAgent() {
  return {
    agentCapabilities: { _meta: { goal: { version: 1, capabilities: { set: true, pause: true, resume: true, clear: true } } } },
    outputEntries: [{ type: "available_commands", raw: { availableCommands: [{ name: "goal" }] } }],
  };
}

function failedAfterAcceptanceEvents() {
  return getNamedEventsSince(null).events
    .map((entry) => entry.event)
    .filter((event) => event.kind === "goal.control.failed_after_acceptance");
}

afterEach(() => {
  vi.useRealTimers();
  __resetNamedEventsForTests();
});

describe("goal ACP control dispatch", () => {
  it("controls a goal that runs no turn over the extension even when /goal is advertised", async () => {
    const invokeExtension = vi.fn(async () => ({ ok: true }));
    const sendSlashCommand = vi.fn();
    const dispatcher = createGoalAcpDispatcher({
      getAgent: vi.fn(async () => codexAgent()),
      invokeExtension,
      sendSlashCommand,
    });

    expect(await dispatcher.dispatch(snapshot({ capabilities: codexCapabilities }), "pause"))
      .toMatchObject({ kind: "dispatched", method: "extension" });
    expect(invokeExtension).toHaveBeenCalledWith("worker-1", "_session/goal", {
      sessionId: "session-1",
      goalId: "goal-1",
      revision: 3,
      action: "pause",
    });
    expect(sendSlashCommand).not.toHaveBeenCalled();
  });

  it("resumes through /goal so the runtime tracks the turn the resume starts", async () => {
    // codex-acp forwards a turn's output only for turns a prompt started. A
    // resume over `_session/goal` ran with no visible output, the worker read
    // as idle while Codex worked, and the call answered only when the turn ended.
    const invokeExtension = vi.fn();
    const sendSlashCommand = vi.fn(async () => ({ ok: true }));
    const dispatcher = createGoalAcpDispatcher({
      getAgent: vi.fn(async () => codexAgent()),
      invokeExtension,
      sendSlashCommand,
    });

    expect(await dispatcher.dispatch(snapshot({ status: "paused", capabilities: codexCapabilities }), "resume"))
      .toMatchObject({ kind: "dispatched", method: "slash" });
    expect(sendSlashCommand).toHaveBeenCalledWith("worker-1", "/goal resume", expect.anything());
    expect(invokeExtension).not.toHaveBeenCalled();
  });

  it("sets an objective through /goal when the agent offers both channels", async () => {
    const invokeExtension = vi.fn();
    const sendSlashCommand = vi.fn(async () => ({ ok: true }));
    const dispatcher = createGoalAcpDispatcher({
      getAgent: vi.fn(async () => codexAgent()),
      invokeExtension,
      sendSlashCommand,
    });

    expect(await dispatcher.dispatch(snapshot(), "set")).toMatchObject({ kind: "dispatched", method: "slash" });
    expect(sendSlashCommand).toHaveBeenCalledWith("worker-1", "/goal Ship it", expect.anything());
    expect(invokeExtension).not.toHaveBeenCalled();
  });

  it("sets an objective too long for /goal over the extension", async () => {
    const invokeExtension = vi.fn(async () => ({ ok: true }));
    const sendSlashCommand = vi.fn();
    const dispatcher = createGoalAcpDispatcher({
      getAgent: vi.fn(async () => codexAgent()),
      invokeExtension,
      sendSlashCommand,
    });
    const objective = "x".repeat(4_001);

    expect(await dispatcher.dispatch(snapshot({ objective }), "set")).toMatchObject({ kind: "dispatched", method: "extension" });
    expect(invokeExtension).toHaveBeenCalledWith("worker-1", "_session/goal", expect.objectContaining({ action: "set", objective }));
    expect(sendSlashCommand).not.toHaveBeenCalled();
  });

  it("returns once the runtime accepts /goal instead of waiting for the goal's turn to end", async () => {
    let failTurn: (error: Error) => void = () => {};
    const sendSlashCommand = vi.fn((_workerId: string, _command: string, options?: { onAccepted?: () => void }) => {
      options?.onAccepted?.();
      return new Promise<unknown>((_resolve, reject) => {
        failTurn = reject;
      });
    });
    const dispatcher = createGoalAcpDispatcher({
      getAgent: vi.fn(async () => codexAgent()),
      invokeExtension: vi.fn(),
      sendSlashCommand,
    });

    expect(await dispatcher.dispatch(snapshot({ capabilities: codexCapabilities }), "resume"))
      .toEqual({ kind: "dispatched", method: "slash" });

    failTurn(new Error("Ask failed: stream closed"));
    await vi.waitFor(() => expect(failedAfterAcceptanceEvents()).toEqual([
      expect.objectContaining({ runId: "run-1", goalId: "goal-1", workerId: "worker-1", action: "resume", method: "slash" }),
    ]));
  });

  it("counts a turn-starting extension call that stays unanswered as accepted", async () => {
    vi.useFakeTimers();
    const invokeExtension = vi.fn(() => new Promise<unknown>(() => {}));
    const dispatcher = createGoalAcpDispatcher({
      getAgent: vi.fn(async () => ({
        agentCapabilities: { _meta: { goal: { version: 1, capabilities: { set: true, resume: true } } } },
      })),
      invokeExtension,
      sendSlashCommand: vi.fn(),
    });

    const dispatched = dispatcher.dispatch(snapshot({ status: "paused" }), "resume");
    await vi.advanceTimersByTimeAsync(GOAL_EXTENSION_ACCEPTANCE_WINDOW_MS);

    await expect(dispatched).resolves.toEqual({ kind: "dispatched", method: "extension" });
    expect(failedAfterAcceptanceEvents()).toEqual([]);
  });

  it("still waits for a pause the extension has not answered", async () => {
    vi.useFakeTimers();
    let settled = false;
    const dispatcher = createGoalAcpDispatcher({
      getAgent: vi.fn(async () => ({
        agentCapabilities: { _meta: { goal: { version: 1, capabilities: { pause: true } } } },
      })),
      invokeExtension: vi.fn(() => new Promise<unknown>(() => {})),
      sendSlashCommand: vi.fn(),
    });

    void dispatcher.dispatch(snapshot(), "pause").then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(GOAL_EXTENSION_ACCEPTANCE_WINDOW_MS * 2);

    expect(settled).toBe(false);
  });

  it("edits through native set when the extension advertises set without edit", async () => {
    const invokeExtension = vi.fn(async () => ({ ok: true }));
    const sendSlashCommand = vi.fn();
    const dispatcher = createGoalAcpDispatcher({
      getAgent: vi.fn(async () => ({ agentCapabilities: {
        _meta: { goal: { version: 1, actions: ["set", "pause", "resume", "clear"] } },
      } })),
      invokeExtension, sendSlashCommand,
    });
    expect(await dispatcher.dispatch(snapshot(), "edit")).toMatchObject({ kind: "dispatched", method: "extension" });
    expect(invokeExtension).toHaveBeenCalledWith("worker-1", "_session/goal", expect.objectContaining({ action: "set", objective: "Ship it" }));
    expect(sendSlashCommand).not.toHaveBeenCalled();
  });

  it("uses slash fallback only when the extension is absent and the command is advertised", async () => {
    const invokeExtension = vi.fn();
    const sendSlashCommand = vi.fn(async () => ({ ok: true }));
    const dispatcher = createGoalAcpDispatcher({
      getAgent: vi.fn(async () => ({
        agentCapabilities: {},
        outputEntries: [{ type: "available_commands", raw: { availableCommands: [{ name: "goal" }] } }],
      })),
      invokeExtension,
      sendSlashCommand,
    });

    expect(await dispatcher.dispatch(snapshot(), "edit")).toMatchObject({ kind: "dispatched", method: "slash" });
    expect(sendSlashCommand).toHaveBeenCalledWith("worker-1", "/goal Ship it", expect.anything());
    expect(invokeExtension).not.toHaveBeenCalled();
  });

  it("refuses an action neither channel advertises", async () => {
    const sendSlashCommand = vi.fn();
    const invokeExtension = vi.fn();
    const noCapability = createGoalAcpDispatcher({
      getAgent: vi.fn(async () => ({ agentCapabilities: {}, outputEntries: [] })),
      invokeExtension,
      sendSlashCommand,
    });

    expect(await noCapability.dispatch(snapshot(), "set")).toMatchObject({ kind: "unsupported" });
    expect(invokeExtension).not.toHaveBeenCalled();
    expect(sendSlashCommand).not.toHaveBeenCalled();
  });

  it("falls back to the slash command when the extension declines the action", async () => {
    // Codex is this agent: it announces goals over the extension while
    // reporting every capability false, and separately advertises `/goal`.
    // Refusing on the extension's answer alone left its goals unresumable.
    const sendSlashCommand = vi.fn(async () => ({ ok: true }));
    const invokeExtension = vi.fn();
    const dispatcher = createGoalAcpDispatcher({
      getAgent: vi.fn(async () => ({
        agentCapabilities: { _meta: { goal: { version: 1, capabilities: {} } } },
        outputEntries: [{ type: "available_commands", raw: { availableCommands: [{ name: "goal" }] } }],
      })),
      invokeExtension,
      sendSlashCommand,
    });

    expect(await dispatcher.dispatch(snapshot({ status: "blocked" }), "retry"))
      .toMatchObject({ kind: "dispatched", method: "slash" });
    expect(sendSlashCommand).toHaveBeenCalledWith("worker-1", "/goal Ship it", expect.anything());
    expect(invokeExtension).not.toHaveBeenCalled();
  });

  it("defers safely when there is no active worker lease", async () => {
    const dispatcher = createGoalAcpDispatcher({
      getAgent: vi.fn(), invokeExtension: vi.fn(), sendSlashCommand: vi.fn(),
    });
    expect(await dispatcher.dispatch(snapshot({ workerId: null, acpSessionId: null }), "set")).toEqual({
      kind: "deferred",
      reason: "no_active_lease",
    });
  });

  it("defers when the lease names a worker the runtime no longer hosts", async () => {
    const invokeExtension = vi.fn();
    const sendSlashCommand = vi.fn();
    const dispatcher = createGoalAcpDispatcher({
      getAgent: vi.fn(async () => {
        throw Object.assign(new Error("Get agent failed: not_found"), { status: 404 });
      }),
      invokeExtension,
      sendSlashCommand,
    });

    expect(await dispatcher.dispatch(snapshot(), "set")).toEqual({ kind: "deferred", reason: "no_active_lease" });
    expect(invokeExtension).not.toHaveBeenCalled();
    expect(sendSlashCommand).not.toHaveBeenCalled();
  });

  it("defers the slash fallback while the agent is mid-turn instead of failing the goal", async () => {
    // A slash fallback is a prompt, and the runtime refuses a prompt while the
    // agent is working. Recording that as a transport failure burned the goal
    // into `error`, and every retry pressed during the turn repeated it.
    const sendSlashCommand = vi.fn(async () => {
      throw new Error("Ask failed: Agent is busy: worker-1");
    });
    const dispatcher = createGoalAcpDispatcher({
      getAgent: vi.fn(async () => ({
        agentCapabilities: {},
        outputEntries: [{ type: "available_commands", raw: { availableCommands: [{ name: "goal" }] } }],
      })),
      invokeExtension: vi.fn(),
      sendSlashCommand,
    });

    expect(await dispatcher.dispatch(snapshot({ status: "error" }), "retry")).toEqual({
      kind: "deferred",
      reason: "worker_busy",
    });
    expect(sendSlashCommand).toHaveBeenCalledWith("worker-1", "/goal Ship it", expect.anything());
  });

  it("defers an extension dispatch the runtime refuses because the agent is busy", async () => {
    const invokeExtension = vi.fn(async () => {
      throw new Error("Agent is busy: worker-1");
    });
    const dispatcher = createGoalAcpDispatcher({
      getAgent: vi.fn(async () => ({
        agentCapabilities: { _meta: { goal: { version: 1, capabilities: { set: true } } } },
      })),
      invokeExtension,
      sendSlashCommand: vi.fn(),
    });

    expect(await dispatcher.dispatch(snapshot(), "set")).toEqual({ kind: "deferred", reason: "worker_busy" });
  });

  it("still fails a slash fallback that broke for any other reason", async () => {
    const dispatcher = createGoalAcpDispatcher({
      getAgent: vi.fn(async () => ({
        agentCapabilities: {},
        outputEntries: [{ type: "available_commands", raw: { availableCommands: [{ name: "goal" }] } }],
      })),
      invokeExtension: vi.fn(),
      sendSlashCommand: vi.fn(async () => {
        throw new Error("Ask failed: fetch failed (caused by: read ECONNRESET)");
      }),
    });

    await expect(dispatcher.dispatch(snapshot(), "set")).rejects.toThrow(/ECONNRESET/);
  });

  it("rethrows a transport failure so it is not mistaken for a missing worker", async () => {
    const dispatcher = createGoalAcpDispatcher({
      getAgent: vi.fn(async () => {
        throw new Error("Get agent failed: fetch failed (caused by: read ECONNRESET)");
      }),
      invokeExtension: vi.fn(),
      sendSlashCommand: vi.fn(),
    });

    await expect(dispatcher.dispatch(snapshot(), "set")).rejects.toThrow(/ECONNRESET/);
  });

  it("uses recorded fallback capabilities when the rolling output buffer lost the command frame", async () => {
    const sendSlashCommand = vi.fn(async () => ({ ok: true }));
    const dispatcher = createGoalAcpDispatcher({
      getAgent: vi.fn(async () => ({ agentCapabilities: {}, outputEntries: [{ type: "message", raw: {} }] })),
      invokeExtension: vi.fn(),
      sendSlashCommand,
    });

    const resumed = snapshot({
      capabilities: { set: true, edit: true, pause: false, resume: false, clear: true, fallbackMethod: "/goal" },
    });
    expect(await dispatcher.dispatch(resumed, "set")).toMatchObject({ kind: "dispatched", method: "slash" });
    expect(sendSlashCommand).toHaveBeenCalledWith("worker-1", "/goal Ship it", expect.anything());
  });

  it("still refuses an action the recorded fallback capabilities do not cover", async () => {
    const sendSlashCommand = vi.fn();
    const dispatcher = createGoalAcpDispatcher({
      getAgent: vi.fn(async () => ({ agentCapabilities: {}, outputEntries: [] })),
      invokeExtension: vi.fn(),
      sendSlashCommand,
    });

    const resumed = snapshot({
      capabilities: { set: true, edit: true, pause: false, resume: false, clear: true, fallbackMethod: "/goal" },
    });
    expect(await dispatcher.dispatch(resumed, "pause")).toMatchObject({ kind: "unsupported" });
    expect(sendSlashCommand).not.toHaveBeenCalled();
  });

  it("reapplies retry as a supported set operation", async () => {
    const invokeExtension = vi.fn(async () => ({ ok: true }));
    const dispatcher = createGoalAcpDispatcher({
      getAgent: vi.fn(async () => ({
        agentCapabilities: { _meta: { goal: { version: 1, capabilities: { set: true } } } },
      })),
      invokeExtension,
      sendSlashCommand: vi.fn(),
    });

    expect(await dispatcher.dispatch(snapshot({ status: "error" }), "retry")).toMatchObject({
      kind: "dispatched",
      method: "extension",
    });
    expect(invokeExtension).toHaveBeenCalledWith("worker-1", "_session/goal", expect.objectContaining({
      action: "set",
      objective: "Ship it",
    }));
  });
});
