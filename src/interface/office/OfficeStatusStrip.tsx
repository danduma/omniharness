import React, { memo } from "react";
import type { AgentSnapshot } from "@/interface/home/types";
import { getWorkerRuntimeLabel, type ConversationWorkerRecord } from "@/lib/conversation-workers";
import { useManagerSnapshot } from "@/lib/use-manager-snapshot";
import { t, useI18nSnapshot } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ACTIVITY_ICONS } from "./activity-icons";
import { deriveWorkerRecordActivity, isAttentionActivity } from "./deriveAgentActivity";
import { workerActivityManager } from "./WorkerActivityManager";

export interface OfficeStatusStripProps {
  workers: ConversationWorkerRecord[];
  agentsById: ReadonlyMap<string, AgentSnapshot>;
  focusedWorkerId?: string | null;
  onFocusWorker?: (workerId: string) => void;
}

/**
 * Compact one-row-per-worker activity board. Each row carries an icon and a
 * text label, so state never depends on color alone.
 */
export const OfficeStatusStrip = memo(function OfficeStatusStrip({ workers, agentsById, focusedWorkerId, onFocusWorker }: OfficeStatusStripProps) {
  useI18nSnapshot();
  const streamActivityByWorker = useManagerSnapshot(workerActivityManager);
  if (workers.length === 0) {
    return null;
  }

  return (
    <ul className="space-y-0.5" aria-label={t("office.strip.aria")}>
      {workers.map((worker, index) => {
        const activity = deriveWorkerRecordActivity(
          worker,
          agentsById.get(worker.id),
          streamActivityByWorker[worker.id]?.activity,
        );
        const Icon = ACTIVITY_ICONS[activity];
        const attention = isAttentionActivity(activity);
        const workerLabel = t("office.strip.workerLabel", {
          number: typeof worker.workerNumber === "number" ? worker.workerNumber : index + 1,
        });
        const activityLabel = t(`office.activity.${activity}`);
        const runtime = getWorkerRuntimeLabel(worker);
        const isFocused = focusedWorkerId === worker.id;

        return (
          <li key={worker.id}>
            <button
              type="button"
              disabled={!onFocusWorker}
              aria-pressed={onFocusWorker ? isFocused : undefined}
              title={t("office.strip.focusWorker", { worker: workerLabel })}
              onClick={() => onFocusWorker?.(worker.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs transition-colors motion-reduce:transition-none",
                onFocusWorker ? "hover:bg-muted/60" : "cursor-default",
                isFocused && "bg-muted",
              )}
            >
              <Icon
                aria-hidden="true"
                className={cn("h-3.5 w-3.5 shrink-0", attention ? "text-destructive" : "text-muted-foreground")}
              />
              <span className="min-w-0 flex-1 truncate font-medium">{workerLabel}</span>
              <span className={cn("shrink-0", attention ? "font-semibold text-foreground" : "text-muted-foreground")}>
                {activityLabel}
              </span>
              {runtime ? <span className="shrink-0 tabular-nums text-muted-foreground">{runtime}</span> : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
});
