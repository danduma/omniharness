import { afterEach, describe, expect, it, vi } from "vitest";
import { __resetNamedEventsForTests, getNamedEventsSince, type NamedEvent } from "@/server/events/named-events";
import { decisionConfigFromValues, type DecisionLayerConfig } from "@/server/decisions/config";
import { DECISION_STATE_MAX_CHARS, DecisionService } from "@/server/decisions/service";
import { createMockDecisionProvider } from "@/server/decisions/mock-provider";
import { DecisionProviderError, type DecisionProvider, type DecisionProviderCall, type DecisionRequest } from "@/server/decisions/types";
import { DECISION_SETTING_KEYS, DEFAULT_DECISION_MODEL } from "@/shared/decision-layer";

const FAKE_KEY = "vck_TESTONLY_placeholder_0000";
const OTHER_FAKE_KEY = "vck_TESTONLY_placeholder_1111";

function config(overrides: Partial<DecisionLayerConfig> = {}): DecisionLayerConfig {
  return {
    enabled: true,
    actingPoints: new Set(),
    textModel: null,
    textTasks: new Set(),
    model: DEFAULT_DECISION_MODEL,
    escalationModel: null,
    zeroDataRetention: false,
    points: new Set(["supervisor_wake"]),
    apiKey: FAKE_KEY,
    baseUrl: null,
    ...overrides,
  };
}

const request: DecisionRequest = {
  point: "supervisor_wake",
  runId: "run-1",
  workerId: "worker-1",
  state: { summary: "worker printed a diff" },
  questions: { wake: { type: "boolean", instructions: "Does the supervisor need to act?" } },
  timeoutMs: 1_000,
};

function events() {
  return getNamedEventsSince(0).events.map((entry) => entry.event as NamedEvent);
}

function decisionEvents() {
  return events().filter((event) => event.kind.startsWith("decision.") || event.kind === "error.surfaced");
}

function service(options: { cfg: () => DecisionLayerConfig; provider?: DecisionProvider; env?: Record<string, string> }) {
  return new DecisionService({
    loadConfig: async () => options.cfg(),
    createProvider: () => options.provider ?? createMockDecisionProvider(),
    env: options.env ?? {},
  });
}

afterEach(() => {
  __resetNamedEventsForTests();
});

describe("decisionConfigFromValues", () => {
  it("is off by default, shadow by default, and reads the key from the environment only", () => {
    const empty = decisionConfigFromValues({}, {});
    expect(empty.enabled).toBe(false);
    expect(empty.actingPoints.size).toBe(0);
    expect(empty.model).toBe(DEFAULT_DECISION_MODEL);
    expect(empty.apiKey).toBeNull();
    expect(empty.points.size).toBe(0);

    const configured = decisionConfigFromValues({
      [DECISION_SETTING_KEYS.enabled]: "true",
      [DECISION_SETTING_KEYS.actingPoints]: JSON.stringify(["supervisor_wake", "worker_activity"]),
      [DECISION_SETTING_KEYS.points]: JSON.stringify(["supervisor_wake", "not-a-point"]),
      AI_GATEWAY_API_KEY: "from-settings-must-be-ignored",
    }, { AI_GATEWAY_API_KEY: ` ${FAKE_KEY} ` });
    expect(configured.enabled).toBe(true);
    // Acting requires the point to be enabled too; worker_activity is not.
    expect([...configured.actingPoints]).toEqual(["supervisor_wake"]);
    expect([...configured.points]).toEqual(["supervisor_wake"]);
    expect(configured.apiKey).toBe(FAKE_KEY);
  });
});

