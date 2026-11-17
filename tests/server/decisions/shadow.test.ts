import { promises as fs } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { settings } from "@/server/db/schema";
import { __resetNamedEventsForTests, getNamedEventsSince, type NamedEvent } from "@/server/events/named-events";
import { runShadowDecision, shadowDecisionLogPath, __resetShadowSamplingForTests, type ShadowDecisionArgs, type ShadowDecisionLogRecord } from "@/server/decisions/shadow";
import { buildSupervisorWakeShadow, shadowSupervisorWake } from "@/server/decisions/points/supervisor-wake";
import { buildWorkerActivityShadow, shadowWorkerActivity } from "@/server/decisions/points/worker-activity";
import { summarizeShadowDecisions, parseShadowLog } from "@/server/decisions/shadow-report";
import type { DecisionOutcome } from "@/server/decisions/service";
import type { DecisionResult } from "@/server/decisions/types";
import { __resetOutputStoreCachesForTests, writeWorkerOutputEntries } from "@/server/workers/output-store";
import { __resetWorkerActivityForTests } from "@/server/workers/activity-tracker";
import { DECISION_SETTING_KEYS } from "@/shared/decision-layer";

function events() {
  return getNamedEventsSince(0).events.map((entry) => entry.event as NamedEvent);
}

function answered(answers: DecisionResult["answers"], requestId = "req-1"): DecisionOutcome {
  return {
    status: "answered",
    requestId,
    shadow: true,
    result: { answers, model: "typesafe-ai/jev", escalated: false, triggeredBy: [], usage: { inputTokens: 1, outputTokens: 1 }, costUsd: 0.00001 },
  };
}

const wakeInput = {
  runId: "run-1",
  workerId: "worker-1",
  runStatus: "running",
  workerState: "working",
  stopReason: null,
  events: [{ type: "worker_output_changed", summary: "worker-1 output changed" }],
  recentOutput: "Editing src/a.ts",
  woke: false,
};

beforeEach(() => {
  __resetNamedEventsForTests();
  __resetShadowSamplingForTests();
});

describe("runShadowDecision", () => {
  function args(overrides: Partial<ShadowDecisionArgs> = {}): ShadowDecisionArgs {
    return { ...buildSupervisorWakeShadow(wakeInput), ...overrides };
  }

  it("records the comparison as an event and a log line without any state", async () => {
    const logged: ShadowDecisionLogRecord[] = [];
    const service = { decide: vi.fn().mockResolvedValue(answered({ needsSupervisor: { type: "boolean", probability: 0.9 } })) };
    await runShadowDecision(args(), { service, appendLog: async (record) => { logged.push(record); } });

    const compared = events().filter((event) => event.kind === "decision.shadow_compared");
    expect(compared).toEqual([expect.objectContaining({
      point: "supervisor_wake", heuristic: "no_wake", decided: "wake", agree: false, sampledOut: 0, runId: "run-1", workerId: "worker-1",
    })]);
    expect((compared[0] as { confidence: number }).confidence).toBeCloseTo(0.8);
    expect(logged).toEqual([expect.objectContaining({ requestId: "req-1", heuristic: "no_wake", decided: "wake", agree: false, model: "typesafe-ai/jev" })]);
    expect(JSON.stringify(logged)).not.toContain("Editing src/a.ts");
  });

  it("samples per key, counts what it skipped, and always samples the rarer outcome", async () => {
    let clock = 1_000;
    const service = { decide: vi.fn().mockResolvedValue(answered({ needsSupervisor: { type: "boolean", probability: 0.1 } })) };
    const deps = { service, now: () => clock, appendLog: async () => undefined };

    await runShadowDecision(args(), deps);
    expect(runShadowDecision(args(), deps)).toBeNull();
    expect(runShadowDecision(args(), deps)).toBeNull();
    await runShadowDecision(args({ alwaysSample: true }), deps);
    clock += args().minIntervalMs;
    await runShadowDecision(args(), deps);

    expect(service.decide).toHaveBeenCalledTimes(3);
    const sampledOut = events().filter((event) => event.kind === "decision.shadow_compared").map((event) => (event as { sampledOut: number }).sampledOut);
    expect(sampledOut).toEqual([0, 2, 0]);
  });

  it("stays silent on skipped or fallback outcomes and never throws into the caller", async () => {
    await runShadowDecision(args(), { service: { decide: async () => ({ status: "skipped", reason: "disabled" }) } });
    __resetShadowSamplingForTests();
    await runShadowDecision(args(), { service: { decide: async () => ({ status: "fallback", requestId: "r", reason: "timeout" }) } });
    __resetShadowSamplingForTests();
    await expect(runShadowDecision(args(), { service: { decide: async () => { throw new Error("boom"); } } })).resolves.toBeUndefined();
    expect(events().filter((event) => event.kind === "decision.shadow_compared")).toEqual([]);
  });

  it("reports a failed log write with a redacted reason", async () => {
    const service = { decide: vi.fn().mockResolvedValue(answered({ needsSupervisor: { type: "boolean", probability: 0.2 } })) };
    await runShadowDecision(args(), {
      service,
      appendLog: async () => { throw new Error("EACCES: permission denied, open '/Users/someone/omni/decision-log/x.jsonl'"); },
    });
    const failed = events().find((event) => event.kind === "decision.log_failed") as { reason: string } | undefined;
    expect(failed?.reason).toContain("EACCES");
    expect(failed?.reason).not.toContain("/Users/someone");
  });
});

