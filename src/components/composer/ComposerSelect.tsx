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
  return (
    <div className="relative">
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(event.target.value as TValue)}
        className={cn(
          "h-9 appearance-none border-0 bg-transparent pl-2 pr-5 text-right text-sm outline-none transition-colors",
          themeMode === "night"
            ? "text-muted-foreground hover:text-foreground"
            : "text-[#8f8f8f] hover:text-[#5e5e5e]",
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      <ChevronDown className={cn(
        "pointer-events-none absolute right-1.5 top-1/2 h-4 w-4 -translate-y-1/2",
        themeMode === "night" ? "text-muted-foreground" : "text-[#9a9a9a]",
      )} />
    </div>
  );
}
