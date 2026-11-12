import { beforeEach, describe, expect, it } from "vitest";
import { __resetNamedEventsForTests, getNamedEventsSince, type NamedEvent } from "@/server/events/named-events";
import { decisionConfigFromValues, type DecisionLayerConfig } from "@/server/decisions/config";
import { DecisionService } from "@/server/decisions/service";
import { createMockDecisionProvider } from "@/server/decisions/mock-provider";
import { DecisionProviderError, type DecisionAnswer, type DecisionProviderCall } from "@/server/decisions/types";
import { DECISION_POINT_IDS, DECISION_SETTING_KEYS } from "@/shared/decision-layer";
import {
  TRIAGE_TASK_MAX_CHARS,
  buildTriageDecisionRequest,
  decideTriageApplication,
  runWorkflowTriage,
} from "@/server/orchestration/prompts";

const FAKE_KEY = "vck_TESTONLY_placeholder_0000";

function config(acting: boolean, overrides: Partial<DecisionLayerConfig> = {}): DecisionLayerConfig {
  const values: Record<string, string> = {
    [DECISION_SETTING_KEYS.enabled]: "true",
    [DECISION_SETTING_KEYS.points]: JSON.stringify(["workflow_triage"]),
    ...(acting ? { [DECISION_SETTING_KEYS.actingPoints]: JSON.stringify(["workflow_triage"]) } : {}),
  };
  return { ...decisionConfigFromValues(values, { AI_GATEWAY_API_KEY: FAKE_KEY }), ...overrides };
}

function service(acting: boolean, answers: Record<string, DecisionAnswer>, calls: DecisionProviderCall[] = [], overrides: Partial<DecisionLayerConfig> = {}) {
  return new DecisionService({
    loadConfig: async () => config(acting, overrides),
    createProvider: () => createMockDecisionProvider((id, call) => {
      if (!calls.includes(call)) calls.push(call);
      return answers[id];
    }),
  });
}

const confident: Record<string, DecisionAnswer> = {
  complexity: { type: "choice", choice: "low", confidence: 0.9 },
  risk: { type: "choice", choice: "low", confidence: 0.9 },
  parallelizable: { type: "boolean", probability: 0.2 },
  profile: { type: "choice", choice: "economy", confidence: 0.9 },
};

function events() {
  return getNamedEventsSince(0).events.map((entry) => entry.event as NamedEvent);
}

beforeEach(() => {
  __resetNamedEventsForTests();
});

describe("workflow_triage decision point", () => {
  it("is a registered decision point", () => {
    expect(DECISION_POINT_IDS).toContain("workflow_triage");
  });

  it("redacts and size-limits the task, and asks only bounded questions", async () => {
    const calls: DecisionProviderCall[] = [];
    const secret = ["sk", "test", "y".repeat(30)].join("-");
    await runWorkflowTriage(service(false, confident, calls), {
      runId: "run-1",
      task: `Fix the login bug with key ${secret} ${"x".repeat(10_000)}`,
      areas: Array.from({ length: 50 }, (_, index) => `area-${index}`),
    });
    expect(calls).toHaveLength(1);
    const state = calls[0]!.state as { task: string; areas: string[] };
    expect(state.task).not.toContain(secret);
    expect(state.task.length).toBeLessThanOrEqual(TRIAGE_TASK_MAX_CHARS + 50);
    expect(state.areas).toHaveLength(20);
    expect(Object.keys(calls[0]!.questions).sort()).toEqual(["complexity", "parallelizable", "profile", "risk"]);
    // The answer space is a profile name only: no model ids, no stage plan.
    const request = buildTriageDecisionRequest({ runId: "run-1", task: "x" });
    const profileQuestion = request.questions.profile;
    expect(profileQuestion?.type === "choice" ? Object.keys(profileQuestion.criteria) : []).toEqual(["economy", "balanced", "thorough"]);
  });

  it("never acts in shadow mode", async () => {
    const { recommendation } = await runWorkflowTriage(service(false, confident), { runId: "run-1", task: "small fix" });
    expect(recommendation?.shadow).toBe(true);
    expect(decideTriageApplication({ recommendation, currentProfile: "balanced", userSelected: false })).toEqual({ action: "none", reason: "shadow" });
  });

  it("ignores low-confidence answers and keeps the profile", async () => {
    const answers = { ...confident, profile: { type: "choice" as const, choice: "economy", confidence: 0.4 } };
    const { recommendation } = await runWorkflowTriage(service(true, answers), { runId: "run-1", task: "small fix" });
    expect(recommendation).toBeNull();
    expect(decideTriageApplication({ recommendation, currentProfile: "balanced", userSelected: false })).toEqual({ action: "none", reason: "no_recommendation" });
    expect(events().some((event) => event.kind === "orchestration.triage_ignored")).toBe(true);
  });

  it("falls back to null when Jev is unavailable", async () => {
    const unavailable = new DecisionService({
      loadConfig: async () => config(true),
      createProvider: () => ({
        id: "mock",
        decide: async () => {
          throw new DecisionProviderError("provider_error", "gateway down", 503);
        },
      }),
    });
    const { outcome, recommendation } = await runWorkflowTriage(unavailable, { runId: "run-1", task: "x" });
    expect(outcome.status).toBe("fallback");
    const disabled = await runWorkflowTriage(service(true, confident, [], { enabled: false }), { runId: "run-1", task: "x" });
    expect(disabled.outcome.status).toBe("skipped");
    expect(disabled.recommendation).toBeNull();
    expect(recommendation).toBeNull();
  });

  it("may only move an unselected profile to an equal-or-cheaper one", async () => {
    const { recommendation } = await runWorkflowTriage(service(true, confident), { runId: "run-1", task: "small fix" });
    expect(recommendation).toMatchObject({ recommendedProfile: "economy", shadow: false });
    expect(decideTriageApplication({ recommendation, currentProfile: "balanced", userSelected: false })).toEqual({ action: "apply", profile: "economy" });
    expect(decideTriageApplication({ recommendation, currentProfile: "balanced", userSelected: true })).toEqual({ action: "none", reason: "user_selected" });
    expect(decideTriageApplication({ recommendation, currentProfile: "custom", userSelected: false })).toEqual({ action: "none", reason: "custom_profile" });

    const upgrade = await runWorkflowTriage(
      service(true, { ...confident, profile: { type: "choice", choice: "thorough", confidence: 0.95 } }),
      { runId: "run-1", task: "migrate the database" },
    );
    expect(decideTriageApplication({ recommendation: upgrade.recommendation, currentProfile: "balanced", userSelected: false }))
      .toEqual({ action: "none", reason: "would_spend_more" });
  });
});
