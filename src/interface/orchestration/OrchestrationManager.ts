import { StateManager } from "@/lib/state-manager";
import type { RuntimeAPIs } from "@/runtime-api/types";
import type {
  OrchestrationAction,
  OrchestrationPolicyResponse,
  OrchestrationPolicySaveResponse,
  OrchestrationPreflightResponse,
  RunOrchestrationActionResponse,
  RunOrchestrationResponse,
  WorkflowPreflightReportDto,
  WorkflowSnapshotDto,
} from "@/shared/orchestration-api";
import {
  TOKEN_PROFILES,
  parseOrchestrationPolicy,
  type ModelBinding,
  type OrchestrationPolicyV1,
  type PolicyValidationIssue,
  type StageBudget,
  type TokenProfile,
  type WorkflowStage,
} from "@/shared/orchestration-policy";

/**
 * Global client source of truth for specialist orchestration (plan Task 9):
 * the policy draft, per-profile preflight reports, and per-run workflow
 * snapshots. Components subscribe and call these methods; they own no
 * workflow state. Snapshots are refreshed from the server on every
 * `orchestration.*` named event, so a reconnecting client needs no side
 * channel. The model is credential-free by construction: policies are
 * validated by the shared parser, which refuses anything secret-shaped.
 */

export type OrchestrationApi = RuntimeAPIs["orchestration"];

type LoadStatus = "idle" | "loading" | "ready" | "error";

export type PreflightEntry = { status: LoadStatus; report: WorkflowPreflightReportDto | null };

export type WorkflowEntry = {
  status: LoadStatus;
  snapshot: WorkflowSnapshotDto | null;
  pendingAction: OrchestrationAction | null;
  /** Stable refusal/conflict id from the last action; translated at render time. */
  lastRefusal: string | null;
  lastError: boolean;
};

export type OrchestrationState = {
  policyStatus: LoadStatus;
  savedPolicy: OrchestrationPolicyV1 | null;
  defaultPolicy: OrchestrationPolicyV1 | null;
  draft: OrchestrationPolicyV1 | null;
  draftIssues: PolicyValidationIssue[];
  saveStatus: "idle" | "saving" | "saved" | "error";
  preflightByProfile: Readonly<Partial<Record<TokenProfile, PreflightEntry>>>;
  workflowByRunId: Readonly<Record<string, WorkflowEntry>>;
  /** Profile chosen for starting a workflow in a run that has none yet. */
  startProfileByRunId: Readonly<Record<string, TokenProfile>>;
};

const EMPTY_WORKFLOW: WorkflowEntry = { status: "idle", snapshot: null, pendingAction: null, lastRefusal: null, lastError: false };

function clonePolicy(policy: OrchestrationPolicyV1): OrchestrationPolicyV1 {
  return JSON.parse(JSON.stringify(policy)) as OrchestrationPolicyV1;
}

function validate(policy: OrchestrationPolicyV1): PolicyValidationIssue[] {
  const parsed = parseOrchestrationPolicy(policy);
  return parsed.ok ? [] : parsed.issues;
}

export class OrchestrationManager extends StateManager<OrchestrationState> {
  private readonly inflightWorkflow = new Map<string, Promise<void>>();
  private readonly staleWorkflow = new Set<string>();
  /** The API the views loaded workflows with; named events refresh through it. */
  private boundApi: OrchestrationApi | null = null;

  constructor(initial: Partial<OrchestrationState> = {}) {
    super({
      policyStatus: "idle",
      savedPolicy: null,
      defaultPolicy: null,
      draft: null,
      draftIssues: [],
      saveStatus: "idle",
      preflightByProfile: {},
      workflowByRunId: {},
      startProfileByRunId: {},
      ...initial,
    });
  }

  // -------------------------------------------------------------------------
  // Policy draft
  // -------------------------------------------------------------------------

  async loadPolicy(api: OrchestrationApi) {
    this.patch({ policyStatus: "loading" });
    try {
      const response = await api.getPolicy() as OrchestrationPolicyResponse;
      this.patch({
        policyStatus: "ready",
        savedPolicy: response.policy,
        defaultPolicy: response.defaults,
        draft: clonePolicy(response.policy),
        draftIssues: [],
        saveStatus: "idle",
      });
    } catch {
      this.patch({ policyStatus: "error" });
    }
  }

