import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetNamedEventsForTests, getNamedEventsSince, type NamedEvent } from "@/server/events/named-events";
import {
  __resetWakeSuppressionsForTests,
  gateSupervisorWake,
  isSuppressibleWake,
  noteSupervisorWoken,
  WAKE_DEFER_MS,
  WAKE_SUPPRESS_MAX_CONSECUTIVE,
  WAKE_SUPPRESS_MAX_WINDOW_MS,
} from "@/server/decisions/points/supervisor-wake";
import { buildWorkerActivityShadow, WORKER_ACTIVITY_ACT_CONFIDENCE } from "@/server/decisions/points/worker-activity";
import { __resetShadowSamplingForTests, runShadowDecision } from "@/server/decisions/shadow";
import type { DecisionOutcome } from "@/server/decisions/service";
import { DecisionService } from "@/server/decisions/service";
import type { DecisionLayerConfig } from "@/server/decisions/config";
import { createMockDecisionProvider } from "@/server/decisions/mock-provider";
import type { DecisionResult } from "@/server/decisions/types";
import { __resetWorkerActivityForTests, observeWorkerActivity, refineWorkerActivity } from "@/server/workers/activity-tracker";
import { deriveWorkerEvents } from "@/server/supervisor/observer";

function events() {
  return getNamedEventsSince(0).events.map((entry) => entry.event as NamedEvent);
}

function answered(answers: DecisionResult["answers"], shadow: boolean): Extract<DecisionOutcome, { status: "answered" }> {
  return {
    status: "answered",
    requestId: "req-1",
    shadow,
    result: { answers, model: "typesafe-ai/jev", escalated: false, triggeredBy: [], usage: { inputTokens: 1, outputTokens: 1 }, costUsd: 0 },
  };
}

const noLog = { appendLog: async () => undefined };

beforeEach(() => {
  __resetNamedEventsForTests();
  __resetShadowSamplingForTests();
  __resetWakeSuppressionsForTests();
  __resetWorkerActivityForTests();
});

describe("refineWorkerActivity", () => {
  it("relabels only the activity derived from that exact entry", () => {
    observeWorkerActivity("run", "w", [{ type: "tool_call", text: "make check", toolKind: "execute", seq: 4 }]);
    expect(refineWorkerActivity("run", "w", 3, "testing")).toBe(false);
    expect(refineWorkerActivity("run", "w", 4, "executing")).toBe(false);
    expect(refineWorkerActivity("run", "w", 4, "testing")).toBe(true);

    const activity = events().filter((event) => event.kind === "worker.activity");
    expect(activity.at(-1)).toMatchObject({ activity: "testing", prev: "executing", source: "decision_model", entrySeq: 4 });

    // Newer work makes the old entry stale.
    observeWorkerActivity("run", "w", [{ type: "tool_call", text: "Edit a.ts", toolKind: "edit", seq: 5 }]);
    expect(refineWorkerActivity("run", "w", 4, "executing")).toBe(false);
  });
});

describe("worker_activity acting", () => {
  function shadowFor(refine = vi.fn().mockReturnValue(true)) {
    return { refine, shadow: buildWorkerActivityShadow({ runId: "run", workerId: "w", command: "make check", entrySeq: 4, refine })! };
  }

  it("refines on a confident disagreement when allowed to act", async () => {
    const { refine, shadow } = shadowFor();
    const service = { decide: vi.fn().mockResolvedValue(answered({ commandKind: { type: "choice", choice: "testing", confidence: WORKER_ACTIVITY_ACT_CONFIDENCE } }, false)) };
    await runShadowDecision(shadow, { service, ...noLog });
    expect(refine).toHaveBeenCalledWith("run", "w", 4, "testing");
    expect(events()).toContainEqual(expect.objectContaining({ kind: "decision.acted", action: "refined_activity", from: "executing", to: "testing" }));
  });

  it.each([
    ["in shadow mode", answered({ commandKind: { type: "choice", choice: "testing", confidence: 0.99 } }, true)],
    ["below the confidence bar", answered({ commandKind: { type: "choice", choice: "testing", confidence: 0.5 } }, false)],
    ["when it agrees", answered({ commandKind: { type: "choice", choice: "executing", confidence: 0.99 } }, false)],
  ])("does not act %s", async (_label, outcome) => {
    const { refine, shadow } = shadowFor();
    await runShadowDecision(shadow, { service: { decide: vi.fn().mockResolvedValue(outcome) }, ...noLog });
    expect(refine).not.toHaveBeenCalled();
    expect(events().some((event) => event.kind === "decision.acted")).toBe(false);
  });
});

