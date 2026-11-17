import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, or } from "drizzle-orm";
import { db, dbClient } from "@/server/db";
import { orchestrationStages, runs, settings } from "@/server/db/schema";
import { withSqliteBusyRetry } from "@/server/db/retry";
import { emitNamedEvent, type OrchestrationFailureCode, type OrchestrationRefusalReason, type SurfacedErrorCode } from "@/server/events/named-events";
import { redactHandoffText } from "@/server/handoff/redaction";
import {
  ACTIVE_STAGE_STATUSES,
  ORCHESTRATION_POLICY_SETTING_KEY,
  STAGE_OUTCOMES,
  computeNextStage,
  createDefaultOrchestrationPolicy,
  isTokenProfile,
  parseOrchestrationPolicy,
  resolveProfilePolicy,
  type ModelBinding,
  type OrchestrationPolicyV1,
  type PolicyValidationIssue,
  type ProfilePolicy,
  type StageHistoryEntry,
  type StageOutcome,
  type StagePolicy,
  type StageStatus,
  type TokenProfile,
  type WorkflowStage,
} from "@/shared/orchestration-policy";
import { getRunBudgetSummary, getStageLedger, reserveStageBudget, settleStageBudget, type StageUsage } from "./budget-ledger";
import {
  createDefaultPreflightContext,
  preflightStageBindings,
  type BindingPreflightContext,
  type BindingPreflightResult,
  type BindingPreflightStatus,
} from "./model-catalog";
import { decideTriageApplication, type TriageRecommendation } from "./prompts";
import type { StagePreflightReportDto, WorkflowPreflightReportDto, WorkflowSnapshotDto } from "@/shared/orchestration-api";

/**
 * Specialist orchestration service: the durable, transactional stage state
 * machine (plan 2026-11-04, Task 5).
 *
 * Every mutation follows the same order: validate policy/profile →
 * preflight the binding (no side effects) → claim the stage (a row in an
 * active status; a partial unique index makes the claim exclusive per
 * run) → reserve budget → emit → delegate to the stage's executor, which
 * reuses the existing planning/review/supervisor owners. Stage completion
 * arrives through `completeStage`/`signalStage` and settles the stage's
 * reservation exactly once.
 *
 * Nothing here silently returns: every refusal, block, fallback, dispatch,
 * completion, and failure is a named event, and user-actionable failures
 * also surface a stable `error.surfaced` code.
 */

export type StageRow = typeof orchestrationStages.$inferSelect;
export type RunRow = typeof runs.$inferSelect;

export class OrchestrationStageError extends Error {
  constructor(
    readonly code: OrchestrationFailureCode,
    message: string,
    readonly recoverable = false,
    readonly details: { handoffId?: string | null; executionRunId?: string | null } = {},
  ) {
    super(message);
    this.name = "OrchestrationStageError";
  }
}

export class OrchestrationRefusedError extends Error {
  constructor(readonly reason: OrchestrationRefusalReason, message: string) {
    super(message);
    this.name = "OrchestrationRefusedError";
  }
}

export type StageExecutionContext = {
  runId: string;
  run: RunRow;
  stage: StageRow;
  stagePolicy: StagePolicy;
  profile: ProfilePolicy;
  binding: ModelBinding;
  canonicalModel: string;
  reason: "first" | "revision" | "repair" | "retry";
  /** Findings of the stage that re-opened this one (revision/repair), as JSON text. */
  previousFindings: string | null;
};

export type StageDispatchResult =
  | {
      kind: "completed";
      outcome: StageOutcome;
      usage: StageUsage | null;
      effectiveModel?: string | null;
      findings?: unknown;
      workerId?: string | null;
    }
  | {
      kind: "waiting";
      workerId?: string | null;
      executionRunId?: string | null;
      externalRef?: string | null;
      handoffId?: string | null;
    };

export type StageExecutor = {
  dispatch: (context: StageExecutionContext) => Promise<StageDispatchResult>;
  /** Best-effort stop of whatever the stage started; failures are reported, not thrown. */
  cancel?: (context: { runId: string; stage: StageRow }) => Promise<void>;
};

export type StageExecutors = Record<WorkflowStage, StageExecutor>;

type ServiceOptions = {
  executors?: () => Promise<StageExecutors>;
  preflightContext?: () => Promise<BindingPreflightContext> | BindingPreflightContext;
  /** Advance to the next stage after a completion. On by default. */
  autoAdvance?: boolean;
};

export type DispatchResult =
  | { status: "dispatched"; stageId: string; stage: WorkflowStage; attempt: number; waiting: boolean }
  | { status: "completed_inline"; stageId: string; stage: WorkflowStage; attempt: number }
  | { status: "conflict"; stage: WorkflowStage | null }
  | { status: "blocked"; stage: WorkflowStage; stageId: string | null; code: OrchestrationFailureCode | string }
  | { status: "failed"; stageId: string; stage: WorkflowStage; code: OrchestrationFailureCode }
  | { status: "done" };

export type StagePreflightReport = StagePreflightReportDto;
export type WorkflowPreflightReport = WorkflowPreflightReportDto;
export type WorkflowSnapshot = WorkflowSnapshotDto;

