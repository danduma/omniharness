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
    <div className={cn("overflow-hidden rounded-2xl border border-white/10 bg-[#0d0f12] text-zinc-100 shadow-[0_24px_70px_rgba(0,0,0,0.32)]", className)}>
      <div className="border-b border-white/10 bg-[#13161b] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-zinc-100">{title}</div>
            {subtitle ? (
              <div className="truncate text-xs text-zinc-400">{subtitle}</div>
            ) : null}
          </div>
          <div className="rounded-md border border-white/10 bg-white/5 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-300">
            {agent?.state || "idle"}
          </div>
        </div>
        {agent?.lastError ? (
          <div className="mt-2 break-all rounded-md border border-red-400/20 bg-red-500/10 px-2 py-1 font-mono text-[10px] text-red-100">
            {agent.lastError}
          </div>
        ) : null}
      </div>
      <div className="h-full min-h-[20rem] bg-[#050607]">
        <Terminal agent={agent} />
      </div>
    </div>
  );
}