describe("supervisor_wake acting", () => {
  const heuristicIdle = { type: "worker_idle", summary: "idle 31s", shouldWakeSupervisor: true, wakeCertainty: "heuristic" as const };
  const question = { type: "worker_elicitation_requested", summary: "asks", shouldWakeSupervisor: true };
  const input = {
    runId: "run",
    workerId: "w",
    runStatus: "running",
    workerState: "working",
    stopReason: null,
    events: [heuristicIdle],
    recentOutput: "still compiling...",
  };

  function service(mode: "off" | "shadow" | "acting", probability = 0.05) {
    return {
      pointMode: vi.fn().mockResolvedValue(mode),
      decide: vi.fn().mockResolvedValue(answered({ needsSupervisor: { type: "boolean", probability } }, mode !== "acting")),
    };
  }

  it("only considers wakes whose every reason is heuristic", () => {
    expect(isSuppressibleWake([heuristicIdle])).toBe(true);
    expect(isSuppressibleWake([heuristicIdle, question])).toBe(false);
    expect(isSuppressibleWake([{ type: "worker_output_changed", summary: "x", shouldWakeSupervisor: false }])).toBe(false);
  });

  it("never consults the layer for protocol wakes or when the point is not acting", async () => {
    const protocol = service("acting");
    expect(await gateSupervisorWake({ ...input, events: [heuristicIdle, question] }, { service: protocol, ...noLog })).toEqual({ delayMs: 0, consulted: false });
    expect(protocol.pointMode).not.toHaveBeenCalled();

    const shadow = service("shadow");
    expect(await gateSupervisorWake(input, { service: shadow, ...noLog })).toEqual({ delayMs: 0, consulted: false });
    expect(shadow.decide).not.toHaveBeenCalled();
  });

  it("defers (never drops) a heuristic wake on a confident no, and records the action", async () => {
    const svc = service("acting", 0.05);
    expect(await gateSupervisorWake(input, { service: svc, ...noLog })).toEqual({ delayMs: WAKE_DEFER_MS, consulted: true });
    expect(events()).toContainEqual(expect.objectContaining({ kind: "decision.acted", point: "supervisor_wake", action: "deferred_wake", from: "wake", to: "no_wake" }));
  });

  it("wakes now on an unsure or positive answer, a fallback, or a thrown error", async () => {
    expect(await gateSupervisorWake(input, { service: service("acting", 0.3), ...noLog })).toEqual({ delayMs: 0, consulted: true });
    expect(await gateSupervisorWake(input, { service: service("acting", 0.9), ...noLog })).toEqual({ delayMs: 0, consulted: true });
    const fallback = { pointMode: vi.fn().mockResolvedValue("acting"), decide: vi.fn().mockResolvedValue({ status: "fallback", requestId: "r", reason: "timeout" }) };
    expect(await gateSupervisorWake(input, { service: fallback, ...noLog })).toEqual({ delayMs: 0, consulted: true });
    const thrown = { pointMode: vi.fn().mockResolvedValue("acting"), decide: vi.fn().mockRejectedValue(new Error("boom")) };
    expect(await gateSupervisorWake(input, { service: thrown, ...noLog })).toEqual({ delayMs: 0, consulted: true });
  });

  it("forces an immediate wake after the maximum consecutive deferrals", async () => {
    const svc = service("acting", 0.05);
    for (let index = 0; index < WAKE_SUPPRESS_MAX_CONSECUTIVE; index += 1) {
      expect((await gateSupervisorWake(input, { service: svc, ...noLog })).delayMs).toBe(WAKE_DEFER_MS);
    }
    expect(await gateSupervisorWake(input, { service: svc, ...noLog })).toEqual({ delayMs: 0, consulted: false });
    expect(events()).toContainEqual(expect.objectContaining({ kind: "decision.overridden", point: "supervisor_wake", by: "watchdog" }));
    // The streak restarts after the forced wake.
    expect((await gateSupervisorWake(input, { service: svc, ...noLog })).delayMs).toBe(WAKE_DEFER_MS);
  });

  it("forces a wake once deferrals span the time window, and resets after a real wake", async () => {
    let clock = 0;
    const svc = service("acting", 0.05);
    const deps = { service: svc, now: () => clock, ...noLog };
    expect((await gateSupervisorWake(input, deps)).delayMs).toBe(WAKE_DEFER_MS);
    clock += WAKE_SUPPRESS_MAX_WINDOW_MS;
    expect((await gateSupervisorWake(input, deps)).delayMs).toBe(0);

    expect((await gateSupervisorWake(input, deps)).delayMs).toBe(WAKE_DEFER_MS);
    noteSupervisorWoken("run", "w");
    clock += WAKE_SUPPRESS_MAX_WINDOW_MS;
    expect((await gateSupervisorWake(input, deps)).delayMs).toBe(WAKE_DEFER_MS);
  });
});

