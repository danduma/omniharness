"use client";

import { cn } from "@/lib/utils";

export type ConversationModeOption = "implementation" | "planning" | "direct";

const MODE_COPY: Record<ConversationModeOption, { label: string; description: string }> = {
  planning: {
    label: "Create plan",
    description: "Work directly with one CLI to inspect the repo, ask questions, and write a spec and plan before implementation.",
  },
  implementation: {
    label: "Implement plan",
    description: "Start a supervisor-managed implementation run for an existing plan or implementation request.",
  },
  direct: {
    label: "Direct control",
    description: "Open one remote CLI session and use OmniHarness as a direct control surface.",
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
    <div className="mb-3 space-y-2">
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
      <p className="text-xs leading-relaxed text-muted-foreground">{MODE_COPY[value].description}</p>
    </div>
  );
}
