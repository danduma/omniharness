"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ValidationEntry {
  id: string;
  status: string;
  summary: string | null;
  evidence: string | null;
}

interface ValidationSummaryProps {
  validations: ValidationEntry[];
}

export function ValidationSummary({ validations }: ValidationSummaryProps) {
  const passed = validations.filter((entry) => entry.status === "passed").length;
  const failed = validations.filter((entry) => entry.status === "failed").length;

  return (
    <Card className="border-border/60 bg-background/80">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <span>Validation</span>
          <Badge variant="secondary">{passed} pass / {failed} fail</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {validations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No validation results yet.</p>
        ) : (
          validations.map((entry) => (
            <div key={entry.id} className="rounded-lg border border-border/50 px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm capitalize">{entry.status}</span>
                <Badge variant={entry.status === "passed" ? "default" : "destructive"}>{entry.status}</Badge>
              </div>
              {entry.summary && <p className="mt-1 text-xs text-muted-foreground">{entry.summary}</p>}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