const ACTIVE = ACTIVE_STAGE_STATUSES as readonly string[];
const ERROR_MESSAGE_CHARS = 600;

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function isUniqueViolation(error: unknown) {
  let current: unknown = error;
  for (let depth = 0; depth < 8 && current; depth += 1) {
    const message = current instanceof Error ? current.message : String(current);
    if (/UNIQUE constraint failed|SQLITE_CONSTRAINT_UNIQUE/i.test(message)) return true;
    current = current instanceof Error ? (current as Error & { cause?: unknown }).cause : undefined;
  }
  return false;
}

function preflightFailureCode(status: BindingPreflightStatus | null): OrchestrationFailureCode {
  switch (status) {
    case "identity_mismatch":
      return "identity_mismatch";
    case "quota_blocked":
      return "quota_blocked";
    case "credential_missing":
      return "credential_missing";
    default:
      return "binding_unavailable";
  }
}

function surfacedCodeFor(code: OrchestrationFailureCode): SurfacedErrorCode {
  switch (code) {
    case "identity_mismatch":
      return "orchestration.identity_mismatch";
    case "budget_exceeded":
      return "orchestration.budget_exceeded";
    case "dispatch_conflict":
      return "orchestration.dispatch_conflict";
    case "handoff_failed":
      return "orchestration.handoff_failed";
    case "binding_unavailable":
    case "quota_blocked":
    case "credential_missing":
      return "orchestration.binding_unavailable";
    case "interrupted_by_restart":
      return "orchestration.needs_recovery";
    default:
      return "orchestration.stage_failed";
  }
}

function toHistory(rows: readonly StageRow[]): StageHistoryEntry[] {
  return rows.map((row) => ({
    stage: row.stageKey as WorkflowStage,
    attempt: row.attempt,
    status: row.status as StageStatus,
    outcome: (STAGE_OUTCOMES as readonly string[]).includes(row.outcome ?? "") ? row.outcome as StageOutcome : null,
    seq: row.seq,
  }));
}

function bindingWorkerType(binding: ModelBinding) {
  return binding.kind === "worker" ? binding.workerType : null;
}

export async function loadSavedOrchestrationPolicy(): Promise<OrchestrationPolicyV1> {
  const row = await db.select().from(settings).where(eq(settings.key, ORCHESTRATION_POLICY_SETTING_KEY)).get();
  if (!row?.value) return createDefaultOrchestrationPolicy();
  const parsed = parseOrchestrationPolicy(row.value);
  if (parsed.ok) return parsed.policy;
  // A stored policy that no longer validates must not silently become a different one.
  emitNamedEvent({ kind: "orchestration.policy_rejected", source: "settings", issueCount: parsed.issues.length });
  emitNamedEvent({
    kind: "error.surfaced",
    code: "orchestration.invalid_policy",
    message: "The saved orchestration policy is invalid; the built-in defaults are used until it is fixed.",
    surface: "banner",
  });
  return createDefaultOrchestrationPolicy();
}

export async function saveOrchestrationPolicy(value: unknown): Promise<{ ok: true; policy: OrchestrationPolicyV1 } | { ok: false; issues: PolicyValidationIssue[] }> {
  const parsed = parseOrchestrationPolicy(value);
  if (!parsed.ok) {
    emitNamedEvent({ kind: "orchestration.policy_rejected", source: "settings", issueCount: parsed.issues.length });
    return parsed;
  }
  const serialized = JSON.stringify(parsed.policy);
  const now = new Date();
  await db.insert(settings).values({ key: ORCHESTRATION_POLICY_SETTING_KEY, value: serialized, updatedAt: now })
    .onConflictDoUpdate({ target: settings.key, set: { value: serialized, updatedAt: now } });
  emitNamedEvent({ kind: "orchestration.policy_saved", source: "settings" });
  return parsed;
}

export class OrchestrationService {
  private readonly loadExecutors: () => Promise<StageExecutors>;
  private readonly preflightContext: () => Promise<BindingPreflightContext> | BindingPreflightContext;
  private readonly autoAdvance: boolean;

  constructor(options: ServiceOptions = {}) {
    this.loadExecutors = options.executors ?? (async () => (await import("./stage-adapters")).createDefaultStageExecutors());
    this.preflightContext = options.preflightContext ?? (() => createDefaultPreflightContext());
    this.autoAdvance = options.autoAdvance ?? true;
  }

  // -------------------------------------------------------------------------
  // Policy / profile
  // -------------------------------------------------------------------------

  private async loadRun(runId: string) {
    return db.select().from(runs).where(eq(runs.id, runId)).get() ?? null;
  }

  private refuse(runId: string, action: "select_profile" | "dispatch" | "retry" | "cancel" | "create", reason: OrchestrationRefusalReason, message: string): never {
    emitNamedEvent({ kind: "orchestration.refused", runId, action, reason });
    if (reason === "profile_locked") {
      emitNamedEvent({ kind: "error.surfaced", code: "orchestration.profile_locked", message, surface: "toast", runId });
    }
    throw new OrchestrationRefusedError(reason, message);
  }

  /** Parsed policy and active profile of an orchestrated run, or null. */
  private workflowOf(run: RunRow): { policy: OrchestrationPolicyV1; profile: TokenProfile; profilePolicy: ProfilePolicy } | null {
    if (!run.orchestrationPolicyJson) return null;
    const parsed = parseOrchestrationPolicy(run.orchestrationPolicyJson);
    if (!parsed.ok) return null;
    const profile = isTokenProfile(run.orchestrationProfile) ? run.orchestrationProfile : parsed.policy.defaultProfile;
    return { policy: parsed.policy, profile, profilePolicy: resolveProfilePolicy(parsed.policy, profile) };
  }

