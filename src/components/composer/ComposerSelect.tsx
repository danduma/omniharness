"use client";

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
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onChange(event.target.value as TValue)}
      className={cn(
        "h-8 max-w-[6.8rem] shrink truncate appearance-none border-0 bg-transparent px-1 text-right text-xs outline-none transition-colors sm:h-9 sm:max-w-none sm:px-2 sm:text-sm",
        themeMode === "night"
          ? "text-muted-foreground hover:text-foreground"
          : "text-[#8f8f8f] hover:text-[#5e5e5e]",
      )}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  );
}
