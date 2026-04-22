"use client";

import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { normalizeAppError, requestJson } from "@/lib/app-errors";
import { buildAgentOutputActivity, formatActivityStatus, type AgentActivityItem, type AgentOutputEntry } from "@/lib/agent-output";
import { cn } from "@/lib/utils";

interface TerminalProps {
  agentName: string;
}

interface AgentTerminalPayload {
  outputEntries?: AgentOutputEntry[];
  currentText?: string;
  lastText?: string;
}

function statusBadgeClass(status: string) {
  switch (status) {
    case "completed":
    case "done":
      return "border-emerald-400/25 bg-emerald-400/8 text-emerald-100";
    case "failed":
    case "error":
    case "cancelled":
      return "border-red-400/25 bg-red-400/8 text-red-100";
    case "in_progress":
    case "working":
      return "border-cyan-400/25 bg-cyan-400/8 text-cyan-100";
    default:
      return "border-white/10 bg-white/5 text-zinc-300";
  }
}

function TimelineRail({ active = false, muted = false }: { active?: boolean; muted?: boolean }) {
  return (
    <div className="absolute bottom-0 left-0 top-0 flex w-4.5 justify-center">
      <div className={cn("h-full w-px bg-white/8", muted && "bg-white/5")} />
      <div
        className={cn(
          "absolute top-0.5 h-2 w-2 rounded-full border bg-[#101318]",
          muted ? "border-white/15" : "border-teal-400/45",
          active && "border-cyan-300/55 bg-cyan-400/12 shadow-[0_0_0_4px_rgba(56,189,248,0.06)]",
        )}
      />
    </div>
  );
}

function ActivityPane({ label, text }: { label: string; text: string }) {
  return (
    <div className="overflow-hidden rounded-[0.85rem] border border-white/10 bg-[#111318] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
      <div className="flex items-stretch">
        <div className="flex w-8 shrink-0 items-start justify-center border-r border-white/8 bg-black/20 px-1 py-2 font-mono text-[8px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
          {label}
        </div>
        <pre className="min-w-0 flex-1 overflow-x-auto px-2.5 py-2 font-mono text-[9px] leading-[1.55] whitespace-pre-wrap break-words text-zinc-200">
          {text}
        </pre>
      </div>
    </div>
  );
}

function ToolActivity({ activity }: { activity: Extract<AgentActivityItem, { kind: "tool" }> }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-semibold tracking-tight text-zinc-100">{activity.label}</span>
        <span className="font-mono text-[10px] leading-[1.45] text-zinc-300/95">{activity.title}</span>
        <span
          className={cn(
            "rounded-full border px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-[0.12em]",
            statusBadgeClass(activity.status),
          )}
        >
          {formatActivityStatus(activity.status)}
        </span>
      </div>
      {activity.inputPane ? <ActivityPane label={activity.inputPane.label} text={activity.inputPane.text} /> : null}
      {activity.outputPane ? <ActivityPane label={activity.outputPane.label} text={activity.outputPane.text} /> : null}
    </div>
  );
}

function ActivityRow({ activity }: { activity: AgentActivityItem }) {
  const active = activity.kind === "tool" && ["pending", "in_progress", "working"].includes(activity.status);
  const muted = activity.kind === "thought";

  return (
    <div className="relative pl-6">
      <TimelineRail active={active} muted={muted} />
      {activity.kind === "message" ? (
        <p className="max-w-none whitespace-pre-wrap text-[12px] leading-[1.55] text-zinc-100/95">{activity.text}</p>
      ) : null}
      {activity.kind === "thought" ? (
        <p className="max-w-none whitespace-pre-wrap text-[11px] leading-[1.5] italic text-zinc-500">{activity.text}</p>
      ) : null}
      {activity.kind === "tool" ? <ToolActivity activity={activity} /> : null}
      {activity.kind === "permission" ? (
        <div className="rounded-[0.85rem] border border-amber-400/20 bg-[rgba(96,67,22,0.34)] px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
          <div className="text-[11px] font-semibold tracking-tight text-amber-100">{activity.title}</div>
          <p className="mt-0.5 whitespace-pre-wrap text-[10px] leading-[1.45] text-amber-50/85">{activity.text}</p>
        </div>
      ) : null}
    </div>
  );
}

export function Terminal({ agentName }: TerminalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data, error } = useQuery({
    queryKey: ["agent", agentName],
    queryFn: async () => {
      return requestJson<AgentTerminalPayload>(`/api/agents/${agentName}`, undefined, {
        source: "Bridge",
        action: `Load terminal output for ${agentName}`,
      });
    },
    refetchInterval: 2000,
  });

  const activity = useMemo(
    () => buildAgentOutputActivity({
      outputEntries: data?.outputEntries,
      currentText: data?.currentText,
      lastText: data?.lastText,
    }),
    [data],
  );

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }
    container.scrollTop = container.scrollHeight;
  }, [activity]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[1.05rem] bg-[#0b0d10] text-zinc-100">
      <div
        ref={scrollRef}
        className="h-full overflow-y-auto px-3 py-2.5 [scrollbar-color:rgba(255,255,255,0.16)_transparent] [scrollbar-width:thin]"
      >
        {activity.length > 0 ? (
          <div className="space-y-3">
            {activity.map((entry) => (
              <ActivityRow key={entry.id} activity={entry} />
            ))}
          </div>
        ) : (
          <div className="flex h-full min-h-full items-center justify-center rounded-xl border border-dashed border-white/10 bg-black/10 px-4 text-center text-sm text-zinc-500">
            Waiting for structured agent output...
          </div>
        )}
      </div>
      {error ? (
        <div className="absolute inset-x-0 bottom-0 border-t border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive backdrop-blur-sm">
          {normalizeAppError(error).message}
        </div>
      ) : null}
    </div>
  );
}
