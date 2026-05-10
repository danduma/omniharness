"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function Switch({
  checked,
  onCheckedChange,
  className,
  disabled,
  ...props
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={cn(
        "relative h-6 w-10 shrink-0 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
        checked ? "border-primary bg-primary" : "border-border bg-muted",
        className,
      )}
      onClick={() => onCheckedChange(!checked)}
      {...props}
    >
      <span
        className={cn(
          "absolute left-0 top-1/2 size-4 -translate-y-1/2 rounded-full bg-background shadow-sm transition-transform",
          checked ? "translate-x-5" : "translate-x-1",
        )}
      />
    </button>
  );
}
