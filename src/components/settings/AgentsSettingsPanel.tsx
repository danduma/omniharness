import { WORKER_OPTIONS } from "@/app/home/constants";
import type { WorkerAvailability, WorkerModelCatalog, WorkerType } from "@/app/home/types";
import { buildInlineError, parseBooleanSetting, parseWorkerType, parseWorkerTypes } from "@/app/home/utils";
import type { AppErrorDescriptor } from "@/lib/app-errors";
import { cn } from "@/lib/utils";
import { ErrorNotice } from "@/components/home/ErrorNotice";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { t, useI18nSnapshot } from "@/lib/i18n";
import { getWorkerAvailabilityMessage } from "./worker-availability-copy";

interface AgentsSettingsPanelProps {
  settings: Record<string, string>;
  setSetting: (key: string, value: string) => void;
  settingsWorkers: WorkerAvailability[];
  workerModels?: Partial<WorkerModelCatalog>;
  workerModelsRefreshing?: boolean;
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
  workerModels,
  workerModelsRefreshing = false,
  workerCatalogQuery,
}: AgentsSettingsPanelProps) {
  useI18nSnapshot();
  const configuredAllowedWorkerTypes = parseWorkerTypes(settings.WORKER_ALLOWED_TYPES);
  const configuredAllowedWorkerSet = new Set(configuredAllowedWorkerTypes);
  const defaultWorkerType = parseWorkerType(settings.WORKER_DEFAULT_TYPE) ?? configuredAllowedWorkerTypes[0] ?? "codex";
  const yoloEnabled = parseBooleanSetting(settings.WORKER_YOLO_MODE, true);
  const defaultWorkerOptions = WORKER_OPTIONS
    .filter((option) => configuredAllowedWorkerSet.has(option.value))
    .map((option) => ({ value: option.value, label: option.label }));
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
      <div className="flex items-center gap-3">
        <label className="shrink-0 text-xs font-semibold text-muted-foreground" htmlFor="WORKER_DEFAULT_TYPE">
          {t("settings.agents.defaultWorker")}
        </label>
        <Select
          id="WORKER_DEFAULT_TYPE"
          className="flex-1"
          value={defaultWorkerType}
          options={defaultWorkerOptions}
          onValueChange={(value) => setSetting("WORKER_DEFAULT_TYPE", value)}
        />
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/70 p-3">
        <Switch
          id="WORKER_YOLO_MODE"
          aria-label={t("settings.agents.toggleDangerouslySkipPermissions")}
          checked={yoloEnabled}
          onCheckedChange={(checked) => setSetting("WORKER_YOLO_MODE", checked ? "true" : "false")}
        />
        <div className="min-w-0 space-y-1">
          <div className="text-sm font-medium">{t("settings.agents.dangerouslySkipPermissions")}</div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground">{t("settings.agents.workerAvailability")}</div>
        {settingsWorkers.map((worker) => {
          const isAvailable = worker.availability.status === "ok";
          const isChecked = configuredAllowedWorkerSet.has(worker.type);
          const modelOptions = workerModels?.[worker.type] ?? [];
          const availabilityMessage = isAvailable ? null : getWorkerAvailabilityMessage(worker);
          const availabilityTone =
            worker.availability.status === "ok"
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : worker.availability.status === "warning"
                ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                : "bg-destructive/10 text-destructive";

          return (
            <div
              key={worker.type}
              className={cn(
                "flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-background/70 p-3",
                !isAvailable && "opacity-70",
              )}
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <Switch
                  aria-label={t("settings.agents.toggleWorker", { worker: worker.label })}
                  className="mt-0.5"
                  checked={isChecked}
                  disabled={!isAvailable || (isChecked && configuredAllowedWorkerTypes.length === 1)}
                  onCheckedChange={(checked) => toggleAllowedWorker(worker.type, checked)}
                />
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium break-words">{worker.label}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em]", availabilityTone)}>
                      {worker.availability.status}
                    </span>
                  </div>
                  {availabilityMessage ? (
                    <p className="text-xs break-words text-muted-foreground">
                      {availabilityMessage}
                    </p>
                  ) : null}
                  <dl className="grid gap-x-3 gap-y-1 pt-1 text-[11px] text-muted-foreground sm:grid-cols-[max-content_minmax(0,1fr)]">
                    <dt className="whitespace-nowrap font-medium text-foreground/70">{t("settings.agents.installedDir")}</dt>
                    <dd className="min-w-0 truncate" title={worker.installation?.path ?? undefined}>
                      {worker.installation?.dir ?? (worker.availability.binary ? t("common.unknown") : t("settings.agents.notInstalled"))}
                    </dd>
                    <dt className="whitespace-nowrap font-medium text-foreground/70">{t("settings.tabs.models")}</dt>
                    <dd className="min-w-0">
                      {modelOptions.length > 0 ? (
                        <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto pr-1">
                          {modelOptions.map((model) => (
                            <span key={model.value} className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-foreground/80">
                              {model.label}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span>{workerModelsRefreshing ? t("settings.models.loadingModels") : t("settings.agents.noModelsReported")}</span>
                      )}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {workerCatalogQuery.isError ? (
        <ErrorNotice
          error={buildInlineError(workerCatalogQuery.error, {
            source: t("settings.agents.errorSource"),
            action: t("settings.agents.loadWorkerAvailability"),
          })}
        />
      ) : null}
    </div>
  );
}
