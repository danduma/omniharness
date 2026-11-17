// Specialist orchestration policy (plan 2026-11-04-multi-agent-specialist-orchestration).
//
// A policy names, per token profile, which specialist runs each workflow
// stage, with what caps, and which bounded fallbacks may replace it. Model
// identifiers are configuration values, not capability claims: the server
// preflights every binding against the installed CLIs before dispatch.
//
// Everything here is pure and persisted as stable ids. No translated copy.

import { SUPPORTED_WORKER_TYPES, type SupportedWorkerType } from "./worker-types";
import { normalizeReasoningEffort } from "./reasoning-effort";

export const ORCHESTRATION_POLICY_VERSION = 1 as const;

/** Settings key holding the saved default policy JSON. */
export const ORCHESTRATION_POLICY_SETTING_KEY = "ORCHESTRATION_POLICY";

export const WORKFLOW_STAGES = ["triage", "plan", "plan_review", "implement", "code_review", "validate"] as const;
export type WorkflowStage = (typeof WORKFLOW_STAGES)[number];

export const TOKEN_PROFILES = ["economy", "balanced", "thorough", "custom"] as const;
export type TokenProfile = (typeof TOKEN_PROFILES)[number];

/** Relative spend rank; `custom` is user-pinned and never compared automatically. */
export const PROFILE_COST_RANK: Record<Exclude<TokenProfile, "custom">, number> = {
  economy: 0,
  balanced: 1,
  thorough: 2,
};

export const STAGE_STATUSES = [
  "pending",
  "preflight",
  "blocked",
  "dispatched",
  "waiting",
  "completed",
  "failed",
  "cancelled",
  "needs_recovery",
] as const;
export type StageStatus = (typeof STAGE_STATUSES)[number];

/** Statuses that hold the run's single dispatch claim. */
export const ACTIVE_STAGE_STATUSES = ["preflight", "dispatched", "waiting"] as const satisfies readonly StageStatus[];

/** Stable outcome ids a completed stage records. */
export const STAGE_OUTCOMES = ["approved", "changes_requested", "passed", "failed_checks", "advisory"] as const;
export type StageOutcome = (typeof STAGE_OUTCOMES)[number];

export type CredentialSource = "account" | "gateway";

export type BindingCaps = {
  maxInputTokens: number | null;
  maxOutputTokens: number | null;
  maxCostUsd: number | null;
};

/** A heavyweight stage run by an installed coding-agent CLI. */
export type WorkerModelBinding = BindingCaps & {
  kind: "worker";
  workerType: SupportedWorkerType;
  /** Canonical requested model id (e.g. `claude-opus-5-5`, `gpt-5.6-terra`). */
  model: string;
  effort: string | null;
  credentialSource: CredentialSource | null;
  accountId: string | null;
};

/** The low-cost decision lane (Jev via AI Gateway). Only valid for `triage`. */
export type DecisionModelBinding = BindingCaps & {
  kind: "decision";
  model: string;
};

export type ModelBinding = WorkerModelBinding | DecisionModelBinding;

export type StageBudget = {
  maxTokens: number | null;
  maxCostUsd: number | null;
};

export type StagePolicy = {
  stage: WorkflowStage;
  binding: ModelBinding;
  /** Tried in order when the primary binding fails preflight. Never used by `custom`. */
  fallbacks: ModelBinding[];
  budget: StageBudget;
};

export type ProfilePolicy = {
  stages: StagePolicy[];
  runBudget: StageBudget;
  /** Bounded implement ↔ code_review repair cycles. */
  maxRepairRounds: number;
  /** Bounded plan ↔ plan_review revision cycles (passed to the plan reviewer as rounds). */
  maxPlanRevisionRounds: number;
  /** `advisory`: triage only recommends. `off`: no triage stage runs. */
  triageMode: "advisory" | "off";
};

export type OrchestrationPolicyV1 = {
  version: typeof ORCHESTRATION_POLICY_VERSION;
  defaultProfile: TokenProfile;
  profiles: Record<TokenProfile, ProfilePolicy>;
};

