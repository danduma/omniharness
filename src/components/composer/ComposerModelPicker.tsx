"use client";

import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import type { WorkerModelOption } from "@/app/home/types";

type ComposerModelPickerProps = {
  value: string;
  options: WorkerModelOption[];
  onChange: (value: string) => void;
  themeMode: "day" | "night";
};

export function ComposerModelPicker({
  value,
  options,
  onChange,
  themeMode,
}: ComposerModelPickerProps) {
  const selectedLabel = options.find((option) => option.value === value)?.label ?? value;
  const hasSelectedOption = options.some((option) => option.value === value);

  return (
    <span className="relative inline-flex min-w-0 max-w-[13rem] shrink items-center">
      <select
        value={value}
        aria-label={t("conversation.composer.workerModelAria")}
        title={selectedLabel}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "h-7 w-full min-w-0 appearance-none truncate rounded-md border-0 bg-transparent py-0 pl-1.5 pr-5 text-right text-xs font-normal shadow-none outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/45 sm:h-8 sm:pl-2 sm:text-sm [field-sizing:content]",
          themeMode === "night"
            ? "text-muted-foreground hover:bg-background/45 hover:text-foreground"
            : "text-[#8f8f8f] hover:bg-black/[0.04] hover:text-[#5e5e5e] dark:text-muted-foreground dark:hover:bg-background/45 dark:hover:text-foreground",
        )}
      >
        {!hasSelectedOption ? (
          <option value={value}>{selectedLabel}</option>
        ) : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-1.5 size-3.5 shrink-0 text-current opacity-60" aria-hidden="true" />
    </span>
  );
}
