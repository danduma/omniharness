"use client";

import React from "react";
import { t, useI18nSnapshot } from "@/lib/i18n";

export type AgentCommand = {
  name: string;
  description?: string | null;
};

export function AgentCommandMenu({
  commands,
  onRun,
  disabled = false,
}: {
  commands: readonly AgentCommand[];
  onRun?: (command: string) => void;
  disabled?: boolean;
}) {
  useI18nSnapshot();
  if (commands.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/20 px-3 py-2">
      <span className="mr-1 text-xs font-medium text-muted-foreground">{t("terminal.protocol.commands")}</span>
      {commands.map((command) => (
        <button
          key={command.name}
          type="button"
          title={command.description ?? command.name}
          disabled={disabled || !onRun}
          className="rounded-md border border-border bg-background px-2 py-1 font-mono text-xs text-foreground hover:bg-muted disabled:opacity-50"
          onClick={() => onRun?.(`/${command.name}`)}
        >
          /{command.name}
        </button>
      ))}
    </div>
  );
}