describe("decision points", () => {
  it("supervisor_wake maps the heuristic and answer onto wake / no_wake", () => {
    const woke = buildSupervisorWakeShadow({ ...wakeInput, woke: true });
    expect(woke.heuristic).toBe("wake");
    expect(woke.alwaysSample).toBe(true);
    const borderline = answered({ needsSupervisor: { type: "boolean", probability: 0.5 } }) as Extract<DecisionOutcome, { status: "answered" }>;
    expect(woke.interpret(borderline.result)).toEqual({ decided: "wake", confidence: 0 });
    expect(shadowSupervisorWake({ ...wakeInput, events: [] })).toBeNull();
  });

  it("worker_activity compares only commands, using the latest one in the batch", async () => {
    expect(buildWorkerActivityShadow({ runId: "r", workerId: "w", command: "pnpm test:lifecycle" })?.heuristic).toBe("testing");
    expect(buildWorkerActivityShadow({ runId: "r", workerId: "w", command: "git status" })?.heuristic).toBe("executing");
    expect(shadowWorkerActivity("r", "w", [{ type: "tool_call", text: "Read a.ts", toolKind: "read" }])).toBeNull();
  });
});

describe("shadow report", () => {
  it("summarizes agreement, confusion and cost per point and tolerates a torn line", () => {
    const base = { at: "2026-10-08T00:00:00.000Z", requestId: "r", runId: "run", workerId: "w", confidence: 0.6, model: "m", escalated: false, costUsd: 0.001, sampledOut: 1 };
    const log = [
      { ...base, point: "supervisor_wake", heuristic: "wake", decided: "wake", agree: true },
      { ...base, point: "supervisor_wake", heuristic: "no_wake", decided: "wake", agree: false },
      { ...base, point: "worker_activity", heuristic: "testing", decided: "testing", agree: true, escalated: true, acted: true },
    ].map((record) => JSON.stringify(record)).join("\n") + "\n{\"torn";
    const [wake, activity] = summarizeShadowDecisions(parseShadowLog(log));
    expect(wake).toMatchObject({ point: "supervisor_wake", comparisons: 2, agreements: 1, agreementRate: 0.5, confusion: { "wake -> wake": 1, "no_wake -> wake": 1 }, meanConfidenceWhenDisagreeing: 0.6, sampledOut: 2 });
    expect(wake.costUsd).toBeCloseTo(0.002);
    expect(activity).toMatchObject({ point: "worker_activity", comparisons: 1, agreementRate: 1, escalations: 1, acted: 1 });
    expect(wake.acted).toBe(0);
  });
});

describe("wiring through the worker stream", () => {
  const previousMock = process.env.MOCK_LLM;

  beforeEach(async () => {
    __resetOutputStoreCachesForTests();
    __resetWorkerActivityForTests();
    await db.delete(settings);
  });

  afterEach(async () => {
    if (previousMock === undefined) delete process.env.MOCK_LLM;
    else process.env.MOCK_LLM = previousMock;
    await db.delete(settings);
  });

  async function waitForEvent(kind: string) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const found = events().find((event) => event.kind === kind);
      if (found) return found;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    return undefined;
  }

  it("compares a worker command when the layer and point are enabled, and logs it", async () => {
    process.env.MOCK_LLM = "true";
    const now = new Date();
    await db.insert(settings).values([
      { key: DECISION_SETTING_KEYS.enabled, value: "true", updatedAt: now },
      { key: DECISION_SETTING_KEYS.points, value: JSON.stringify(["worker_activity"]), updatedAt: now },
    ]);
    const runId = `run-shadow-${Date.now()}`;
    await writeWorkerOutputEntries(runId, "worker-1", [{
      id: "cmd-1", type: "tool_call", text: "git status", toolKind: "execute", status: "in_progress", timestamp: now.toISOString(),
    } as never]);

    // The mock provider picks the first choice ("testing"); the pattern says "executing".
    const compared = await waitForEvent("decision.shadow_compared");
    expect(compared).toMatchObject({ point: "worker_activity", heuristic: "executing", decided: "testing", agree: false });

    const logText = await fs.readFile(shadowDecisionLogPath(new Date()), "utf8");
    expect(parseShadowLog(logText)).toContainEqual(expect.objectContaining({ runId, workerId: "worker-1", heuristic: "executing" }));
    expect(logText).not.toContain("git status");
  });

  it("only reports a skip when the layer is off, never a comparison", async () => {
    await writeWorkerOutputEntries(`run-off-${Date.now()}`, "worker-1", [{
      id: "cmd-2", type: "tool_call", text: "pnpm test", toolKind: "execute", status: "in_progress", timestamp: new Date().toISOString(),
    } as never]);
    expect(await waitForEvent("decision.skipped")).toMatchObject({ point: "worker_activity", reason: "disabled" });
    expect(events().some((event) => event.kind === "decision.shadow_compared")).toBe(false);
  });
});