export type PolicyValidationIssue = {
  /** Stable machine code; translated at render time. */
  code:
    | "not_object"
    | "unsupported_version"
    | "unknown_profile"
    | "missing_profile"
    | "unknown_stage"
    | "duplicate_stage"
    | "unknown_worker_type"
    | "invalid_binding"
    | "decision_binding_outside_triage"
    | "worker_binding_for_triage"
    | "negative_cap"
    | "missing_implementation"
    | "reviewer_not_independent"
    | "duplicate_fallback"
    | "custom_fallbacks_forbidden"
    | "invalid_rounds"
    | "secret_in_policy";
  path: string;
};

export type PolicyParseResult =
  | { ok: true; policy: OrchestrationPolicyV1 }
  | { ok: false; issues: PolicyValidationIssue[] };

const MAX_ROUNDS = 5;
const MODEL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/@+-]{0,199}$/;
/** Shapes that look like credentials. Policies must never carry them. */
const SECRET_PATTERNS = [/sk-[A-Za-z0-9_-]{12,}/, /\bvck_[A-Za-z0-9]{12,}/, /\bghp_[A-Za-z0-9]{20,}/, /\bAKIA[0-9A-Z]{16}\b/];
const SECRET_KEY_NAMES = /(api[_-]?key|token|secret|password|credential)$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseCap(value: unknown, path: string, issues: PolicyValidationIssue[]): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    issues.push({ code: "invalid_binding", path });
    return null;
  }
  if (value < 0) {
    issues.push({ code: "negative_cap", path });
    return null;
  }
  return value;
}

function parseCaps(value: Record<string, unknown>, path: string, issues: PolicyValidationIssue[]): BindingCaps {
  return {
    maxInputTokens: parseCap(value.maxInputTokens, `${path}.maxInputTokens`, issues),
    maxOutputTokens: parseCap(value.maxOutputTokens, `${path}.maxOutputTokens`, issues),
    maxCostUsd: parseCap(value.maxCostUsd, `${path}.maxCostUsd`, issues),
  };
}

function parseBinding(value: unknown, path: string, issues: PolicyValidationIssue[]): ModelBinding | null {
  if (!isRecord(value)) {
    issues.push({ code: "invalid_binding", path });
    return null;
  }
  const model = typeof value.model === "string" ? value.model.trim() : "";
  if (!MODEL_ID_PATTERN.test(model)) {
    issues.push({ code: "invalid_binding", path: `${path}.model` });
    return null;
  }
  const caps = parseCaps(value, path, issues);
  if (value.kind === "decision") {
    return { kind: "decision", model, ...caps };
  }
  if (value.kind !== "worker") {
    issues.push({ code: "invalid_binding", path: `${path}.kind` });
    return null;
  }
  const workerType = typeof value.workerType === "string" ? value.workerType.trim().toLowerCase() : "";
  if (!(SUPPORTED_WORKER_TYPES as readonly string[]).includes(workerType)) {
    issues.push({ code: "unknown_worker_type", path: `${path}.workerType` });
    return null;
  }
  const credentialSource = value.credentialSource === "gateway" || value.credentialSource === "account"
    ? value.credentialSource
    : null;
  if (value.credentialSource !== undefined && value.credentialSource !== null && credentialSource === null) {
    issues.push({ code: "invalid_binding", path: `${path}.credentialSource` });
  }
  const accountId = typeof value.accountId === "string" && value.accountId.trim() ? value.accountId.trim() : null;
  return {
    kind: "worker",
    workerType: workerType as SupportedWorkerType,
    model,
    effort: typeof value.effort === "string" ? normalizeReasoningEffort(value.effort) : null,
    credentialSource,
    accountId,
    ...caps,
  };
}

export function bindingKey(binding: ModelBinding) {
  return binding.kind === "decision"
    ? `decision:${binding.model}`
    : `worker:${binding.workerType}:${binding.model}:${binding.effort ?? ""}:${binding.credentialSource ?? ""}:${binding.accountId ?? ""}`;
}

function containsSecret(value: unknown, depth = 0): boolean {
  if (depth > 10) return false;
  if (typeof value === "string") return SECRET_PATTERNS.some((pattern) => pattern.test(value));
  if (Array.isArray(value)) return value.some((entry) => containsSecret(entry, depth + 1));
  if (isRecord(value)) {
    return Object.entries(value).some(([key, entry]) => (
      (SECRET_KEY_NAMES.test(key) && typeof entry === "string" && entry.length > 0) || containsSecret(entry, depth + 1)
    ));
  }
  return false;
}