  async createWorkflow(args: { runId: string; profile?: TokenProfile | null; policy?: unknown }) {
    const run = await this.loadRun(args.runId);
    if (!run) throw new Error("Conversation not found.");
    if (run.mode !== "implementation") {
      // Direct conversations are pinned to one CLI (HANDOFF_REQUIRED); a
      // multi-specialist workflow would have to mutate them. Refuse instead.
      this.refuse(run.id, "create", "unsupported_run", "Specialist workflows run in Omni conversations, not direct agent conversations.");
    }
    if (run.orchestrationPolicyJson) {
      const existing = this.workflowOf(run);
      if (existing) return { runId: run.id, profile: existing.profile, created: false };
    }
    let policy: OrchestrationPolicyV1;
    if (args.policy !== undefined && args.policy !== null) {
      const parsed = parseOrchestrationPolicy(args.policy);
      if (!parsed.ok) {
        emitNamedEvent({ kind: "orchestration.policy_rejected", source: "run", issueCount: parsed.issues.length });
        emitNamedEvent({ kind: "error.surfaced", code: "orchestration.invalid_policy", message: "The orchestration policy is invalid.", surface: "toast", runId: run.id });
        throw new OrchestrationRefusedError("invalid_profile", "The orchestration policy is invalid.");
      }
      policy = parsed.policy;
    } else {
      policy = await loadSavedOrchestrationPolicy();
    }
    if (args.profile !== undefined && args.profile !== null && !isTokenProfile(args.profile)) {
      this.refuse(run.id, "create", "invalid_profile", "Unknown token profile.");
    }
    const profile = args.profile ?? policy.defaultProfile;
    // Immutable snapshot: later edits of the saved default never change this run.
    // The IS NULL predicate makes concurrent creates race-safe.
    const claim = await dbClient.execute({
      sql: `UPDATE runs SET orchestration_policy_json = ?, orchestration_policy_version = ?, orchestration_profile = ?,
        orchestration_profile_source = ?, updated_at = ? WHERE id = ? AND orchestration_policy_json IS NULL`,
      args: [JSON.stringify(policy), policy.version, profile, args.profile ? "user" : "default", nowSeconds(), run.id],
    });
    if (claim.rowsAffected === 0) {
      const latest = await this.loadRun(run.id);
      const existing = latest ? this.workflowOf(latest) : null;
      return { runId: run.id, profile: existing?.profile ?? profile, created: false };
    }
    emitNamedEvent({ kind: "orchestration.workflow_created", runId: run.id, profile, policyVersion: policy.version });
    return { runId: run.id, profile, created: true };
  }

  async selectProfile(args: { runId: string; profile: string; source?: "user" | "triage" }) {
    const run = await this.loadRun(args.runId);
    if (!run) throw new Error("Conversation not found.");
    if (!this.workflowOf(run)) this.refuse(args.runId, "select_profile", "no_workflow", "This conversation has no orchestration workflow.");
    if (!isTokenProfile(args.profile)) this.refuse(args.runId, "select_profile", "invalid_profile", "Unknown token profile.");
    const source = args.source ?? "user";
    const updated = await dbClient.execute({
      sql: `UPDATE runs SET orchestration_profile = ?, orchestration_profile_source = ?, updated_at = ?
        WHERE id = ? AND orchestration_profile_locked_at IS NULL
        ${source === "triage" ? "AND COALESCE(orchestration_profile_source, 'default') <> 'user'" : ""}`,
      args: [args.profile, source, nowSeconds(), args.runId],
    });
    if (updated.rowsAffected === 0) {
      this.refuse(args.runId, "select_profile", "profile_locked", "The token profile can no longer change: the workflow has started.");
    }
    emitNamedEvent({ kind: "orchestration.profile_selected", runId: args.runId, profile: args.profile, source });
    return { runId: args.runId, profile: args.profile };
  }

  /** Record (and, within its guardrails, apply) a triage recommendation. */
  async applyTriageRecommendation(runId: string, recommendation: TriageRecommendation | null) {
    const run = await this.loadRun(runId);
    const workflow = run ? this.workflowOf(run) : null;
    if (!run || !workflow) return { applied: false };
    if (!recommendation) {
      emitNamedEvent({ kind: "orchestration.triage_ignored", runId, requestId: null, reason: "no_recommendation" });
      return { applied: false };
    }
    const decision = decideTriageApplication({
      recommendation,
      currentProfile: workflow.profile,
      userSelected: run.orchestrationProfileSource === "user" || run.orchestrationProfileLockedAt !== null,
    });
    await db.update(runs).set({ orchestrationTriageJson: JSON.stringify(recommendation), updatedAt: new Date() }).where(eq(runs.id, runId));
    let applied = false;
    if (decision.action === "apply") {
      try {
        await this.selectProfile({ runId, profile: decision.profile, source: "triage" });
        applied = true;
      } catch (error) {
        if (!(error instanceof OrchestrationRefusedError)) throw error;
      }
    }
    emitNamedEvent({
      kind: "orchestration.triage_recommended",
      runId,
      requestId: recommendation.requestId,
      profile: recommendation.recommendedProfile,
      confidence: recommendation.confidence,
      applied,
      reason: decision.action === "apply" ? "applied" : decision.reason,
    });
    return { applied };
  }

  // -------------------------------------------------------------------------
  // Preflight (no writes)
  // -------------------------------------------------------------------------

