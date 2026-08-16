"use client";

import { t, useI18nSnapshot } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type ConversationModeOption = "omni" | "direct";

const DIRECT_MODE_COPY_KEYS = {
  label: "conversation.mode.direct.label",
  description: "conversation.mode.direct.description",
};

const MODE_ORDER: ConversationModeOption[] = ["direct"];

function getConversationModeCopy() {
  return {
    label: t(DIRECT_MODE_COPY_KEYS.label),
    description: t(DIRECT_MODE_COPY_KEYS.description),
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
  const selectedMode = MODE_ORDER.includes(value) ? value : "direct";
  const activeCopy = getConversationModeCopy();

  return (
    <div className="mb-9 space-y-4">
      <div className="flex w-full justify-center">
        <div className="mx-auto flex w-fit max-w-full rounded-2xl border border-border/70 bg-muted/40 p-1.5 dark:border-white/[0.12] dark:bg-black/[0.12]">
          {MODE_ORDER.map((mode) => {
            const config = getConversationModeCopy();

            return (
              <button
                key={mode}
                type="button"
                className={cn(
                  "min-w-0 shrink rounded-xl border px-3.5 py-2 text-center text-sm font-semibold leading-[1.15] break-words hyphens-auto transition-colors",
                  selectedMode === mode
                    ? "border-primary/[0.22] bg-primary/[0.055] text-primary"
                    : "border-transparent text-muted-foreground hover:bg-background/40 hover:text-foreground",
                  disabled && "cursor-not-allowed opacity-60 hover:bg-transparent hover:text-muted-foreground",
                )}
                aria-pressed={selectedMode === mode}
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
