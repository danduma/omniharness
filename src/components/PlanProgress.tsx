"use client";

import React from "react";
import { CircleAlert, CircleX, LoaderCircle, Square, SquareCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { t, useI18nSnapshot } from "@/lib/i18n";
import type { GoalPlanItem } from "@/shared/goal-plan";

interface PlanProgressProps {
  items: GoalPlanItem[];
  compact?: boolean;
  source?: "agent" | "file";
}

const statusIcons = {
  pending: Square,
  in_progress: LoaderCircle,
  blocked: CircleAlert,
  completed: SquareCheck,
  failed: CircleX,
};

const statusStyles: Record<string, string> = {
  pending: "text-muted-foreground",
  in_progress: "text-blue-600 dark:text-blue-400",
  blocked: "text-amber-700 dark:text-amber-400",
  completed: "text-emerald-700 dark:text-emerald-300",
  failed: "text-destructive",
};

export function PlanProgress({ items, compact = false, source = "agent" }: PlanProgressProps) {
  useI18nSnapshot();
  const total = items.length;
  const completed = items.filter((item) => item.status === "completed").length;
  const fromFile = source === "file";

  return (
    <div className="space-y-3" data-plan-source={source}>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3 text-sm font-medium">
          <span>{t(fromFile ? "goal.plan.fileTitle" : "goal.plan.title")}</span>
          <Badge variant="secondary" className="shrink-0">{t(fromFile ? "goal.plan.checkedCount" : "goal.plan.progress", { completed, total })}</Badge>
        </div>
        {fromFile ? <p className="text-xs leading-relaxed text-muted-foreground">{t("goal.plan.fileHelp")}</p> : null}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("goal.plan.empty")}</p>
      ) : (
        <div
          role="region"
          aria-label={t("goal.plan.list")}
          tabIndex={0}
          className="max-h-[min(36dvh,20rem)] overflow-y-auto overscroll-contain rounded-lg [touch-action:pan-y_pinch-zoom] focus-visible:outline-2 focus-visible:outline-ring [scrollbar-width:thin]"
        >
          <ul className="divide-y divide-border/50">
            {items.map((item) => {
              const StatusIcon = statusIcons[item.status];
              const statusLabel = t(fromFile && (item.status === "pending" || item.status === "completed")
                ? `goal.plan.fileStatus.${item.status}`
                : `goal.plan.status.${item.status}`);
              return (
                <li key={item.id} className="flex items-start gap-2.5 py-2.5 pr-2">
                  <span role="img" aria-label={statusLabel} title={statusLabel} className={`mt-0.5 shrink-0 ${statusStyles[item.status] || ""}`}>
                    <StatusIcon className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    {!compact ? <div className="text-xs font-medium text-muted-foreground">{item.phase || t("goal.plan.unphased")}</div> : null}
                    <div className="break-words text-sm leading-relaxed [overflow-wrap:anywhere]">{item.title}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
