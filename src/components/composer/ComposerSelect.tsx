"use client";

import { Select } from "@/components/ui/select";
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
    <Select
      ariaLabel={ariaLabel}
      value={value}
      options={options}
      onValueChange={(nextValue) => onChange(nextValue as TValue)}
      className={cn(
        "h-7 w-max min-w-0 max-w-[8.5rem] shrink border-0 bg-transparent px-1.5 text-xs shadow-none sm:h-8 sm:px-2 sm:text-sm [&>span]:text-right",
        themeMode === "night"
          ? "text-muted-foreground hover:text-foreground"
          : "text-[#8f8f8f] hover:text-[#5e5e5e]",
      )}
      contentClassName="min-w-40"
    />
  );
}
