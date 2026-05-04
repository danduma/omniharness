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
}: {
  value: ConversationModeOption;
  onChange: (mode: ConversationModeOption) => void;
}) {
  return (
    <div className="mb-8 space-y-3">
      <div className="inline-flex rounded-xl border border-border/60 bg-muted/30 p-1">
        {(Object.entries(MODE_COPY) as Array<[ConversationModeOption, { label: string }]>).map(([mode, config]) => (
          <button
            key={mode}
            type="button"
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
              value === mode
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-pressed={value === mode}
            onClick={() => onChange(mode)}
          >
            {config.label}
          </button>
        ))}
      </div>
      <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{MODE_COPY[value].description}</p>
    </div>
  );
}
