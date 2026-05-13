"use client";

import { t, useI18nSnapshot } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type ConversationModeOption = "implementation" | "planning" | "direct";

const MODE_COPY_KEYS: Record<ConversationModeOption, { label: string; description: string }> = {
  planning: {
    label: "conversation.mode.planning.label",
    description: "conversation.mode.planning.description",
  },
  implementation: {
    label: "conversation.mode.implementation.label",
    description: "conversation.mode.implementation.description",
  },
  direct: {
    label: "conversation.mode.direct.label",
    description: "conversation.mode.direct.description",
  },
};

const MODE_ORDER: ConversationModeOption[] = ["direct", "planning", "implementation"];

export function getConversationModeCopy(mode: ConversationModeOption) {
  const copy = MODE_COPY_KEYS[mode];

  return {
    label: t(copy.label),
    description: t(copy.description),
  };
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
  useI18nSnapshot();
  const activeCopy = getConversationModeCopy(value);

  return (
    <div className="mb-9 space-y-4">
      <div className="flex w-full justify-center">
        <div className="mx-auto flex w-fit max-w-full rounded-2xl border border-border/70 bg-muted/40 p-1.5 dark:border-white/[0.12] dark:bg-black/[0.12]">
          {MODE_ORDER.map((mode) => {
            const config = getConversationModeCopy(mode);

            return (
              <button
                key={mode}
                type="button"
                className={cn(
                  "min-w-0 shrink rounded-xl border px-3.5 py-2 text-center text-sm font-semibold leading-[1.15] break-words hyphens-auto transition-colors",
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
            );
          })}
        </div>
      </div>
      <p className="mx-auto flex h-[10.5rem] max-w-[68ch] items-start justify-center text-[15px] leading-7 text-muted-foreground/90 sm:h-[5.25rem]">{activeCopy.description}</p>
    </div>
  );
}
