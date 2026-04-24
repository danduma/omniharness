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
    "rounded-xl p-4 text-sm shadow-sm",
    tone === "success"
      ? "border border-emerald-500/30 bg-emerald-500/5"
      : tone === "warning"
        ? "border border-amber-500/30 bg-amber-500/5"
        : "border border-destructive/30 bg-destructive/5",
  );
  const iconClass = cn(
    "mt-0.5 h-4 w-4 shrink-0",
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
      <div className="flex items-start gap-3">
        {tone === "success" ? <CheckCircle2 className={iconClass} /> : <AlertTriangle className={iconClass} />}
        <div className="min-w-0 flex-1">
          <div>
            <div className={titleClass}>{error.action || error.source || "Error"}</div>
            <div className="mt-1 whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-foreground">
              {error.message}
            </div>
          </div>
          {error.suggestion ? (
            <div className="mt-2 text-xs leading-relaxed text-muted-foreground">{error.suggestion}</div>
          ) : null}
          {error.details?.length ? (
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
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
