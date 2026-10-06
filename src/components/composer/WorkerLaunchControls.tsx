"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import type { WorkerModelOption } from "@/interface/home/types";
import { ComposerModelPicker } from "./ComposerModelPicker";
import { ComposerSelect, type ComposerSelectOption } from "./ComposerSelect";

type Control<TOption> = {
  value: string;
  options: TOption[];
  onChange: (value: string) => void;
};

export type WorkerLaunchControlsProps = {
  themeMode: "day" | "night";
  worker: Control<ComposerSelectOption>;
  /** Shown instead of the CLI picker when the worker cannot change. */
  lockedWorkerLabel?: string | null;
  /** Hidden while "Auto" is the only choice, as in the composer. */
  account: Control<ComposerSelectOption>;
  model: Control<WorkerModelOption>;
  effort: Control<ComposerSelectOption>;
  disabled?: boolean;
};

/**
 * The CLI · account · model · effort row. The composer and every other place
 * that picks a worker render this so the choice looks and reads the same.
 */
export function WorkerLaunchControls({
  themeMode,
  worker,
  lockedWorkerLabel,
  account,
  model,
  effort,
  disabled = false,
}: WorkerLaunchControlsProps) {
  return (
    <>
      {lockedWorkerLabel ? (
        <div className={cn(
          "w-max shrink-0 whitespace-nowrap rounded-full border px-2 py-1 text-xs font-semibold sm:px-3",
          themeMode === "night"
            ? "border-border/60 bg-background/50 text-muted-foreground"
            : "border-[#d8d8d8] bg-white/90 text-[#6a6a6a] dark:border-border/60 dark:bg-background/50 dark:text-muted-foreground",
        )}>
          {lockedWorkerLabel}
        </div>
      ) : (
        <ComposerSelect
          ariaLabel={t("conversation.composer.settings.agent")}
          value={worker.value}
          options={worker.options}
          onChange={worker.onChange}
          themeMode={themeMode}
          disabled={disabled}
        />
      )}

      {account.options.length > 1 ? (
        <ComposerSelect
          ariaLabel={t("conversation.composer.account.ariaLabel")}
          value={account.value}
          options={account.options}
          onChange={account.onChange}
          themeMode={themeMode}
          disabled={disabled}
        />
      ) : null}

      <ComposerModelPicker
        value={model.value}
        options={model.options}
        onChange={model.onChange}
        themeMode={themeMode}
        disabled={disabled}
      />

      <ComposerSelect
        ariaLabel={t("conversation.composer.settings.effort")}
        value={effort.value}
        options={effort.options}
        onChange={effort.onChange}
        themeMode={themeMode}
        disabled={disabled}
      />
    </>
  );
}
