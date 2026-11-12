import React, { memo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { GitPullRequestArrow, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WORKER_OPTIONS } from "@/interface/home/constants";
import { codeReviewUiManager } from "@/interface/review/CodeReviewUiManager";
import { t, useI18nSnapshot } from "@/lib/i18n";
import { useManagerSnapshot } from "@/lib/use-manager-snapshot";
import { cn } from "@/lib/utils";
import { useRuntimeAPIs } from "@/runtime-api/provider";
import type {
  CodeReviewListResponse,
  CodeReviewRecord,
  CodeReviewStartResponse,
} from "@/shared/code-review";

const KNOWN_REASONS = new Set([
  "approved",
  "approved_with_minor_findings",
  "disagreement",
  "no_evidence",
  "invalid_verdict",
  "round_limit",
  "interrupted_by_restart",
  "implementer_busy",
]);

function agentLabel(type: string) {
  return WORKER_OPTIONS.find((option) => option.value === type)?.label ?? type;
}

function statusLine(review: CodeReviewRecord) {
  const reviewer = agentLabel(review.reviewerType);
  const implementer = agentLabel(review.implementerType);
  if (review.status === "running") {
    return t("codeReview.running", {
      reviewer,
      implementer,
      round: Math.min(review.maxRounds, review.roundsCompleted + 1),
      max: review.maxRounds,
    });
  }
  return t(`codeReview.status.${review.status}`, { reviewer });
}

function reasonLine(review: CodeReviewRecord) {
  if (review.status === "running" || !review.outcomeReason) return null;
  return t(KNOWN_REASONS.has(review.outcomeReason) ? `codeReview.reason.${review.outcomeReason}` : "codeReview.reason.other");
}

export interface CodeReviewPanelProps {
  runId: string;
}

/**
 * Cross-review for the selected conversation: start one, follow its rounds,
 * and read its findings. Outcomes that need the user (a disagreement or the
 * round limit) are shown here, since server-surfaced errors do not reach the
 * interface.
 */
export const CodeReviewPanel = memo(function CodeReviewPanel({ runId }: CodeReviewPanelProps) {
  useI18nSnapshot();
  const runtimeApis = useRuntimeAPIs();
  const { revisionByRunId, refusalByRunId } = useManagerSnapshot(codeReviewUiManager);
  const revision = revisionByRunId[runId] ?? 0;
  const refusal = refusalByRunId[runId] ?? null;

  const reviewsQuery = useQuery({
    queryKey: ["codeReviews", runId, revision],
    queryFn: async () => (await runtimeApis.codeReviews.list({ runId }) as CodeReviewListResponse).reviews,
  });
  const start = useMutation({
    mutationFn: async () => runtimeApis.codeReviews.start({ runId, body: {} }) as Promise<CodeReviewStartResponse>,
    onMutate: () => codeReviewUiManager.setRefusal(runId, null),
    onSuccess: (result) => {
      codeReviewUiManager.setRefusal(runId, result.ok ? null : result.refused);
      codeReviewUiManager.onCodeReviewEvent({ runId });
    },
  });

  const latest = reviewsQuery.data?.[0] ?? null;
  const running = latest?.status === "running";
  const needsUser = latest?.status === "escalated" || latest?.status === "cap_reached" || latest?.status === "failed";
  const visibleFindings = latest?.findings.filter((finding) => finding.status !== "withdrawn") ?? [];

  return (
    <details className="group rounded-lg border border-border/60 bg-background/60 text-xs" open={running || needsUser}>
      <summary className="flex cursor-pointer items-center gap-2 px-2.5 py-2">
        <GitPullRequestArrow aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="font-semibold">{t("codeReview.title")}</span>
        <span className={cn("min-w-0 flex-1 truncate", needsUser ? "font-semibold text-destructive" : "text-muted-foreground")}>
          {latest ? statusLine(latest) : null}
        </span>
        {running ? <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground motion-reduce:animate-none" /> : null}
      </summary>
      <div className="space-y-2 border-t border-border/50 px-2.5 py-2">
        {!latest && !reviewsQuery.isLoading ? <p className="text-muted-foreground">{t("codeReview.empty")}</p> : null}
        {reviewsQuery.isError ? <p role="alert" className="text-destructive">{t("codeReview.loadFailed")}</p> : null}
        {latest && reasonLine(latest) ? (
          <p className={cn(needsUser ? "text-foreground" : "text-muted-foreground")}>{reasonLine(latest)}</p>
        ) : null}

        {latest ? (
          visibleFindings.length > 0 ? (
            <div className="space-y-1">
              <div className="font-semibold text-muted-foreground">{t("codeReview.findingsHeading", { count: visibleFindings.length })}</div>
              <ul className="space-y-1.5">
                {visibleFindings.map((finding) => (
                  <li key={finding.id} className="rounded-md border border-border/50 bg-muted/30 p-2">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className={cn(
                        "rounded px-1 font-semibold uppercase tracking-wide",
                        finding.severity === "blocker" || finding.severity === "major"
                          ? "bg-destructive/10 text-destructive"
                          : "bg-muted text-muted-foreground",
                      )}
                      >
                        {t(`codeReview.severity.${finding.severity}`)}
                      </span>
                      {finding.file ? (
                        <code className="truncate text-[11px]">{finding.line ? `${finding.file}:${finding.line}` : finding.file}</code>
                      ) : null}
                      <span className="ml-auto text-muted-foreground">{t(`codeReview.findingStatus.${finding.status}`)}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap">{finding.claim}</p>
                    {finding.disputeReason ? (
                      <p className="mt-1 text-muted-foreground">{t("codeReview.disputed", { reason: finding.disputeReason })}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : latest.status !== "running" ? <p className="text-muted-foreground">{t("codeReview.noFindings")}</p> : null
        ) : null}

        {refusal ? <p role="status" className="text-foreground">{t(`codeReview.refused.${refusal}`)}</p> : null}
        {start.isError ? <p role="alert" className="text-destructive">{t("codeReview.startFailed")}</p> : null}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          disabled={running || start.isPending}
          onClick={() => start.mutate()}
        >
          {start.isPending ? t("codeReview.starting") : t("codeReview.start")}
        </Button>
      </div>
    </details>
  );
});
