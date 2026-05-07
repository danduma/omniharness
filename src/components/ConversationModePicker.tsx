"use client";

import { cn } from "@/lib/utils";

export type ConversationModeOption = "implementation" | "planning" | "direct";

const MODE_COPY: Record<ConversationModeOption, { label: string; description: string }> = {
  planning: {
    label: "Create plan",
    description: "Use planning mode directly in the selected CLI. Once the plan is done, omni will take over, confirm it under your intent, and keep the agents working non stop until it is fully implemented.",
  },
  implementation: {
    label: "Implement plan",
    description: "Fully implement an existing plan or spec. Omni will confirm details, coordinate the work and monitor progress until every single bit of the plan is fully implemented.",
  },
  direct: {
    label: "Direct control",
    description: "Use this to directly interact with the selected CLI, with full remote control capabilities.",
  },
};

export function getConversationModeCopy(mode: ConversationModeOption) {
  return MODE_COPY[mode];
}

export function ConversationModePicker({
  value,
  onChange,
  disabled = false,
}: {
  value: ConversationModeOption;
  onChange: (mode: ConversationModeOption) => void;
  disabled?: boolean;
}) {
  return (
    <div className="mb-9 space-y-4">
      <div className="inline-flex rounded-2xl border border-border/70 bg-muted/40 p-1.5 dark:border-white/[0.12] dark:bg-black/[0.12]">
        {(Object.entries(MODE_COPY) as Array<[ConversationModeOption, { label: string }]>).map(([mode, config]) => (
          <button
            key={mode}
            type="button"
            className={cn(
              "rounded-xl border px-3.5 py-2 text-sm font-semibold transition-colors",
              value === mode
                ? "border-primary/[0.22] bg-primary/[0.055] text-primary"
                : "border-transparent text-muted-foreground hover:bg-background/40 hover:text-foreground",
              disabled && "cursor-not-allowed opacity-60 hover:bg-transparent hover:text-muted-foreground",
            )}
            aria-pressed={value === mode}
            disabled={disabled}
            onClick={() => {
              if (disabled) {
                return;
              }

              onChange(mode);
            }}
          >
            {config.label}
          </button>
        ))}
      </div>
      <p className="mx-auto flex h-[10.5rem] max-w-[68ch] items-start justify-center text-[15px] leading-7 text-muted-foreground/90 sm:h-[5.25rem]">{MODE_COPY[value].description}</p>
    </div>
  );
}
