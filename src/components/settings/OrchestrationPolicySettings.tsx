import React, { useEffect } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatTokens, formatUsd } from "@/components/home/OrchestrationTimeline";
import { orchestrationManager as defaultOrchestrationManager, type OrchestrationManager } from "@/interface/orchestration/OrchestrationManager";
import { t, useI18nSnapshot } from "@/lib/i18n";
import { useManagerSnapshot } from "@/lib/use-manager-snapshot";
import { cn } from "@/lib/utils";
import { useRuntimeAPIs } from "@/runtime-api/provider";
import { TOKEN_PROFILES, type ProfilePolicy, type StagePolicy, type TokenProfile } from "@/shared/orchestration-policy";
import { SUPPORTED_WORKER_TYPES, WORKER_TYPE_LABELS, type SupportedWorkerType } from "@/shared/worker-types";
import type { StagePreflightReportDto } from "@/shared/orchestration-api";

const KNOWN_ISSUES = new Set([
  "not_object", "unsupported_version", "unknown_profile", "missing_profile", "unknown_stage", "duplicate_stage",
  "unknown_worker_type", "invalid_binding", "decision_binding_outside_triage", "worker_binding_for_triage",
  "negative_cap", "missing_implementation", "reviewer_not_independent", "duplicate_fallback",
  "custom_fallbacks_forbidden", "invalid_rounds", "secret_in_policy",
]);

function bindingLabel(stage: StagePolicy) {
  const binding = stage.binding;
  if (binding.kind === "decision") return t("orchestration.decisionBinding", { model: binding.model });
  return t("orchestration.workerBinding", {
    agent: WORKER_TYPE_LABELS[binding.workerType] ?? binding.workerType,
    model: binding.model,
    effort: binding.effort ?? t("orchestration.defaultEffort"),
  });
}

