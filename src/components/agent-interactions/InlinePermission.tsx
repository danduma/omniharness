"use client";

import React from "react";
import { ShieldAlert } from "lucide-react";
import { t, useI18nSnapshot } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type PendingInlinePermission = {
  requestId: number;
  requestedAt: string;
  toolCall?: {
    toolCallId?: string | null;
    kind?: string | null;
    title?: string | null;
    status?: string | null;
  } | null;
  options?: Array<{ optionId: string; kind: string; name: string }>;
};

export type PermissionResponseInput = {
  workerId: string;
  requestId: number;
  decision: "approve" | "deny";
  optionId?: string;
};

function isDenyOption(option: { optionId: string; kind: string }) {
  return option.kind.startsWith("reject") || option.optionId.startsWith("reject");
}

export function InlinePermission({
  workerId,
  permission,
  onRespond,
  disabled = false,
  className,
}: {
  workerId: string;
  permission: PendingInlinePermission;
  onRespond?: (input: PermissionResponseInput) => void;
  disabled?: boolean;
  className?: string;
}) {
  useI18nSnapshot();
  const options = permission.options ?? [];
  const detail = [permission.toolCall?.kind, permission.toolCall?.title].filter(Boolean).join(": ");

  return (
    <section
      className={cn(
        "rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-4 shadow-sm dark:border-amber-300/15 dark:bg-amber-300/[0.04]",
        className,
      )}
      aria-label={t("terminal.permission.requested")}
    >
      <div className="flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-200">
        <ShieldAlert className="h-4 w-4" />
        {t("terminal.permission.requested")}
      </div>
      {detail ? <p className="mt-2 break-words font-mono text-sm text-foreground">{detail}</p> : null}
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("terminal.permission.choose")}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {options.length > 0 ? options.map((option) => {
          const deny = isDenyOption(option);
          return (
            <button
              key={option.optionId}
              type="button"
              disabled={disabled || !onRespond}
              className={cn(
                "inline-flex min-h-9 items-center rounded-lg border px-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50",
                deny
                  ? "border-border bg-background text-muted-foreground hover:text-foreground"
                  : "border-amber-600/30 bg-amber-500/15 text-amber-900 hover:bg-amber-500/25 dark:text-amber-100",
              )}
              onClick={() => onRespond?.({
                workerId,
                requestId: permission.requestId,
                decision: deny ? "deny" : "approve",
                optionId: option.optionId,
              })}
            >
              {option.name}
            </button>
          );
        }) : (
          <>
            <button
              type="button"
              disabled={disabled || !onRespond}
              className="inline-flex h-9 items-center rounded-lg border border-border bg-background px-3 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
              onClick={() => onRespond?.({ workerId, requestId: permission.requestId, decision: "deny" })}
            >
              {t("terminal.permission.denyAction")}
            </button>
            <button
              type="button"
              disabled={disabled || !onRespond}
              className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              onClick={() => onRespond?.({ workerId, requestId: permission.requestId, decision: "approve" })}
            >
              {t("terminal.permission.approveAction")}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