describe("DecisionService", () => {
  it("skips with the kill switch, a disabled point, or a missing key, and reports each reason once", async () => {
    let current = config({ enabled: false });
    const svc = service({ cfg: () => current });

    expect(await svc.decide(request)).toEqual({ status: "skipped", reason: "disabled" });
    expect(await svc.decide(request)).toEqual({ status: "skipped", reason: "disabled" });
    current = config({ points: new Set() });
    expect(await svc.decide(request)).toEqual({ status: "skipped", reason: "point_disabled" });
    current = config({ apiKey: null });
    expect(await svc.decide(request)).toEqual({ status: "skipped", reason: "unconfigured" });

    expect(decisionEvents()).toEqual([
      { kind: "decision.skipped", point: "supervisor_wake", reason: "disabled" },
      { kind: "decision.skipped", point: "supervisor_wake", reason: "point_disabled" },
      { kind: "decision.skipped", point: "supervisor_wake", reason: "unconfigured" },
    ]);
  });

  it("answers in shadow mode and emits requested + answered with no state or key", async () => {
    const svc = service({ cfg: () => config() });
    const outcome = await svc.decide(request);
    expect(outcome).toMatchObject({ status: "answered", shadow: true, result: { answers: { wake: { type: "boolean", probability: 0.5 } } } });

    const [requested, answered] = decisionEvents();
    expect(requested).toMatchObject({ kind: "decision.requested", point: "supervisor_wake", runId: "run-1", workerId: "worker-1", shadow: true });
    expect(answered).toMatchObject({ kind: "decision.answered", requestId: (requested as { requestId: string }).requestId, model: DEFAULT_DECISION_MODEL, escalated: false, shadow: true });
    const serialized = JSON.stringify(events());
    expect(serialized).not.toContain(FAKE_KEY);
    expect(serialized).not.toContain("worker printed a diff");
  });

  it("redacts secrets and machine paths from state before it leaves the process", async () => {
    const seen: DecisionProviderCall[] = [];
    const provider: DecisionProvider = { id: "mock", decide: async (call) => { seen.push(call); return createMockDecisionProvider().decide(call); } };
    const svc = service({ cfg: () => config(), provider });
    await svc.decide({
      ...request,
      state: { log: [`export AI_GATEWAY_API_KEY=${OTHER_FAKE_KEY}`, "token vck_abcdefghijkl", "opened /Users/someone/project/file.ts"] },
    });
    const sent = JSON.stringify(seen[0]!.state);
    expect(sent).not.toContain(OTHER_FAKE_KEY);
    expect(sent).not.toContain("vck_abcdefghijkl");
    expect(sent).not.toContain("/Users/someone");
    expect(sent).toContain("[REDACTED]");
  });

  it("falls back without calling the provider when the state is too large", async () => {
    const decide = vi.fn();
    const svc = service({ cfg: () => config(), provider: { id: "mock", decide } });
    const outcome = await svc.decide({ ...request, state: Array.from({ length: 5 }, () => "x".repeat(DECISION_STATE_MAX_CHARS / 4)) });
    expect(outcome).toMatchObject({ status: "fallback", reason: "state_too_large" });
    expect(decide).not.toHaveBeenCalled();
  });

  it("times out through the abort signal and falls back", async () => {
    const provider: DecisionProvider = {
      id: "mock",
      decide: (call) => new Promise((_, reject) => {
        call.signal.addEventListener("abort", () => reject(new DecisionProviderError("timeout", "timed out")));
      }),
    };
    const svc = service({ cfg: () => config(), provider });
    const outcome = await svc.decide({ ...request, timeoutMs: 20 });
    expect(outcome).toMatchObject({ status: "fallback", reason: "timeout" });
    expect(decisionEvents().at(-1)).toMatchObject({ kind: "decision.fallback", reason: "timeout" });
  });

  it("blocks a rejected key after one surfaced error until the key changes", async () => {
    let current = config();
    const decide = vi.fn().mockRejectedValue(new DecisionProviderError("auth_failed", "AI Gateway rejected the API key with HTTP 401.", 401));
    const svc = service({ cfg: () => current, provider: { id: "vercel-ai-gateway", decide } });

    expect(await svc.decide(request)).toMatchObject({ status: "fallback", reason: "auth_failed" });
    expect(await svc.decide(request)).toEqual({ status: "skipped", reason: "auth_blocked" });
    expect(await svc.decide(request)).toEqual({ status: "skipped", reason: "auth_blocked" });
    expect(decide).toHaveBeenCalledTimes(1);

    const surfaced = events().filter((event) => event.kind === "error.surfaced");
    expect(surfaced).toEqual([expect.objectContaining({ code: "decision.auth_failed", surface: "banner", runId: "run-1" })]);
    expect(JSON.stringify(surfaced)).not.toContain(FAKE_KEY);

    current = config({ apiKey: OTHER_FAKE_KEY });
    decide.mockResolvedValueOnce(await createMockDecisionProvider().decide({ ...request, model: "m", escalationModel: null, zeroDataRetention: false, signal: new AbortController().signal }));
    expect(await svc.decide(request)).toMatchObject({ status: "answered" });
  });

  it("surfaces an exhausted budget once and keeps falling back", async () => {
    const decide = vi.fn().mockRejectedValue(new DecisionProviderError("budget_exceeded", "AI Gateway budget exceeded.", 402));
    const svc = service({ cfg: () => config(), provider: { id: "vercel-ai-gateway", decide } });
    await svc.decide(request);
    await svc.decide(request);
    expect(decide).toHaveBeenCalledTimes(2);
    expect(events().filter((event) => event.kind === "error.surfaced")).toEqual([
      expect.objectContaining({ code: "decision.budget_exceeded", surface: "toast" }),
    ]);
  });

  it("reports shadow false only for points allowed to act", async () => {
    const svc = service({ cfg: () => config({ points: new Set(["supervisor_wake", "worker_activity"]), actingPoints: new Set(["worker_activity"]) }) });
    expect(await svc.decide(request)).toMatchObject({ status: "answered", shadow: true });
    expect(await svc.decide({ ...request, point: "worker_activity" })).toMatchObject({ status: "answered", shadow: false });
  });

  it("treats unexpected provider exceptions as provider_error fallbacks", async () => {
    const svc = service({ cfg: () => config(), provider: { id: "mock", decide: async () => { throw new Error("boom"); } } });
    expect(await svc.decide(request)).toMatchObject({ status: "fallback", reason: "provider_error" });
  });

  it("uses the mock provider without a key when MOCK_LLM is set", async () => {
    const svc = new DecisionService({ loadConfig: async () => config({ apiKey: null }), env: { MOCK_LLM: "true" } });
    expect(await svc.decide(request)).toMatchObject({ status: "answered" });
  });
});
