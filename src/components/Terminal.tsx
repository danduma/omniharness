"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildAgentOutputActivity, formatActivityStatus, type AgentActivityItem, type AgentOutputEntry } from "@/lib/agent-output";
import { cn } from "@/lib/utils";

interface TerminalProps {
  agent?: AgentTerminalPayload | null;
  variant?: "terminal" | "native";
  className?: string;
}

export interface AgentTerminalPayload {
  outputEntries?: AgentOutputEntry[];
  currentText?: string;
  lastText?: string;
}

const TOOL_OUTPUT_PREVIEW_LINES = 3;
const TERMINAL_TOOL_STATUSES = new Set(["completed", "done", "failed", "error", "cancelled"]);

function isTerminalToolStatus(status: string) {
  return TERMINAL_TOOL_STATUSES.has(status);
}

function statusBadgeClass(status: string, variant: "terminal" | "native") {
  if (variant === "native") {
    switch (status) {
      case "completed":
      case "done":
        return "border-emerald-500/25 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300";
      case "failed":
      case "error":
      case "cancelled":
        return "border-destructive/25 bg-destructive/8 text-destructive";
      case "in_progress":
      case "working":
        return "border-primary/25 bg-primary/8 text-primary";
      default:
        return "border-border bg-muted/40 text-muted-foreground";
    }
  }

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

function TimelineMarker({
  active = false,
  muted = false,
  variant,
}: {
  active?: boolean;
  muted?: boolean;
  variant: "terminal" | "native";
}) {
  return (
    <div className="relative z-10 flex w-4 shrink-0 justify-center">
      <div
        className={cn(
          "mt-[0.32rem] h-2 w-2 rounded-full border",
          variant === "native"
            ? muted ? "border-border bg-background" : "border-primary/40 bg-background"
            : muted ? "border-white/15 bg-[#101318]" : "border-teal-400/45 bg-[#101318]",
          active && (variant === "native"
            ? "border-primary bg-primary/10 shadow-[0_0_0_4px_hsl(var(--primary)/0.08)]"
            : "border-cyan-300/55 bg-cyan-400/12 shadow-[0_0_0_4px_rgba(56,189,248,0.06)]"),
        )}
      />
    </div>
  );
}

function ActivityPane({
  label,
  text,
  variant,
  preview = false,
  expanded = true,
  onClick,
}: {
  label: string;
  text: string;
  variant: "terminal" | "native";
  preview?: boolean;
  expanded?: boolean;
  onClick?: () => void;
}) {
  const lines = text.split("\n");
  const canExpand = preview && lines.length > TOOL_OUTPUT_PREVIEW_LINES;
  const clipped = canExpand && !expanded;

  return (
    <div
      className={cn(
        "overflow-hidden",
        canExpand && "cursor-pointer",
        variant === "native"
          ? "rounded-lg border border-border/60 bg-muted/25"
          : "rounded-[0.85rem] border border-white/10 bg-[#111318] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]",
      )}
      onClick={canExpand ? onClick : undefined}
      role={canExpand ? "button" : undefined}
      tabIndex={canExpand ? 0 : undefined}
      title={canExpand ? (expanded ? "Click to collapse output preview" : "Click to expand full output") : undefined}
      onKeyDown={canExpand ? (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick?.();
        }
      } : undefined}
    >
      <div className="flex items-stretch">
        <div className={cn(
          "flex w-8 shrink-0 items-start justify-center border-r px-1 py-2 font-mono text-[8px] font-semibold uppercase tracking-[0.22em]",
          variant === "native"
            ? "border-border/60 bg-background/40 text-muted-foreground"
            : "border-white/8 bg-black/20 text-zinc-500",
        )}>
          {label}
        </div>
        <pre className={cn(
          "min-w-0 flex-1 overflow-x-auto px-2.5 py-2 font-mono whitespace-pre-wrap break-words",
          variant === "native" ? "text-sm leading-6" : "text-[9px] leading-[1.55]",
          clipped && "line-clamp-[3]",
          variant === "native" ? "text-foreground" : "text-zinc-200",
        )}>
          {text}
        </pre>
      </div>
    </div>
  );
}

