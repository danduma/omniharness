import type React from "react";
import { Bug } from "lucide-react";
import { appearancePreferencesManager } from "@/app/home/AppearancePreferencesManager";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { requestBugDropOpen } from "@/components/BugDropBootstrap";
import type { SettingsDraftState } from "@/app/home/SettingsDraftManager";
import type { AppErrorDescriptor } from "@/lib/app-errors";
import { appErrorKey } from "@/lib/app-errors";
import type { AccountRecord, LlmProfileTab, SettingsResponse, SettingsTab, WorkerAvailability, WorkerCatalogResponse } from "@/app/home/types";
import { cn } from "@/lib/utils";
import { ErrorNotice } from "@/components/home/ErrorNotice";
import { buildInlineError } from "@/app/home/utils";
import { useManagerSnapshot } from "@/lib/use-manager-snapshot";
import { t, useI18nSnapshot } from "@/lib/i18n";
import { GeneralSettingsPanel } from "./GeneralSettingsPanel";
import { ModelsSettingsPanel } from "./ModelsSettingsPanel";
import { CredentialsSettingsPanel } from "./CredentialsSettingsPanel";
import { AgentsSettingsPanel } from "./AgentsSettingsPanel";
import { RuntimeSettingsPanel } from "./RuntimeSettingsPanel";
import { ProjectMemorySettingsPanel } from "./ProjectMemorySettingsPanel";
import { parseBooleanSetting } from "@/app/home/utils";

const SETTINGS_TABS: Array<{ value: SettingsTab; labelKey: string }> = [
  { value: "general", labelKey: "settings.tabs.general" },
  { value: "models", labelKey: "settings.tabs.models" },
  { value: "credentials", labelKey: "settings.tabs.credentials" },
  { value: "agents", labelKey: "settings.tabs.agents" },
  { value: "runtime", labelKey: "settings.tabs.runtime" },
  { value: "memory", labelKey: "settings.tabs.memory" },
];

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeSettingsTab: SettingsTab;
  setActiveSettingsTab: React.Dispatch<React.SetStateAction<SettingsTab>>;
  activeLlmProfileTab: LlmProfileTab;
  setActiveLlmProfileTab: React.Dispatch<React.SetStateAction<LlmProfileTab>>;
  settingsDraft: SettingsDraftState;
  setSetting: (key: string, value: string) => void;
  discardSettingsDraft: () => void;
  secretStates?: Record<string, { configured: boolean; updatedAt: string; preview?: string }>;
  settingsWorkers: WorkerAvailability[];
  accounts: AccountRecord[];
  onAccountsChanged: (accounts: AccountRecord[]) => void;
  onRefreshAccounts: () => Promise<void>;
  workerCatalogQuery: {
    isError: boolean;
    isFetching?: boolean;
    error: unknown;
    data?: Partial<WorkerCatalogResponse> & { diagnostics?: AppErrorDescriptor[] };
  };
  onRefreshWorkerCatalog: () => void;
  workerCatalogRefreshing: boolean;
  settingsDiagnostics: AppErrorDescriptor[];
  resourceSnapshot?: SettingsResponse["resourceSnapshot"];
  saveSettings: {
    error: unknown;
    isPending: boolean;
    mutate: () => void;
  };
  activeProjectPath: string | null;
}

