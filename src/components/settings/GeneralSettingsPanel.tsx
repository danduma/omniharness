import { LanguageSelect } from "@/components/LanguageSelect";
import { Select } from "@/components/ui/select";
import {
  COMMIT_WORKER_EFFORTS,
  GIT_COMMIT_WORKER_EFFORT_SETTING,
  GIT_COMMIT_WORKER_MODEL_SETTING,
  GIT_COMMIT_WORKER_TYPE_SETTING,
  normalizeCommitWorkerSettings,
} from "@/lib/commit-workflow";
import { getWorkerModelOptions } from "@/interface/home/utils";
import { WORKER_OPTIONS } from "@/interface/home/constants";
import type { WorkerModelCatalog } from "@/interface/home/types";
import { t, useI18nSnapshot } from "@/lib/i18n";
import { AppearanceSettingsPanel } from "./AppearanceSettingsPanel";
import { NotificationsSettingsPanel } from "./NotificationsSettingsPanel";

interface GeneralSettingsPanelProps {
  settings: Record<string, string>;
  setSetting: (key: string, value: string) => void;
  workerModels?: Partial<WorkerModelCatalog>;
}

function workerLabelKey(workerType: string) {
  return `settings.commitAgent.cli.${workerType}`;
}

function effortLabelKey(effort: string) {
  return `settings.commitAgent.effort.${effort.replace(" ", "")}`;
}

export function GeneralSettingsPanel({ settings, setSetting, workerModels }: GeneralSettingsPanelProps) {
  useI18nSnapshot();
  const commitWorker = normalizeCommitWorkerSettings(settings);
  const modelOptions = getWorkerModelOptions(workerModels, commitWorker.workerType);
  const visibleModelOptions = modelOptions.some((option) => option.value === commitWorker.model)
    ? modelOptions
    : [{ value: commitWorker.model, label: commitWorker.model }, ...modelOptions];
  const workerOptions = WORKER_OPTIONS.map((option) => ({
    value: option.value,
    label: t(workerLabelKey(option.value)),
  }));
  const effortOptions = COMMIT_WORKER_EFFORTS.map((effort) => ({
    value: effort,
    label: t(effortLabelKey(effort)),
  }));

  const handleWorkerTypeChange = (workerType: string) => {
    setSetting(GIT_COMMIT_WORKER_TYPE_SETTING, workerType);
    const nextModel = getWorkerModelOptions(workerModels, workerType as keyof WorkerModelCatalog)[0]?.value;
    if (nextModel) {
      setSetting(GIT_COMMIT_WORKER_MODEL_SETTING, nextModel);
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4">
      <LanguageSelect />
      <AppearanceSettingsPanel />
      <NotificationsSettingsPanel />
      <div className="space-y-3">
        <div className="space-y-1">
          <div className="text-sm font-semibold">{t("settings.commitAgent.title")}</div>
          <p className="text-xs leading-5 text-muted-foreground">{t("settings.commitAgent.description")}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(9rem,0.9fr)_minmax(14rem,1.35fr)] sm:items-center">
          <label className="text-sm font-semibold text-foreground" htmlFor={GIT_COMMIT_WORKER_TYPE_SETTING}>
            {t("settings.commitAgent.cli")}
          </label>
          <Select
            id={GIT_COMMIT_WORKER_TYPE_SETTING}
            ariaLabel={t("settings.commitAgent.cli")}
            value={commitWorker.workerType}
            options={workerOptions}
            onValueChange={handleWorkerTypeChange}
          />
          <label className="text-sm font-semibold text-foreground" htmlFor={GIT_COMMIT_WORKER_MODEL_SETTING}>
            {t("settings.commitAgent.model")}
          </label>
          <Select
            id={GIT_COMMIT_WORKER_MODEL_SETTING}
            ariaLabel={t("settings.commitAgent.model")}
            value={commitWorker.model}
            options={visibleModelOptions}
            native
            onValueChange={(value) => setSetting(GIT_COMMIT_WORKER_MODEL_SETTING, value)}
          />
          <label className="text-sm font-semibold text-foreground" htmlFor={GIT_COMMIT_WORKER_EFFORT_SETTING}>
            {t("settings.commitAgent.effort")}
          </label>
          <Select
            id={GIT_COMMIT_WORKER_EFFORT_SETTING}
            ariaLabel={t("settings.commitAgent.effort")}
            value={commitWorker.effort}
            options={effortOptions}
            onValueChange={(value) => setSetting(GIT_COMMIT_WORKER_EFFORT_SETTING, value)}
          />
        </div>
      </div>
    </div>
  );
}