  private updateDraft(mutate: (draft: OrchestrationPolicyV1) => void) {
    this.update((current) => {
      if (!current.draft) return current;
      const draft = clonePolicy(current.draft);
      mutate(draft);
      return { ...current, draft, draftIssues: validate(draft), saveStatus: "idle" };
    });
  }

  setDefaultProfile(profile: TokenProfile) {
    this.updateDraft((draft) => {
      draft.defaultProfile = profile;
    });
  }

  /** Only the custom profile is edited by hand; built-in profiles come from the server. */
  updateCustomBinding(stage: WorkflowStage, patch: Partial<Pick<Extract<ModelBinding, { kind: "worker" }>, "workerType" | "model" | "effort">>) {
    this.updateDraft((draft) => {
      const entry = draft.profiles.custom.stages.find((candidate) => candidate.stage === stage);
      if (!entry || entry.binding.kind !== "worker") return;
      entry.binding = { ...entry.binding, ...patch };
    });
  }

  updateCustomStageBudget(stage: WorkflowStage, budget: Partial<StageBudget>) {
    this.updateDraft((draft) => {
      const entry = draft.profiles.custom.stages.find((candidate) => candidate.stage === stage);
      if (entry) entry.budget = { ...entry.budget, ...budget };
    });
  }

  updateRunBudget(profile: TokenProfile, budget: Partial<StageBudget>) {
    this.updateDraft((draft) => {
      draft.profiles[profile].runBudget = { ...draft.profiles[profile].runBudget, ...budget };
    });
  }

  resetDraft() {
    const { savedPolicy } = this.getSnapshot();
    if (!savedPolicy) return;
    this.patch({ draft: clonePolicy(savedPolicy), draftIssues: [], saveStatus: "idle" });
  }

  restoreDefaults() {
    const { defaultPolicy } = this.getSnapshot();
    if (!defaultPolicy) return;
    const draft = clonePolicy(defaultPolicy);
    this.patch({ draft, draftIssues: validate(draft), saveStatus: "idle" });
  }

  isDraftDirty() {
    const { draft, savedPolicy } = this.getSnapshot();
    return Boolean(draft && savedPolicy && JSON.stringify(draft) !== JSON.stringify(savedPolicy));
  }

  async saveDraft(api: OrchestrationApi) {
    const { draft } = this.getSnapshot();
    if (!draft) return;
    const issues = validate(draft);
    if (issues.length > 0) {
      this.patch({ draftIssues: issues, saveStatus: "error" });
      return;
    }
    this.patch({ saveStatus: "saving" });
    try {
      const response = await api.savePolicy({ policy: draft }) as OrchestrationPolicySaveResponse;
      if (!response.ok) {
        this.patch({ draftIssues: response.issues, saveStatus: "error" });
        return;
      }
      this.patch({ savedPolicy: response.policy, draft: clonePolicy(response.policy), draftIssues: [], saveStatus: "saved", preflightByProfile: {} });
    } catch {
      this.patch({ saveStatus: "error" });
    }
  }

  async runPreflight(api: OrchestrationApi, profile: TokenProfile) {
    const { draft } = this.getSnapshot();
    this.setPreflight(profile, { status: "loading", report: this.getSnapshot().preflightByProfile[profile]?.report ?? null });
    try {
      const response = await api.preflight({ profile, ...(draft && validate(draft).length === 0 ? { policy: draft } : {}) }) as OrchestrationPreflightResponse;
      this.setPreflight(profile, response.ok ? { status: "ready", report: response.report } : { status: "error", report: null });
    } catch {
      this.setPreflight(profile, { status: "error", report: null });
    }
  }

  private setPreflight(profile: TokenProfile, entry: PreflightEntry) {
    this.update((current) => ({ ...current, preflightByProfile: { ...current.preflightByProfile, [profile]: entry } }));
  }

  /** Start is only allowed once a profile's preflight came back ready. */
  canStartWith(profile: TokenProfile) {
    const entry = this.getSnapshot().preflightByProfile[profile];
    return entry?.status === "ready" && Boolean(entry.report?.ready);
  }

