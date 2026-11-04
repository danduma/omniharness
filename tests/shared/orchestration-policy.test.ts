import { describe, expect, it } from "vitest";
import {
  canEnterStage,
  computeNextStage,
  createDefaultOrchestrationPolicy,
  parseOrchestrationPolicy,
  resolveProfilePolicy,
  type StageHistoryEntry,
  type StageOutcome,
  type StageStatus,
  type WorkflowStage,
} from "@/shared/orchestration-policy";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function issueCodes(value: unknown) {
  const result = parseOrchestrationPolicy(value);
  return result.ok ? [] : result.issues.map((issue) => issue.code);
}

describe("orchestration policy parsing", () => {
  it("accepts the default economy/balanced/thorough/custom policy", () => {
    const result = parseOrchestrationPolicy(createDefaultOrchestrationPolicy());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.policy.profiles).sort()).toEqual(["balanced", "custom", "economy", "thorough"]);
    const balanced = resolveProfilePolicy(result.policy, "balanced");
    expect(balanced.stages.map((stage) => stage.stage)).toEqual(["triage", "plan", "plan_review", "implement", "code_review", "validate"]);
    expect(balanced.stages.find((stage) => stage.stage === "plan")?.binding).toMatchObject({ kind: "worker", workerType: "claude", model: "claude-opus-5-5" });
    expect(balanced.stages.find((stage) => stage.stage === "implement")?.binding).toMatchObject({ kind: "worker", workerType: "codex", model: "gpt-5.6-terra" });
  });

  it("round-trips through JSON strings", () => {
    const result = parseOrchestrationPolicy(JSON.stringify(createDefaultOrchestrationPolicy()));
    expect(result.ok).toBe(true);
  });

  it("rejects an unknown CLI", () => {
    const policy = clone(createDefaultOrchestrationPolicy()) as any;
    policy.profiles.balanced.stages[1].binding.workerType = "cursor";
    expect(issueCodes(policy)).toContain("unknown_worker_type");
  });

  it("rejects a duplicate stage binding", () => {
    const policy = clone(createDefaultOrchestrationPolicy()) as any;
    policy.profiles.balanced.stages.push(clone(policy.profiles.balanced.stages[1]));
    expect(issueCodes(policy)).toContain("duplicate_stage");
  });

  it("rejects negative caps", () => {
    const policy = clone(createDefaultOrchestrationPolicy()) as any;
    policy.profiles.economy.stages[1].budget.maxTokens = -1;
    policy.profiles.economy.runBudget.maxCostUsd = -5;
    const codes = issueCodes(policy);
    expect(codes.filter((code) => code === "negative_cap")).toHaveLength(2);
  });

  it("rejects a profile with no implementation binding", () => {
    const policy = clone(createDefaultOrchestrationPolicy()) as any;
    policy.profiles.thorough.stages = policy.profiles.thorough.stages.filter((stage: { stage: string }) => stage.stage !== "implement");
    expect(issueCodes(policy)).toContain("missing_implementation");
  });

  it("rejects a decision binding outside triage and a worker binding for triage", () => {
    const policy = clone(createDefaultOrchestrationPolicy()) as any;
    policy.profiles.balanced.stages[1].binding = { kind: "decision", model: "typesafe-ai/jev" };
    policy.profiles.economy.stages[0].binding = { kind: "worker", workerType: "codex", model: "gpt-5.6-luna" };
    const codes = issueCodes(policy);
    expect(codes).toContain("decision_binding_outside_triage");
    expect(codes).toContain("worker_binding_for_triage");
  });

  it("refuses a code reviewer of the same CLI as the implementer", () => {
    const policy = clone(createDefaultOrchestrationPolicy()) as any;
    const review = policy.profiles.balanced.stages.find((stage: { stage: string }) => stage.stage === "code_review");
    review.binding = { kind: "worker", workerType: "codex", model: "gpt-5.6-terra" };
    review.fallbacks = [];
    expect(issueCodes(policy)).toContain("reviewer_not_independent");
  });

  it("forbids automatic fallbacks in the custom profile", () => {
    const policy = clone(createDefaultOrchestrationPolicy()) as any;
    policy.profiles.custom.stages[1].fallbacks = [{ kind: "worker", workerType: "claude", model: "claude-sonnet-5-5" }];
    expect(issueCodes(policy)).toContain("custom_fallbacks_forbidden");
  });

  it("rejects anything that looks like a credential", () => {
    const policy = clone(createDefaultOrchestrationPolicy()) as any;
    policy.profiles.balanced.stages[1].binding.apiKey = ["sk", "fake", "x".repeat(24)].join("-");
    expect(issueCodes(policy)).toEqual(["secret_in_policy"]);
  });

  it("rejects unsupported versions and non-objects", () => {
    expect(issueCodes({ ...createDefaultOrchestrationPolicy(), version: 2 })).toEqual(["unsupported_version"]);
    expect(issueCodes("not json")).toEqual(["not_object"]);
    expect(issueCodes([])).toEqual(["not_object"]);
  });
});