describe("observer wake certainty", () => {
  const base = { state: "working", currentText: "", lastText: "", pendingPermissions: [], stderrBuffer: [], stopReason: null };

  it("marks idle and long-text completion wakes as heuristic, and clean turn ends as certain", () => {
    const first = deriveWorkerEvents({ workerId: "w", snapshot: { ...base, currentText: "a" } as never, previous: undefined, now: 0 });
    const idle = deriveWorkerEvents({ workerId: "w", snapshot: { ...base, currentText: "a" } as never, previous: first.nextState, now: 31_000 });
    expect(idle.events.find((event) => event.type === "worker_idle")?.wakeCertainty).toBe("heuristic");

    const finished = deriveWorkerEvents({ workerId: "w", snapshot: { ...base, state: "idle", currentText: "done" } as never, previous: first.nextState, now: 1_000 });
    const completed = finished.events.find((event) => event.type === "worker_turn_completed");
    expect(completed?.shouldWakeSupervisor).toBe(true);
    expect(completed?.wakeCertainty).toBeUndefined();
  });
});

describe("DecisionService.pointMode", () => {
  const cfg = (overrides: Partial<DecisionLayerConfig>): DecisionLayerConfig => ({
    enabled: true,
    model: "typesafe-ai/jev",
    escalationModel: null,
    zeroDataRetention: false,
    points: new Set(["supervisor_wake"]),
    actingPoints: new Set(),
    textModel: null,
    textTasks: new Set(),
    apiKey: "vck_TESTONLY_placeholder_0000",
    baseUrl: null,
    ...overrides,
  });
  const make = (config: DecisionLayerConfig) => new DecisionService({ loadConfig: async () => config, createProvider: () => createMockDecisionProvider(), env: {} });

  it("reports off, shadow, or acting without calling the provider", async () => {
    expect(await make(cfg({ enabled: false })).pointMode("supervisor_wake")).toBe("off");
    expect(await make(cfg({ apiKey: null })).pointMode("supervisor_wake")).toBe("off");
    expect(await make(cfg({})).pointMode("supervisor_wake")).toBe("shadow");
    expect(await make(cfg({ actingPoints: new Set(["supervisor_wake"]) })).pointMode("supervisor_wake")).toBe("acting");
    const broken = new DecisionService({ loadConfig: async () => { throw new Error("db down"); }, env: {} });
    expect(await broken.pointMode("supervisor_wake")).toBe("off");
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
