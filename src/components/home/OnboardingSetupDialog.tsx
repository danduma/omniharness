import { CheckCircle2, CircleAlert, RefreshCw, Settings, Terminal as TerminalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { WorkerAvailability } from "@/app/home/types";
import { cn } from "@/lib/utils";
import { t, useI18nSnapshot } from "@/lib/i18n";
import { getWorkerAvailabilityMessage, getWorkerSetupCommand } from "@/components/settings/worker-availability-copy";

function getTone(worker: WorkerAvailability) {
  if (worker.availability.status === "ok" && worker.authentication?.status !== "not_authenticated") {
    return "ready";
  }
  if (!worker.availability.binary) {
    return "missing";
  }
  if (worker.authentication?.status === "not_authenticated") {
    return "auth";
  }
  return "check";
}

function getLabelKey(worker: WorkerAvailability) {
  const tone = getTone(worker);
  if (tone === "ready") return "settings.agents.onboarding.ready";
  if (tone === "missing") return "settings.agents.onboarding.install";
  if (tone === "auth") return "settings.agents.onboarding.signIn";
  return "settings.agents.onboarding.check";
}

export function hasPendingCliSetup(workers: WorkerAvailability[]): boolean {
  return workers.some((worker) => (
    worker.availability.status !== "ok"
    || worker.authentication?.status === "not_authenticated"
    || worker.authentication?.status === "unknown"
  ));
}

interface OnboardingSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workers: WorkerAvailability[];
  onRefreshWorkerCatalog: () => void;
  workerCatalogRefreshing: boolean;
  onOpenAgentSettings: () => void;
}

export function OnboardingSetupDialog({
  open,
  onOpenChange,
  workers,
  onRefreshWorkerCatalog,
  workerCatalogRefreshing,
  onOpenAgentSettings,
}: OnboardingSetupDialogProps) {
  useI18nSnapshot();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(720px,calc(100dvh-2rem))] flex-col overflow-hidden sm:max-w-xl">
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle>{t("settings.agents.onboarding.title")}</DialogTitle>
          <DialogDescription>{t("settings.agents.onboarding.description")}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {workers.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("settings.agents.onboarding.statusUnknown")}</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {workers.map((worker) => {
                const tone = getTone(worker);
                const isReady = tone === "ready";
                const command = getWorkerSetupCommand(worker);
                const detail = getWorkerAvailabilityMessage(worker) || t("settings.agents.onboarding.statusUnknown");

                return (
                  <div key={worker.type} className="min-w-0 rounded-md border border-border/60 bg-background/75 p-3">
                    <div className="flex min-w-0 items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        {isReady ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                        ) : (
                          <CircleAlert className="h-4 w-4 shrink-0 text-amber-600" />
                        )}
                        <span className="min-w-0 truncate text-sm font-medium text-foreground">{worker.label}</span>
                      </div>
                      <span className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                        isReady ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-300",
                      )}>
                        {t(getLabelKey(worker))}
                      </span>
                    </div>
                    <p className="mt-2 min-h-8 text-xs leading-4 text-muted-foreground">{detail}</p>
                    {!isReady ? (
                      <div className="mt-3 flex items-center gap-2 rounded-md bg-muted/60 px-2 py-1.5 font-mono text-[11px] text-foreground">
                        <TerminalIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="shrink-0 text-muted-foreground">{t("settings.agents.onboarding.command")}</span>
                        <code className="min-w-0 truncate">{command}</code>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button variant="outline" onClick={onRefreshWorkerCatalog} disabled={workerCatalogRefreshing}>
            <RefreshCw className={cn("h-3.5 w-3.5", workerCatalogRefreshing && "animate-spin")} aria-hidden="true" />
            {workerCatalogRefreshing ? t("settings.agents.refreshingAvailability") : t("settings.agents.refreshAvailability")}
          </Button>
          <Button onClick={() => { onOpenChange(false); onOpenAgentSettings(); }}>
            <Settings className="h-3.5 w-3.5" />
            {t("settings.agents.onboarding.openSettings")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
