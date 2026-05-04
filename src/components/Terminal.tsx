"use client";

import { useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from "react";
import { ALargeSmall, Check, ChevronDown, LoaderCircle } from "lucide-react";
import { MarkdownContent } from "@/components/MarkdownContent";
import { terminalUiManager } from "@/components/component-state-managers";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { buildAgentOutputActivity, formatActivityStatus, type AgentActivityItem, type AgentOutputEntry } from "@/lib/agent-output";
import { cn } from "@/lib/utils";
import { useManagerSnapshot } from "@/lib/use-manager-snapshot";

interface TerminalProps {
  agent?: AgentTerminalPayload | null;
  userMessages?: TerminalUserMessage[];
  getUserMessageActions?: (message: TerminalUserMessage) => TerminalUserMessageAction[];
  hasMoreHistory?: boolean;
  onRequestMoreHistory?: () => void;
  variant?: "terminal" | "native";
  className?: string;
}

export interface TerminalUserMessage {
  id: string;
  content: string;
  createdAt: string;
}

export interface TerminalUserMessageAction {
  label: string;
  title?: string;
  icon: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}

export interface AgentTerminalPayload {
  outputEntries?: AgentOutputEntry[];
  currentText?: string;
  lastText?: string;
  displayText?: string;
}

type TerminalActivityItem = AgentActivityItem | {
  id: string;
  kind: "user_message";
  text: string;
  timestamp: string;
  actions: TerminalUserMessageAction[];
};

const TOOL_OUTPUT_PREVIEW_LINES = 3;
const TOOL_OUTPUT_COLLAPSED_MAX_HEIGHT = "calc(var(--terminal-pane-size) * 4.65 + 1rem)";
const TOOL_OUTPUT_EXPANDED_MAX_HEIGHT = "min(72vh, 42rem)";
const TERMINAL_REVEAL_CLASS = "grid transition-[grid-template-rows,opacity,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none";
const TERMINAL_REVEAL_OPEN_CLASS = "grid-rows-[1fr] opacity-100 translate-y-0";
const TERMINAL_REVEAL_CLOSED_CLASS = "grid-rows-[0fr] opacity-0 -translate-y-1 pointer-events-none";
const TERMINAL_TOOL_STATUSES = new Set(["completed", "done", "failed", "error", "cancelled"]);
const TERMINAL_BOTTOM_THRESHOLD_PX = 4;
const TERMINAL_BASE_FONT_SIZES = {
  message: 13,
  thought: 12,
  thoughtLabel: 12,
  toolLabel: 12,
  toolTitle: 11,
  pane: 10,
  paneLabel: 9,
  badge: 9,
  permissionTitle: 12,
  permissionText: 11,
};

export const TERMINAL_ZOOM_LEVELS = [
  { value: "tiny", label: "Tiny", notch: -1, scale: 0.82 },
  { value: "default", label: "Default", notch: 0, scale: 1 },
  { value: "large", label: "Large", notch: 1, scale: 1.12 },
  { value: "larger", label: "Larger", notch: 2, scale: 1.24 },
  { value: "largest", label: "Largest", notch: 3, scale: 1.36 },
] as const;

export type TerminalZoomLevel = (typeof TERMINAL_ZOOM_LEVELS)[number]["value"];

function toScaledPx(baseSize: number, scale: number) {
  return `${Math.round(baseSize * scale * 10) / 10}px`;
}

export function getTerminalZoomStyle(level: TerminalZoomLevel): CSSProperties {
  const zoomLevel = TERMINAL_ZOOM_LEVELS.find((candidate) => candidate.value === level) ?? TERMINAL_ZOOM_LEVELS[1];
  const { scale } = zoomLevel;

  return {
    "--terminal-message-size": toScaledPx(TERMINAL_BASE_FONT_SIZES.message, scale),
    "--terminal-thought-size": toScaledPx(TERMINAL_BASE_FONT_SIZES.thought, scale),
    "--terminal-thought-label-size": toScaledPx(TERMINAL_BASE_FONT_SIZES.thoughtLabel, scale),
    "--terminal-tool-label-size": toScaledPx(TERMINAL_BASE_FONT_SIZES.toolLabel, scale),
    "--terminal-tool-title-size": toScaledPx(TERMINAL_BASE_FONT_SIZES.toolTitle, scale),
    "--terminal-pane-size": toScaledPx(TERMINAL_BASE_FONT_SIZES.pane, scale),
    "--terminal-pane-label-size": toScaledPx(TERMINAL_BASE_FONT_SIZES.paneLabel, scale),
    "--terminal-badge-size": toScaledPx(TERMINAL_BASE_FONT_SIZES.badge, scale),
    "--terminal-permission-title-size": toScaledPx(TERMINAL_BASE_FONT_SIZES.permissionTitle, scale),
    "--terminal-permission-text-size": toScaledPx(TERMINAL_BASE_FONT_SIZES.permissionText, scale),
  } as CSSProperties;
}

export function shouldTerminalFollowLatest(
  metrics: Pick<HTMLDivElement, "scrollTop" | "clientHeight" | "scrollHeight">,
) {
  return metrics.scrollHeight - metrics.clientHeight - metrics.scrollTop <= TERMINAL_BOTTOM_THRESHOLD_PX;
}

function shouldTerminalRequestMoreHistory(
  metrics: Pick<HTMLDivElement, "scrollTop">,
) {
  return metrics.scrollTop <= TERMINAL_BOTTOM_THRESHOLD_PX;
}

function activityTimestampMs(timestamp: string) {
  const value = new Date(timestamp).getTime();
  return Number.isFinite(value) ? value : 0;
}

function activityKindOrder(activity: TerminalActivityItem) {
  switch (activity.kind) {
    case "user_message":
      return 0;
    case "thinking":
      return 1;
    case "tool":
      return 2;
    case "permission":
      return 3;
    case "history_gap":
      return 4;
    case "message":
      return 5;
    default:
      return 6;
  }
}

function isTerminalToolStatus(status: string) {
  return TERMINAL_TOOL_STATUSES.has(status);
}

function formatThoughtDuration(durationMs: number | undefined) {
  if (durationMs == null) {
    return null;
  }

  const totalSeconds = Math.round(durationMs / 1000);
  if (totalSeconds < 1) {
    return null;
  }
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

function formatThoughtLabel(activity: Extract<AgentActivityItem, { kind: "thinking" }>) {
  if (activity.inProgress) {
    return "Thinking";
  }

  const duration = formatThoughtDuration(activity.durationMs);
  return duration ? `Thought for ${duration}` : "Thought";
}

function shouldShowToolStatusBadge(status: string) {
  return !["completed", "done", "in_progress", "working"].includes(status);
}

function shouldShowToolSpinner(status: string) {
  return ["in_progress", "working"].includes(status);
}

function isRunningActivityStatus(status: string) {
  return ["pending", "in_progress", "working"].includes(status);
}

function isErrorActivityStatus(status: string) {
  return ["failed", "error", "cancelled"].includes(status);
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
      return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-400/8 dark:text-emerald-100";
    case "failed":
    case "error":
    case "cancelled":
      return "border-red-500/25 bg-red-500/10 text-red-700 dark:border-red-400/25 dark:bg-red-400/8 dark:text-red-100";
    case "in_progress":
    case "working":
      return "border-cyan-600/25 bg-cyan-600/10 text-cyan-700 dark:border-cyan-400/25 dark:bg-cyan-400/8 dark:text-cyan-100";
    default:
      return "border-border bg-muted/40 text-muted-foreground dark:border-white/10 dark:bg-white/5 dark:text-zinc-300";
  }
}

function TimelineMarker({
  running = false,
  tone,
  variant,
}: {
  running?: boolean;
  tone: "thought" | "tool" | "error" | "user";
  variant: "terminal" | "native";
}) {
  const toneClass = {
    thought: variant === "native"
      ? "border-muted-foreground/55 bg-muted-foreground/75"
      : "border-muted-foreground/55 bg-muted-foreground/75 dark:border-zinc-400/60 dark:bg-zinc-400/80",
    tool: variant === "native"
      ? "border-emerald-500/75 bg-emerald-500"
      : "border-emerald-500/75 bg-emerald-500 dark:border-emerald-400/75 dark:bg-emerald-400",
    error: variant === "native"
      ? "border-destructive/80 bg-destructive"
      : "border-red-500/80 bg-red-500 dark:border-red-400/80 dark:bg-red-400",
    user: variant === "native"
      ? "border-primary/75 bg-primary"
      : "border-cyan-600/75 bg-cyan-600 dark:border-cyan-400/75 dark:bg-cyan-400",
  }[tone];
  const runningClass = {
    thought: variant === "native"
      ? "border-muted-foreground/55 bg-transparent"
      : "border-muted-foreground/55 bg-transparent dark:border-zinc-400/60",
    tool: variant === "native"
      ? "border-emerald-500/75 bg-transparent"
      : "border-emerald-500/75 bg-transparent dark:border-emerald-400/75",
    error: variant === "native"
      ? "border-destructive/80 bg-transparent"
      : "border-red-500/80 bg-transparent dark:border-red-400/80",
    user: variant === "native"
      ? "border-primary/75 bg-transparent"
      : "border-cyan-600/75 bg-transparent dark:border-cyan-400/75",
  }[tone];

  return (
    <div className="relative z-10 flex w-4 shrink-0 justify-center">
      <div
        className={cn(
          "mt-[0.32rem] h-2 w-2 rounded-full border",
          running ? runningClass : toneClass,
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
  interactive = true,
  onClick,
}: {
  label: string;
  text: string;
  variant: "terminal" | "native";
  preview?: boolean;
  expanded?: boolean;
  interactive?: boolean;
  onClick?: () => void;
}) {
  const lines = text.split("\n");
  const canExpand = preview && lines.length > TOOL_OUTPUT_PREVIEW_LINES;
  const canInteract = canExpand && interactive;
  const clipped = canExpand && !expanded;
  const previewStyle: CSSProperties | undefined = canExpand
    ? { maxHeight: clipped ? TOOL_OUTPUT_COLLAPSED_MAX_HEIGHT : TOOL_OUTPUT_EXPANDED_MAX_HEIGHT }
    : undefined;

  return (
    <div
      style={previewStyle}
      className={cn(
        "overflow-hidden",
        canInteract && "cursor-pointer",
        canExpand && "transition-[max-height,background-color,border-color,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
        variant === "native"
          ? "rounded border border-border/60 bg-muted/25"
          : "rounded border border-border/70 bg-background shadow-sm dark:border-white/10 dark:bg-[#111318] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]",
      )}
      onClick={canInteract ? onClick : undefined}
      role={canInteract ? "button" : undefined}
      tabIndex={canInteract ? 0 : undefined}
      title={canInteract ? (expanded ? "Click to collapse output preview" : "Click to expand full output") : undefined}
      onKeyDown={canInteract ? (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick?.();
        }
      } : undefined}
    >
      <div className="flex items-stretch">
        <div className={cn(
          "flex w-8 shrink-0 items-start justify-center border-r px-1 py-2 font-mono text-[length:var(--terminal-pane-label-size)] font-semibold uppercase tracking-[0.18em]",
          variant === "native"
            ? "border-border/60 bg-background/40 text-muted-foreground"
            : "border-border/60 bg-muted/40 text-muted-foreground dark:border-white/8 dark:bg-black/20 dark:text-zinc-500",
        )}>
          {label}
        </div>
        <pre className={cn(
          "min-w-0 flex-1 overflow-auto px-2.5 py-2 font-mono whitespace-pre-wrap break-words",
          "text-[length:var(--terminal-pane-size)]",
          variant === "native" ? "leading-[1.5]" : "leading-[1.55]",
          clipped && "line-clamp-[3]",
          variant === "native" ? "text-foreground" : "text-foreground dark:text-zinc-200",
        )}>
          {text}
        </pre>
      </div>
    </div>
  );
}

function ThinkingDots({ variant }: { variant: "terminal" | "native" }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className={cn(
            "h-1 w-1 rounded-full animate-pulse",
            variant === "native" ? "bg-muted-foreground" : "bg-muted-foreground dark:bg-zinc-400",
          )}
          style={{ animationDelay: `${index * 160}ms` }}
        />
      ))}
    </span>
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
  const showToolLabel = activity.label !== "Tool";
  const { toolDetailsOpenById, toolOutputExpandedById } = useManagerSnapshot(terminalUiManager);
  const detailsOpen = toolDetailsOpenById[activity.id] ?? !isDone;
  const outputExpanded = toolOutputExpandedById[activity.id] ?? false;
  const hasToolPanes = Boolean(activity.inputPane || activity.outputPane);

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="group/tool flex w-full flex-wrap items-center gap-1.5 text-left"
        onClick={() => {
          if (detailsOpen) {
            terminalUiManager.setToolOutputExpanded(activity.id, false);
          }
          terminalUiManager.setToolDetailsOpen(activity.id, !detailsOpen);
        }}
        aria-expanded={detailsOpen}
      >
        {showToolLabel ? (
          <span className={cn("text-[length:var(--terminal-tool-label-size)] font-semibold tracking-tight", variant === "native" ? "text-foreground" : "text-foreground dark:text-zinc-100")}>{activity.label}</span>
        ) : null}
        <span
          className={cn(
            "font-mono leading-[1.45]",
            showToolLabel ? "text-[length:var(--terminal-tool-title-size)]" : "text-[length:var(--terminal-tool-label-size)]",
            variant === "native" ? "text-muted-foreground" : "text-muted-foreground dark:text-zinc-300/95",
          )}
        >
          {activity.title}
        </span>
        {shouldShowToolSpinner(activity.status) ? (
          <LoaderCircle
            className={cn(
              "h-3 w-3 shrink-0 animate-spin",
              variant === "native" ? "text-muted-foreground" : "text-muted-foreground dark:text-zinc-400",
            )}
            aria-label={formatActivityStatus(activity.status)}
          />
        ) : null}
        {shouldShowToolStatusBadge(activity.status) ? (
          <span
            className={cn(
              "rounded-full border px-1.5 py-0.5 font-mono text-[length:var(--terminal-badge-size)] font-semibold uppercase tracking-[0.1em]",
              statusBadgeClass(activity.status, variant),
            )}
          >
            {formatActivityStatus(activity.status)}
          </span>
        ) : null}
        <ChevronDown
          className={cn(
            "h-3 w-3 shrink-0 transition-transform duration-200 ease-out",
            detailsOpen && "rotate-180",
            variant === "native" ? "text-muted-foreground group-hover/tool:text-foreground" : "text-muted-foreground group-hover/tool:text-foreground dark:text-zinc-500 dark:group-hover/tool:text-zinc-200",
          )}
          aria-hidden="true"
        />
      </button>
      {hasToolPanes ? (
        <div
          className={cn(
            TERMINAL_REVEAL_CLASS,
            detailsOpen ? TERMINAL_REVEAL_OPEN_CLASS : TERMINAL_REVEAL_CLOSED_CLASS,
          )}
          aria-hidden={!detailsOpen}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="space-y-2 pb-0.5 pt-0.5">
              {activity.inputPane ? <ActivityPane label={activity.inputPane.label} text={activity.inputPane.text} variant={variant} /> : null}
              {activity.outputPane ? (
                <ActivityPane
                  label={activity.outputPane.label}
                  text={activity.outputPane.text}
                  variant={variant}
                  preview
                  expanded={outputExpanded}
                  interactive={detailsOpen}
                  onClick={() => terminalUiManager.setToolOutputExpanded(activity.id, !outputExpanded)}
                />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ThoughtActivity({
  activity,
  variant,
}: {
  activity: Extract<AgentActivityItem, { kind: "thinking" }>;
  variant: "terminal" | "native";
}) {
  const { thoughtOpenById } = useManagerSnapshot(terminalUiManager);
  const open = thoughtOpenById[activity.id] ?? activity.inProgress;

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        className="group/thought flex w-full items-center gap-1.5 text-left"
        onClick={() => terminalUiManager.setThoughtOpen(activity.id, !open)}
        aria-expanded={open}
      >
        <span className={cn("text-[length:var(--terminal-thought-label-size)] font-semibold tracking-tight", variant === "native" ? "text-muted-foreground" : "text-muted-foreground dark:text-zinc-400")}>
          {formatThoughtLabel(activity)}
        </span>
        {activity.inProgress ? <ThinkingDots variant={variant} /> : null}
        <ChevronDown
          className={cn(
            "h-3 w-3 shrink-0 transition-transform duration-200 ease-out",
            open && "rotate-180",
            variant === "native" ? "text-muted-foreground group-hover/thought:text-foreground" : "text-muted-foreground group-hover/thought:text-foreground dark:text-zinc-500 dark:group-hover/thought:text-zinc-300",
          )}
          aria-hidden="true"
        />
      </button>
      <div
        className={cn(
          TERMINAL_REVEAL_CLASS,
          open ? TERMINAL_REVEAL_OPEN_CLASS : TERMINAL_REVEAL_CLOSED_CLASS,
        )}
        aria-hidden={!open}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="space-y-1 pb-0.5 pt-0.5">
            {activity.thoughts.map((thought, index) => (
              <MarkdownContent
                key={`${activity.id}:${index}`}
                content={thought}
                inheritTextColor
                className={cn(
                  "space-y-1 text-[length:var(--terminal-thought-size)] leading-[1.5]",
                  variant === "native"
                    ? "text-muted-foreground [&_code]:bg-muted/70 [&_pre]:bg-muted/35"
                    : "text-muted-foreground [&_blockquote]:border-border/70 [&_blockquote]:bg-muted/30 [&_code]:bg-muted/70 [&_pre]:border-border/70 [&_pre]:bg-muted/30 dark:text-zinc-500 dark:[&_blockquote]:border-white/10 dark:[&_blockquote]:bg-white/5 dark:[&_code]:bg-white/10 dark:[&_pre]:border-white/10 dark:[&_pre]:bg-white/5",
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ActivityRow({
  activity,
  connectorExtendsAfter = false,
  connectorExtendsBefore = false,
  variant,
}: {
  activity: TerminalActivityItem;
  connectorExtendsAfter?: boolean;
  connectorExtendsBefore?: boolean;
  variant: "terminal" | "native";
}) {
  if (activity.kind === "user_message") {
    return (
      <div className="relative z-10 pl-4 sm:pl-6">
        <div className="max-w-[min(72ch,calc(100%-1rem))] rounded-[1.55rem] bg-[#f3f3f3] px-6 py-4 text-[length:var(--terminal-message-size)] leading-[1.55] text-[#202124] dark:bg-[#3a3a3a] dark:text-[#d8d8d8] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:max-w-[min(78ch,calc(100%-1.5rem))]">
          <p className="max-w-none whitespace-pre-wrap">{activity.text}</p>
        </div>
        {activity.actions.length > 0 ? (
          <div className="mt-1 flex items-center gap-1 pl-1 text-muted-foreground/70">
            {activity.actions.map((action) => (
              <button
                key={action.label}
                type="button"
                aria-label={action.label}
                title={action.title ?? action.label}
                disabled={action.disabled}
                onClick={action.onClick}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
              >
                {action.icon}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  const running = activity.kind === "thinking"
    ? activity.inProgress
    : activity.kind === "tool" && isRunningActivityStatus(activity.status);
  const markerTone = activity.kind === "tool"
    ? isErrorActivityStatus(activity.status) ? "error" : "tool"
    : "thought";

  return (
    <div className="relative flex items-start gap-3">
      {connectorExtendsBefore ? (
        <div className={cn(
          "absolute left-2 top-0 h-[0.57rem] w-px",
          variant === "native" ? "bg-border/80" : "bg-border/80 dark:bg-white/14",
        )} />
      ) : null}
      {connectorExtendsAfter ? (
        <div className={cn(
          "absolute -bottom-3 left-2 top-[0.57rem] w-px",
          variant === "native" ? "bg-border/80" : "bg-border/80 dark:bg-white/14",
        )} />
      ) : null}
      <TimelineMarker running={running} tone={markerTone} variant={variant} />
      <div className="min-w-0 flex-1">
        {activity.kind === "message" ? (
          <MarkdownContent
            content={activity.text}
            className={cn(
              "text-[length:var(--terminal-message-size)] leading-[1.55]",
              variant === "native"
                ? "text-foreground"
                : "text-foreground [&_blockquote]:border-border/70 [&_blockquote]:bg-muted/30 [&_blockquote]:text-muted-foreground [&_code]:bg-muted/70 [&_code]:text-inherit [&_h3]:text-inherit [&_h4]:text-inherit [&_pre]:border-border/70 [&_pre]:bg-muted/30 [&_pre]:text-inherit [&_strong]:text-inherit dark:text-zinc-100/95 dark:[&_blockquote]:border-white/10 dark:[&_blockquote]:bg-white/5 dark:[&_blockquote]:text-zinc-300 dark:[&_code]:bg-white/10 dark:[&_pre]:border-white/10 dark:[&_pre]:bg-white/5",
            )}
          />
        ) : null}
        {activity.kind === "history_gap" ? (
          <div
            className={cn(
              "inline-flex max-w-[min(72ch,100%)] flex-col gap-1 rounded-md border border-dashed px-2.5 py-2",
              variant === "native"
                ? "border-border bg-muted/20 text-muted-foreground"
                : "border-border/80 bg-muted/25 text-muted-foreground dark:border-white/12 dark:bg-white/5 dark:text-zinc-400",
            )}
          >
            <div className="font-mono text-[length:var(--terminal-badge-size)] font-semibold uppercase tracking-[0.12em]">
              Live payload summary
            </div>
            <div className="text-[length:var(--terminal-thought-size)] leading-[1.45]">
              {activity.text}
            </div>
          </div>
        ) : null}
        {activity.kind === "thinking" ? <ThoughtActivity activity={activity} variant={variant} /> : null}
        {activity.kind === "tool" ? <ToolActivity activity={activity} variant={variant} /> : null}
        {activity.kind === "permission" ? (
          <div className={cn(
            "rounded-[0.85rem] border px-2.5 py-2",
            variant === "native"
              ? "border-amber-500/25 bg-amber-500/8"
              : "border-amber-500/25 bg-amber-500/10 dark:border-amber-400/20 dark:bg-[rgba(96,67,22,0.34)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]",
          )}>
            <div className={cn("text-[length:var(--terminal-permission-title-size)] font-semibold tracking-tight", variant === "native" ? "text-amber-800 dark:text-amber-300" : "text-amber-800 dark:text-amber-100")}>{activity.title}</div>
            <p className={cn("mt-0.5 whitespace-pre-wrap text-[length:var(--terminal-permission-text-size)] leading-[1.45]", variant === "native" ? "text-amber-900/85 dark:text-amber-100/85" : "text-amber-900/85 dark:text-amber-50/85")}>{activity.text}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function Terminal({
  agent,
  userMessages = [],
  getUserMessageActions,
  hasMoreHistory = false,
  onRequestMoreHistory,
  variant = "terminal",
  className,
}: TerminalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldFollowLatestRef = useRef(true);
  const { terminalZoom } = useManagerSnapshot(terminalUiManager);

  const activity = useMemo(() => {
    const agentActivity = buildAgentOutputActivity({
      outputEntries: agent?.outputEntries,
      currentText: agent?.currentText,
      lastText: agent?.lastText,
      displayText: agent?.displayText,
    });
    const userActivity: TerminalActivityItem[] = userMessages.map((message) => ({
      id: `user:${message.id}`,
      kind: "user_message",
      text: message.content,
      timestamp: message.createdAt,
      actions: getUserMessageActions?.(message) ?? [],
    }));

    return [...userActivity, ...agentActivity].sort((a, b) => {
      const timeDelta = activityTimestampMs(a.timestamp) - activityTimestampMs(b.timestamp);
      if (timeDelta !== 0) {
        return timeDelta;
      }
      return activityKindOrder(a) - activityKindOrder(b) || a.id.localeCompare(b.id);
    });
  }, [agent, getUserMessageActions, userMessages]);
  const terminalZoomStyle = useMemo(() => getTerminalZoomStyle(terminalZoom), [terminalZoom]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !shouldFollowLatestRef.current) {
      return;
    }
    container.scrollTop = container.scrollHeight;
  }, [activity]);

  return (
    <div className={cn(
      "relative w-full",
      variant === "native"
        ? "bg-transparent text-foreground"
        : "h-full overflow-hidden rounded-[1.05rem] border border-border/70 bg-card text-foreground shadow-sm dark:border-transparent dark:bg-[#0b0d10] dark:text-zinc-100 dark:shadow-none",
      className,
    )}
      style={terminalZoomStyle}
    >
      {variant === "terminal" ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            className="absolute right-2 top-2 z-20 inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/70 bg-background/95 text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45 dark:border-white/10 dark:bg-[#15181d]/95 dark:text-zinc-400 dark:hover:bg-[#1d2128] dark:hover:text-zinc-100 dark:focus-visible:ring-cyan-300/45"
            aria-label="Terminal text size"
            title="Terminal text size"
          >
            <ALargeSmall className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-36">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Text size</DropdownMenuLabel>
              {TERMINAL_ZOOM_LEVELS.map((level) => (
                <DropdownMenuItem
                  key={level.value}
                  onClick={() => terminalUiManager.setTerminalZoom(level.value)}
                  className="text-xs"
                >
                  <span className="w-4">
                    {terminalZoom === level.value ? <Check className="h-3.5 w-3.5" /> : null}
                  </span>
                  <span>{level.label}</span>
                  {level.notch > 0 ? <span className="ml-auto text-muted-foreground">+{level.notch}</span> : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      <div
        ref={scrollRef}
        onScroll={(event) => {
          shouldFollowLatestRef.current = shouldTerminalFollowLatest(event.currentTarget);
          if (hasMoreHistory && shouldTerminalRequestMoreHistory(event.currentTarget)) {
            onRequestMoreHistory?.();
          }
        }}
        className={cn(
          variant === "native"
            ? "overflow-visible px-1 py-2"
            : "h-full overflow-y-auto px-3 pb-2.5 pt-9 [scrollbar-color:rgba(113,113,122,0.28)_transparent] [scrollbar-width:thin] dark:[scrollbar-color:rgba(255,255,255,0.16)_transparent]",
        )}
      >
        {activity.length > 0 ? (
          <div className="relative flex flex-col gap-3">
            {activity.map((entry, index) => {
              const previousEntry = activity[index - 1];
              const nextEntry = activity[index + 1];
              const isUserMessage = entry.kind === "user_message";

              return (
                <ActivityRow
                  key={entry.id}
                  activity={entry}
                  connectorExtendsBefore={!isUserMessage && previousEntry?.kind !== "user_message"}
                  connectorExtendsAfter={!isUserMessage && nextEntry?.kind !== "user_message"}
                  variant={variant}
                />
              );
            })}
          </div>
        ) : (
          <div className={cn(
            "flex h-full min-h-full items-center justify-center rounded-xl border border-dashed px-4 text-center text-sm",
            variant === "native"
              ? "border-border bg-muted/20 text-muted-foreground"
              : "border-border/70 bg-muted/25 text-muted-foreground dark:border-white/10 dark:bg-black/10 dark:text-zinc-500",
          )}>
            Waiting for structured agent output...
          </div>
        )}
      </div>
    </div>
  );
}