function parseRounds(value: unknown, path: string, issues: PolicyValidationIssue[], fallback: number) {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > MAX_ROUNDS) {
    issues.push({ code: "invalid_rounds", path });
    return fallback;
  }
  return value;
}

function parseProfile(profile: TokenProfile, value: unknown, issues: PolicyValidationIssue[]): ProfilePolicy | null {
  const path = `profiles.${profile}`;
  if (!isRecord(value)) {
    issues.push({ code: "missing_profile", path });
    return null;
  }
  const stagesValue = Array.isArray(value.stages) ? value.stages : null;
  if (!stagesValue) {
    issues.push({ code: "missing_profile", path: `${path}.stages` });
    return null;
  }
  const seen = new Set<WorkflowStage>();
  const stages: StagePolicy[] = [];
  stagesValue.forEach((entry, index) => {
    const stagePath = `${path}.stages[${index}]`;
    if (!isRecord(entry) || !(WORKFLOW_STAGES as readonly string[]).includes(entry.stage as string)) {
      issues.push({ code: "unknown_stage", path: `${stagePath}.stage` });
      return;
    }
    const stage = entry.stage as WorkflowStage;
    if (seen.has(stage)) {
      issues.push({ code: "duplicate_stage", path: `${stagePath}.stage` });
      return;
    }
    seen.add(stage);
    const binding = parseBinding(entry.binding, `${stagePath}.binding`, issues);
    if (!binding) return;
    if (binding.kind === "decision" && stage !== "triage") {
      issues.push({ code: "decision_binding_outside_triage", path: `${stagePath}.binding` });
      return;
    }
    if (binding.kind === "worker" && stage === "triage") {
      issues.push({ code: "worker_binding_for_triage", path: `${stagePath}.binding` });
      return;
    }
    const fallbacksValue = Array.isArray(entry.fallbacks) ? entry.fallbacks : [];
    if (profile === "custom" && fallbacksValue.length > 0) {
      issues.push({ code: "custom_fallbacks_forbidden", path: `${stagePath}.fallbacks` });
    }
    const keys = new Set([bindingKey(binding)]);
    const fallbacks: ModelBinding[] = [];
    fallbacksValue.forEach((fallbackValue, fallbackIndex) => {
      const fallbackPath = `${stagePath}.fallbacks[${fallbackIndex}]`;
      const fallback = parseBinding(fallbackValue, fallbackPath, issues);
      if (!fallback) return;
      if (fallback.kind !== binding.kind) {
        issues.push({ code: binding.kind === "decision" ? "worker_binding_for_triage" : "decision_binding_outside_triage", path: fallbackPath });
        return;
      }
      const key = bindingKey(fallback);
      if (keys.has(key)) {
        issues.push({ code: "duplicate_fallback", path: fallbackPath });
        return;
      }
      keys.add(key);
      fallbacks.push(fallback);
    });
    const budgetValue = isRecord(entry.budget) ? entry.budget : {};
    stages.push({
      stage,
      binding,
      fallbacks,
      budget: {
        maxTokens: parseCap(budgetValue.maxTokens, `${stagePath}.budget.maxTokens`, issues),
        maxCostUsd: parseCap(budgetValue.maxCostUsd, `${stagePath}.budget.maxCostUsd`, issues),
      },
    });
  });

  if (!seen.has("implement")) {
    issues.push({ code: "missing_implementation", path: `${path}.stages` });
  }
  const implement = stages.find((stage) => stage.stage === "implement");
  const codeReview = stages.find((stage) => stage.stage === "code_review");
  if (implement?.binding.kind === "worker" && codeReview?.binding.kind === "worker"
    && implement.binding.workerType === codeReview.binding.workerType) {
    // The existing cross-review refuses same-type review; the policy refuses it up front.
    issues.push({ code: "reviewer_not_independent", path: `${path}.stages` });
  }

  const runBudgetValue = isRecord(value.runBudget) ? value.runBudget : {};
  const triageMode = value.triageMode === "off" ? "off" : "advisory";
  stages.sort((left, right) => WORKFLOW_STAGES.indexOf(left.stage) - WORKFLOW_STAGES.indexOf(right.stage));
  return {
    stages,
    runBudget: {
      maxTokens: parseCap(runBudgetValue.maxTokens, `${path}.runBudget.maxTokens`, issues),
      maxCostUsd: parseCap(runBudgetValue.maxCostUsd, `${path}.runBudget.maxCostUsd`, issues),
    },
    maxRepairRounds: parseRounds(value.maxRepairRounds, `${path}.maxRepairRounds`, issues, 1),
    maxPlanRevisionRounds: parseRounds(value.maxPlanRevisionRounds, `${path}.maxPlanRevisionRounds`, issues, 1),
    triageMode,
  };
}

