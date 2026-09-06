import { describe, expect, it, vi } from "vitest";
import type { GoalSnapshot } from "@/shared/goal-plan";
import { createGoalAcpDispatcher } from "@/server/runs/goal-acp";

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

describe("goal ACP control dispatch", () => {
  it("prefers the advertised extension and never also sends a slash command", async () => {
    const invokeExtension = vi.fn(async () => ({ ok: true }));
    const sendSlashCommand = vi.fn();
    const dispatcher = createGoalAcpDispatcher({
      getAgent: vi.fn(async () => ({
        agentCapabilities: { _meta: { goal: { version: 1, capabilities: { set: true, clear: true } } } },
        outputEntries: [{ type: "available_commands", raw: { availableCommands: [{ name: "goal" }] } }],
      })),
      invokeExtension,
      sendSlashCommand,
    });

    expect(await dispatcher.dispatch(snapshot(), "set")).toMatchObject({ kind: "dispatched", method: "extension" });
    expect(invokeExtension).toHaveBeenCalledWith("worker-1", "_session/goal", {
      sessionId: "session-1",
      goalId: "goal-1",
      revision: 3,
      action: "set",
      objective: "Ship it",
    });
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
    expect(sendSlashCommand).toHaveBeenCalledWith("worker-1", "/goal Ship it");
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
    expect(sendSlashCommand).toHaveBeenCalledWith("worker-1", "/goal Ship it");
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
    expect(sendSlashCommand).toHaveBeenCalledWith("worker-1", "/goal Ship it");
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
