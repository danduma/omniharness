"use client";

import { Terminal, type AgentTerminalPayload } from "@/components/Terminal";
import { cn } from "@/lib/utils";

export interface AgentSurfaceAgent extends AgentTerminalPayload {
  name: string;
  state: string;
  type?: string;
  lastError?: string | null;
}

export function AgentSurface({
  title,
  subtitle,
  agent,
  className,
}: {
  title: string;
  subtitle?: string | null;
  agent: AgentSurfaceAgent | null;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-border/70 bg-card text-card-foreground shadow-sm dark:border-white/10 dark:bg-[#0d0f12] dark:text-zinc-100 dark:shadow-[0_24px_70px_rgba(0,0,0,0.32)]", className)}>
      <div className="border-b border-border/70 bg-card px-4 py-3 dark:border-white/10 dark:bg-[#13161b]">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-foreground dark:text-zinc-100">{title}</div>
            {subtitle ? (
              <div className="truncate text-xs text-muted-foreground dark:text-zinc-400">{subtitle}</div>
            ) : null}
          </div>
          <div className="rounded-md border border-border/70 bg-muted/40 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
            {agent?.state || "idle"}
          </div>
        </div>
        {agent?.lastError ? (
          <div className="mt-2 break-all rounded-md border border-red-500/25 bg-red-500/10 px-2 py-1 font-mono text-[10px] text-red-700 dark:border-red-400/20 dark:text-red-100">
            {agent.lastError}
          </div>
        ) : null}
      </div>
      <div className="h-full min-h-[20rem] bg-muted/20 p-2 dark:bg-[#050607]">
        <Terminal agent={agent} />
      </div>
    </div>
  );
}
