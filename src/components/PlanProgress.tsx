"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PlanItem {
  id: string;
  title: string;
  phase: string | null;
  status: string;
}

interface PlanProgressProps {
  items: PlanItem[];
}

const statusStyles: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-500/10 text-blue-600",
  blocked: "bg-amber-500/10 text-amber-700",
  done: "bg-emerald-500/10 text-emerald-700",
  failed: "bg-destructive/10 text-destructive",
};

export function PlanProgress({ items }: PlanProgressProps) {
  const total = items.length;
  const completed = items.filter((item) => item.status === "done").length;

  return (
    <Card className="border-border/60 bg-background/80">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <span>Plan Progress</span>
          <Badge variant="secondary">{completed}/{total}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No plan items yet.</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-3 rounded-lg border border-border/50 px-3 py-2">
              <div className="min-w-0">
                <div className="text-xs font-medium text-muted-foreground">{item.phase || "Unphased"}</div>
                <div className="text-sm truncate">{item.title}</div>
              </div>
              <Badge className={statusStyles[item.status] || ""} variant="secondary">
                {item.status}
              </Badge>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