/** Parse and validate an untrusted policy value (settings row, API body). */
export function parseOrchestrationPolicy(value: unknown): PolicyParseResult {
  let input = value;
  if (typeof input === "string") {
    try {
      input = JSON.parse(input) as unknown;
    } catch {
      return { ok: false, issues: [{ code: "not_object", path: "" }] };
    }
  }
  if (!isRecord(input)) return { ok: false, issues: [{ code: "not_object", path: "" }] };
  if (containsSecret(input)) return { ok: false, issues: [{ code: "secret_in_policy", path: "" }] };
  if (input.version !== ORCHESTRATION_POLICY_VERSION) {
    return { ok: false, issues: [{ code: "unsupported_version", path: "version" }] };
  }
  const issues: PolicyValidationIssue[] = [];
  if (!(TOKEN_PROFILES as readonly string[]).includes(input.defaultProfile as string)) {
    issues.push({ code: "unknown_profile", path: "defaultProfile" });
  }
  const profilesValue = isRecord(input.profiles) ? input.profiles : {};
  for (const key of Object.keys(profilesValue)) {
    if (!(TOKEN_PROFILES as readonly string[]).includes(key)) issues.push({ code: "unknown_profile", path: `profiles.${key}` });
  }
  const profiles = {} as Record<TokenProfile, ProfilePolicy>;
  for (const profile of TOKEN_PROFILES) {
    const parsed = parseProfile(profile, profilesValue[profile], issues);
    if (parsed) profiles[profile] = parsed;
  }
  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    policy: { version: ORCHESTRATION_POLICY_VERSION, defaultProfile: input.defaultProfile as TokenProfile, profiles },
  };
}

export function resolveProfilePolicy(policy: OrchestrationPolicyV1, profile: TokenProfile): ProfilePolicy {
  return policy.profiles[profile];
}

export function isTokenProfile(value: unknown): value is TokenProfile {
  return typeof value === "string" && (TOKEN_PROFILES as readonly string[]).includes(value);
}

/** Stages that actually run for a profile, in workflow order. */
export function activeStages(profile: ProfilePolicy): WorkflowStage[] {
  return profile.stages
    .filter((stage) => stage.stage !== "triage" || profile.triageMode !== "off")
    .map((stage) => stage.stage);
}

// ---------------------------------------------------------------------------
// Defaults. These are intended defaults, editable when a local installation
// exposes different canonical ids; preflight refuses any that are missing.
// ---------------------------------------------------------------------------

const NO_CAPS: BindingCaps = { maxInputTokens: null, maxOutputTokens: null, maxCostUsd: null };

function worker(workerType: SupportedWorkerType, model: string, effort: string | null): WorkerModelBinding {
  return { kind: "worker", workerType, model, effort, credentialSource: null, accountId: null, ...NO_CAPS };
}

const JEV: DecisionModelBinding = { kind: "decision", model: "typesafe-ai/jev", maxInputTokens: 32_000, maxOutputTokens: 1_000, maxCostUsd: 0.05 };

function stage(stageId: WorkflowStage, binding: ModelBinding, maxTokens: number | null, maxCostUsd: number | null, fallbacks: ModelBinding[] = []): StagePolicy {
  return { stage: stageId, binding, fallbacks, budget: { maxTokens, maxCostUsd } };
}

/**
 * Default run caps cover the worst case the profile itself allows with
 * unreported usage: every stage once, plus each bounded plan revision
 * (plan + plan_review) and repair cycle (implement + code_review + validate).
 * Anything beyond that is the user's decision.
 */
