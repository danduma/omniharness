// Implemented Planning Review UI
"use client";

import React from "react";
import { t, useI18nSnapshot } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useManagerSnapshot } from "@/lib/use-manager-snapshot";
import { planningReviewPreferencesManager, planningReviewPreferencesSetters } from "@/app/home/PlanningReviewPreferencesManager";
import { Button } from "./ui/button";
import { type PlanningReviewRunRecord, type PlanningReviewRoundRecord, type PlanningReviewFindingRecord } from "@/app/home/types";
import { ChevronDown, ChevronUp, Play, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { type PlanningReviewAgentSelection } from "@/server/planning/review-preferences";

interface PlanningReviewControlsProps {
  isReviewing: boolean;
  latestReviewRun?: PlanningReviewRunRecord | null;
  latestReviewRound?: PlanningReviewRoundRecord | null;
  findings?: PlanningReviewFindingRecord[];
  onStartReview: (prefs: { agentSelection: PlanningReviewAgentSelection; rounds: number }) => void;
}

export function PlanningReviewControls({
  isReviewing,
  latestReviewRun,
  latestReviewRound,
  findings = [],
  onStartReview,
}: PlanningReviewControlsProps) {
  useI18nSnapshot();
  const { agentSelection, rounds, isExpanded, isSaving } = useManagerSnapshot(planningReviewPreferencesManager);

  const agents: PlanningReviewAgentSelection[] = ["auto", "same", "codex", "claude", "gemini", "opencode"];

  const handleStart = () => {
    onStartReview({ agentSelection, rounds });
  };

  const statusText = React.useMemo(() => {
    if (!latestReviewRun) return null;

    const totalRounds = latestReviewRun.roundsRequested;
    const currentRoundNumber = latestReviewRound?.roundNumber ?? (latestReviewRun.status === "completed" ? totalRounds : Math.min(latestReviewRun.roundsCompleted + 1, totalRounds));
    const progress = totalRounds > 1 ? ` (${currentRoundNumber}/${totalRounds})` : "";

    if (latestReviewRun.status === "running") {
      if (latestReviewRound?.status === "reviewing") return t("planning.review.reviewing") + progress;
      if (latestReviewRound?.status === "revising") return t("planning.review.revising") + progress;
      return t("planning.review.starting") + progress;
    }
    if (latestReviewRun.status === "completed") return t("planning.review.completed");
    if (latestReviewRun.status === "failed") return t("planning.review.failed") + progress;
    return null;
  }, [latestReviewRun, latestReviewRound]);

  const roundsLabel = rounds === 1 ? t("planning.review.roundsValue.one") : t("planning.review.roundsValue.other", { count: rounds });
  const findingsSummary = findings.length === 1 ? t("planning.review.findingsSummary.one") : t("planning.review.findingsSummary.other", { count: findings.length });

  return (
    <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
      <button
        type="button"
        onClick={() => planningReviewPreferencesManager.setExpanded(!isExpanded)}
        className="flex w-full items-center justify-between text-sm font-medium text-foreground hover:text-primary transition-colors"
      >
        <span className="flex items-center gap-2">
          {t("planning.review.expand")}
          {!isExpanded && (
            <span className="text-xs font-normal text-muted-foreground">
              {t(`planning.review.agent.${agentSelection}`)} · {roundsLabel}
            </span>
          )}
        </span>
        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {isExpanded && (
        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("planning.review.agentLabel")}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {agents.map((agent) => (
                <button
                  key={agent}
                  type="button"
                  onClick={() => planningReviewPreferencesSetters.setAgentSelection(agent)}
                  disabled={isReviewing || isSaving}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-medium border transition-all",
                    agentSelection === agent
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:border-primary/50"
                  )}
                >
                  {t(`planning.review.agent.${agent}`)}
                </button>
              ))}
            </div>
            {agentSelection === "auto" && (
              <p className="text-xs text-muted-foreground italic">
                {t("planning.review.autoHelp")}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("planning.review.roundsLabel")}
            </label>
            <div className="flex items-center gap-3">
              {[1, 2, 3, 5].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => planningReviewPreferencesSetters.setRounds(val)}
                  disabled={isReviewing || isSaving}
                  className={cn(
                    "w-8 h-8 rounded-full border flex items-center justify-center text-xs font-medium transition-all",
                    rounds === val
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:border-primary/50"
                  )}
                >
                  {val}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <Button
              onClick={handleStart}
              disabled={isReviewing}
              size="sm"
            >
              {isReviewing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {statusText}
                </>
              ) : (
                <>
                  <Play className="mr-2 h-3.5 w-3.5" />
                  {t("planning.review.start")}
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {latestReviewRun && !isExpanded && (
        <div className="mt-2 flex items-center gap-2 text-xs">
          {latestReviewRun.status === "running" ? (
            <Loader2 className="h-3 w-3 animate-spin text-primary" />
          ) : latestReviewRun.status === "completed" ? (
            <CheckCircle2 className="h-3 w-3 text-green-500" />
          ) : (
            <AlertCircle className="h-3 w-3 text-destructive" />
          )}
          <span className={cn(
            "font-medium",
            latestReviewRun.status === "completed" ? "text-green-600 dark:text-green-400" :
            latestReviewRun.status === "failed" ? "text-destructive" : "text-primary"
          )}>
            {statusText}
          </span>
          {findings.length > 0 && (
            <span className="text-muted-foreground">
              ({findingsSummary})
            </span>
          )}
        </div>
      )}
    </div>
  );
}