function ToolActivity({
  activity,
  variant,
}: {
  activity: Extract<AgentActivityItem, { kind: "tool" }>;
  variant: "terminal" | "native";
}) {
  const isDone = isTerminalToolStatus(activity.status);
  const [detailsOpen, setDetailsOpen] = useState(!isDone);
  const [outputExpanded, setOutputExpanded] = useState(false);

  useEffect(() => {
    if (isTerminalToolStatus(activity.status)) {
      setDetailsOpen(false);
      setOutputExpanded(false);
    }
  }, [activity.status]);

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="flex w-full flex-wrap items-center gap-1.5 text-left"
        onClick={() => setDetailsOpen((open) => {
          if (open) {
            setOutputExpanded(false);
          }
          return !open;
        })}
        aria-expanded={detailsOpen}
      >
        <span className={cn("text-[11px] font-semibold tracking-tight", variant === "native" ? "text-foreground" : "text-zinc-100")}>{activity.label}</span>
        <span className={cn("font-mono text-[10px] leading-[1.45]", variant === "native" ? "text-muted-foreground" : "text-zinc-300/95")}>{activity.title}</span>
        <span
          className={cn(
            "rounded-full border px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-[0.12em]",
            statusBadgeClass(activity.status, variant),
          )}
        >
          {formatActivityStatus(activity.status)}
        </span>
      </button>
      {detailsOpen && activity.inputPane ? <ActivityPane label={activity.inputPane.label} text={activity.inputPane.text} variant={variant} /> : null}
      {detailsOpen && activity.outputPane ? (
        <ActivityPane
          label={activity.outputPane.label}
          text={activity.outputPane.text}
          variant={variant}
          preview
          expanded={outputExpanded}
          onClick={() => setOutputExpanded((open) => !open)}
        />
      ) : null}
    </div>
  );
}

function ActivityRow({ activity, variant }: { activity: AgentActivityItem; variant: "terminal" | "native" }) {
  const active = activity.kind === "tool" && ["pending", "in_progress", "working"].includes(activity.status);
  const muted = activity.kind === "thought";

  return (
    <div className="relative flex items-start gap-3">
      <TimelineMarker active={active} muted={muted} variant={variant} />
      <div className="min-w-0 flex-1">
        {activity.kind === "message" ? (
          <p className={cn("max-w-none whitespace-pre-wrap text-[12px] leading-[1.55]", variant === "native" ? "text-foreground" : "text-zinc-100/95")}>{activity.text}</p>
        ) : null}
        {activity.kind === "thought" ? (
          <p className={cn("max-w-none whitespace-pre-wrap text-[11px] leading-[1.5] italic", variant === "native" ? "text-muted-foreground" : "text-zinc-500")}>{activity.text}</p>
        ) : null}
        {activity.kind === "tool" ? <ToolActivity activity={activity} variant={variant} /> : null}
        {activity.kind === "permission" ? (
          <div className={cn(
            "rounded-[0.85rem] border px-2.5 py-2",
            variant === "native"
              ? "border-amber-500/25 bg-amber-500/8"
              : "border-amber-400/20 bg-[rgba(96,67,22,0.34)] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]",
          )}>
            <div className={cn("text-[11px] font-semibold tracking-tight", variant === "native" ? "text-amber-800 dark:text-amber-300" : "text-amber-100")}>{activity.title}</div>
            <p className={cn("mt-0.5 whitespace-pre-wrap text-[10px] leading-[1.45]", variant === "native" ? "text-amber-900/85 dark:text-amber-100/85" : "text-amber-50/85")}>{activity.text}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function Terminal({ agent, variant = "terminal", className }: TerminalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const activity = useMemo(
    () => buildAgentOutputActivity({
      outputEntries: agent?.outputEntries,
      currentText: agent?.currentText,
      lastText: agent?.lastText,
    }),
    [agent],
  );

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }
    container.scrollTop = container.scrollHeight;
  }, [activity]);

  return (
    <div className={cn(
      "relative w-full",
      variant === "native"
        ? "bg-transparent text-foreground"
        : "h-full overflow-hidden rounded-[1.05rem] bg-[#0b0d10] text-zinc-100",
      className,
    )}>
      <div
        ref={scrollRef}
        className={cn(
          variant === "native"
            ? "overflow-visible px-1 py-2"
            : "h-full overflow-y-auto px-3 py-2.5 [scrollbar-color:rgba(255,255,255,0.16)_transparent] [scrollbar-width:thin]",
        )}
      >
        {activity.length > 0 ? (
          <div className="relative flex flex-col gap-3">
            <div className={cn(
              "absolute left-2 top-0 h-full w-px",
              variant === "native" ? "bg-border/70" : "bg-white/8",
            )} />
            {activity.map((entry) => (
              <ActivityRow key={entry.id} activity={entry} variant={variant} />
            ))}
          </div>
        ) : (
          <div className={cn(
            "flex h-full min-h-full items-center justify-center rounded-xl border border-dashed px-4 text-center text-sm",
            variant === "native"
              ? "border-border bg-muted/20 text-muted-foreground"
              : "border-white/10 bg-black/10 text-zinc-500",
          )}>
            Waiting for structured agent output...
          </div>
        )}
      </div>
    </div>
  );
}
