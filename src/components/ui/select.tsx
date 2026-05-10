"use client";

import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type SelectOption = {
  value: string;
  label: string;
  description?: string;
};

interface SelectProps {
  id?: string;
  value: string;
  options: readonly SelectOption[];
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  contentClassName?: string;
}

export function Select({
  id,
  value,
  options,
  onValueChange,
  placeholder = "Select",
  disabled = false,
  ariaLabel,
  className,
  contentClassName,
}: SelectProps) {
  const selectedOption = options.find((option) => option.value === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        id={id}
        aria-label={ariaLabel}
        disabled={disabled}
        className={cn(
          "flex h-8 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-border bg-background px-2.5 text-left text-xs text-foreground shadow-sm outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
          className,
        )}
      >
        <span className={cn("truncate", !selectedOption && "text-muted-foreground")}>
          {selectedOption?.label ?? placeholder}
        </span>
        <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={cn("w-[var(--anchor-width)] min-w-44", contentClassName)}>
        {options.map((option) => {
          const selected = option.value === value;

          return (
            <DropdownMenuItem
              key={option.value}
              className="min-h-8 cursor-pointer gap-2 pr-2"
              onClick={() => onValueChange(option.value)}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate">{option.label}</div>
                {option.description ? (
                  <div className="truncate text-[11px] text-muted-foreground">{option.description}</div>
                ) : null}
              </div>
              {selected ? <CheckIcon className="size-3.5 text-foreground" aria-hidden="true" /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
