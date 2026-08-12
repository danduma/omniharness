"use client";

import React from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BranchWorkspaceButton } from "@/components/home/BranchWorkspaceButton";
import { ComposerModelPicker } from "@/components/composer/ComposerModelPicker";
import { ComposerSelect } from "@/components/composer/ComposerSelect";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EFFORT_OPTIONS } from "@/interface/home/constants";
import type { ComposerWorkerOption, WorkerModelOption } from "@/interface/home/types";
import { t, useI18nSnapshot } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type MobileComposerSelectOption = { value: string; label: string };

export type MobileComposerSettingDescriptor =
  | {
    key: "cli";
    kind: "select";
    label: string;
    ariaLabel: string;
    value: ComposerWorkerOption;
    options: MobileComposerSelectOption[];
    disabled: boolean;
    onChange: (value: string) => void;
  }
  | {
    key: "cli";
    kind: "locked";
    label: string;
    value: string;
  }
  | {
    key: "account" | "effort";
    kind: "select";
    label: string;
    ariaLabel: string;
    value: string;
    options: MobileComposerSelectOption[];
    disabled: boolean;
    onChange: (value: string) => void;
  }
  | {
    key: "model";
    kind: "model";
    label: string;
    ariaLabel: string;
    value: string;
    options: WorkerModelOption[];
    disabled: boolean;
    onChange: (value: string) => void;
  };

export interface MobileComposerSettingDescriptorArgs {
  shouldLockDirectWorker: boolean;
  lockedDirectWorkerLabel: string;
  selectedCliAgent: ComposerWorkerOption;
  setSelectedCliAgent: (value: ComposerWorkerOption) => void;
  composerWorkerOptions: Array<{ value: ComposerWorkerOption; label: string }>;
  selectedWorkerAccountId: string;
  setSelectedWorkerAccountId: (value: string) => void;
  composerAccountOptions: MobileComposerSelectOption[];
  selectedModel: string;
  setSelectedModel: (value: string) => void;
  activeWorkerModelOptions: WorkerModelOption[];
  selectedEffort: string;
  setSelectedEffort: (value: string) => void;
  disabled: boolean;
}

export function getMobileComposerSettingDescriptors({
  shouldLockDirectWorker,
  lockedDirectWorkerLabel,
  selectedCliAgent,
  setSelectedCliAgent,
  composerWorkerOptions,
  selectedWorkerAccountId,
  setSelectedWorkerAccountId,
  composerAccountOptions,
  selectedModel,
  setSelectedModel,
  activeWorkerModelOptions,
  selectedEffort,
  setSelectedEffort,
  disabled,
}: MobileComposerSettingDescriptorArgs): MobileComposerSettingDescriptor[] {
  return [
    shouldLockDirectWorker
      ? {
        key: "cli",
        kind: "locked",
        label: t("conversation.composer.settings.agent"),
        value: lockedDirectWorkerLabel,
      }
      : {
        key: "cli",
        kind: "select",
        label: t("conversation.composer.settings.agent"),
        ariaLabel: t("conversation.composer.settings.agent"),
        value: selectedCliAgent,
        options: composerWorkerOptions,
        disabled,
        onChange: (value) => setSelectedCliAgent(value as ComposerWorkerOption),
      },
    {
      key: "model",
      kind: "model",
      label: t("conversation.composer.settings.model"),
      ariaLabel: t("conversation.composer.workerModelAria"),
      value: selectedModel,
      options: activeWorkerModelOptions,
      disabled,
      onChange: setSelectedModel,
    },
    {
      key: "effort",
      kind: "select",
      label: t("conversation.composer.settings.effort"),
      ariaLabel: t("conversation.composer.settings.effort"),
      value: selectedEffort,
      options: EFFORT_OPTIONS.map((effort) => ({ value: effort, label: effort })),
      disabled,
      onChange: setSelectedEffort,
    },
    {
      key: "account",
      kind: "select",
      label: t("conversation.composer.settings.account"),
      ariaLabel: t("conversation.composer.account.ariaLabel"),
      value: selectedWorkerAccountId,
      options: composerAccountOptions,
      disabled,
      onChange: setSelectedWorkerAccountId,
    },
  ];
}

export interface MobileComposerSettingsProps extends MobileComposerSettingDescriptorArgs {
  selectedRunId: string | null;
  workspaceProjectPath: string | null;
  themeMode: "day" | "night";
  settingsOpen: boolean;
  onSettingsOpenChange: (open: boolean) => void;
}

