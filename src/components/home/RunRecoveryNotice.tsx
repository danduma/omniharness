import { RotateCcw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RunRecoveryState } from "@/app/home/types";
import { recoveryDescription, recoveryTitle, recoveryTone } from "@/app/home/recovery-utils";

export function RunRecoveryNotice({
  recoveryState,
  isResuming,
  onResume,
}: {
  recoveryState: RunRecoveryState | null;
  isResuming: boolean;
  onResume: () => void;
}) {
  if (!recoveryState) {
    return null;
  }

  const tone = recoveryTone(recoveryState);
  const canResume = recoveryState.status !== "recovering" && recoveryState.recommendedAction !== "none";

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
      aria-label="Run recovery"
    >
      <div className="flex items-start gap-2">
        <ShieldAlert className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          tone === "error" ? "text-destructive" : tone === "active" ? "text-sky-600" : "text-amber-700",
        )} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-foreground">{recoveryTitle(recoveryState)}</p>
            {canResume ? (
              <Button type="button" size="sm" variant="outline" disabled={isResuming} onClick={onResume}>
                <RotateCcw className="mr-2 h-3.5 w-3.5" />
                Resume
              </Button>
            ) : null}
          </div>
          <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground">
            {recoveryDescription(recoveryState)}
          </p>
          {typeof recoveryState.attemptCount === "number" && recoveryState.attemptCount > 0 ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Attempts: {recoveryState.attemptCount}
              {recoveryState.policyDecision ? ` · Policy: ${recoveryState.policyDecision}` : ""}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
