import { RotateCcw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RunRecoveryState } from "@/app/home/types";
import { recoveryDescriptionKey, recoveryTitleKey, recoveryTone } from "@/app/home/recovery-utils";
import { t, useI18nSnapshot } from "@/lib/i18n";

function formatRecoveryTime(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "medium",
    }).format(date)
    : value;
}

export function RunRecoveryNotice({
  recoveryState,
  isResuming,
  onResume,
}: {
  recoveryState: RunRecoveryState | null;
  isResuming: boolean;
  onResume: () => void;
}) {
  useI18nSnapshot();
  if (!recoveryState) {
    return null;
  }

  const tone = recoveryTone(recoveryState);
  const canResume = recoveryState.status !== "recovering" && recoveryState.recommendedAction !== "none";
  const title = t(recoveryTitleKey(recoveryState));
  const descriptionKey = recoveryDescriptionKey(recoveryState);
  const resetTime = formatRecoveryTime(recoveryState.resumeAt);
  const description = descriptionKey.startsWith("recovery.")
    ? t(descriptionKey, { resumeAt: resetTime ?? t("recovery.notice.pendingReset") })
    : descriptionKey;

  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2 text-sm",
        tone === "error"
          ? "border-destructive/30 bg-destructive/5"
          : tone === "active"
            ? "border-sky-500/25 bg-sky-500/[0.04]"
            : "border-amber-500/25 bg-amber-500/[0.04]",
      )}
      aria-label={t("recovery.notice.ariaLabel")}
    >
      <div className="flex items-start gap-2">
        <ShieldAlert className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          tone === "error" ? "text-destructive" : tone === "active" ? "text-sky-600" : "text-amber-700",
        )} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-foreground">{title}</p>
            {canResume ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isResuming}
                onClick={onResume}
                aria-label={t("recovery.notice.resume")}
              >
                <RotateCcw className="mr-2 h-3.5 w-3.5" />
                {t("recovery.notice.resume")}
              </Button>
            ) : null}
          </div>
          <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground">
            {description}
          </p>
          {recoveryState.kind === "quota_waiting" && resetTime ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t("recovery.notice.quotaResumeAt", { resumeAt: resetTime })}
            </p>
          ) : null}
          {typeof recoveryState.attemptCount === "number" && recoveryState.attemptCount > 0 ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t("recovery.notice.attempts", { count: recoveryState.attemptCount })}
              {recoveryState.policyDecision ? ` ${t("recovery.notice.policy", { policy: recoveryState.policyDecision })}` : ""}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