export function SettingsDialog({
  open,
  onOpenChange,
  activeSettingsTab,
  setActiveSettingsTab,
  activeLlmProfileTab,
  setActiveLlmProfileTab,
  settingsDraft,
  setSetting,
  discardSettingsDraft,
  secretStates,
  settingsWorkers,
  accounts,
  onAccountsChanged,
  onRefreshAccounts,
  workerCatalogQuery,
  onRefreshWorkerCatalog,
  workerCatalogRefreshing,
  settingsDiagnostics,
  resourceSnapshot,
  saveSettings,
  activeProjectPath,
}: SettingsDialogProps) {
  const appearancePreferences = useManagerSnapshot(appearancePreferencesManager);
  useI18nSnapshot();
  const serverSettingsDirty = settingsDraft.dirtyKeys.size > 0;
  const localPreferencesDirty = appearancePreferences.dirtyKeys.size > 0;
  const isDirty = serverSettingsDirty || localPreferencesDirty;
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      discardSettingsDraft();
      appearancePreferencesManager.discardDraft();
    }
    onOpenChange(nextOpen);
  };
  const handleCancel = () => handleOpenChange(false);
  const handleSave = () => {
    const isServerDirty = settingsDraft.dirtyKeys.size > 0;

    if (isServerDirty) {
      saveSettings.mutate();
      return;
    }

    appearancePreferencesManager.saveDraft();
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[min(760px,calc(100dvh-2rem))] flex-col overflow-hidden sm:max-h-[min(760px,calc(100dvh-3rem))] sm:max-w-2xl">
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle>{t("settings.dialog.title")}</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="space-y-4">
            <div className="inline-flex flex-wrap rounded-xl border border-border/60 bg-muted/30 p-1">
              {SETTINGS_TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                    activeSettingsTab === tab.value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  aria-pressed={activeSettingsTab === tab.value}
                  onClick={() => setActiveSettingsTab(tab.value)}
                >
                  {t(tab.labelKey)}
                </button>
              ))}
            </div>

            {activeSettingsTab === "general" ? (
              <GeneralSettingsPanel />
            ) : null}
            {activeSettingsTab === "models" ? (
              <ModelsSettingsPanel
                activeLlmProfileTab={activeLlmProfileTab}
                setActiveLlmProfileTab={setActiveLlmProfileTab}
                settings={settingsDraft.draft}
                setSetting={setSetting}
                secretStates={secretStates}
              />
            ) : null}
            {activeSettingsTab === "credentials" ? (
              <CredentialsSettingsPanel
                settings={settingsDraft.draft}
                setSetting={setSetting}
              />
            ) : null}
            {activeSettingsTab === "agents" ? (
              <AgentsSettingsPanel
                settings={settingsDraft.draft}
                setSetting={setSetting}
                settingsWorkers={settingsWorkers}
                accounts={accounts}
                onAccountsChanged={onAccountsChanged}
                onRefreshAccounts={onRefreshAccounts}
                workerModels={workerCatalogQuery.data?.workerModels}
                workerModelsRefreshing={workerCatalogQuery.data?.workerModelsRefreshing}
                workerCatalogQuery={workerCatalogQuery}
                onRefreshWorkerCatalog={onRefreshWorkerCatalog}
                workerCatalogRefreshing={workerCatalogRefreshing}
              />
            ) : null}
            {activeSettingsTab === "runtime" ? (
              <RuntimeSettingsPanel
                settings={settingsDraft.draft}
                setSetting={setSetting}
                resourceSnapshot={resourceSnapshot}
              />
            ) : null}
            {activeSettingsTab === "memory" ? (
              <ProjectMemorySettingsPanel
                projectPath={activeProjectPath}
                globalMemoryEnabled={parseBooleanSetting(settingsDraft.draft.SUPERVISOR_MEMORY_ENABLED, true)}
              />
            ) : null}

            {settingsDiagnostics.length > 0 ? (
              <div className="space-y-3">
                {settingsDiagnostics.map((error) => (
                  <ErrorNotice key={appErrorKey(error)} error={error} />
                ))}
              </div>
            ) : null}

            {workerCatalogQuery.data?.diagnostics?.length ? (
              <div className="space-y-3">
                {workerCatalogQuery.data.diagnostics.map((error) => (
                  <ErrorNotice key={appErrorKey(error)} error={error} />
                ))}
              </div>
            ) : null}

            {saveSettings.error ? (
              <ErrorNotice
                error={buildInlineError(saveSettings.error, {
                  source: "Settings",
                  action: "Save settings",
                })}
              />
            ) : null}
          </div>
        </div>

        <DialogFooter className="shrink-0 sm:justify-between">
          <Button variant="outline" onClick={requestBugDropOpen}>
            <Bug className="h-4 w-4" />
            <span>{t("settings.feedback.reportIssue")}</span>
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="ghost" onClick={handleCancel}>{t("common.cancel")}</Button>
            <Button onClick={handleSave} disabled={saveSettings.isPending || !isDirty}>
              {isDirty ? t("common.save") : t("common.saved")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
