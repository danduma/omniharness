"use client";

import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type ComposerSelectOption<TValue extends string = string> = {
  value: TValue;
  label: string;
};

export type ComposerSelectProps<TValue extends string = string> = {
  value: TValue;
  options: Array<ComposerSelectOption<TValue>>;
  onChange: (value: TValue) => void;
  themeMode: "day" | "night";
  ariaLabel: string;
};

export function ComposerSelect<TValue extends string>({
  value,
  options,
  onChange,
  themeMode,
  ariaLabel,
}: ComposerSelectProps<TValue>) {
  return (
    <span className="relative inline-flex min-w-0 max-w-[8.5rem] shrink items-center">
      <select
        value={value}
        aria-label={ariaLabel}
        onChange={(event) => onChange(event.target.value as TValue)}
        className={cn(
          "h-7 w-full min-w-0 appearance-none truncate rounded-md border-0 bg-transparent py-0 pl-1.5 pr-5 text-right text-xs shadow-none outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/45 sm:h-8 sm:pl-2 sm:text-sm",
          themeMode === "night"
            ? "text-muted-foreground hover:text-foreground"
            : "text-[#8f8f8f] hover:text-[#5e5e5e] dark:text-muted-foreground dark:hover:text-foreground",
        )}
      >
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