export function createDefaultOrchestrationPolicy(): OrchestrationPolicyV1 {
  const balancedStages = [
    stage("triage", JEV, 40_000, 0.05),
    stage("plan", worker("claude", "claude-opus-5-5", "high"), 600_000, 15),
    stage("plan_review", worker("codex", "gpt-5.6-terra", "high"), 300_000, 6),
    stage("implement", worker("codex", "gpt-5.6-terra", "high"), 2_000_000, 40),
    stage("code_review", worker("claude", "claude-sonnet-5-5", "high"), 400_000, 8, [worker("claude", "claude-opus-5-5", "medium")]),
    stage("validate", worker("codex", "gpt-5.6-luna", "medium"), 200_000, 3),
  ];
  return {
    version: ORCHESTRATION_POLICY_VERSION,
    defaultProfile: "balanced",
    profiles: {
      economy: {
        stages: [
          stage("triage", JEV, 40_000, 0.05),
          stage("plan", worker("claude", "claude-sonnet-5-5", "medium"), 250_000, 4),
          stage("implement", worker("codex", "gpt-5.6-luna", "medium"), 800_000, 10, [worker("codex", "gpt-5.6-terra", "medium")]),
          stage("code_review", worker("claude", "claude-sonnet-5-5", "medium"), 200_000, 3),
        ],
        runBudget: { maxTokens: 1_300_000, maxCostUsd: 18 },
        maxRepairRounds: 0,
        maxPlanRevisionRounds: 0,
        triageMode: "advisory",
      },
      balanced: {
        stages: balancedStages,
        runBudget: { maxTokens: 7_500_000, maxCostUsd: 150 },
        maxRepairRounds: 1,
        maxPlanRevisionRounds: 1,
        triageMode: "advisory",
      },
      thorough: {
        stages: [
          stage("triage", JEV, 40_000, 0.05),
          stage("plan", worker("claude", "claude-opus-5-5", "xhigh"), 1_000_000, 30),
          stage("plan_review", worker("codex", "gpt-6.1-sol", "high"), 500_000, 12),
          stage("implement", worker("codex", "gpt-6.1-sol", "high"), 3_500_000, 90),
          stage("code_review", worker("claude", "claude-opus-5-5", "high"), 700_000, 18),
          stage("validate", worker("codex", "gpt-5.6-terra", "high"), 500_000, 8),
        ],
        runBudget: { maxTokens: 19_000_000, maxCostUsd: 480 },
        maxRepairRounds: 2,
        maxPlanRevisionRounds: 2,
        triageMode: "advisory",
      },
      custom: {
        stages: balancedStages.map((entry) => ({ ...entry, fallbacks: [] })),
        runBudget: { maxTokens: 7_500_000, maxCostUsd: 150 },
        maxRepairRounds: 1,
        maxPlanRevisionRounds: 1,
        triageMode: "advisory",
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Pure next-stage rules.
// ---------------------------------------------------------------------------

export type StageHistoryEntry = {
  stage: WorkflowStage;
  attempt: number;
  status: StageStatus;
  outcome: StageOutcome | null;
  /** Monotonic insertion order of the attempt (persisted row sequence). */
  seq: number;
};

export type BlockedReason =
  | "stage_blocked"
  | "stage_failed"
  | "needs_recovery"
  | "repair_cap_reached"
  | "revision_cap_reached"
  | "checks_failed";

export type NextStageDecision =
  | { kind: "dispatch"; stage: WorkflowStage; attempt: number; reason: "first" | "revision" | "repair" | "retry" }
  | { kind: "active"; stage: WorkflowStage; attempt: number }
  | { kind: "blocked"; stage: WorkflowStage; attempt: number; reason: BlockedReason }
  | { kind: "done" };

function latestAttempt(history: readonly StageHistoryEntry[], stageId: WorkflowStage) {
  let latest: StageHistoryEntry | null = null;
  for (const entry of history) {
    if (entry.stage === stageId && (!latest || entry.attempt > latest.attempt)) latest = entry;
  }
  return latest;
}

function completedWithOutcome(history: readonly StageHistoryEntry[], stageId: WorkflowStage, outcome: StageOutcome) {
  return history.filter((entry) => entry.stage === stageId && entry.status === "completed" && entry.outcome === outcome).length;
}

function repairsUsed(history: readonly StageHistoryEntry[]) {
  return completedWithOutcome(history, "code_review", "changes_requested") + completedWithOutcome(history, "validate", "failed_checks");
}

/**
 * Decide the single next eligible stage. Deterministic over persisted
 * history, so a restart recomputes the same answer.
 *
 * A stage's completion is only valid while it is newer (by `seq`) than the
 * latest completion of every upstream stage. Loops: a `plan_review` that
 * requests changes re-opens `plan`; a `code_review` requesting changes or a
 * `validate` with failed checks re-opens `implement`, each within its
 * bounded round cap. Re-opening an upstream stage invalidates every
 * downstream completion, which then runs again with a new attempt.
 */
export function computeNextStage(profile: ProfilePolicy, history: readonly StageHistoryEntry[]): NextStageDecision {
  const active = history.find((entry) => (ACTIVE_STAGE_STATUSES as readonly string[]).includes(entry.status));
  if (active) return { kind: "active", stage: active.stage, attempt: active.attempt };

  const stages = activeStages(profile);
  let upstreamSeq = -Infinity;
  for (const stageId of stages) {
    const latest = latestAttempt(history, stageId);
    const nextAttempt = (latest?.attempt ?? 0) + 1;
    if (!latest || latest.seq < upstreamSeq) {
      const reason = stageId === "implement" && repairsUsed(history) > 0
        ? "repair"
        : stageId === "plan" && completedWithOutcome(history, "plan_review", "changes_requested") > 0
          ? "revision"
          : "first";
      return { kind: "dispatch", stage: stageId, attempt: nextAttempt, reason };
    }
    switch (latest.status) {
      case "pending":
        return { kind: "dispatch", stage: stageId, attempt: latest.attempt, reason: "first" };
      case "cancelled":
        return { kind: "dispatch", stage: stageId, attempt: nextAttempt, reason: "retry" };
      case "blocked":
        return { kind: "blocked", stage: stageId, attempt: latest.attempt, reason: "stage_blocked" };
      case "failed":
        return { kind: "blocked", stage: stageId, attempt: latest.attempt, reason: "stage_failed" };
      case "needs_recovery":
        return { kind: "blocked", stage: stageId, attempt: latest.attempt, reason: "needs_recovery" };
      default:
        break;
    }
    if (stageId === "plan_review" && latest.outcome === "changes_requested") {
      if (completedWithOutcome(history, "plan_review", "changes_requested") > profile.maxPlanRevisionRounds) {
        return { kind: "blocked", stage: stageId, attempt: latest.attempt, reason: "revision_cap_reached" };
      }
      return { kind: "dispatch", stage: "plan", attempt: (latestAttempt(history, "plan")?.attempt ?? 0) + 1, reason: "revision" };
    }
    if ((stageId === "code_review" && latest.outcome === "changes_requested") || (stageId === "validate" && latest.outcome === "failed_checks")) {
      if (repairsUsed(history) > profile.maxRepairRounds) {
        return { kind: "blocked", stage: stageId, attempt: latest.attempt, reason: stageId === "validate" ? "checks_failed" : "repair_cap_reached" };
      }
      return { kind: "dispatch", stage: "implement", attempt: (latestAttempt(history, "implement")?.attempt ?? 0) + 1, reason: "repair" };
    }
    upstreamSeq = latest.seq;
  }
  return { kind: "done" };
}

/**
 * Hard gates: may `stage` be entered given the history? Every upstream
 * stage must hold a valid, passing completion. Used to refuse a manual
 * continue/retry that would skip an unmet gate.
 */
export function canEnterStage(profile: ProfilePolicy, history: readonly StageHistoryEntry[], stageId: WorkflowStage): boolean {
  const stages = activeStages(profile);
  const index = stages.indexOf(stageId);
  if (index < 0) return false;
  let upstreamSeq = -Infinity;
  for (let upstream = 0; upstream < index; upstream += 1) {
    const upstreamStage = stages[upstream]!;
    const latest = latestAttempt(history, upstreamStage);
    if (!latest || latest.status !== "completed" || latest.seq < upstreamSeq) return false;
    if (upstreamStage === "plan_review" && latest.outcome !== "approved") return false;
    if (upstreamStage === "code_review" && latest.outcome !== "approved") return false;
    if (upstreamStage === "validate" && latest.outcome !== "passed") return false;
    upstreamSeq = latest.seq;
  }
  return true;
}
