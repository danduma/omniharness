import React, { memo, useEffect } from "react";
import { LoaderCircle, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { orchestrationManager as defaultOrchestrationManager, type OrchestrationManager } from "@/interface/orchestration/OrchestrationManager";
import { t, useI18nSnapshot } from "@/lib/i18n";
import { useManagerSnapshot } from "@/lib/use-manager-snapshot";
import { cn } from "@/lib/utils";
import { useRuntimeAPIs } from "@/runtime-api/provider";
import type { WorkflowSnapshotDto, WorkflowStageDto } from "@/shared/orchestration-api";
import { TOKEN_PROFILES, type StageStatus, type TokenProfile } from "@/shared/orchestration-policy";
import { WORKER_TYPE_LABELS, type SupportedWorkerType } from "@/shared/worker-types";

export type TimelineCategory = "pending" | "blocked" | "active" | "complete" | "recovery";

/** The five visual states the timeline distinguishes. */
export function timelineCategory(status: StageStatus): TimelineCategory {
  switch (status) {
    case "preflight":
    case "dispatched":
    case "waiting":
      return "active";
    case "completed":
      return "complete";
    case "blocked":
    case "failed":
      return "blocked";
    case "needs_recovery":
      return "recovery";
    default:
      return "pending";
  }
}

const CATEGORY_CLASS: Record<TimelineCategory, string> = {
  pending: "border-border/60 text-muted-foreground",
  active: "border-sky-500/50 text-sky-700 dark:text-sky-300",
  complete: "border-emerald-500/50 text-emerald-700 dark:text-emerald-300",
  blocked: "border-red-500/50 text-red-700 dark:text-red-300",
  recovery: "border-amber-500/50 text-amber-700 dark:text-amber-300",
};

const KNOWN_FAILURES = new Set([
  "binding_unavailable", "identity_mismatch", "quota_blocked", "credential_missing", "budget_exceeded",
  "dispatch_conflict", "handoff_failed", "adapter_failed", "agent_failed", "interrupted_by_restart", "gate_unmet", "cancelled",
]);
const KNOWN_REFUSALS = new Set([
  "no_workflow", "unsupported_run", "invalid_profile", "profile_locked", "workflow_cancelled", "workflow_done",
  "stage_active", "stage_blocked", "gate_unmet", "nothing_to_retry", "conflict",
]);
const RETRYABLE = new Set(["stage_blocked", "stage_failed", "needs_recovery"]);

export function formatTokens(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function formatUsd(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

function agentLabel(type: string | null) {
  if (!type) return t("orchestration.decisionLane");
  return WORKER_TYPE_LABELS[type as SupportedWorkerType] ?? type;
}

function usageLine(stage: WorkflowStageDto) {
  if (stage.settled && stage.usageUnknown) return t("orchestration.usageUnknown", { reserved: formatTokens(stage.reservedTokens) });
  if (stage.settled) return t("orchestration.usageSettled", { tokens: formatTokens(stage.settledTokens), cost: formatUsd(stage.settledCostUsd) });
  if (stage.reservedTokens !== null) return t("orchestration.usageReserved", { tokens: formatTokens(stage.reservedTokens) });
  return null;
}

function StageRow({ stage }: { stage: WorkflowStageDto }) {
  const category = timelineCategory(stage.status);
  const usage = usageLine(stage);
  return (
    <li className={cn("rounded-lg border bg-background/60 p-2 text-xs", CATEGORY_CLASS[category])} data-testid="orchestration-stage" data-category={category}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-foreground">
          {t(`orchestration.stage.${stage.stage}`)}
          {stage.attempt > 1 ? ` · ${t("orchestration.attempt", { attempt: stage.attempt })}` : ""}
        </span>
        <span>{t(`orchestration.status.${stage.status}`)}{stage.outcome ? ` · ${t(`orchestration.outcome.${stage.outcome}`)}` : ""}</span>
      </div>
      <div className="mt-1 text-muted-foreground">
        {t("orchestration.binding", { agent: agentLabel(stage.requestedWorkerType), model: stage.requestedModel ?? "—" })}
        {stage.effectiveModel && stage.effectiveModel !== stage.requestedModel ? ` · ${t("orchestration.effectiveModel", { model: stage.effectiveModel })}` : ""}
        {stage.usedFallback ? ` · ${t("orchestration.usedFallback")}` : ""}
      </div>
      {usage ? <div className="text-muted-foreground">{usage}</div> : null}
      {stage.failureCode && stage.status !== "completed" ? (
        <div className="mt-1">{t(KNOWN_FAILURES.has(stage.failureCode) ? `orchestration.failure.${stage.failureCode}` : "orchestration.failure.other")}</div>
      ) : null}
    </li>
  );
}

function NextLine({ snapshot }: { snapshot: WorkflowSnapshotDto }) {
  const next = snapshot.next;
  if (snapshot.cancelled) return <p className="text-xs text-muted-foreground">{t("orchestration.next.cancelled")}</p>;
  if (next.kind === "done") return <p className="text-xs text-muted-foreground">{t("orchestration.next.done")}</p>;
  if (next.kind === "active") return <p className="text-xs text-muted-foreground">{t("orchestration.next.active", { stage: t(`orchestration.stage.${next.stage}`) })}</p>;
  if (next.kind === "blocked") return <p className="text-xs text-red-700 dark:text-red-300">{t(`orchestration.blocked.${next.reason}`, { stage: t(`orchestration.stage.${next.stage}`) })}</p>;
  return <p className="text-xs text-muted-foreground">{t("orchestration.next.dispatch", { stage: t(`orchestration.stage.${next.stage}`) })}</p>;
}

export interface OrchestrationTimelineProps {
  runId: string;
  /** Injectable for tests; the app uses the global manager. */
  manager?: OrchestrationManager;
}

/**
 * The run's specialist workflow: start it on a preflighted profile, follow
 * its stages in order, and retry, continue, or cancel a blocked one. All
 * state lives in `orchestrationManager`; this view only renders it and
 * issues manager commands.
 */
export const OrchestrationTimeline = memo(function OrchestrationTimeline({ runId, manager: orchestrationManager = defaultOrchestrationManager }: OrchestrationTimelineProps) {
  useI18nSnapshot();
  const api = useRuntimeAPIs().orchestration;
  const state = useManagerSnapshot(orchestrationManager);
  const entry = state.workflowByRunId[runId];
  const snapshot = entry?.snapshot ?? null;
  const pending = entry?.pendingAction ?? null;

  useEffect(() => {
    void orchestrationManager.loadWorkflow(api, runId);
  }, [api, orchestrationManager, runId]);

  if (!entry || (entry.status === "loading" && !snapshot)) {
    return null;
  }

  const refusal = entry.lastRefusal
    ? <p role="alert" className="text-xs text-red-700 dark:text-red-300">{t(KNOWN_REFUSALS.has(entry.lastRefusal) ? `orchestration.refusal.${entry.lastRefusal}` : "orchestration.refusal.other")}</p>
    : entry.lastError
      ? <p role="alert" className="text-xs text-red-700 dark:text-red-300">{t("orchestration.requestFailed")}</p>
      : null;

  if (!snapshot) {
    const profile = orchestrationManager.startProfileFor(runId);
    const preflight = state.preflightByProfile[profile];
    const canStart = orchestrationManager.canStartWith(profile);
    return (
      <section className="mx-auto my-3 w-full max-w-3xl space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3" aria-labelledby={`orchestration-start-${runId}`}>
        <div className="flex items-center gap-2">
          <Workflow aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
          <h3 id={`orchestration-start-${runId}`} className="text-sm font-semibold">{t("orchestration.title")}</h3>
        </div>
        <p className="text-xs text-muted-foreground">{t("orchestration.startHelp")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-medium" htmlFor={`orchestration-profile-${runId}`}>{t("orchestration.profileLabel")}</label>
          <select
            id={`orchestration-profile-${runId}`}
            className="h-8 rounded-md border border-border bg-background px-2 text-xs"
            value={profile}
            onChange={(event) => {
              const next = event.target.value as TokenProfile;
              orchestrationManager.setStartProfile(runId, next);
              void orchestrationManager.runPreflight(api, next);
            }}
          >
            {TOKEN_PROFILES.map((option) => <option key={option} value={option}>{t(`orchestration.profile.${option}`)}</option>)}
          </select>
          <Button size="sm" variant="outline" disabled={preflight?.status === "loading"} onClick={() => void orchestrationManager.runPreflight(api, profile)}>
            {preflight?.status === "loading" ? <LoaderCircle aria-hidden="true" className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
            {t("orchestration.preflight")}
          </Button>
          <Button size="sm" disabled={!canStart || pending !== null} onClick={() => void orchestrationManager.startWorkflow(api, runId)}>
            {t("orchestration.start")}
          </Button>
        </div>
        {preflight?.report && !preflight.report.ready ? (
          <p className="text-xs text-amber-700 dark:text-amber-300">{t("orchestration.preflightBlocked")}</p>
        ) : null}
        {preflight?.status === "error" ? <p className="text-xs text-red-700 dark:text-red-300">{t("orchestration.requestFailed")}</p> : null}
        {refusal}
      </section>
    );
  }

  const next = snapshot.next;
  const canRetry = next.kind === "blocked" && RETRYABLE.has(next.reason) && !snapshot.cancelled;
  const canContinue = next.kind === "dispatch" && !snapshot.cancelled;
  const canCancel = !snapshot.cancelled && next.kind !== "done";
  const runCap = snapshot.profilePolicy.runBudget;
  const stages = [...snapshot.stages].sort((left, right) => left.seq - right.seq);

  return (
    <section className="mx-auto my-3 w-full max-w-3xl space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3" aria-labelledby={`orchestration-title-${runId}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Workflow aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
          <h3 id={`orchestration-title-${runId}`} className="text-sm font-semibold">{t("orchestration.title")}</h3>
          <span className="rounded-full border border-border/60 px-2 py-0.5 text-[11px]">{t(`orchestration.profile.${snapshot.profile}`)}</span>
          {snapshot.locked ? <span className="text-[11px] text-muted-foreground">{t("orchestration.locked")}</span> : null}
        </div>
        <span className="text-[11px] text-muted-foreground">
          {t("orchestration.budgetLine", {
            committed: formatTokens(snapshot.budget.committedTokens),
            cap: runCap.maxTokens === null ? t("orchestration.noCap") : formatTokens(runCap.maxTokens),
            cost: formatUsd(snapshot.budget.committedCostUsd),
          })}
          {snapshot.budget.unknownUsageStages > 0 ? ` · ${t("orchestration.unknownStages", { count: snapshot.budget.unknownUsageStages })}` : ""}
        </span>
      </div>
      {stages.length > 0 ? <ol className="space-y-1.5">{stages.map((stage) => <StageRow key={stage.id} stage={stage} />)}</ol> : null}
      <NextLine snapshot={snapshot} />
      <div className="flex flex-wrap gap-2">
        {canContinue ? <Button size="sm" disabled={pending !== null} onClick={() => void orchestrationManager.act(api, runId, "dispatch")}>{t("orchestration.continue")}</Button> : null}
        {canRetry ? <Button size="sm" disabled={pending !== null} onClick={() => void orchestrationManager.act(api, runId, "retry")}>{t("orchestration.retry")}</Button> : null}
        {canCancel ? <Button size="sm" variant="outline" disabled={pending !== null} onClick={() => void orchestrationManager.act(api, runId, "cancel")}>{t("orchestration.cancel")}</Button> : null}
      </div>
      {refusal}
    </section>
  );
});
