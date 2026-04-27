"use client";

import { ChevronDown } from "lucide-react";
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
  const selectedLabel = options.find((option) => option.value === value)?.label ?? value;

  return (
    <div
      className={cn(
        "relative inline-flex h-8 max-w-[6.8rem] shrink items-center justify-end gap-0.5 rounded-md pl-1 pr-0.5 text-xs outline-none transition-colors focus-within:ring-2 focus-within:ring-ring/35 sm:h-9 sm:max-w-none sm:gap-1 sm:pl-2 sm:pr-1 sm:text-sm",
        themeMode === "night"
          ? "text-muted-foreground hover:text-foreground"
          : "text-[#8f8f8f] hover:text-[#5e5e5e]",
      )}
    >
      <span className="min-w-0 truncate text-right">{selectedLabel}</span>
      <ChevronDown className={cn(
        "h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4",
        themeMode === "night" ? "text-muted-foreground" : "text-[#9a9a9a]",
      )} />
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(event.target.value as TValue)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  );
}