function StageLine({ stage, preflight, editable, manager: orchestrationManager }: { stage: StagePolicy; preflight: StagePreflightReportDto | undefined; editable: boolean; manager: OrchestrationManager }) {
  const binding = stage.binding;
  return (
    <li className="space-y-1 rounded-lg border border-border/50 bg-background/60 p-2 text-xs" data-testid="orchestration-policy-stage">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{t(`orchestration.stage.${stage.stage}`)}</span>
        {preflight ? (
          <span className={cn(preflight.status === "ready" ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300")}>
            {t(`orchestration.preflightStatus.${preflight.status}`)}
            {preflight.selected?.usedFallback ? ` · ${t("orchestration.usedFallback")}` : ""}
          </span>
        ) : null}
      </div>
      {editable && binding.kind === "worker" ? (
        <div className="grid gap-2 sm:grid-cols-3">
          <select
            aria-label={t("orchestration.agentFor", { stage: t(`orchestration.stage.${stage.stage}`) })}
            className="h-8 rounded-md border border-border bg-background px-2"
            value={binding.workerType}
            onChange={(event) => orchestrationManager.updateCustomBinding(stage.stage, { workerType: event.target.value as SupportedWorkerType })}
          >
            {SUPPORTED_WORKER_TYPES.map((type) => <option key={type} value={type}>{WORKER_TYPE_LABELS[type]}</option>)}
          </select>
          <Input
            aria-label={t("orchestration.modelFor", { stage: t(`orchestration.stage.${stage.stage}`) })}
            className="h-8 bg-background text-xs"
            value={binding.model}
            onChange={(event) => orchestrationManager.updateCustomBinding(stage.stage, { model: event.target.value })}
          />
          <Input
            aria-label={t("orchestration.effortFor", { stage: t(`orchestration.stage.${stage.stage}`) })}
            className="h-8 bg-background text-xs"
            value={binding.effort ?? ""}
            placeholder={t("orchestration.defaultEffort")}
            onChange={(event) => orchestrationManager.updateCustomBinding(stage.stage, { effort: event.target.value.trim() || null })}
          />
        </div>
      ) : (
        <div className="text-muted-foreground">{bindingLabel(stage)}</div>
      )}
      <div className="text-muted-foreground">
        {t("orchestration.stageCaps", {
          tokens: stage.budget.maxTokens === null ? t("orchestration.noCap") : formatTokens(stage.budget.maxTokens),
          cost: stage.budget.maxCostUsd === null ? t("orchestration.noCap") : formatUsd(stage.budget.maxCostUsd),
        })}
      </div>
    </li>
  );
}

function ProfileCard({ profile, policy, isDefault, manager: orchestrationManager }: { profile: TokenProfile; policy: ProfilePolicy; isDefault: boolean; manager: OrchestrationManager }) {
  const api = useRuntimeAPIs().orchestration;
  const state = useManagerSnapshot(orchestrationManager);
  const preflight = state.preflightByProfile[profile];
  const reportByStage = new Map((preflight?.report?.stages ?? []).map((entry) => [entry.stage, entry]));
  const stages = policy.stages.filter((stage) => stage.stage !== "triage" || policy.triageMode !== "off");
  return (
    <article className={cn("space-y-2 rounded-xl border p-3", isDefault ? "border-primary/60 bg-primary/5" : "border-border/60 bg-background/40")} data-testid={`orchestration-profile-${profile}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-0.5">
          <h4 className="text-sm font-semibold">{t(`orchestration.profile.${profile}`)}</h4>
          <p className="text-xs text-muted-foreground">{t(`orchestration.profileHelp.${profile}`)}</p>
        </div>
        <label className="flex items-center gap-1.5 text-xs">
          <input
            type="radio"
            name="orchestration-default-profile"
            checked={isDefault}
            onChange={() => orchestrationManager.setDefaultProfile(profile)}
          />
          {t("orchestration.defaultProfile")}
        </label>
      </div>
      <ol className="space-y-1.5">
        {stages.map((stage) => <StageLine key={stage.stage} stage={stage} preflight={reportByStage.get(stage.stage)} editable={profile === "custom"} manager={orchestrationManager} />)}
      </ol>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {t("orchestration.runCaps", {
            tokens: policy.runBudget.maxTokens === null ? t("orchestration.noCap") : formatTokens(policy.runBudget.maxTokens),
            cost: policy.runBudget.maxCostUsd === null ? t("orchestration.noCap") : formatUsd(policy.runBudget.maxCostUsd),
            repairs: policy.maxRepairRounds,
            revisions: policy.maxPlanRevisionRounds,
          })}
        </span>
        <Button size="sm" variant="outline" disabled={preflight?.status === "loading"} onClick={() => void orchestrationManager.runPreflight(api, profile)}>
          {preflight?.status === "loading" ? <LoaderCircle aria-hidden="true" className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
          {t("orchestration.preflight")}
        </Button>
      </div>
      {preflight?.report ? (
        <p role="status" className={cn("text-xs", preflight.report.ready ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300")}>
          {preflight.report.ready ? t("orchestration.preflightReady") : t("orchestration.preflightBlocked")}
        </p>
      ) : null}
      {preflight?.status === "error" ? <p className="text-xs text-red-700 dark:text-red-300">{t("orchestration.requestFailed")}</p> : null}
    </article>
  );
}

/**
 * Settings for specialist orchestration: compare the token profiles with
 * their real stage bindings and caps, preflight them against the installed
 * CLIs, pin the custom profile, and choose the default. Model credentials are
 * never shown or edited here; they stay with accounts and the environment.
 */
export function OrchestrationPolicySettings({ manager: orchestrationManager = defaultOrchestrationManager }: { manager?: OrchestrationManager } = {}) {
  useI18nSnapshot();
  const api = useRuntimeAPIs().orchestration;
  const state = useManagerSnapshot(orchestrationManager);

  useEffect(() => {
    if (orchestrationManager.getSnapshot().policyStatus === "idle") void orchestrationManager.loadPolicy(api);
  }, [api, orchestrationManager]);

  const draft = state.draft;
  return (
    <section className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4" aria-labelledby="orchestration-policy-title">
      <div className="space-y-1">
        <h3 id="orchestration-policy-title" className="text-sm font-semibold">{t("orchestration.settingsTitle")}</h3>
        <p className="text-xs text-muted-foreground">{t("orchestration.settingsDescription")}</p>
      </div>
      {state.policyStatus === "error" ? <p role="alert" className="text-xs text-red-700 dark:text-red-300">{t("orchestration.requestFailed")}</p> : null}
      {!draft ? (
        state.policyStatus === "loading" ? <p className="text-xs text-muted-foreground">{t("orchestration.loading")}</p> : null
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            {TOKEN_PROFILES.map((profile) => (
              <ProfileCard key={profile} profile={profile} policy={draft.profiles[profile]} isDefault={draft.defaultProfile === profile} manager={orchestrationManager} />
            ))}
          </div>
          {state.draftIssues.length > 0 ? (
            <ul role="alert" className="space-y-1 rounded-lg border border-red-500/40 bg-red-500/5 p-2 text-xs text-red-700 dark:text-red-300">
              {state.draftIssues.map((issue, index) => (
                <li key={`${issue.code}-${issue.path}-${index}`}>
                  {t(KNOWN_ISSUES.has(issue.code) ? `orchestration.issue.${issue.code}` : "orchestration.issue.other")}
                  {issue.path ? ` (${issue.path})` : ""}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" disabled={state.saveStatus === "saving" || state.draftIssues.length > 0 || !orchestrationManager.isDraftDirty()} onClick={() => void orchestrationManager.saveDraft(api)}>
              {t("orchestration.save")}
            </Button>
            <Button size="sm" variant="outline" disabled={!orchestrationManager.isDraftDirty()} onClick={() => orchestrationManager.resetDraft()}>
              {t("orchestration.discard")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => orchestrationManager.restoreDefaults()}>
              {t("orchestration.restoreDefaults")}
            </Button>
            {state.saveStatus === "saved" ? <span role="status" className="text-xs text-muted-foreground">{t("orchestration.saved")}</span> : null}
            {state.saveStatus === "error" && state.draftIssues.length === 0 ? <span role="alert" className="text-xs text-red-700 dark:text-red-300">{t("orchestration.requestFailed")}</span> : null}
          </div>
          <p className="text-xs text-muted-foreground">{t("orchestration.unknownUsageNote")}</p>
        </>
      )}
    </section>
  );
}