  async preflightProfile(runId: string | null, profile: TokenProfile, profilePolicy: ProfilePolicy): Promise<WorkflowPreflightReport> {
    const context = await this.preflightContext();
    const stages: StagePreflightReport[] = [];
    for (const stagePolicy of profilePolicy.stages) {
      if (stagePolicy.stage === "triage" && profilePolicy.triageMode === "off") continue;
      const result = await preflightStageBindings({
        primary: stagePolicy.binding,
        fallbacks: stagePolicy.fallbacks,
        allowFallbacks: profile !== "custom",
      }, context);
      stages.push(this.reportStage(stagePolicy.stage, result));
    }
    // Triage is advisory: an unavailable Jev never blocks the workflow.
    const ready = stages.every((stage) => stage.stage === "triage" || stage.status === "ready");
    if (runId) {
      emitNamedEvent({
        kind: "orchestration.preflight_completed",
        runId,
        profile,
        ready,
        blockedStages: stages.filter((stage) => stage.status !== "ready").map((stage) => stage.stage),
      });
    }
    return { runId: runId ?? "", profile, ready, stages };
  }

  private reportStage(stage: WorkflowStage, result: { selected: BindingPreflightResult | null; usedFallback: boolean; attempts: BindingPreflightResult[] }): StagePreflightReport {
    return {
      stage,
      status: result.selected?.status ?? result.attempts.at(-1)?.status ?? "unavailable",
      selected: result.selected
        ? { binding: result.selected.binding, canonicalModel: result.selected.canonicalModel, usedFallback: result.usedFallback }
        : null,
      attempts: result.attempts.map((attempt) => ({
        status: attempt.status,
        model: attempt.binding.model,
        workerType: bindingWorkerType(attempt.binding),
        diagnostics: attempt.diagnostics,
      })),
    };
  }

  async preflightWorkflow(runId: string): Promise<WorkflowPreflightReport> {
    const run = await this.loadRun(runId);
    const workflow = run ? this.workflowOf(run) : null;
    if (!workflow) throw new OrchestrationRefusedError("no_workflow", "This conversation has no orchestration workflow.");
    return this.preflightProfile(runId, workflow.profile, workflow.profilePolicy);
  }

  // -------------------------------------------------------------------------
  // Dispatch
  // -------------------------------------------------------------------------

  async listStages(runId: string) {
    return db.select().from(orchestrationStages).where(eq(orchestrationStages.runId, runId)).orderBy(asc(orchestrationStages.seq));
  }

  private async insertStage(values: {
    runId: string;
    stage: WorkflowStage;
    attempt: number;
    status: StageStatus;
    binding: ModelBinding;
    canonicalModel: string | null;
    usedFallback: boolean;
    failureCode?: string | null;
    lastError?: string | null;
    outcome?: StageOutcome | null;
  }) {
    const id = randomUUID();
    const now = nowSeconds();
    // seq is allocated inside the insert; (run_id, seq) is unique, so a racing insert fails instead of reusing it.
    await withSqliteBusyRetry(() => dbClient.execute({
      sql: `INSERT INTO orchestration_stages
        (id, run_id, stage_key, attempt, seq, status, outcome, binding_json, requested_worker_type, requested_model, used_fallback, claim_token, failure_code, last_error, claimed_at, completed_at, created_at, updated_at)
        SELECT ?, ?, ?, ?, COALESCE(MAX(seq), 0) + 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        FROM orchestration_stages WHERE run_id = ?`,
      args: [
        id, values.runId, values.stage, values.attempt, values.status, values.outcome ?? null, JSON.stringify(values.binding),
        bindingWorkerType(values.binding), values.canonicalModel ?? values.binding.model, values.usedFallback ? 1 : 0,
        randomUUID(), values.failureCode ?? null, values.lastError ?? null,
        ACTIVE.includes(values.status) ? now : null, values.status === "completed" ? now : null, now, now, values.runId,
      ],
    }));
    return id;
  }

  private surface(code: OrchestrationFailureCode, runId: string, message: string, surface: "toast" | "banner" | "log" = "banner") {
    emitNamedEvent({ kind: "error.surfaced", code: surfacedCodeFor(code), message: redactHandoffText(message, ERROR_MESSAGE_CHARS), surface, runId });
  }

