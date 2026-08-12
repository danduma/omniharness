"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { t, useI18nSnapshot } from "@/lib/i18n";
import type { GoalPlanItem } from "@/shared/goal-plan";

interface PlanProgressProps {
  items: GoalPlanItem[];
  compact?: boolean;
}

const statusStyles: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-500/10 text-blue-600",
  blocked: "bg-amber-500/10 text-amber-700",
  completed: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  failed: "bg-destructive/10 text-destructive",
};

export function PlanProgress({ items, compact = false }: PlanProgressProps) {
  useI18nSnapshot();
  const total = items.length;
  const completed = items.filter((item) => item.status === "completed").length;

  return (
    <Card className="border-border/60 bg-background/50 shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <span>{t("goal.plan.title")}</span>
          <Badge variant="secondary">{t("goal.plan.progress", { completed, total })}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("goal.plan.empty")}</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3 rounded-lg border border-border/50 px-3 py-2">
                <div className="min-w-0">
                  {!compact ? <div className="text-xs font-medium text-muted-foreground">{item.phase || t("goal.plan.unphased")}</div> : null}
                  <div className="truncate text-sm">{item.title}</div>
                </div>
                <Badge className={statusStyles[item.status] || ""} variant="secondary">
                  {t(`goal.plan.status.${item.status}`)}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