function renderSettingControl(descriptor: MobileComposerSettingDescriptor, themeMode: "day" | "night") {
  if (descriptor.kind === "locked") {
    return <span className="text-sm text-muted-foreground">{descriptor.value}</span>;
  }

  if (descriptor.kind === "model") {
    return (
      <ComposerModelPicker
        value={descriptor.value}
        options={descriptor.options}
        onChange={descriptor.onChange}
        themeMode={themeMode}
        disabled={descriptor.disabled}
      />
    );
  }

  return (
    <ComposerSelect
      value={descriptor.value}
      options={descriptor.options}
      onChange={descriptor.onChange}
      themeMode={themeMode}
      ariaLabel={descriptor.ariaLabel}
      disabled={descriptor.disabled}
    />
  );
}

function getMobileSettingsSummary({
  shouldLockDirectWorker,
  lockedDirectWorkerLabel,
  selectedCliAgent,
  composerWorkerOptions,
  selectedModel,
  activeWorkerModelOptions,
  selectedEffort,
}: MobileComposerSettingDescriptorArgs) {
  const selectedHarnessLabel = shouldLockDirectWorker
    ? lockedDirectWorkerLabel
    : composerWorkerOptions.find((option) => option.value === selectedCliAgent)?.label ?? selectedCliAgent;
  const selectedModelLabel = activeWorkerModelOptions.find((option) => option.value === selectedModel)?.label ?? selectedModel;
  return `${selectedHarnessLabel} · ${selectedModelLabel} · ${selectedEffort}`;
}

export function MobileComposerSettings({
  selectedRunId,
  workspaceProjectPath,
  themeMode,
  settingsOpen,
  onSettingsOpenChange,
  ...descriptorArgs
}: MobileComposerSettingsProps) {
  useI18nSnapshot();
  const descriptors = getMobileComposerSettingDescriptors(descriptorArgs);
  const settingsSummary = getMobileSettingsSummary(descriptorArgs);

  return (
    <>
      <div
        data-composer-mobile-settings="true"
        className="contents sm:hidden"
      >
        {!selectedRunId ? (
          <div
            data-composer-workspace="true"
            className="pointer-events-none absolute inset-x-0 bottom-full z-30 flex max-w-full items-center justify-start px-3 pb-2 sm:hidden"
          >
            <div className="pointer-events-auto min-w-0 max-w-full rounded-full border border-border/70 bg-background/95 shadow-sm backdrop-blur-sm dark:bg-[#2f2f2f]/95">
              <BranchWorkspaceButton
                projectPath={workspaceProjectPath}
                disabled={descriptorArgs.disabled}
                themeMode={themeMode}
              />
            </div>
          </div>
        ) : null}
        <Button
          type="button"
          data-composer-settings-chip="true"
          data-composer-settings-summary="true"
          variant="ghost"
          onClick={() => onSettingsOpenChange(true)}
          className={cn(
            "flex h-8 min-w-0 max-w-full flex-1 basis-0 items-center gap-1.5 overflow-hidden rounded-[0.85rem] border border-border/70 bg-background/95 px-3 py-1.5 text-[11px] font-medium leading-4 shadow-sm backdrop-blur-sm dark:bg-[#2f2f2f]/95",
            themeMode === "night"
              ? "text-muted-foreground hover:bg-background/45 hover:text-foreground"
              : "text-[#959595] hover:bg-black/[0.04] hover:text-[#666666] dark:text-muted-foreground dark:hover:bg-background/45 dark:hover:text-foreground",
          )}
          aria-label={t("conversation.composer.settings.title")}
          title={settingsSummary}
        >
          <SlidersHorizontal className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-left">{settingsSummary}</span>
        </Button>
      </div>

      <Sheet open={settingsOpen} onOpenChange={onSettingsOpenChange}>
        <SheetContent data-composer-settings-dialog="true" side="bottom" className="px-4 pb-8 pt-0">
          <SheetHeader className="pb-2">
            <SheetTitle>{t("conversation.composer.settings.title")}</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-5">
            {descriptors.map((descriptor) => (
              <div key={descriptor.key} className="flex items-center justify-between">
                <span className="text-sm font-medium">{descriptor.label}</span>
                {renderSettingControl(descriptor, themeMode)}
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
