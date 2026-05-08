import type React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { SettingsDraftState } from "@/app/home/SettingsDraftManager";
import type { AppErrorDescriptor } from "@/lib/app-errors";
import { appErrorKey } from "@/lib/app-errors";
import type { LlmProfileTab, SettingsTab, WorkerAvailability } from "@/app/home/types";
import { cn } from "@/lib/utils";
import { ErrorNotice } from "@/components/home/ErrorNotice";
import { buildInlineError } from "@/app/home/utils";
import { GeneralSettingsPanel } from "./GeneralSettingsPanel";
import { ModelsSettingsPanel } from "./ModelsSettingsPanel";
import { AgentsSettingsPanel } from "./AgentsSettingsPanel";
import { RuntimeSettingsPanel } from "./RuntimeSettingsPanel";

const SETTINGS_TABS: Array<{ value: SettingsTab; label: string }> = [
  { value: "general", label: "General" },
  { value: "models", label: "Models" },
  { value: "agents", label: "Agents" },
  { value: "runtime", label: "Runtime" },
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
  secretStates?: Record<string, { configured: boolean; updatedAt: string }>;
  settingsWorkers: WorkerAvailability[];
  workerCatalogQuery: {
    isError: boolean;
    error: unknown;
    data?: { diagnostics?: AppErrorDescriptor[] };
  };
  settingsDiagnostics: AppErrorDescriptor[];
  saveSettings: {
    error: unknown;
    isPending: boolean;
    mutate: () => void;
  };
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
  workerCatalogQuery,
  settingsDiagnostics,
  saveSettings,
}: SettingsDialogProps) {
  const isDirty = settingsDraft.dirtyKeys.size > 0;
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      discardSettingsDraft();
    }
    onOpenChange(nextOpen);
  };
  const handleCancel = () => handleOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[min(760px,calc(100dvh-2rem))] flex-col overflow-hidden sm:max-h-[min(760px,calc(100dvh-3rem))] sm:max-w-2xl">
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle>OmniHarness Settings</DialogTitle>
          <DialogDescription>
            Configure browser preferences, model routing, worker agents, and runtime behavior for this workspace.
          </DialogDescription>
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
                  {tab.label}
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
            {activeSettingsTab === "agents" ? (
              <AgentsSettingsPanel
                settings={settingsDraft.draft}
                setSetting={setSetting}
                settingsWorkers={settingsWorkers}
                workerCatalogQuery={workerCatalogQuery}
              />
            ) : null}
            {activeSettingsTab === "runtime" ? (
              <RuntimeSettingsPanel settings={settingsDraft.draft} setSetting={setSetting} />
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

        <DialogFooter className="shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Local preferences apply immediately. Save persists only workspace and runtime settings.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={handleCancel}>Cancel</Button>
            <Button onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending || !isDirty}>
              {isDirty ? "Save" : "Saved"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
