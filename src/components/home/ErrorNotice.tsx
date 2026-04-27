import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NoticeDescriptor } from "@/app/home/types";

export function ErrorNotice({
  error,
}: {
  error: NoticeDescriptor;
}) {
  const tone = error.tone ?? "error";
  const containerClass = cn(
    "rounded-md px-2 py-1 text-xs",
    tone === "success"
      ? "border border-emerald-500/20 bg-emerald-500/[0.03]"
      : tone === "warning"
        ? "border border-amber-500/20 bg-amber-500/[0.03]"
        : "border border-destructive/20 bg-destructive/[0.03]",
  );
  const iconClass = cn(
    "mt-0.5 h-3 w-3 shrink-0",
    tone === "success"
      ? "text-emerald-600"
      : tone === "warning"
        ? "text-amber-700"
        : "text-destructive",
  );
  const titleClass = cn(
    "font-semibold",
    tone === "success"
      ? "text-emerald-700 dark:text-emerald-300"
      : tone === "warning"
        ? "text-amber-800 dark:text-amber-300"
        : "text-destructive",
  );

  return (
    <div className={containerClass}>
      <div className="flex items-start gap-1.5">
        {tone === "success" ? <CheckCircle2 className={iconClass} /> : <AlertTriangle className={iconClass} />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-x-1.5 gap-y-0.5 leading-4">
            <span className={titleClass}>{error.action || error.source || "Error"}</span>
            <span className="whitespace-pre-wrap break-words text-muted-foreground">
              {error.message}
            </span>
          </div>
          {error.suggestion ? (
            <div className="mt-0.5 leading-4 text-muted-foreground">{error.suggestion}</div>
          ) : null}
          {error.details?.length ? (
            <div className="mt-0.5 space-y-0.5 text-muted-foreground">
              {error.details.map((detail) => (
                <div key={detail} className="whitespace-pre-wrap break-words font-mono">
                  {detail}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