describe("next-stage rules", () => {
  const balanced = createDefaultOrchestrationPolicy().profiles.balanced;
  let seq = 0;
  function entry(stage: WorkflowStage, attempt: number, status: StageStatus, outcome: StageOutcome | null = null): StageHistoryEntry {
    seq += 1;
    return { stage, attempt, status, outcome, seq };
  }

  it("walks triage → plan → plan_review → implement → code_review → validate", () => {
    seq = 0;
    const history: StageHistoryEntry[] = [];
    const order: string[] = [];
    const outcomes: Record<WorkflowStage, StageOutcome> = {
      triage: "advisory",
      plan: "passed",
      plan_review: "approved",
      implement: "passed",
      code_review: "approved",
      validate: "passed",
    };
    for (let step = 0; step < 10; step += 1) {
      const next = computeNextStage(balanced, history);
      if (next.kind === "done") break;
      expect(next.kind).toBe("dispatch");
      if (next.kind !== "dispatch") return;
      order.push(next.stage);
      history.push(entry(next.stage, next.attempt, "completed", outcomes[next.stage]));
    }
    expect(order).toEqual(["triage", "plan", "plan_review", "implement", "code_review", "validate"]);
    expect(computeNextStage(balanced, history)).toEqual({ kind: "done" });
  });

  it("re-opens the planner on review findings, then re-reviews the revision", () => {
    seq = 0;
    const history = [
      entry("triage", 1, "completed", "advisory"),
      entry("plan", 1, "completed", "passed"),
      entry("plan_review", 1, "completed", "changes_requested"),
    ];
    expect(computeNextStage(balanced, history)).toEqual({ kind: "dispatch", stage: "plan", attempt: 2, reason: "revision" });
    history.push(entry("plan", 2, "completed", "passed"));
    expect(computeNextStage(balanced, history)).toEqual({ kind: "dispatch", stage: "plan_review", attempt: 2, reason: "first" });
    history.push(entry("plan_review", 2, "completed", "changes_requested"));
    expect(computeNextStage(balanced, history)).toMatchObject({ kind: "blocked", reason: "revision_cap_reached" });
  });

  it("allows one bounded repair cycle in balanced and none in economy", () => {
    seq = 0;
    const history = [
      entry("triage", 1, "completed", "advisory"),
      entry("plan", 1, "completed", "passed"),
      entry("plan_review", 1, "completed", "approved"),
      entry("implement", 1, "completed", "passed"),
      entry("code_review", 1, "completed", "changes_requested"),
    ];
    expect(computeNextStage(balanced, history)).toEqual({ kind: "dispatch", stage: "implement", attempt: 2, reason: "repair" });
    history.push(entry("implement", 2, "completed", "passed"));
    expect(computeNextStage(balanced, history)).toEqual({ kind: "dispatch", stage: "code_review", attempt: 2, reason: "first" });
    history.push(entry("code_review", 2, "completed", "changes_requested"));
    expect(computeNextStage(balanced, history)).toMatchObject({ kind: "blocked", reason: "repair_cap_reached" });

    seq = 0;
    const economy = createDefaultOrchestrationPolicy().profiles.economy;
    const economyHistory = [
      entry("triage", 1, "completed", "advisory"),
      entry("plan", 1, "completed", "passed"),
      entry("implement", 1, "completed", "passed"),
      entry("code_review", 1, "completed", "changes_requested"),
    ];
    expect(computeNextStage(economy, economyHistory)).toMatchObject({ kind: "blocked", reason: "repair_cap_reached" });
  });

  it("reports an active stage and never a second dispatch", () => {
    seq = 0;
    const history = [entry("triage", 1, "completed", "advisory"), entry("plan", 1, "dispatched")];
    expect(computeNextStage(balanced, history)).toEqual({ kind: "active", stage: "plan", attempt: 1 });
  });

  it("blocks on failed, blocked, and needs_recovery stages; re-dispatches cancelled ones", () => {
    seq = 0;
    expect(computeNextStage(balanced, [entry("triage", 1, "failed")])).toMatchObject({ kind: "blocked", reason: "stage_failed" });
    expect(computeNextStage(balanced, [entry("triage", 1, "blocked")])).toMatchObject({ kind: "blocked", reason: "stage_blocked" });
    expect(computeNextStage(balanced, [entry("triage", 1, "needs_recovery")])).toMatchObject({ kind: "blocked", reason: "needs_recovery" });
    expect(computeNextStage(balanced, [entry("triage", 1, "cancelled")])).toEqual({ kind: "dispatch", stage: "triage", attempt: 2, reason: "retry" });
  });

  it("skips triage when the profile turns it off", () => {
    const profile = { ...balanced, triageMode: "off" as const };
    expect(computeNextStage(profile, [])).toEqual({ kind: "dispatch", stage: "plan", attempt: 1, reason: "first" });
  });

  it("refuses a transition that skips an unmet hard gate", () => {
    seq = 0;
    const history = [
      entry("triage", 1, "completed", "advisory"),
      entry("plan", 1, "completed", "passed"),
      entry("plan_review", 1, "completed", "changes_requested"),
    ];
    expect(canEnterStage(balanced, history, "implement")).toBe(false);
    expect(canEnterStage(balanced, history, "plan_review")).toBe(true);
    history.push(entry("plan", 2, "completed", "passed"));
    // The approval of the first review would be stale after a revision.
    expect(canEnterStage(balanced, history, "implement")).toBe(false);
    history.push(entry("plan_review", 2, "completed", "approved"));
    expect(canEnterStage(balanced, history, "implement")).toBe(true);
    expect(canEnterStage(balanced, history, "validate")).toBe(false);
  });
});

describe("default profile budgets", () => {
  it("covers every stage plus the profile's bounded loops within the run cap, even with unknown usage", () => {
    const policy = createDefaultOrchestrationPolicy();
    for (const profile of Object.values(policy.profiles)) {
      const sum = (stages: string[], key: "maxTokens" | "maxCostUsd") => profile.stages
        .filter((stage) => stages.includes(stage.stage))
        .reduce((total, stage) => total + (stage.budget[key] ?? 0), 0);
      const all = profile.stages.map((stage) => stage.stage);
      for (const key of ["maxTokens", "maxCostUsd"] as const) {
        const worstCase = sum(all, key)
          + profile.maxPlanRevisionRounds * sum(["plan", "plan_review"], key)
          + profile.maxRepairRounds * sum(["implement", "code_review", "validate"], key);
        expect(worstCase).toBeLessThanOrEqual(profile.runBudget[key] ?? Infinity);
      }
    }
  });
});