  async dispatchNextStage(runId: string): Promise<DispatchResult> {
    const run = await this.loadRun(runId);
    if (!run) throw new Error("Conversation not found.");
    const workflow = this.workflowOf(run);
    if (!workflow) this.refuse(runId, "dispatch", "no_workflow", "This conversation has no orchestration workflow.");
    if (run.orchestrationCancelledAt) this.refuse(runId, "dispatch", "workflow_cancelled", "The workflow was cancelled.");

    const rows = await this.listStages(runId);
    const next = computeNextStage(workflow.profilePolicy, toHistory(rows));
    if (next.kind === "active") {
      emitNamedEvent({ kind: "orchestration.refused", runId, action: "dispatch", reason: "stage_active" });
      return { status: "conflict", stage: next.stage };
    }
    if (next.kind === "done") {
      emitNamedEvent({ kind: "orchestration.workflow_completed", runId });
      return { status: "done" };
    }
    if (next.kind === "blocked") {
      emitNamedEvent({ kind: "orchestration.workflow_blocked", runId, stage: next.stage, reason: next.reason });
      const row = rows.find((candidate) => candidate.stageKey === next.stage && candidate.attempt === next.attempt) ?? null;
      return { status: "blocked", stage: next.stage, stageId: row?.id ?? null, code: row?.failureCode ?? next.reason };
    }

    const stagePolicy = workflow.profilePolicy.stages.find((entry) => entry.stage === next.stage);
    if (!stagePolicy) throw new Error(`Profile has no policy for stage ${next.stage}.`);

    // 1. Preflight (pure inspection).
    const context = await this.preflightContext();
    const preflight = await preflightStageBindings({
      primary: stagePolicy.binding,
      fallbacks: stagePolicy.fallbacks,
      allowFallbacks: workflow.profile !== "custom",
    }, context);
    if (!preflight.selected && next.stage === "triage") {
      // Triage is advisory: an unavailable Jev keeps the selected/default
      // profile and never blocks or escalates the workflow.
      let triageId: string;
      try {
        triageId = await this.insertStage({
          runId, stage: "triage", attempt: next.attempt, status: "completed", outcome: "advisory", binding: stagePolicy.binding,
          canonicalModel: null, usedFallback: false, failureCode: preflightFailureCode(preflight.attempts.at(-1)?.status ?? null),
        });
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        return this.conflict(runId, next.stage);
      }
      emitNamedEvent({ kind: "orchestration.triage_ignored", runId, requestId: null, reason: "binding_unavailable" });
      emitNamedEvent({ kind: "orchestration.stage_completed", runId, stageId: triageId, stage: "triage", attempt: next.attempt, outcome: "advisory", effectiveModel: null });
      if (this.autoAdvance) this.advanceInBackground(runId);
      return { status: "completed_inline", stageId: triageId, stage: "triage", attempt: next.attempt };
    }
    if (!preflight.selected) {
      const lastStatus = preflight.attempts.at(-1)?.status ?? null;
      const code = preflightFailureCode(lastStatus);
      const diagnostics = preflight.attempts.flatMap((attempt) => attempt.diagnostics).join(", ");
      let stageId: string | null = null;
      try {
        stageId = await this.insertStage({
          runId, stage: next.stage, attempt: next.attempt, status: "blocked", binding: stagePolicy.binding,
          canonicalModel: null, usedFallback: false, failureCode: code, lastError: diagnostics || null,
        });
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        return this.conflict(runId, next.stage);
      }
      emitNamedEvent({ kind: "orchestration.stage_blocked", runId, stageId, stage: next.stage, attempt: next.attempt, code });
      this.surface(code, runId, `The ${next.stage} stage cannot start: model binding ${stagePolicy.binding.model} is ${lastStatus ?? "unavailable"} (${diagnostics || "no diagnostics"}).`);
      return { status: "blocked", stage: next.stage, stageId, code };
    }
    const selected = preflight.selected;
    if (preflight.usedFallback) {
      emitNamedEvent({ kind: "orchestration.fallback_selected", runId, stage: next.stage, fromModel: stagePolicy.binding.model, toModel: selected.binding.model });
    }

    // 2. Claim. The partial unique index admits one active stage per run.
    let stageId: string;
    try {
      stageId = await this.insertStage({
        runId, stage: next.stage, attempt: next.attempt, status: "preflight", binding: selected.binding,
        canonicalModel: selected.canonicalModel, usedFallback: preflight.usedFallback,
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      return this.conflict(runId, next.stage);
    }
    emitNamedEvent({ kind: "orchestration.stage_claimed", runId, stageId, stage: next.stage, attempt: next.attempt, reason: next.reason });

    // 3. Reserve budget against the stage and run caps.
    const reservation = await reserveStageBudget({ runId, stageId, stageBudget: stagePolicy.budget, runBudget: workflow.profilePolicy.runBudget });
    if (!reservation.ok) {
      await db.update(orchestrationStages).set({
        status: "blocked",
        failureCode: "budget_exceeded",
        lastError: reservation.reason,
        updatedAt: new Date(),
      }).where(eq(orchestrationStages.id, stageId));
      emitNamedEvent({ kind: "orchestration.stage_blocked", runId, stageId, stage: next.stage, attempt: next.attempt, code: "budget_exceeded" });
      this.surface("budget_exceeded", runId, reservation.reason === "stage_cap"
        ? `The ${next.stage} stage would exceed its token or cost cap.`
        : `The ${next.stage} stage would exceed the workflow's token or cost cap (${reservation.committedTokens} tokens already committed). Raise the cap or choose another profile, then retry.`);
      return { status: "blocked", stage: next.stage, stageId, code: "budget_exceeded" };
    }
    emitNamedEvent({ kind: "orchestration.budget_reserved", runId, stageId, tokens: reservation.tokens, costUsd: reservation.costUsd, duplicate: reservation.duplicate });

    // 4. Lock the profile once real (non-advisory) work starts.
    if (next.stage !== "triage" && !run.orchestrationProfileLockedAt) {
      await dbClient.execute({
        sql: "UPDATE runs SET orchestration_profile_locked_at = ?, updated_at = ? WHERE id = ? AND orchestration_profile_locked_at IS NULL",
        args: [nowSeconds(), nowSeconds(), runId],
      });
    }

    await db.update(orchestrationStages).set({ status: "dispatched", updatedAt: new Date() }).where(eq(orchestrationStages.id, stageId));
    const stage = (await db.select().from(orchestrationStages).where(eq(orchestrationStages.id, stageId)).get())!;
    emitNamedEvent({
      kind: "orchestration.stage_dispatched",
      runId,
      stageId,
      stage: next.stage,
      attempt: next.attempt,
      workerType: bindingWorkerType(selected.binding),
      requestedModel: selected.canonicalModel ?? selected.binding.model,
      usedFallback: preflight.usedFallback,
      executionRunId: null,
    });

    // 5. Delegate to the existing stage owner.
    const previousFindings = next.reason === "revision" || next.reason === "repair"
      ? this.previousFindings(rows, next.stage)
      : null;
    let result: StageDispatchResult;
    try {
      const executors = await this.loadExecutors();
      result = await executors[next.stage].dispatch({
        runId,
        run: (await this.loadRun(runId)) ?? run,
        stage,
        stagePolicy,
        profile: workflow.profilePolicy,
        binding: selected.binding,
        canonicalModel: selected.canonicalModel ?? selected.binding.model,
        reason: next.reason,
        previousFindings,
      });
    } catch (error) {
      const stageError = error instanceof OrchestrationStageError
        ? error
        : new OrchestrationStageError("adapter_failed", error instanceof Error ? error.message : String(error));
      if (!(error instanceof OrchestrationStageError)) {
        emitNamedEvent({ kind: "orchestration.adapter_failed", runId, stageId, reason: redactHandoffText(stageError.message, 300) });
      }
      await this.failStage({ stageId, code: stageError.code, message: stageError.message, recoverable: stageError.recoverable, handoffId: stageError.details.handoffId ?? null });
      return { status: "failed", stageId, stage: next.stage, code: stageError.code };
    }

    if (result.kind === "completed") {
      await this.completeStage({ stageId, outcome: result.outcome, usage: result.usage, effectiveModel: result.effectiveModel ?? null, findings: result.findings, workerId: result.workerId ?? null });
      return { status: "completed_inline", stageId, stage: next.stage, attempt: next.attempt };
    }
    await db.update(orchestrationStages).set({
      status: "waiting",
      workerId: result.workerId ?? null,
      executionRunId: result.executionRunId ?? runId,
      externalRef: result.externalRef ?? null,
      handoffId: result.handoffId ?? null,
      updatedAt: new Date(),
    }).where(and(eq(orchestrationStages.id, stageId), eq(orchestrationStages.status, "dispatched")));
    if (result.handoffId) {
      emitNamedEvent({ kind: "orchestration.handoff_started", runId, stageId, handoffId: result.handoffId, targetWorkerType: bindingWorkerType(selected.binding) ?? "" });
    }
    emitNamedEvent({ kind: "orchestration.stage_waiting", runId, stageId, stage: next.stage, externalRef: result.externalRef ?? null });
    return { status: "dispatched", stageId, stage: next.stage, attempt: next.attempt, waiting: true };
  }

  private conflict(runId: string, stage: WorkflowStage): DispatchResult {
    emitNamedEvent({ kind: "orchestration.refused", runId, action: "dispatch", reason: "stage_active" });
    this.surface("dispatch_conflict", runId, "Another dispatch of this workflow stage is already in progress.", "log");
    return { status: "conflict", stage };
  }

  /** Findings of the latest review/validation that re-opened `stage`. */
  private previousFindings(rows: readonly StageRow[], stage: WorkflowStage) {
    const sources: WorkflowStage[] = stage === "plan" ? ["plan_review"] : ["code_review", "validate"];
    const latest = [...rows].reverse().find((row) => sources.includes(row.stageKey as WorkflowStage) && row.status === "completed");
    return latest?.findingsJson ?? null;
  }

  // -------------------------------------------------------------------------
  // Completion / failure / signals
  // -------------------------------------------------------------------------

  async completeStage(args: {
    stageId: string;
    outcome: StageOutcome;
    usage: StageUsage | null;
    effectiveModel?: string | null;
    findings?: unknown;
    workerId?: string | null;
  }) {
    const now = new Date();
    const updated = await db.update(orchestrationStages).set({
      status: "completed",
      outcome: args.outcome,
      effectiveModel: args.effectiveModel ?? null,
      findingsJson: args.findings === undefined || args.findings === null ? null : redactHandoffText(JSON.stringify(args.findings), 16_000),
      ...(args.workerId ? { workerId: args.workerId } : {}),
      completedAt: now,
      updatedAt: now,
    }).where(and(eq(orchestrationStages.id, args.stageId), inArray(orchestrationStages.status, [...ACTIVE])))
      .returning();
    const row = updated[0];
    if (!row) {
      const existing = await db.select().from(orchestrationStages).where(eq(orchestrationStages.id, args.stageId)).get();
      if (existing) {
        emitNamedEvent({ kind: "orchestration.stage_signal_ignored", runId: existing.runId, stage: existing.stageKey as WorkflowStage, reason: "already_terminal" });
      }
      return { completed: false };
    }
    const settlement = await settleStageBudget({ runId: row.runId, stageId: row.id, usage: args.usage });
    emitNamedEvent({ kind: "orchestration.budget_settled", runId: row.runId, stageId: row.id, usageUnknown: settlement.usageUnknown, duplicate: settlement.duplicate });
    emitNamedEvent({
      kind: "orchestration.stage_completed",
      runId: row.runId,
      stageId: row.id,
      stage: row.stageKey as WorkflowStage,
      attempt: row.attempt,
      outcome: args.outcome,
      effectiveModel: args.effectiveModel ?? null,
    });
    if (this.autoAdvance) this.advanceInBackground(row.runId);
    return { completed: true };
  }

  private advanceInBackground(runId: string) {
    void this.dispatchNextStage(runId).catch((error) => {
      emitNamedEvent({ kind: "orchestration.adapter_failed", runId, stageId: null, reason: redactHandoffText(error instanceof Error ? error.message : String(error), 300) });
    });
  }

  async failStage(args: { stageId: string; code: OrchestrationFailureCode; message: string; recoverable: boolean; usage?: StageUsage | null; handoffId?: string | null }) {
    const now = new Date();
    const status: StageStatus = args.recoverable ? "needs_recovery" : "failed";
    const updated = await db.update(orchestrationStages).set({
      status,
      failureCode: args.code,
      lastError: redactHandoffText(args.message, ERROR_MESSAGE_CHARS),
      ...(args.handoffId ? { handoffId: args.handoffId } : {}),
      updatedAt: now,
    }).where(and(eq(orchestrationStages.id, args.stageId), inArray(orchestrationStages.status, [...ACTIVE])))
      .returning();
    const row = updated[0];
    if (!row) return { failed: false };
    if (!args.recoverable) {
      // A failed attempt is final: settle it (usage unknown unless reported).
      const settlement = await settleStageBudget({ runId: row.runId, stageId: row.id, usage: args.usage ?? null });
      emitNamedEvent({ kind: "orchestration.budget_settled", runId: row.runId, stageId: row.id, usageUnknown: settlement.usageUnknown, duplicate: settlement.duplicate });
    }
    emitNamedEvent({ kind: "orchestration.stage_failed", runId: row.runId, stageId: row.id, stage: row.stageKey as WorkflowStage, attempt: row.attempt, code: args.code, recoverable: args.recoverable });
    this.surface(args.code, row.runId, args.recoverable
      ? `The ${row.stageKey} stage needs attention before it can continue: ${args.message}`
      : `The ${row.stageKey} stage failed: ${args.message}`);
    return { failed: true };
  }

  /**
   * An existing stage owner (plan review, code review, supervisor) reported a
   * terminal result for a run. Finds the matching active stage — on the
   * workflow run or on the run it executes in after a handoff — and settles
   * it. Signals for runs without a waiting stage are ignored with an event.
   */
  async signalStage(args: {
    runId: string;
    stage: WorkflowStage;
    externalRef?: string | null;
    result: { kind: "completed"; outcome: StageOutcome; usage?: StageUsage | null; effectiveModel?: string | null; findings?: unknown; workerId?: string | null }
      | { kind: "failed"; code: OrchestrationFailureCode; message: string; recoverable?: boolean };
  }) {
    const candidates = await db.select().from(orchestrationStages).where(and(
      or(eq(orchestrationStages.runId, args.runId), eq(orchestrationStages.executionRunId, args.runId)),
      eq(orchestrationStages.stageKey, args.stage),
      inArray(orchestrationStages.status, [...ACTIVE]),
    ));
    const row = candidates[0];
    if (!row) return { matched: false };
    if (args.externalRef && row.externalRef && row.externalRef !== args.externalRef) {
      emitNamedEvent({ kind: "orchestration.stage_signal_ignored", runId: row.runId, stage: args.stage, reason: "stale_ref" });
      return { matched: false };
    }
    if (args.result.kind === "completed") {
      await this.completeStage({
        stageId: row.id,
        outcome: args.result.outcome,
        usage: args.result.usage ?? null,
        effectiveModel: args.result.effectiveModel ?? null,
        findings: args.result.findings,
        workerId: args.result.workerId ?? null,
      });
    } else {
      await this.failStage({ stageId: row.id, code: args.result.code, message: args.result.message, recoverable: args.result.recoverable ?? false });
    }
    return { matched: true, stageId: row.id };
  }

  /** Does `runId` (or a run it handed off to) have an orchestrated workflow? */
  async isOrchestrated(runId: string) {
    const run = await this.loadRun(runId);
    if (run?.orchestrationPolicyJson) return true;
    const linked = await db.select({ id: orchestrationStages.id }).from(orchestrationStages).where(eq(orchestrationStages.executionRunId, runId)).get();
    return Boolean(linked);
  }

  // -------------------------------------------------------------------------
  // User controls
  // -------------------------------------------------------------------------

  async retryStage(runId: string) {
    const run = await this.loadRun(runId);
    const workflow = run ? this.workflowOf(run) : null;
    if (!run || !workflow) this.refuse(runId, "retry", "no_workflow", "This conversation has no orchestration workflow.");
    if (run.orchestrationCancelledAt) this.refuse(runId, "retry", "workflow_cancelled", "The workflow was cancelled.");
    const rows = await this.listStages(runId);
    const next = computeNextStage(workflow.profilePolicy, toHistory(rows));
    if (next.kind === "active") this.refuse(runId, "retry", "stage_active", "A stage is still running.");
    if (next.kind !== "blocked") this.refuse(runId, "retry", "nothing_to_retry", "There is no blocked stage to retry.");
    if (next.reason === "repair_cap_reached" || next.reason === "revision_cap_reached" || next.reason === "checks_failed") {
      // A cap reached by completed reviews is the user's decision, not a retry.
      this.refuse(runId, "retry", "gate_unmet", "The review loop reached its round limit; review the findings before continuing.");
    }
    const row = rows.find((candidate) => candidate.stageKey === next.stage && candidate.attempt === next.attempt);
    if (!row) this.refuse(runId, "retry", "nothing_to_retry", "There is no blocked stage to retry.");
    const ledger = await getStageLedger(row.id);
    if (ledger.reservation && !ledger.settlement) {
      const settlement = await settleStageBudget({ runId, stageId: row.id, usage: null });
      emitNamedEvent({ kind: "orchestration.budget_settled", runId, stageId: row.id, usageUnknown: settlement.usageUnknown, duplicate: settlement.duplicate });
    }
    const updated = await db.update(orchestrationStages).set({ status: "cancelled", updatedAt: new Date() })
      .where(and(eq(orchestrationStages.id, row.id), inArray(orchestrationStages.status, ["blocked", "failed", "needs_recovery"])))
      .returning({ id: orchestrationStages.id });
    if (updated.length === 0) this.refuse(runId, "retry", "stage_active", "The stage changed while retrying.");
    emitNamedEvent({ kind: "orchestration.stage_retried", runId, stageId: row.id, stage: row.stageKey as WorkflowStage, attempt: row.attempt + 1 });
    return this.dispatchNextStage(runId);
  }

  async cancelWorkflow(runId: string) {
    const run = await this.loadRun(runId);
    if (!run || !this.workflowOf(run)) this.refuse(runId, "cancel", "no_workflow", "This conversation has no orchestration workflow.");
    await db.update(runs).set({ orchestrationCancelledAt: new Date(), updatedAt: new Date() }).where(eq(runs.id, runId));
    const active = await db.select().from(orchestrationStages).where(and(
      eq(orchestrationStages.runId, runId),
      inArray(orchestrationStages.status, [...ACTIVE]),
    ));
    let cancelled = 0;
    const executors = active.length > 0 ? await this.loadExecutors() : null;
    for (const row of active) {
      const updated = await db.update(orchestrationStages).set({ status: "cancelled", failureCode: "cancelled", updatedAt: new Date() })
        .where(and(eq(orchestrationStages.id, row.id), inArray(orchestrationStages.status, [...ACTIVE])))
        .returning({ id: orchestrationStages.id });
      if (updated.length === 0) continue;
      cancelled += 1;
      const settlement = await settleStageBudget({ runId, stageId: row.id, usage: null });
      emitNamedEvent({ kind: "orchestration.budget_settled", runId, stageId: row.id, usageUnknown: settlement.usageUnknown, duplicate: settlement.duplicate });
      try {
        await executors?.[row.stageKey as WorkflowStage]?.cancel?.({ runId, stage: row });
      } catch (error) {
        emitNamedEvent({ kind: "orchestration.adapter_failed", runId, stageId: row.id, reason: redactHandoffText(error instanceof Error ? error.message : String(error), 300) });
      }
    }
    emitNamedEvent({ kind: "orchestration.workflow_cancelled", runId, cancelledStages: cancelled });
    return { cancelledStages: cancelled };
  }

  // -------------------------------------------------------------------------
  // Snapshot projection
  // -------------------------------------------------------------------------

  async getWorkflowSnapshot(runId: string): Promise<WorkflowSnapshot | null> {
    const run = await this.loadRun(runId);
    const workflow = run ? this.workflowOf(run) : null;
    if (!run || !workflow) return null;
    const rows = await this.listStages(runId);
    const ledgers = await Promise.all(rows.map((row) => getStageLedger(row.id)));
    let triage: unknown = null;
    try {
      triage = run.orchestrationTriageJson ? JSON.parse(run.orchestrationTriageJson) : null;
    } catch {
      triage = null;
    }
    const source = run.orchestrationProfileSource;
    return {
      runId,
      profile: workflow.profile,
      profileSource: source === "user" || source === "triage" ? source : "default",
      locked: run.orchestrationProfileLockedAt !== null,
      cancelled: run.orchestrationCancelledAt !== null,
      policyVersion: workflow.policy.version,
      profilePolicy: workflow.profilePolicy,
      stages: rows.map((row, index) => {
        const ledger = ledgers[index]!;
        return {
          id: row.id,
          stage: row.stageKey as WorkflowStage,
          attempt: row.attempt,
          seq: row.seq,
          status: row.status as StageStatus,
          outcome: (row.outcome as StageOutcome | null) ?? null,
          requestedWorkerType: row.requestedWorkerType,
          requestedModel: row.requestedModel,
          effectiveModel: row.effectiveModel,
          usedFallback: row.usedFallback,
          workerId: row.workerId,
          executionRunId: row.executionRunId,
          handoffId: row.handoffId,
          failureCode: row.failureCode,
          lastError: row.lastError,
          reservedTokens: ledger.reservation?.tokens ?? null,
          reservedCostUsd: ledger.reservation?.costUsd ?? null,
          settled: Boolean(ledger.settlement),
          usageUnknown: ledger.settlement?.usageUnknown ?? false,
          settledTokens: ledger.settlement?.tokens ?? null,
          settledCostUsd: ledger.settlement?.costUsd ?? null,
          createdAt: row.createdAt.toISOString(),
          completedAt: row.completedAt ? row.completedAt.toISOString() : null,
        };
      }),
      budget: await getRunBudgetSummary(runId),
      next: computeNextStage(workflow.profilePolicy, toHistory(rows)),
      triage,
    };
  }
}

export const orchestrationService = new OrchestrationService();
