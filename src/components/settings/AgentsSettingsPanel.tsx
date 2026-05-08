import { WORKER_OPTIONS } from "@/app/home/constants";
import type { WorkerAvailability, WorkerType } from "@/app/home/types";
import { buildInlineError, parseBooleanSetting, parseWorkerType, parseWorkerTypes } from "@/app/home/utils";
import type { AppErrorDescriptor } from "@/lib/app-errors";
import { cn } from "@/lib/utils";
import { ErrorNotice } from "@/components/home/ErrorNotice";

interface AgentsSettingsPanelProps {
  settings: Record<string, string>;
  setSetting: (key: string, value: string) => void;
  settingsWorkers: WorkerAvailability[];
  workerCatalogQuery: {
    isError: boolean;
    error: unknown;
    data?: { diagnostics?: AppErrorDescriptor[] };
  };
}

export function AgentsSettingsPanel({
  settings,
  setSetting,
  settingsWorkers,
  workerCatalogQuery,
}: AgentsSettingsPanelProps) {
  const configuredAllowedWorkerTypes = parseWorkerTypes(settings.WORKER_ALLOWED_TYPES);
  const configuredAllowedWorkerSet = new Set(configuredAllowedWorkerTypes);
  const defaultWorkerType = parseWorkerType(settings.WORKER_DEFAULT_TYPE) ?? configuredAllowedWorkerTypes[0] ?? "codex";
  const toggleAllowedWorker = (workerType: WorkerType, checked: boolean) => {
    const nextAllowed = checked
      ? Array.from(new Set([...configuredAllowedWorkerTypes, workerType]))
      : configuredAllowedWorkerTypes.filter((type) => type !== workerType);

    if (nextAllowed.length === 0) {
      return;
    }

    setSetting("WORKER_ALLOWED_TYPES", JSON.stringify(nextAllowed));
    if (!nextAllowed.includes(defaultWorkerType)) {
      setSetting("WORKER_DEFAULT_TYPE", nextAllowed[0]);
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4">
      <div className="space-y-1">
        <div className="text-sm font-semibold">Worker Agents</div>
        <p className="text-xs text-muted-foreground">
          Tune availability, allowed workers, default agent selection, and permission posture.
        </p>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground">Worker availability status</div>
        <p className="text-xs text-muted-foreground">
          Only currently available bridge workers can be enabled for new conversations.
        </p>
        {settingsWorkers.map((worker) => {
          const isAvailable = worker.availability.status === "ok";
          const isChecked = configuredAllowedWorkerSet.has(worker.type);
          const availabilityTone =
            worker.availability.status === "ok"
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : worker.availability.status === "warning"
                ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                : "bg-destructive/10 text-destructive";

          return (
            <label
              key={worker.type}
              className={cn(
                "flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-background/70 p-3",
                !isAvailable && "opacity-70",
              )}
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-border"
                  checked={isChecked}
                  disabled={!isAvailable || (isChecked && configuredAllowedWorkerTypes.length === 1)}
                  onChange={(event) => toggleAllowedWorker(worker.type, event.target.checked)}
                />
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium break-words">{worker.label}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em]", availabilityTone)}>
                      {worker.availability.status}
                    </span>
                  </div>
                  <p className="text-xs break-words text-muted-foreground">
                    {worker.availability.message || (isAvailable ? "Ready to spawn from the bridge." : "Unavailable right now.")}
                  </p>
                </div>
              </div>
            </label>
          );
        })}
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground" htmlFor="WORKER_DEFAULT_TYPE">
          Default Worker Agent
        </label>
        <select
          id="WORKER_DEFAULT_TYPE"
          className="h-8 w-full rounded border bg-muted/50 px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
          value={defaultWorkerType}
          onChange={(event) => setSetting("WORKER_DEFAULT_TYPE", event.target.value)}
        >
          {WORKER_OPTIONS
            .filter((option) => configuredAllowedWorkerSet.has(option.value))
            .map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
        </select>
      </div>

      <label className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-background/70 p-3" htmlFor="WORKER_YOLO_MODE">
        <div className="min-w-0 space-y-1">
          <div className="text-sm font-medium">YOLO / permission posture</div>
          <p className="text-xs text-muted-foreground">
            Default new workers to the runtime&apos;s most permissive mode so routine approvals rarely interrupt execution.
          </p>
        </div>
        <input
          id="WORKER_YOLO_MODE"
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-border"
          checked={parseBooleanSetting(settings.WORKER_YOLO_MODE, true)}
          onChange={(event) => setSetting("WORKER_YOLO_MODE", event.target.checked ? "true" : "false")}
        />
      </label>

      {workerCatalogQuery.isError ? (
        <ErrorNotice
          error={buildInlineError(workerCatalogQuery.error, {
            source: "Agent runtime",
            action: "Load worker availability",
          })}
        />
      ) : null}
    </div>
  );
}