  // -------------------------------------------------------------------------
  // Run workflows
  // -------------------------------------------------------------------------

  private setWorkflow(runId: string, patch: Partial<WorkflowEntry>) {
    this.update((current) => {
      const existing = current.workflowByRunId[runId] ?? EMPTY_WORKFLOW;
      return { ...current, workflowByRunId: { ...current.workflowByRunId, [runId]: { ...existing, ...patch } } };
    });
  }

  workflowFor(runId: string): WorkflowEntry {
    return this.getSnapshot().workflowByRunId[runId] ?? EMPTY_WORKFLOW;
  }

  setStartProfile(runId: string, profile: TokenProfile) {
    this.update((current) => ({ ...current, startProfileByRunId: { ...current.startProfileByRunId, [runId]: profile } }));
  }

  startProfileFor(runId: string): TokenProfile {
    return this.getSnapshot().startProfileByRunId[runId] ?? this.getSnapshot().savedPolicy?.defaultProfile ?? "balanced";
  }

  /**
   * Fetch a run's snapshot. Concurrent requests coalesce; a request that
   * arrives while one is in flight schedules exactly one follow-up, so the
   * last event always wins without overlapping fetches.
   */
  loadWorkflow(api: OrchestrationApi, runId: string): Promise<void> {
    this.boundApi = api;
    const inflight = this.inflightWorkflow.get(runId);
    if (inflight) {
      this.staleWorkflow.add(runId);
      return inflight;
    }
    if (!this.getSnapshot().workflowByRunId[runId]?.snapshot) this.setWorkflow(runId, { status: "loading" });
    const task = (async () => {
      try {
        const response = await api.getWorkflow({ runId }) as RunOrchestrationResponse;
        this.setWorkflow(runId, { status: "ready", snapshot: response.workflow, lastError: false });
      } catch {
        this.setWorkflow(runId, { status: "error", lastError: true });
      } finally {
        this.inflightWorkflow.delete(runId);
        if (this.staleWorkflow.delete(runId)) void this.loadWorkflow(api, runId);
      }
    })();
    this.inflightWorkflow.set(runId, task);
    return task;
  }

  /** Named-event hook: refresh the affected run's snapshot. */
  onOrchestrationEvent(payload: unknown) {
    const api = this.boundApi;
    if (!api || !payload || typeof payload !== "object") return;
    const runId = (payload as { runId?: unknown }).runId;
    if (typeof runId !== "string" || !runId) return;
    // Only runs some component has looked at are kept fresh.
    if (!this.getSnapshot().workflowByRunId[runId]) return;
    void this.loadWorkflow(api, runId);
  }

  async act(api: OrchestrationApi, runId: string, action: OrchestrationAction, extra: { profile?: TokenProfile } = {}) {
    if (this.workflowFor(runId).pendingAction) return;
    this.setWorkflow(runId, { pendingAction: action, lastRefusal: null, lastError: false });
    try {
      const response = await api.act({ runId, body: { action, ...extra } }) as RunOrchestrationActionResponse;
      if (!response.ok) {
        const conflict = (response.result as { status?: string } | undefined)?.status;
        this.setWorkflow(runId, { lastRefusal: response.refused ?? conflict ?? "unknown" });
      }
    } catch {
      this.setWorkflow(runId, { lastError: true });
    } finally {
      this.setWorkflow(runId, { pendingAction: null });
      await this.loadWorkflow(api, runId);
    }
  }

  /** Create a workflow on the chosen profile and dispatch its first stage. */
  async startWorkflow(api: OrchestrationApi, runId: string) {
    const profile = this.startProfileFor(runId);
    await this.act(api, runId, "create", { profile });
    const entry = this.workflowFor(runId);
    if (entry.lastRefusal || entry.lastError || !entry.snapshot) return;
    await this.act(api, runId, "dispatch");
  }
}

export const orchestrationManager = new OrchestrationManager();

/** Stage order for display; same as the server's workflow order. */
export const TIMELINE_PROFILES = TOKEN_PROFILES;
