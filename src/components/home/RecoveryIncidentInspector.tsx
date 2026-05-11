import { ChevronDown, ShieldCheck } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { RecoveryIncidentRecord } from "@/app/home/types";
import { conversationMainManager } from "@/components/component-state-managers";
import { useManagerSnapshot } from "@/lib/use-manager-snapshot";
import { cn } from "@/lib/utils";
import { t, useI18nSnapshot } from "@/lib/i18n";

function formatTime(value: string | null | undefined) {
  if (!value) return t("recovery.inspector.notResolved");
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : value;
}

function parseDetails(details: string | null | undefined) {
  if (!details) return null;
  try {
    return JSON.parse(details) as Record<string, unknown>;
  } catch {
    return { summary: details };
  }
}

export function RecoveryIncidentInspector({
  runId,
  incidents,
}: {
  runId: string | null;
  incidents: RecoveryIncidentRecord[];
}) {
  useI18nSnapshot();
  const { runLogOpenByRunId } = useManagerSnapshot(conversationMainManager);
  if (!runId || incidents.length === 0) {
    return null;
  }

  const key = `${runId}:recovery`;
  const open = Boolean(runLogOpenByRunId[key]);

  return (
    <Collapsible open={open} onOpenChange={(nextOpen) => conversationMainManager.setRunLogOpen(key, nextOpen)}>
      <div className="rounded-lg border border-border/70 bg-muted/20 text-sm" aria-label={t("recovery.inspector.ariaLabel")}>
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left">
          <span className="flex min-w-0 items-center gap-2 text-xs font-semibold text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
            {t("recovery.inspector.title")}
            <span className="rounded-full bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {incidents.length}
            </span>
          </span>
          <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-2 border-t border-border/60 px-3 py-2">
            {incidents.map((incident) => {
              const details = parseDetails(incident.details);
              return (
                <div key={incident.id} className="rounded-md border border-border/50 bg-background/70 p-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-foreground">{incident.kind} · {incident.status}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {t("recovery.inspector.detectedUpdated", {
                          detectedAt: formatTime(incident.detectedAt),
                          updatedAt: formatTime(incident.updatedAt),
                        })}
                      </p>
                    </div>
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {t("recovery.inspector.attempts", { count: incident.autoAttemptCount })}
                    </span>
                  </div>
                  <dl className="mt-2 grid gap-1 text-[11px] text-muted-foreground">
                    {incident.workerId ? <div><dt className="inline font-medium">{t("recovery.inspector.worker")}</dt> <dd className="inline font-mono">{incident.workerId}</dd></div> : null}
                    {incident.queuedMessageId ? <div><dt className="inline font-medium">{t("recovery.inspector.queuedMessage")}</dt> <dd className="inline font-mono">{incident.queuedMessageId}</dd></div> : null}
                    {incident.lastError ? <div><dt className="inline font-medium">{t("recovery.inspector.error")}</dt> <dd className="inline break-words">{incident.lastError}</dd></div> : null}
                    {details?.decision ? <div><dt className="inline font-medium">{t("recovery.inspector.policy")}</dt> <dd className="inline">{String(details.decision)}</dd></div> : null}
                    {details?.summary ? <div><dt className="inline font-medium">{t("recovery.inspector.summary")}</dt> <dd className="inline">{String(details.summary)}</dd></div> : null}
                    {details?.resumeAt ? <div><dt className="inline font-medium">{t("recovery.inspector.resumeAt")}</dt> <dd className="inline">{formatTime(String(details.resumeAt))}</dd></div> : null}
                    {details?.quotaResetSource ? <div><dt className="inline font-medium">{t("recovery.inspector.source")}</dt> <dd className="inline">{String(details.quotaResetSource)}</dd></div> : null}
                    {details?.quotaResetConfidence ? <div><dt className="inline font-medium">{t("recovery.inspector.confidence")}</dt> <dd className="inline">{String(details.quotaResetConfidence)}</dd></div> : null}
                    {details?.scheduledWakeAt ? <div><dt className="inline font-medium">{t("recovery.inspector.scheduledWake")}</dt> <dd className="inline">{formatTime(String(details.scheduledWakeAt))}</dd></div> : null}
                    {details?.rawText ? <div><dt className="inline font-medium">{t("recovery.inspector.providerMessage")}</dt> <dd className="inline break-words">{String(details.rawText)}</dd></div> : null}
                    {incident.resolvedAt ? <div><dt className="inline font-medium">{t("recovery.inspector.resolved")}</dt> <dd className="inline">{formatTime(incident.resolvedAt)}</dd></div> : null}
                  </dl>
                </div>
              );
            })}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
