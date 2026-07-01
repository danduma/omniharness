"use client";

import Image from "next/image";
import { useLayoutEffect, useMemo, useRef, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { ALargeSmall, Check, ChevronDown, Copy, LoaderCircle } from "lucide-react";
import { MarkdownContent } from "@/components/MarkdownContent";
import { attachmentImagePreviewManager, conversationCopyNoticeManager, terminalUiManager } from "@/components/component-state-managers";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  appearancePreferencesManager,
  getConversationTerminalTextSizeStyle,
  getTerminalTextSizeStyle,
  TERMINAL_TEXT_SIZE_LEVELS,
  type TerminalTextSizeLevel,
} from "@/app/home/AppearancePreferencesManager";
import { buildAgentOutputActivity, formatActivityStatus, type AgentActivityItem, type AgentOutputEntry, type AgentToolGroupCounts } from "@/lib/agent-output";
import type { WorkerEntry } from "@/server/workers/entries-types";
import { formatBytes, type ChatAttachment } from "@/lib/chat-attachments";
import { parseProjectFileReference, type ProjectFileReference } from "@/lib/project-file-links";
import { cn } from "@/lib/utils";
import { useManagerSnapshot } from "@/lib/use-manager-snapshot";
import { t, useI18nSnapshot } from "@/lib/i18n";

interface TerminalProps {
  agent?: AgentTerminalPayload | null;
  userMessages?: TerminalUserMessage[];
  /**
   * Unified worker conversation stream entries. When provided, the
   * Terminal renders directly from these and ignores `agent` /
   * `userMessages`. Phase 4 of the unified stream rollout flips
   * ConversationMain to pass this prop. See
   * docs/architecture/worker-conversation-stream.md.
   */
  entries?: WorkerEntry[];
  allowUserMessageFallback?: boolean;
  getUserMessageActions?: (message: TerminalUserMessage) => TerminalUserMessageAction[];
  editingUserMessageId?: string | null;
  editingUserMessageValue?: string;
  isEditingUserMessageSaving?: boolean;
  onEditingUserMessageValueChange?: (value: string) => void;
  onCancelEditingUserMessage?: () => void;
  onSaveEditedUserMessage?: (messageId: string) => void;
  hasMoreHistory?: boolean;
  onRequestMoreHistory?: () => void;
  variant?: "terminal" | "native";
  textSizeScope?: "terminal" | "conversation";
  conversationMessageTextSize?: boolean;
  className?: string;
  showTextSizeControl?: boolean;
  showPendingAssistantIndicator?: boolean;
  pendingAssistantStatus?: TerminalPendingAssistantStatus;
  activityFilter?: (activity: TerminalActivityItem) => boolean;
  thoughtsDefaultOpen?: boolean;
  toolGroupsDefaultOpen?: boolean;
  emptyState?: ReactNode;
  isLoading?: boolean;
  projectRoot?: string | null;
  onOpenProjectFile?: (file: ProjectFileReference) => void;
  scrollAnchorKey?: string | null;
  summarizeWorkBlocks?: boolean;
}

export interface TerminalUserMessage {
  id: string;
  content: string;
  createdAt: string;
  attachments?: ChatAttachment[];
}

export interface TerminalUserMessageAction {
  label: string;
  title?: string;
  icon: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  menuItems?: TerminalUserMessageActionItem[];
  feedback?: "copy-message";
}

export interface TerminalUserMessageActionItem {
  label: string;
  title?: string;
  icon: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}

export interface AgentTerminalPayload {
  outputEntries?: AgentOutputEntry[];
  state?: string | null;
  currentText?: string;
  lastText?: string;
  displayText?: string;
}

export type TerminalActivityItem = AgentActivityItem | {
  id: string;
  kind: "user_message";
  messageId: string;
  text: string;
  timestamp: string;
  attachments: ChatAttachment[];
  actions: TerminalUserMessageAction[];
} | {
  id: string;
  kind: "pending_assistant";
  status: TerminalPendingAssistantStatus;
  timestamp: string;
};
type TerminalActivityItemWithOrder = TerminalActivityItem & { streamSeq?: number };
export type TerminalActivityKind = TerminalActivityItem["kind"];
export type TerminalPendingAssistantStatus = "connecting" | "thinking" | "working";

const TOOL_OUTPUT_PREVIEW_LINES = 3;
const TOOL_OUTPUT_COLLAPSED_MAX_HEIGHT = "calc(var(--terminal-pane-size) * 4.65 + 1rem)";
const TOOL_OUTPUT_EXPANDED_MAX_HEIGHT = "min(72vh, 42rem)";
const TERMINAL_REVEAL_CLASS = "grid transition-[grid-template-rows,opacity,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none";
const TERMINAL_REVEAL_OPEN_CLASS = "grid-rows-[1fr] opacity-100 translate-y-0";
const TERMINAL_REVEAL_CLOSED_CLASS = "grid-rows-[0fr] opacity-0 -translate-y-1 pointer-events-none";
const TERMINAL_TOOL_STATUSES = new Set(["completed", "done", "failed", "error", "cancelled"]);
const TERMINAL_BOTTOM_THRESHOLD_PX = 1;
const TERMINAL_TOP_THRESHOLD_PX = 4;
export { TERMINAL_TEXT_SIZE_LEVELS };
export type TerminalZoomLevel = TerminalTextSizeLevel;
export const getTerminalZoomStyle = getTerminalTextSizeStyle;

export function shouldTerminalFollowLatest(
  metrics: Pick<HTMLDivElement, "scrollTop" | "clientHeight" | "scrollHeight">,
) {
  return metrics.scrollHeight - metrics.clientHeight - metrics.scrollTop <= TERMINAL_BOTTOM_THRESHOLD_PX;
}

export function shouldTerminalKeepFollowingLatest(
  metrics: Pick<HTMLDivElement, "scrollTop" | "clientHeight" | "scrollHeight">,
  previousScrollTop: number,
) {
  if (metrics.scrollTop < previousScrollTop) {
    return false;
  }

  return shouldTerminalFollowLatest(metrics);
}

export function getTerminalActivityVersion(activity: TerminalActivityItem[]) {
  return activity.map((item) => {
    switch (item.kind) {
      case "pending_assistant":
        return `${item.id}:${item.kind}:${item.status}`;
      case "thinking":
        return `${item.id}:${item.kind}:${item.timestamp}:${item.inProgress}:${item.thoughts.join("\n").length}`;
      case "tool":
        return `${item.id}:${item.kind}:${item.timestamp}:${item.status}:${item.title.length}:${item.inputPane?.text.length ?? 0}:${item.outputPane?.text.length ?? 0}`;
      case "tool_group":
        return `${item.id}:${item.kind}:${item.timestamp}:${item.status}:${item.tools.length}:${item.tools.map((tool) => `${tool.id}:${tool.status}:${tool.title.length}:${tool.inputPane?.text.length ?? 0}:${tool.outputPane?.text.length ?? 0}`).join(",")}`;
      case "permission":
        return `${item.id}:${item.kind}:${item.timestamp}:${item.status}:${item.title.length}:${item.text.length}:${item.detail?.length ?? 0}`;
      case "message":
      case "user_message":
        return `${item.id}:${item.kind}:${item.timestamp}:${item.text.length}`;
      case "work_summary":
        return `${item.id}:${item.kind}:${item.durationMs}:${item.inProgress}:${item.items.length}`;
    }
  }).join("|");
}

export function shouldTerminalConnectorExtend(
  activityKind: TerminalActivityKind,
  adjacentActivityKind: TerminalActivityKind | undefined,
) {
  return activityKind !== "user_message"
    && adjacentActivityKind !== undefined
    && adjacentActivityKind !== "user_message";
}

export function TerminalTextSizeControl({ className }: { className?: string }) {
  const { terminalTextSize } = useManagerSnapshot(appearancePreferencesManager);
  useI18nSnapshot();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/70 bg-background/95 text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45 dark:border-white/10 dark:bg-[#15181d]/95 dark:text-zinc-400 dark:hover:bg-[#1d2128] dark:hover:text-zinc-100 dark:focus-visible:ring-cyan-300/45",
          className,
        )}
        aria-label={t("settings.appearance.terminalFontSize")}
        title={t("settings.appearance.terminalFontSize")}
      >
        <ALargeSmall className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("settings.appearance.terminalFontSize")}</DropdownMenuLabel>
          {TERMINAL_TEXT_SIZE_LEVELS.map((level) => (
            <DropdownMenuItem
              key={level.value}
              onClick={() => appearancePreferencesManager.setTerminalTextSize(level.value)}
              className="text-xs"
            >
              <span className="w-4">
                {terminalTextSize === level.value ? <Check className="h-3.5 w-3.5" /> : null}
              </span>
              <span>{t(level.labelKey)}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function shouldTerminalRequestMoreHistory(
  metrics: Pick<HTMLDivElement, "scrollTop">,
) {
  return metrics.scrollTop <= TERMINAL_TOP_THRESHOLD_PX;
}

function getTerminalScrollElement(container: HTMLDivElement, variant: "terminal" | "native") {
  if (variant === "terminal") {
    return container;
  }

  return (container.closest('[data-slot="scroll-area-viewport"], [data-radix-scroll-area-viewport]') as HTMLDivElement | null) ?? container;
}

function scrollTerminalToBottom(container: HTMLDivElement, behavior: ScrollBehavior = "smooth") {
  if (container.scrollHeight <= container.clientHeight) {
    return false;
  }
  container.scrollTo({
    top: container.scrollHeight,
    behavior,
  });
  return true;
}

export function shouldTerminalScrollToLatest({
  variant,
  isFirstRenderedActivity,
  latestActivityKind,
}: {
  variant: "terminal" | "native";
  isFirstRenderedActivity: boolean;
  latestActivityKind: TerminalActivityKind | undefined;
}) {
  if (variant !== "native") {
    return true;
  }

  if (latestActivityKind === "pending_assistant") {
    return false;
  }

  return !(isFirstRenderedActivity && latestActivityKind === "user_message");
}

function activityTimestampMs(timestamp: string) {
  const value = new Date(timestamp).getTime();
  return Number.isFinite(value) ? value : 0;
}

function inferFallbackUserMessageSeq(createdAt: string, entries: WorkerEntry[]) {
  const messageTime = activityTimestampMs(createdAt);
  if (entries.length === 0) {
    return undefined;
  }

  const orderedEntries = entries
    .filter((entry) => typeof entry.seq === "number")
    .sort((left, right) => left.seq - right.seq);
  const nextEntry = orderedEntries.find((entry) => activityTimestampMs(entry.timestamp) >= messageTime);
  if (nextEntry) {
    return nextEntry.seq - 0.001;
  }

  const latestSeq = orderedEntries.at(-1)?.seq;
  return typeof latestSeq === "number" ? latestSeq + 0.001 : undefined;
}

function normalizeUserMessageText(text: string | null | undefined) {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

function timestampDistanceMs(left: string | null | undefined, right: string | null | undefined) {
  const leftTime = left ? new Date(left).getTime() : Number.NaN;
  const rightTime = right ? new Date(right).getTime() : Number.NaN;
  if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.abs(leftTime - rightTime);
}

function workerEntryMatchesUserMessage(entry: WorkerEntry, message: TerminalUserMessage) {
  if (entry.type !== "user_input") {
    return false;
  }
  if (entry.id === message.id) {
    return true;
  }
  return normalizeUserMessageText(entry.text) === normalizeUserMessageText(message.content)
    && timestampDistanceMs(entry.timestamp, message.createdAt) <= 5_000;
}

function activityKindOrder(activity: TerminalActivityItem) {
  switch (activity.kind) {
    case "user_message":
      return 0;
    case "pending_assistant":
      return 1;
    case "thinking":
    case "work_summary":
      return 2;
    case "tool":
    case "tool_group":
      return 3;
    case "permission":
      return 4;
    case "message":
      return 5;
    default:
      return 6;
  }
}

function activityStreamSeq(
  activity: TerminalActivityItemWithOrder,
  seqByActivityId: Map<string, number>,
): number | null {
  if (typeof activity.streamSeq === "number") {
    return activity.streamSeq;
  }
  if (activity.kind === "tool_group") {
    const seqs = activity.tools
      .map((tool) => seqByActivityId.get(tool.id))
      .filter((seq): seq is number => typeof seq === "number");
    return seqs.length > 0 ? Math.min(...seqs) : null;
  }
  if (activity.id.startsWith("message-fragment-run:")) {
    const parts = activity.id.split(":");
    const firstId = parts[1];
    if (firstId) {
      return seqByActivityId.get(firstId) ?? null;
    }
  }
  return seqByActivityId.get(activity.id) ?? null;
}

function shouldRenderUnifiedStreamEntry(entry: WorkerEntry) {
  return entry.type !== "lifecycle";
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

function formatWorkDuration(durationMs: number): string {
  const totalSeconds = Math.max(1, Math.round(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
  if (minutes > 0) parts.push(`${minutes} ${minutes === 1 ? "minute" : "minutes"}`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds} ${seconds === 1 ? "second" : "seconds"}`);
  return parts.join(" ");
}

function countBlockToolCalls(block: TerminalActivityItemWithOrder[]): number {
  let count = 0;
  for (const item of block) {
    if (item.kind === "tool") count += 1;
    else if (item.kind === "tool_group") count += item.counts.total;
  }
  return count;
}

function summarizeWorkIntervals(items: TerminalActivityItemWithOrder[]): TerminalActivityItemWithOrder[] {
  const result: TerminalActivityItemWithOrder[] = [];
  let workBlock: TerminalActivityItemWithOrder[] = [];

  const flushWorkBlock = (nextItem: TerminalActivityItemWithOrder | null) => {
    if (workBlock.length === 0) {
      return;
    }
    const followedByMessage = nextItem?.kind === "message";
    const toolCallCount = countBlockToolCalls(workBlock);
    const shouldSummarize = followedByMessage && toolCallCount > 1;

    if (!shouldSummarize) {
      result.push(...workBlock);
      workBlock = [];
      return;
    }

    const firstItem = workBlock[0]!;
    const lastItem = workBlock[workBlock.length - 1]!;
    const firstTs = Date.parse(firstItem.timestamp);
    const endTs = nextItem ? Date.parse(nextItem.timestamp) : null;
    const lastTs = Date.parse(lastItem.timestamp);
    const durationMs = Number.isFinite(firstTs) && endTs != null && Number.isFinite(endTs)
      ? Math.max(0, endTs - firstTs)
      : (Number.isFinite(firstTs) && Number.isFinite(lastTs) ? Math.max(0, lastTs - firstTs) : 0);
    const inProgress = workBlock.some((item) => {
      if (item.kind === "thinking") return item.inProgress;
      if (item.kind === "tool" || item.kind === "tool_group") return isRunningActivityStatus(item.status);
      return false;
    });
    result.push({
      id: `work-summary:${firstItem.id}`,
      kind: "work_summary",
      durationMs,
      timestamp: firstItem.timestamp,
      inProgress,
      items: workBlock as AgentActivityItem[],
      streamSeq: firstItem.streamSeq,
    });
    workBlock = [];
  };

  for (const item of items) {
    if (item.kind === "thinking" || item.kind === "tool" || item.kind === "tool_group" || item.kind === "permission") {
      workBlock.push(item);
    } else {
      flushWorkBlock(item);
      result.push(item);
    }
  }
  flushWorkBlock(null);
  return result;
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

function formatCountSegment(count: number, singleKey: string, pluralKey: string) {
  if (count <= 0) {
    return null;
  }
  return t(count === 1 ? singleKey : pluralKey, { count });
}

function capitalizeFirstCharacter(value: string) {
  if (!value) {
    return value;
  }
  return value.charAt(0).toLocaleUpperCase() + value.slice(1);
}

function formatToolGroupSummary(counts: AgentToolGroupCounts) {
  const segments = [
    formatCountSegment(counts.editedFiles, "conversation.toolGroup.editedFile", "conversation.toolGroup.editedFiles"),
    formatCountSegment(counts.readFiles, "conversation.toolGroup.readFile", "conversation.toolGroup.readFiles"),
    formatCountSegment(counts.searches, "conversation.toolGroup.searchedTime", "conversation.toolGroup.searchedTimes"),
    formatCountSegment(counts.commands, "conversation.toolGroup.ranCommand", "conversation.toolGroup.ranCommands"),
    formatCountSegment(counts.agents, "conversation.toolGroup.usedAgent", "conversation.toolGroup.usedAgents"),
    formatCountSegment(counts.tools, "conversation.toolGroup.usedTool", "conversation.toolGroup.usedTools"),
  ].filter((segment): segment is string => Boolean(segment));

  const summary = segments.length > 0
    ? segments.join(t("conversation.toolGroup.summarySeparator"))
    : t(counts.total === 1 ? "conversation.toolGroup.usedTool" : "conversation.toolGroup.usedTools", { count: counts.total });

  return capitalizeFirstCharacter(summary);
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
  tone: "thought" | "tool" | "error" | "user" | "permission";
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
    permission: variant === "native"
      ? "border-amber-500/75 bg-amber-500"
      : "border-amber-500/75 bg-amber-500 dark:border-amber-300/75 dark:bg-amber-300",
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
    permission: variant === "native"
      ? "border-amber-500/75 bg-transparent"
      : "border-amber-500/75 bg-transparent dark:border-amber-300/75",
  }[tone];

  return (
    <div className="relative z-10 flex w-4 shrink-0 justify-center">
      <div
        className={cn(
          "mt-[0.43rem] h-2 w-2 rounded-full border",
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
  projectRoot,
  onOpenProjectFile,
  preview = false,
  expanded = true,
  interactive = true,
  onClick,
}: {
  label: string;
  text: string;
  variant: "terminal" | "native";
  projectRoot?: string | null;
  onOpenProjectFile?: (file: ProjectFileReference) => void;
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
          <ProjectFileReferenceText
            text={text}
            projectRoot={projectRoot}
            onOpenProjectFile={onOpenProjectFile}
          />
        </pre>
      </div>
    </div>
  );
}

type DiffDisplayRow = {
  id: string;
  kind: "context" | "add" | "remove" | "separator";
  visible: string;
  lineNumber: number | null;
};

type ParsedDiffPane = {
  fileName: string | null;
  added: number;
  removed: number;
  rows: DiffDisplayRow[];
};

function basenameDiffPath(value: string): string {
  const trimmed = value.trim().replace(/^["']|["']$/g, "");
  const cleaned = trimmed.replace(/^(?:a|b)\//, "");
  const segments = cleaned.split(/[/\\]/).filter(Boolean);
  return segments[segments.length - 1] || cleaned || trimmed;
}

function extractDiffFileName(line: string): string | null {
  if (line.startsWith("diff --")) {
    const parts = line.trim().split(/\s+/);
    return basenameDiffPath(parts[parts.length - 1] ?? "");
  }

  if (line.startsWith("*** Update File:") || line.startsWith("*** Add File:") || line.startsWith("*** Delete File:")) {
    return basenameDiffPath(line.slice(line.indexOf(":") + 1));
  }

  if (line.startsWith("+++ ") && !line.startsWith("+++ /dev/null")) {
    return basenameDiffPath(line.slice(4));
  }

  if (line.startsWith("--- ") && !line.startsWith("--- /dev/null")) {
    return basenameDiffPath(line.slice(4));
  }

  return null;
}

function parseHunkStart(line: string): { oldLine: number; newLine: number } | null {
  const match = line.match(/^@@\s+-(\d+)(?:,\d+)?\s+\+(\d+)(?:,\d+)?/);
  if (!match) {
    return null;
  }

  return {
    oldLine: Number(match[1]),
    newLine: Number(match[2]),
  };
}

function isDiffMetadataLine(line: string): boolean {
  return line.startsWith("diff --")
    || line.startsWith("+++")
    || line.startsWith("---")
    || line.startsWith("***")
    || line.startsWith("index ")
    || line.startsWith("\\ No newline");
}

function parseDiffPane(text: string): ParsedDiffPane {
  const rows: DiffDisplayRow[] = [];
  let fileName: string | null = null;
  let oldLine: number | null = null;
  let newLine: number | null = null;
  let added = 0;
  let removed = 0;
  let pendingSeparator = false;

  const addSeparator = (id: string) => {
    if (rows.length > 0 && rows[rows.length - 1]?.kind !== "separator") {
      rows.push({ id, kind: "separator", visible: "", lineNumber: null });
    }
  };

  text.split("\n").forEach((line, index) => {
    fileName = fileName || extractDiffFileName(line);

    if (/^\[\d+ unchanged lines omitted\]$/.test(line.trim())) {
      addSeparator(`${index}:omitted`);
      return;
    }

    const hunkStart = parseHunkStart(line);
    if (hunkStart) {
      oldLine = hunkStart.oldLine;
      newLine = hunkStart.newLine;
      pendingSeparator = rows.length > 0;
      return;
    }

    if (isDiffMetadataLine(line)) {
      return;
    }

    if (pendingSeparator) {
      addSeparator(`${index}:hunk`);
      pendingSeparator = false;
    }

    if (line.startsWith("+")) {
      rows.push({
        id: `${index}:add:${line}`,
        kind: "add",
        visible: line.slice(1),
        lineNumber: newLine,
      });
      added += 1;
      newLine = newLine == null ? null : newLine + 1;
      return;
    }

    if (line.startsWith("-")) {
      rows.push({
        id: `${index}:remove:${line}`,
        kind: "remove",
        visible: line.slice(1),
        lineNumber: oldLine,
      });
      removed += 1;
      oldLine = oldLine == null ? null : oldLine + 1;
      return;
    }

    const visible = line.startsWith(" ") ? line.slice(1) : line;
    rows.push({
      id: `${index}:context:${line}`,
      kind: "context",
      visible,
      lineNumber: newLine ?? oldLine,
    });
    oldLine = oldLine == null ? null : oldLine + 1;
    newLine = newLine == null ? null : newLine + 1;
  });

  return { fileName, added, removed, rows };
}

function diffRowClass(kind: DiffDisplayRow["kind"], variant: "terminal" | "native") {
  if (kind === "add") {
    return variant === "native"
      ? "bg-emerald-500/13 text-emerald-900 dark:text-emerald-200"
      : "bg-emerald-500/14 text-emerald-900 dark:bg-emerald-400/12 dark:text-emerald-100";
  }
  if (kind === "remove") {
    return variant === "native"
      ? "bg-red-500/13 text-red-900 dark:text-red-200"
      : "bg-red-500/14 text-red-900 dark:bg-red-400/12 dark:text-red-100";
  }
  if (kind === "separator") {
    return variant === "native"
      ? "bg-muted/45 text-muted-foreground"
      : "bg-muted/35 text-muted-foreground dark:bg-white/7 dark:text-zinc-500";
  }
  return variant === "native" ? "text-foreground" : "text-foreground dark:text-zinc-200";
}

function diffLineNumberClass(kind: DiffDisplayRow["kind"], variant: "terminal" | "native") {
  if (kind === "add") {
    return variant === "native"
      ? "text-emerald-700 dark:text-emerald-300"
      : "text-emerald-700 dark:text-emerald-300";
  }
  if (kind === "remove") {
    return variant === "native"
      ? "text-red-700 dark:text-red-300"
      : "text-red-700 dark:text-red-300";
  }
  return variant === "native"
    ? "text-muted-foreground"
    : "text-muted-foreground dark:text-zinc-500";
}

function diffChangeRailClass(kind: DiffDisplayRow["kind"], variant: "terminal" | "native") {
  if (kind === "add") {
    return variant === "native" ? "bg-emerald-500" : "bg-emerald-400";
  }
  if (kind === "remove") {
    return variant === "native" ? "bg-red-500" : "bg-red-400";
  }
  return "bg-transparent";
}

function DiffPane({
  text,
  variant,
  preview = false,
  expanded = true,
  interactive = true,
  onClick,
}: {
  text: string;
  variant: "terminal" | "native";
  preview?: boolean;
  expanded?: boolean;
  interactive?: boolean;
  onClick?: () => void;
}) {
  const diff = useMemo(() => parseDiffPane(text), [text]);
  const canExpand = preview && diff.rows.length > TOOL_OUTPUT_PREVIEW_LINES;
  const canInteract = canExpand && interactive;
  const clipped = canExpand && !expanded;
  const previewStyle: CSSProperties | undefined = canExpand
    ? { maxHeight: clipped ? TOOL_OUTPUT_COLLAPSED_MAX_HEIGHT : TOOL_OUTPUT_EXPANDED_MAX_HEIGHT }
    : undefined;
  const copyDiff = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    void navigator.clipboard?.writeText(text);
  };

  return (
    <div
      style={previewStyle}
      className={cn(
        "overflow-hidden rounded-lg border",
        canInteract && "cursor-pointer",
        canExpand && "transition-[max-height,background-color,border-color,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
        variant === "native"
          ? "border-border/70 bg-muted/20 shadow-sm"
          : "border-border/70 bg-background shadow-sm dark:border-white/10 dark:bg-[#111318] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]",
      )}
      onClick={canInteract ? onClick : undefined}
      role={canInteract ? "button" : undefined}
      tabIndex={canInteract ? 0 : undefined}
      title={canInteract ? (expanded ? "Click to collapse diff preview" : "Click to expand full diff") : undefined}
      onKeyDown={canInteract ? (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick?.();
        }
      } : undefined}
    >
      <div className={cn(
        "flex min-h-8 items-center gap-1.5 border-b px-2.5 py-1",
        variant === "native"
          ? "border-border/70 bg-muted/25"
          : "border-border/70 bg-muted/20 dark:border-white/10 dark:bg-white/5",
      )}>
        <div className="min-w-0 flex-1">
          <div className={cn(
            "truncate font-mono text-[length:var(--terminal-pane-size)] font-medium",
            variant === "native" ? "text-foreground/75" : "text-foreground/75 dark:text-zinc-300",
          )}>
            {diff.fileName ?? t("terminal.diff.unknownFile")}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 font-mono text-[length:var(--terminal-pane-size)] font-semibold">
          <span className={variant === "native" ? "text-emerald-700 dark:text-emerald-300" : "text-emerald-600 dark:text-emerald-300"}>
            +{diff.added}
          </span>
          <span className={variant === "native" ? "text-red-700 dark:text-red-300" : "text-red-600 dark:text-red-300"}>
            -{diff.removed}
          </span>
        </div>
        <button
          type="button"
          className={cn(
            "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45",
            variant === "native"
              ? "text-muted-foreground hover:bg-muted hover:text-foreground"
              : "text-muted-foreground hover:bg-white/8 hover:text-foreground dark:text-zinc-500 dark:hover:text-zinc-200",
          )}
          aria-label={t("terminal.diff.copyAria")}
          title={t("terminal.diff.copyAria")}
          onClick={copyDiff}
        >
          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
      <div className="overflow-auto">
        <div className={cn(
          "min-w-max py-1 font-mono font-medium text-[length:var(--terminal-pane-size)]",
          variant === "native" ? "leading-[1.55]" : "leading-[1.6]",
        )}>
          {diff.rows.map((line) => (
            line.kind === "separator" ? (
              <div
                key={line.id}
                className={cn("h-2 border-y", variant === "native" ? "border-border/45 bg-muted/30" : "border-border/45 bg-muted/25 dark:border-white/8 dark:bg-white/5")}
                aria-hidden="true"
              />
            ) : (
              <div
                key={line.id}
                className={cn("grid grid-cols-[4px_5.5rem_minmax(0,1fr)]", diffRowClass(line.kind, variant))}
              >
                <span className={cn("block", diffChangeRailClass(line.kind, variant))} aria-hidden="true" />
                <span className={cn("select-none border-r px-3 text-right tabular-nums", variant === "native" ? "border-border/50" : "border-border/50 dark:border-white/8", diffLineNumberClass(line.kind, variant))}>
                  {line.lineNumber ?? ""}
                </span>
                <span className="whitespace-pre px-4">
                  {line.visible.length > 0 ? line.visible : " "}
                </span>
              </div>
            )
          ))}
        </div>
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

const PENDING_ASSISTANT_LABEL_KEYS: Record<TerminalPendingAssistantStatus, string> = {
  connecting: "terminal.pending.connecting",
  thinking: "terminal.pending.thinking",
  working: "terminal.pending.working",
};

function PendingAssistantActivity({ status }: { status: TerminalPendingAssistantStatus }) {
  const text = t(PENDING_ASSISTANT_LABEL_KEYS[status]);
  return (
    <div
      className="inline-flex items-baseline text-[calc(var(--terminal-message-size)+1px)] font-medium leading-5 text-muted-foreground/55"
      aria-label={text}
    >
      {Array.from(text).map((character, index) => (
        <span
          key={index}
          className="inline-block animate-pulse text-foreground/80"
          style={{
            animationDelay: `${index * 90}ms`,
            animationDuration: "1.15s",
          }}
        >
          {character}
        </span>
      ))}
    </div>
  );
}

function terminalAttachmentUrl(attachment: ChatAttachment) {
  return attachment.previewUrl
    || (attachment.storagePath
      ? `/api/attachments?path=${encodeURIComponent(attachment.storagePath)}&mimeType=${encodeURIComponent(attachment.mimeType)}`
      : "");
}

function UserMessageAttachments({ attachments }: { attachments: ChatAttachment[] }) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {attachments.map((attachment) => {
        const url = terminalAttachmentUrl(attachment);
        return attachment.kind === "image" && url ? (
          <button
            type="button"
            key={attachment.id}
            onClick={() => attachmentImagePreviewManager.open({ url, name: attachment.name, size: attachment.size })}
            className="group/attachment inline-flex max-w-full items-center gap-2 overflow-hidden rounded-xl border border-border/60 bg-[#e9e9e9] p-1.5 pr-3 text-xs dark:border-white/10 dark:bg-black/15"
            title={`Preview ${attachment.name}`}
            aria-label={`Preview ${attachment.name}`}
          >
            <Image
              src={url}
              alt={attachment.name}
              width={72}
              height={72}
              unoptimized
              className="h-[72px] w-[72px] rounded-lg object-cover transition-transform group-hover/attachment:scale-105"
            />
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{attachment.name}</span>
              <span className="opacity-60">{formatBytes(attachment.size)}</span>
            </span>
          </button>
        ) : (
          <div
            key={attachment.id}
            className="inline-flex max-w-full items-center gap-2 rounded-full border border-border/60 bg-[#e9e9e9] px-3 py-1.5 text-xs dark:border-white/10 dark:bg-black/15"
          >
            <span className="truncate">{attachment.name}</span>
            <span className="shrink-0 opacity-60">{formatBytes(attachment.size)}</span>
          </div>
        );
      })}
    </div>
  );
}

function UserMessageEditForm({
  messageId,
  value,
  isSaving,
  conversationMessageTextSize,
  onValueChange,
  onCancel,
  onSave,
}: {
  messageId: string;
  value: string;
  isSaving: boolean;
  conversationMessageTextSize: boolean;
  onValueChange: (value: string) => void;
  onCancel: () => void;
  onSave: (messageId: string) => void;
}) {
  useI18nSnapshot();

  return (
    <div className="w-full max-w-[min(72ch,calc(100%-1rem))] rounded-xl border border-primary/30 bg-background p-3 shadow-sm sm:max-w-[min(78ch,calc(100%-1.5rem))]">
      <textarea
        value={value}
        aria-label={t("conversation.messageEdit.ariaLabel")}
        onChange={(event) => onValueChange(event.target.value)}
        className={cn(
          "min-h-28 w-full resize-y rounded-lg border border-border bg-background p-3 outline-none focus:ring-1 focus:ring-primary/40",
          conversationMessageTextSize
            ? "text-sm leading-6"
            : "text-[length:var(--terminal-message-size)] leading-[1.55]",
        )}
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{t("conversation.messageEdit.notice")}</p>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button type="button" size="sm" disabled={isSaving || !value.trim()} onClick={() => onSave(messageId)}>
            {t("conversation.messageEdit.saveAndRerun")}
          </Button>
        </div>
      </div>
    </div>
  );
}

const PROJECT_FILE_REFERENCE_TOKEN_PATTERN = /(https?:\/\/[^\s<>()]+|\/[A-Za-z0-9._~/%+-][^\s<>()]*:\d+(?::\d+)?)/g;

function ProjectFileReferenceText({
  text,
  projectRoot,
  onOpenProjectFile,
}: {
  text: string;
  projectRoot?: string | null;
  onOpenProjectFile?: (file: ProjectFileReference) => void;
}) {
  if (!projectRoot || !onOpenProjectFile) {
    return text;
  }

  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  PROJECT_FILE_REFERENCE_TOKEN_PATTERN.lastIndex = 0;
  while ((match = PROJECT_FILE_REFERENCE_TOKEN_PATTERN.exec(text))) {
    const token = match[0];
    const reference = parseProjectFileReference(token, projectRoot);
    if (!reference) {
      continue;
    }

    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    nodes.push(
      <button
        key={`${match.index}:${token}`}
        type="button"
        className="inline font-mono text-inherit underline decoration-current/35 underline-offset-4 hover:decoration-current"
        onClick={(event) => {
          event.stopPropagation();
          onOpenProjectFile(reference);
        }}
      >
        {token}
      </button>,
    );
    lastIndex = match.index + token.length;
  }

  if (nodes.length === 0) {
    return text;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function ToolActivity({
  activity,
  variant,
  projectRoot,
  onOpenProjectFile,
}: {
  activity: Extract<AgentActivityItem, { kind: "tool" }>;
  variant: "terminal" | "native";
  projectRoot?: string | null;
  onOpenProjectFile?: (file: ProjectFileReference) => void;
}) {
  const isDone = isTerminalToolStatus(activity.status);
  const showToolLabel = activity.label !== "Tool";
  const { toolDetailsOpenById, toolOutputExpandedById } = useManagerSnapshot(terminalUiManager);
  const detailsOpen = toolDetailsOpenById[activity.id] ?? !isDone;
  const outputIsDiff = activity.outputPane?.kind === "diff";
  const outputExpanded = toolOutputExpandedById[activity.id] ?? outputIsDiff;
  const hasToolPanes = Boolean(activity.inputPane || activity.outputPane);

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        className="group/tool flex w-full flex-wrap items-center gap-1.5 text-left"
        onClick={() => {
          const nextDetailsOpen = !detailsOpen;
          if (nextDetailsOpen && outputIsDiff) {
            terminalUiManager.setToolOutputExpanded(activity.id, true);
          } else if (detailsOpen) {
            terminalUiManager.setToolOutputExpanded(activity.id, false);
          }
          terminalUiManager.setToolDetailsOpen(activity.id, nextDetailsOpen);
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
            <div className="space-y-1.5 pb-0.5 pt-0.5">
              {activity.inputPane ? (
                <ActivityPane
                  label={activity.inputPane.label}
                  text={activity.inputPane.text}
                  variant={variant}
                  projectRoot={projectRoot}
                  onOpenProjectFile={onOpenProjectFile}
                />
              ) : null}
              {activity.outputPane?.kind === "diff" ? (
                <DiffPane
                  text={activity.outputPane.text}
                  variant={variant}
                  preview
                  expanded={outputExpanded}
                  interactive={detailsOpen}
                  onClick={() => terminalUiManager.setToolOutputExpanded(activity.id, !outputExpanded)}
                />
              ) : activity.outputPane ? (
                <ActivityPane
                  label={activity.outputPane.label}
                  text={activity.outputPane.text}
                  variant={variant}
                  projectRoot={projectRoot}
                  onOpenProjectFile={onOpenProjectFile}
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

function NestedToolActivityRow({
  tool,
  isFirst,
  isLast,
  variant,
  projectRoot,
  onOpenProjectFile,
}: {
  tool: Extract<AgentActivityItem, { kind: "tool" }>;
  isFirst: boolean;
  isLast: boolean;
  variant: "terminal" | "native";
  projectRoot?: string | null;
  onOpenProjectFile?: (file: ProjectFileReference) => void;
}) {
  const running = isRunningActivityStatus(tool.status);
  const markerTone = isErrorActivityStatus(tool.status) ? "error" : "tool";

  return (
    <div className="relative flex items-start gap-2.5">
      {!isFirst ? (
        <div className={cn(
          "absolute left-1.5 top-0 h-[0.61rem] w-px",
          variant === "native" ? "bg-border/70" : "bg-border/70 dark:bg-white/12",
        )} />
      ) : null}
      {!isLast ? (
        <div className={cn(
          "absolute -bottom-2 left-1.5 top-[0.61rem] w-px",
          variant === "native" ? "bg-border/70" : "bg-border/70 dark:bg-white/12",
        )} />
      ) : null}
      <div className="relative z-10 flex w-3 shrink-0 justify-center">
        <div
          className={cn(
            "mt-[0.42rem] h-1.5 w-1.5 rounded-full border",
            running
              ? markerTone === "error"
                ? variant === "native" ? "border-destructive/80 bg-transparent" : "border-red-500/80 bg-transparent dark:border-red-400/80"
                : variant === "native" ? "border-emerald-500/75 bg-transparent" : "border-emerald-500/75 bg-transparent dark:border-emerald-400/75"
              : markerTone === "error"
                ? variant === "native" ? "border-destructive/80 bg-destructive" : "border-red-500/80 bg-red-500 dark:border-red-400/80 dark:bg-red-400"
                : variant === "native" ? "border-emerald-500/75 bg-emerald-500" : "border-emerald-500/75 bg-emerald-500 dark:border-emerald-400/75 dark:bg-emerald-400",
          )}
        />
      </div>
      <div className="min-w-0 flex-1 pb-0.5">
        <ToolActivity
          activity={tool}
          variant={variant}
          projectRoot={projectRoot}
          onOpenProjectFile={onOpenProjectFile}
        />
      </div>
    </div>
  );
}

function ToolGroupActivity({
  activity,
  variant,
  toolGroupsDefaultOpen,
  projectRoot,
  onOpenProjectFile,
}: {
  activity: Extract<AgentActivityItem, { kind: "tool_group" }>;
  variant: "terminal" | "native";
  toolGroupsDefaultOpen: boolean;
  projectRoot?: string | null;
  onOpenProjectFile?: (file: ProjectFileReference) => void;
}) {
  useI18nSnapshot();
  const { toolGroupOpenById } = useManagerSnapshot(terminalUiManager);
  const open = toolGroupOpenById[activity.id] ?? toolGroupsDefaultOpen;
  const summary = formatToolGroupSummary(activity.counts);

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        className="group/tool-group flex w-full flex-wrap items-center gap-1.5 text-left"
        onClick={() => terminalUiManager.setToolGroupOpen(activity.id, !open)}
        aria-expanded={open}
        aria-label={t("conversation.toolGroup.toggleAriaLabel", { summary })}
        title={open ? t("conversation.toolGroup.collapseTitle") : t("conversation.toolGroup.expandTitle")}
      >
        <span
          className={cn(
            "font-mono font-semibold leading-[1.45] text-[length:var(--terminal-tool-title-size)]",
            variant === "native" ? "text-foreground" : "text-foreground dark:text-zinc-100",
          )}
        >
          {summary}
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
        <ChevronDown
          className={cn(
            "h-3 w-3 shrink-0 transition-transform duration-200 ease-out",
            open && "rotate-180",
            variant === "native" ? "text-muted-foreground group-hover/tool-group:text-foreground" : "text-muted-foreground group-hover/tool-group:text-foreground dark:text-zinc-500 dark:group-hover/tool-group:text-zinc-200",
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
          <div className="space-y-2 pb-0.5 pt-0.5">
            {activity.tools.map((tool, index) => (
              <NestedToolActivityRow
                key={tool.id}
                tool={tool}
                isFirst={index === 0}
                isLast={index === activity.tools.length - 1}
                variant={variant}
                projectRoot={projectRoot}
                onOpenProjectFile={onOpenProjectFile}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ThoughtActivity({
  activity,
  variant,
  thoughtsDefaultOpen,
  projectRoot,
  onOpenProjectFile,
}: {
  activity: Extract<AgentActivityItem, { kind: "thinking" }>;
  variant: "terminal" | "native";
  thoughtsDefaultOpen: boolean;
  projectRoot?: string | null;
  onOpenProjectFile?: (file: ProjectFileReference) => void;
}) {
  const { thoughtOpenById } = useManagerSnapshot(terminalUiManager);
  const open = (thoughtOpenById[activity.id] ?? thoughtsDefaultOpen) || activity.inProgress;

  return (
    <div className="space-y-1">
      <button
        type="button"
        className="group/thought flex w-full items-center gap-1.5 text-left"
        onClick={() => terminalUiManager.setThoughtOpen(activity.id, !open)}
        aria-expanded={open}
      >
        <span className={cn("shrink-0 text-[length:var(--terminal-thought-label-size)] font-semibold tracking-tight", variant === "native" ? "text-muted-foreground" : "text-muted-foreground dark:text-zinc-400")}>
          {formatThoughtLabel(activity)}
        </span>
        {activity.thoughts.length > 0 && (
          <span className="truncate text-[length:var(--terminal-thought-size)] font-normal text-muted-foreground/60 dark:text-zinc-500/60">
            {activity.thoughts.join(" ").replace(/\s+/g, " ").trim()}
          </span>
        )}
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
                projectRoot={projectRoot}
                onOpenProjectFile={onOpenProjectFile}
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

function WorkSummaryNestedItem({
  item,
  isFirst,
  isLast,
  variant,
  thoughtsDefaultOpen,
  toolGroupsDefaultOpen,
  projectRoot,
  onOpenProjectFile,
}: {
  item: Extract<AgentActivityItem, { kind: "thinking" | "tool" | "tool_group" | "permission" }>;
  isFirst: boolean;
  isLast: boolean;
  variant: "terminal" | "native";
  thoughtsDefaultOpen: boolean;
  toolGroupsDefaultOpen: boolean;
  projectRoot?: string | null;
  onOpenProjectFile?: (file: ProjectFileReference) => void;
}) {
  const running = item.kind === "thinking"
    ? item.inProgress
    : item.kind === "permission"
      ? item.status === "pending"
      : isRunningActivityStatus(item.status);
  const isError = (item.kind === "tool" || item.kind === "tool_group") && isErrorActivityStatus(item.status);
  const markerTone = item.kind === "thinking" ? "thought" : item.kind === "permission" ? "permission" : isError ? "error" : "tool";
  const markerColorClass = {
    thought: variant === "native"
      ? (running ? "border-muted-foreground/55 bg-transparent" : "border-muted-foreground/55 bg-muted-foreground/75")
      : (running ? "border-muted-foreground/55 bg-transparent dark:border-zinc-400/60" : "border-muted-foreground/55 bg-muted-foreground/75 dark:border-zinc-400/60 dark:bg-zinc-400/80"),
    tool: variant === "native"
      ? (running ? "border-emerald-500/75 bg-transparent" : "border-emerald-500/75 bg-emerald-500")
      : (running ? "border-emerald-500/75 bg-transparent dark:border-emerald-400/75" : "border-emerald-500/75 bg-emerald-500 dark:border-emerald-400/75 dark:bg-emerald-400"),
    error: variant === "native"
      ? "border-destructive/80 bg-destructive"
      : "border-red-500/80 bg-red-500 dark:border-red-400/80 dark:bg-red-400",
    permission: variant === "native"
      ? (running ? "border-amber-500/75 bg-transparent" : "border-amber-500/75 bg-amber-500")
      : (running ? "border-amber-500/75 bg-transparent dark:border-amber-400/75" : "border-amber-500/75 bg-amber-500 dark:border-amber-400/75 dark:bg-amber-400"),
  }[markerTone];

  return (
    <div className="relative flex items-start gap-2.5">
      {!isFirst ? (
        <div className={cn(
          "absolute left-1.5 top-0 h-[0.61rem] w-px",
          variant === "native" ? "bg-border/70" : "bg-border/70 dark:bg-white/12",
        )} />
      ) : null}
      {!isLast ? (
        <div className={cn(
          "absolute -bottom-2 left-1.5 top-[0.61rem] w-px",
          variant === "native" ? "bg-border/70" : "bg-border/70 dark:bg-white/12",
        )} />
      ) : null}
      <div className="relative z-10 flex w-3 shrink-0 justify-center">
        <div className={cn("mt-[0.42rem] h-1.5 w-1.5 rounded-full border", markerColorClass)} />
      </div>
      <div className="min-w-0 flex-1 pb-0.5">
        {item.kind === "thinking" ? (
          <ThoughtActivity
            activity={item}
            variant={variant}
            thoughtsDefaultOpen={thoughtsDefaultOpen}
            projectRoot={projectRoot}
            onOpenProjectFile={onOpenProjectFile}
          />
        ) : null}
        {item.kind === "tool" ? (
          <ToolActivity
            activity={item}
            variant={variant}
            projectRoot={projectRoot}
            onOpenProjectFile={onOpenProjectFile}
          />
        ) : null}
        {item.kind === "tool_group" ? (
          <ToolGroupActivity
            activity={item}
            variant={variant}
            toolGroupsDefaultOpen={toolGroupsDefaultOpen}
            projectRoot={projectRoot}
            onOpenProjectFile={onOpenProjectFile}
          />
        ) : null}
        {item.kind === "permission" ? (
          item.status === "pending" ? (
            <div className={cn(
              "rounded border px-2 py-1.5",
              variant === "native"
                ? "border-amber-500/35 bg-amber-500/10"
                : "border-amber-500/25 bg-amber-500/10 dark:border-amber-400/20 dark:bg-[rgba(96,67,22,0.34)]",
            )}>
              <div className={cn("text-[length:var(--terminal-permission-title-size)] font-semibold tracking-tight", variant === "native" ? "text-amber-800 dark:text-amber-300" : "text-amber-800 dark:text-amber-100")}>{item.title}</div>
              {item.detail ? (
                <p className={cn("mt-0.5 break-words font-mono text-[length:var(--terminal-permission-text-size)] leading-[1.45]", variant === "native" ? "text-amber-900/85 dark:text-amber-100/85" : "text-amber-900/85 dark:text-amber-50/85")}>{item.detail}</p>
              ) : null}
              {item.text ? (
                <p className={cn("mt-0.5 whitespace-pre-wrap text-[length:var(--terminal-permission-text-size)] leading-[1.45]", variant === "native" ? "text-amber-900/75 dark:text-amber-100/75" : "text-amber-900/75 dark:text-amber-50/75")}>{item.text}</p>
              ) : null}
            </div>
          ) : (
            <div className="py-0.5">
              <div className={cn("text-[length:var(--terminal-permission-title-size)] font-medium", variant === "native" ? "text-foreground/80 dark:text-zinc-300" : "text-foreground/80 dark:text-zinc-300")}>{item.title}</div>
              {item.detail ? (
                <p className={cn("mt-0.5 break-words font-mono text-[length:var(--terminal-permission-text-size)] leading-[1.45]", variant === "native" ? "text-muted-foreground" : "text-muted-foreground dark:text-zinc-500")}>{item.detail}</p>
              ) : null}
              {item.text ? (
                <p className={cn("mt-0.5 whitespace-pre-wrap text-[length:var(--terminal-permission-text-size)] leading-[1.45]", variant === "native" ? "text-muted-foreground" : "text-muted-foreground dark:text-zinc-500")}>{item.text}</p>
              ) : null}
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}

function WorkSummaryActivity({
  activity,
  variant,
  thoughtsDefaultOpen,
  toolGroupsDefaultOpen,
  projectRoot,
  onOpenProjectFile,
}: {
  activity: Extract<AgentActivityItem, { kind: "work_summary" }>;
  variant: "terminal" | "native";
  thoughtsDefaultOpen: boolean;
  toolGroupsDefaultOpen: boolean;
  projectRoot?: string | null;
  onOpenProjectFile?: (file: ProjectFileReference) => void;
}) {
  const { workSummaryOpenById } = useManagerSnapshot(terminalUiManager);
  const open = workSummaryOpenById[activity.id] ?? false;
  const nestedItems = activity.items.filter(
    (item): item is Extract<AgentActivityItem, { kind: "thinking" | "tool" | "tool_group" | "permission" }> =>
      item.kind === "thinking" || item.kind === "tool" || item.kind === "tool_group" || item.kind === "permission",
  );

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        className="group/work-summary flex w-full items-center gap-1.5 text-left"
        onClick={() => terminalUiManager.setWorkSummaryOpen(activity.id, !open)}
        aria-expanded={open}
      >
        <span className={cn(
          "shrink-0 text-[length:var(--terminal-thought-label-size)] font-semibold tracking-tight",
          variant === "native" ? "text-muted-foreground" : "text-muted-foreground dark:text-zinc-400",
        )}>
          {activity.inProgress ? "Working" : `Worked for ${formatWorkDuration(activity.durationMs)}`}
        </span>
        {activity.inProgress ? <ThinkingDots variant={variant} /> : null}
        <ChevronDown
          className={cn(
            "h-3 w-3 shrink-0 transition-transform duration-200 ease-out",
            open && "rotate-180",
            variant === "native"
              ? "text-muted-foreground group-hover/work-summary:text-foreground"
              : "text-muted-foreground group-hover/work-summary:text-foreground dark:text-zinc-500 dark:group-hover/work-summary:text-zinc-300",
          )}
          aria-hidden="true"
        />
      </button>
      <div
        className={cn(TERMINAL_REVEAL_CLASS, open ? TERMINAL_REVEAL_OPEN_CLASS : TERMINAL_REVEAL_CLOSED_CLASS)}
        aria-hidden={!open}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="space-y-2 pb-0.5 pt-0.5">
            {nestedItems.map((item, index) => (
              <WorkSummaryNestedItem
                key={item.id}
                item={item}
                isFirst={index === 0}
                isLast={index === nestedItems.length - 1}
                variant={variant}
                thoughtsDefaultOpen={thoughtsDefaultOpen}
                toolGroupsDefaultOpen={toolGroupsDefaultOpen}
                projectRoot={projectRoot}
                onOpenProjectFile={onOpenProjectFile}
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
  editingUserMessageId = null,
  editingUserMessageValue = "",
  isEditingUserMessageSaving = false,
  conversationMessageTextSize = false,
  onEditingUserMessageValueChange,
  onCancelEditingUserMessage,
  onSaveEditedUserMessage,
  thoughtsDefaultOpen,
  toolGroupsDefaultOpen,
  projectRoot,
  onOpenProjectFile,
}: {
  activity: TerminalActivityItem;
  connectorExtendsAfter?: boolean;
  connectorExtendsBefore?: boolean;
  variant: "terminal" | "native";
  editingUserMessageId?: string | null;
  editingUserMessageValue?: string;
  isEditingUserMessageSaving?: boolean;
  conversationMessageTextSize?: boolean;
  onEditingUserMessageValueChange?: (value: string) => void;
  onCancelEditingUserMessage?: () => void;
  onSaveEditedUserMessage?: (messageId: string) => void;
  thoughtsDefaultOpen: boolean;
  toolGroupsDefaultOpen: boolean;
  projectRoot?: string | null;
  onOpenProjectFile?: (file: ProjectFileReference) => void;
}) {
  useI18nSnapshot();
  const { copiedMessageId } = useManagerSnapshot(conversationCopyNoticeManager);

  if (activity.kind === "user_message") {
    const isEditing = activity.messageId === editingUserMessageId
      && onEditingUserMessageValueChange
      && onCancelEditingUserMessage
      && onSaveEditedUserMessage;

    return (
      <div className="relative z-10 flex w-full flex-col items-end">
        {isEditing ? (
          <UserMessageEditForm
            messageId={activity.messageId}
            value={editingUserMessageValue}
            isSaving={isEditingUserMessageSaving}
            conversationMessageTextSize={conversationMessageTextSize}
            onValueChange={onEditingUserMessageValueChange}
            onCancel={onCancelEditingUserMessage}
            onSave={onSaveEditedUserMessage}
          />
        ) : (
          <div className={cn(
            "max-w-[min(72ch,calc(100%-1rem))] rounded-[1.55rem] bg-[#f3f3f3] px-5 py-3.5 text-[#202124] dark:bg-[#3a3a3a] dark:text-[#d8d8d8] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:max-w-[min(78ch,calc(100%-1.5rem))]",
            conversationMessageTextSize
              ? "text-sm leading-6"
              : "text-[length:var(--terminal-message-size)] leading-[1.55]",
          )}>
            {activity.text ? <p className="max-w-none whitespace-pre-wrap">{activity.text}</p> : null}
            {activity.attachments.length > 0 ? <UserMessageAttachments attachments={activity.attachments} /> : null}
          </div>
        )}
        {!isEditing && activity.actions.length > 0 ? (
          <div className="mt-1 flex items-center justify-end gap-1 pr-1 text-muted-foreground/70">
            {activity.actions.map((action) => {
              const showCopiedNotice = action.feedback === "copy-message" && copiedMessageId === activity.messageId;

              return action.menuItems?.length ? (
                <DropdownMenu key={action.label}>
                  <DropdownMenuTrigger
                    aria-label={action.label}
                    title={action.title ?? action.label}
                    disabled={action.disabled}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {action.icon}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {action.menuItems.map((item) => (
                      <DropdownMenuItem
                        key={item.label}
                        className="cursor-pointer whitespace-nowrap"
                        disabled={item.disabled}
                        onClick={item.onClick}
                      >
                        <span className="mr-2 inline-flex h-4 w-4 items-center justify-center">{item.icon}</span>
                        {item.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <span key={action.label} className="relative inline-flex flex-col items-center">
                  <button
                    type="button"
                    aria-label={action.label}
                    title={action.title ?? action.label}
                    disabled={action.disabled}
                    onClick={action.onClick}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {action.icon}
                  </button>
                  {showCopiedNotice ? (
                    <span
                      role="status"
                      aria-live="polite"
                      className="pointer-events-none absolute top-full z-20 mt-1 whitespace-nowrap rounded-md border border-border/70 bg-popover px-2 py-1 text-[11px] font-medium leading-none text-popover-foreground shadow-sm"
                    >
                      {t("conversation.message.copiedNotice")}
                    </span>
                  ) : null}
                </span>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  }

  if (activity.kind === "pending_assistant") {
    return (
      <div className="relative z-10 mt-3 flex w-full justify-start px-1" aria-live="polite">
        <PendingAssistantActivity status={activity.status} />
      </div>
    );
  }

  const running = activity.kind === "thinking" || activity.kind === "work_summary"
    ? activity.inProgress
    : (activity.kind === "tool" || activity.kind === "tool_group") && isRunningActivityStatus(activity.status);
  const markerTone = activity.kind === "tool" || activity.kind === "tool_group"
    ? isErrorActivityStatus(activity.status) ? "error" : "tool"
    : activity.kind === "permission"
      ? "permission"
    : "thought";

  return (
    <div className="relative flex items-start gap-3">
      {connectorExtendsBefore ? (
        <div className={cn(
          "absolute left-2 top-0 h-[0.68rem] w-px",
          variant === "native" ? "bg-border/80" : "bg-border/80 dark:bg-white/14",
        )} />
      ) : null}
      {connectorExtendsAfter ? (
        <div className={cn(
          "absolute -bottom-2 left-2 top-[0.68rem] w-px",
          variant === "native" ? "bg-border/80" : "bg-border/80 dark:bg-white/14",
        )} />
      ) : null}
      <TimelineMarker running={running} tone={markerTone} variant={variant} />
      <div className="min-w-0 flex-1">
        {activity.kind === "message" ? (
          <MarkdownContent
            content={activity.text}
            projectRoot={projectRoot}
            onOpenProjectFile={onOpenProjectFile}
            className={cn(
              conversationMessageTextSize
                ? "text-sm leading-6"
                : "text-[length:var(--terminal-message-size)] leading-[1.55]",
              variant === "native"
                ? "text-foreground"
                : "text-foreground [&_blockquote]:border-border/70 [&_blockquote]:bg-muted/30 [&_blockquote]:text-muted-foreground [&_code]:bg-muted/70 [&_code]:text-inherit [&_h3]:text-inherit [&_h4]:text-inherit [&_pre]:border-border/70 [&_pre]:bg-muted/30 [&_pre]:text-inherit [&_strong]:text-inherit dark:text-zinc-100/95 dark:[&_blockquote]:border-white/10 dark:[&_blockquote]:bg-white/5 dark:[&_blockquote]:text-zinc-300 dark:[&_code]:bg-white/10 dark:[&_pre]:border-white/10 dark:[&_pre]:bg-white/5",
            )}
          />
        ) : null}
        {activity.kind === "thinking" ? (
          <ThoughtActivity
            activity={activity}
            variant={variant}
            thoughtsDefaultOpen={thoughtsDefaultOpen}
            projectRoot={projectRoot}
            onOpenProjectFile={onOpenProjectFile}
          />
        ) : null}
        {activity.kind === "tool" ? (
          <ToolActivity
            activity={activity}
            variant={variant}
            projectRoot={projectRoot}
            onOpenProjectFile={onOpenProjectFile}
          />
        ) : null}
        {activity.kind === "tool_group" ? (
          <ToolGroupActivity
            activity={activity}
            variant={variant}
            toolGroupsDefaultOpen={toolGroupsDefaultOpen}
            projectRoot={projectRoot}
            onOpenProjectFile={onOpenProjectFile}
          />
        ) : null}
        {activity.kind === "work_summary" ? (
          <WorkSummaryActivity
            activity={activity}
            variant={variant}
            thoughtsDefaultOpen={thoughtsDefaultOpen}
            toolGroupsDefaultOpen={toolGroupsDefaultOpen}
            projectRoot={projectRoot}
            onOpenProjectFile={onOpenProjectFile}
          />
        ) : null}
        {activity.kind === "permission" ? (
          activity.status === "pending" ? (
            <div className={cn(
              "rounded-[0.85rem] border px-2.5 py-2",
              variant === "native"
                ? "border-amber-500/25 bg-amber-500/8"
                : "border-amber-500/25 bg-amber-500/10 dark:border-amber-400/20 dark:bg-[rgba(96,67,22,0.34)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]",
            )}>
              <div className={cn("text-[length:var(--terminal-permission-title-size)] font-semibold tracking-tight", variant === "native" ? "text-amber-800 dark:text-amber-300" : "text-amber-800 dark:text-amber-100")}>{t(activity.title)}</div>
              {activity.detail ? (
                <p className={cn("mt-0.5 break-words font-mono text-[length:var(--terminal-permission-text-size)] leading-[1.45]", variant === "native" ? "text-amber-900/85 dark:text-amber-100/85" : "text-amber-900/85 dark:text-amber-50/85")}>{t("terminal.permission.for", { detail: activity.detail })}</p>
              ) : null}
              {activity.text ? (
                <p className={cn("mt-0.5 whitespace-pre-wrap text-[length:var(--terminal-permission-text-size)] leading-[1.45]", variant === "native" ? "text-amber-900/75 dark:text-amber-100/75" : "text-amber-900/75 dark:text-amber-50/75")}>{activity.text}</p>
              ) : null}
            </div>
          ) : (
            <div className="py-0.5">
              <div className={cn("text-[length:var(--terminal-permission-title-size)] font-medium", variant === "native" ? "text-foreground/80 dark:text-zinc-300" : "text-foreground/80 dark:text-zinc-300")}>{t(activity.title)}</div>
              {activity.detail ? (
                <p className={cn("mt-0.5 break-words font-mono text-[length:var(--terminal-permission-text-size)] leading-[1.45]", variant === "native" ? "text-muted-foreground" : "text-muted-foreground dark:text-zinc-500")}>{t("terminal.permission.for", { detail: activity.detail })}</p>
              ) : null}
              {activity.text ? (
                <p className={cn("mt-0.5 whitespace-pre-wrap text-[length:var(--terminal-permission-text-size)] leading-[1.45]", variant === "native" ? "text-muted-foreground" : "text-muted-foreground dark:text-zinc-500")}>{activity.text}</p>
              ) : null}
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}

export function Terminal({
  agent,
  userMessages = [],
  entries,
  allowUserMessageFallback = false,
  getUserMessageActions,
  editingUserMessageId = null,
  editingUserMessageValue = "",
  isEditingUserMessageSaving = false,
  onEditingUserMessageValueChange,
  onCancelEditingUserMessage,
  onSaveEditedUserMessage,
  hasMoreHistory = false,
  onRequestMoreHistory,
  variant = "terminal",
  textSizeScope = "terminal",
  conversationMessageTextSize = false,
  className,
  showTextSizeControl = true,
  showPendingAssistantIndicator = false,
  pendingAssistantStatus = "thinking",
  activityFilter,
  thoughtsDefaultOpen = false,
  toolGroupsDefaultOpen = false,
  emptyState,
  isLoading = false,
  projectRoot,
  onOpenProjectFile,
  scrollAnchorKey = null,
  summarizeWorkBlocks = false,
}: TerminalProps) {
  useI18nSnapshot();
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const shouldFollowLatestRef = useRef(true);
  const previousScrollTopRef = useRef(0);
  const previousActivityVersionRef = useRef<string | null>(null);
  const previousScrollAnchorKeyRef = useRef<string | null>(null);
  const hasPositionedFirstActivityRef = useRef(false);
  const firstActivityIdRef = useRef<string | null>(null);
  const { conversationTextSize, terminalTextSize } = useManagerSnapshot(appearancePreferencesManager);

  const activity = useMemo(() => {
    // When the unified worker stream provides actual `entries`, the legacy
    // `agent` / `userMessages` props are ignored. Split the entries by
    // type and route them through the same renderers — bridge-typed
    // entries feed `buildAgentOutputActivity`, server-produced
    // user_input/supervisor_input entries become user-message
    // activity items, and visible lifecycle/system entries fall
    // through to the agent activity builder as plain messages.
    const usingUnifiedStream = Array.isArray(entries) && entries.length > 0;
    const visibleEntries = usingUnifiedStream
      ? (entries ?? []).filter(shouldRenderUnifiedStreamEntry)
      : undefined;
    const bridgeEntries = usingUnifiedStream
      ? (visibleEntries ?? [])
        .flatMap((entry) => {
          if (
            entry.type === "message"
            || entry.type === "thought"
            || entry.type === "tool_call"
            || entry.type === "tool_call_update"
            || entry.type === "permission"
          ) {
            return [entry as unknown as AgentOutputEntry];
          }
          if (entry.type === "system_note" || entry.type === "lifecycle") {
            return [{
              id: entry.id,
              type: "message",
              text: entry.text,
              timestamp: entry.timestamp,
              raw: entry.raw,
            } satisfies AgentOutputEntry];
          }
          return [];
        })
      : agent?.outputEntries;
    const seqByActivityId = new Map<string, number>();
    if (usingUnifiedStream) {
      for (const entry of visibleEntries ?? []) {
        if (typeof entry.seq !== "number") {
          continue;
        }
        if (!seqByActivityId.has(entry.id)) {
          seqByActivityId.set(entry.id, entry.seq);
        }
        if (entry.toolCallId) {
          const previousSeq = seqByActivityId.get(entry.toolCallId) ?? entry.seq;
          seqByActivityId.set(entry.toolCallId, Math.min(previousSeq, entry.seq));
        }
      }
    }
    const agentActivity: TerminalActivityItemWithOrder[] = buildAgentOutputActivity({
      outputEntries: bridgeEntries,
      state: usingUnifiedStream ? "idle" : agent?.state,
      currentText: usingUnifiedStream ? "" : agent?.currentText,
      lastText: usingUnifiedStream ? "" : agent?.lastText,
      displayText: usingUnifiedStream ? "" : agent?.displayText,
    }).map((item) => (
      usingUnifiedStream
        ? { ...item, streamSeq: activityStreamSeq(item, seqByActivityId) ?? undefined }
        : item
    ));
    const canPlaceFallbackUserMessages = usingUnifiedStream && allowUserMessageFallback;
    const userActivity: TerminalActivityItemWithOrder[] = usingUnifiedStream
      ? [
        ...(visibleEntries ?? [])
          .filter((entry) => entry.type === "user_input" || entry.type === "supervisor_input")
          .map((entry) => ({ source: "stream" as const, entry })),
        ...(canPlaceFallbackUserMessages ? userMessages : [])
          .filter((message) => !(entries ?? []).some((entry) => workerEntryMatchesUserMessage(entry, message)))
          .map((message) => ({ source: "fallback" as const, message })),
      ]
        .map((entry) => {
          if (entry.source === "fallback") {
            const messageSeq = inferFallbackUserMessageSeq(entry.message.createdAt, entries ?? []);
            return {
              id: `user:${entry.message.id}`,
              kind: "user_message" as const,
              messageId: entry.message.id,
              text: entry.message.content,
              timestamp: entry.message.createdAt,
              attachments: entry.message.attachments ?? [],
              streamSeq: messageSeq,
              actions: getUserMessageActions?.(entry.message) ?? [],
            };
          }

          const attachments = (entry.entry.attachments ?? []).map((attachment) => ({
            id: attachment.id,
            kind: attachment.mimeType.startsWith("image/") ? "image" as const : "file" as const,
            name: attachment.filename,
            mimeType: attachment.mimeType,
            size: attachment.sizeBytes,
          }));

          // Stream entry timestamps can drift from the original message
          // createdAt when a user_input row gets re-appended onto a
          // newer worker's stream (the entry id is preserved but the
          // timestamp is whatever new Date() was when the append ran).
          // The DB row is the source of truth for "when did the user
          // send this", so override the entry timestamp with
          // userMessages.createdAt whenever the ids match.
          const matchingUserMessage = entry.entry.type === "user_input"
            ? userMessages.find((m) => m.id === entry.entry.id)
            : null;
          const authoritativeTimestamp = matchingUserMessage?.createdAt ?? entry.entry.timestamp;

          return {
            id: `user:${entry.entry.id}`,
            kind: "user_message" as const,
            messageId: entry.entry.id,
            text: entry.entry.text,
            timestamp: authoritativeTimestamp,
            attachments,
            streamSeq: entry.entry.seq,
            actions: entry.entry.type === "user_input" ? getUserMessageActions?.({
              id: entry.entry.id,
              content: entry.entry.text,
              createdAt: authoritativeTimestamp,
              attachments,
            }) ?? [] : [],
          };
        })
      : userMessages.map((message) => ({
        id: `user:${message.id}`,
        kind: "user_message",
        messageId: message.id,
        text: message.content,
        timestamp: message.createdAt,
        attachments: message.attachments ?? [],
        actions: getUserMessageActions?.(message) ?? [],
      }));
    const latestActivityTimestamp = [...userActivity, ...agentActivity]
      .map((item) => activityTimestampMs(item.timestamp))
      .reduce((latest, timestamp) => Math.max(latest, timestamp), 0);
    const shouldShowPendingAssistantActivity = showPendingAssistantIndicator;
    const pendingAssistantActivity: TerminalActivityItem[] = shouldShowPendingAssistantActivity
      ? [{
          id: "pending-assistant",
          kind: "pending_assistant",
          status: pendingAssistantStatus,
          timestamp: new Date((latestActivityTimestamp || Date.now()) + 1).toISOString(),
        }]
      : [];

    // Multi-worker conversations (transcript endpoint) tag every entry
    // with a `workerId` field. When we see more than one workerId in
    // play we can't trust seq as a primary key — it's per-worker — so
    // we sort by timestamp first. For single-worker streams seq still
    // wins (it's the actual write order, robust against clock skew on
    // entries the SDK back-dates to their thinking-started time).
    const entriesArr = (entries ?? []) as unknown as Array<{ workerId?: unknown }>;
    const workerIdsInEntries = new Set<string>();
    for (const entry of entriesArr) {
      if (typeof entry.workerId === "string" && entry.workerId.length > 0) {
        workerIdsInEntries.add(entry.workerId);
      }
    }
    const isMultiWorker = workerIdsInEntries.size > 1;
    const sorted = [...userActivity, ...agentActivity, ...pendingAssistantActivity].sort((a, b) => {
      if (isMultiWorker) {
        const timeDelta = activityTimestampMs(a.timestamp) - activityTimestampMs(b.timestamp);
        if (timeDelta !== 0) {
          return timeDelta;
        }
      }
      if (usingUnifiedStream) {
        const leftSeq = activityStreamSeq(a, seqByActivityId);
        const rightSeq = activityStreamSeq(b, seqByActivityId);
        if (leftSeq !== null && rightSeq !== null) {
          return leftSeq - rightSeq;
        }
      }
      const timeDelta = activityTimestampMs(a.timestamp) - activityTimestampMs(b.timestamp);
      if (timeDelta !== 0) {
        return timeDelta;
      }
      return activityKindOrder(a) - activityKindOrder(b) || a.id.localeCompare(b.id);
    });
    return summarizeWorkBlocks ? summarizeWorkIntervals(sorted) : sorted;
  }, [agent, allowUserMessageFallback, entries, getUserMessageActions, pendingAssistantStatus, showPendingAssistantIndicator, summarizeWorkBlocks, userMessages]);
  const filteredActivity = useMemo(
    () => activityFilter ? activity.filter(activityFilter) : activity,
    [activity, activityFilter],
  );
  const effectiveToolGroupsDefaultOpen = useMemo(() => {
    if (toolGroupsDefaultOpen) return true;
    const lastMeaningful = filteredActivity.filter((a) => a.kind !== "pending_assistant").at(-1);
    return lastMeaningful?.kind === "tool_group" && isRunningActivityStatus(lastMeaningful.status);
  }, [filteredActivity, toolGroupsDefaultOpen]);
  const terminalZoomStyle = useMemo(() => (
    textSizeScope === "conversation"
      ? getConversationTerminalTextSizeStyle(conversationTextSize)
      : getTerminalTextSizeStyle(terminalTextSize)
  ), [conversationTextSize, terminalTextSize, textSizeScope]);
  const handleProjectFileReferenceClick = useMemo(() => (
    projectRoot && onOpenProjectFile
      ? (file: ProjectFileReference) => onOpenProjectFile(file)
      : undefined
  ), [onOpenProjectFile, projectRoot]);

  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }

    const scrollContainer = getTerminalScrollElement(container, variant);
    scrollContainerRef.current = scrollContainer;
    previousScrollTopRef.current = scrollContainer.scrollTop;

    const updateFollowState = () => {
      shouldFollowLatestRef.current = shouldTerminalKeepFollowingLatest(scrollContainer, previousScrollTopRef.current);
      previousScrollTopRef.current = scrollContainer.scrollTop;
    };

    updateFollowState();
    scrollContainer.addEventListener("scroll", updateFollowState, { passive: true });
    return () => scrollContainer.removeEventListener("scroll", updateFollowState);
  }, [variant]);

  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    const activityVersion = getTerminalActivityVersion(filteredActivity);
    const scrollAnchorChanged = previousScrollAnchorKeyRef.current !== scrollAnchorKey;
    previousScrollAnchorKeyRef.current = scrollAnchorKey;
    if (scrollAnchorChanged) {
      hasPositionedFirstActivityRef.current = false;
    }
    const previousActivityVersion = previousActivityVersionRef.current;
    const activityChanged = previousActivityVersionRef.current !== activityVersion;
    previousActivityVersionRef.current = activityVersion;
    const firstActivityId = filteredActivity[0]?.id ?? null;
    if (firstActivityId !== firstActivityIdRef.current) {
      hasPositionedFirstActivityRef.current = false;
      firstActivityIdRef.current = firstActivityId;
    }

    const isFirstRenderedActivity = filteredActivity.length > 0 && !hasPositionedFirstActivityRef.current;
    if (
      !container
      || (!activityChanged && !scrollAnchorChanged)
      || (!shouldFollowLatestRef.current && !isFirstRenderedActivity)
    ) {
      return;
    }

    const latestActivityKind = filteredActivity.at(-1)?.kind;
    if (!shouldTerminalScrollToLatest({ variant, isFirstRenderedActivity, latestActivityKind })) {
      previousScrollTopRef.current = container.scrollTop;
      return;
    }

    const scrollBehavior: ScrollBehavior = isFirstRenderedActivity ? "auto" : "smooth";

    if (isFirstRenderedActivity) {
      const didScroll = scrollTerminalToBottom(container, "auto");
      if (didScroll) {
        shouldFollowLatestRef.current = true;
        hasPositionedFirstActivityRef.current = true;
      }
      previousScrollTopRef.current = container.scrollTop;
      return;
    }

    shouldFollowLatestRef.current = true;
    if (filteredActivity.length > 0) {
      hasPositionedFirstActivityRef.current = true;
    }
    requestAnimationFrame(() => {
      if (previousActivityVersion === null) {
        scrollTerminalToBottom(container, "auto");
      } else {
        scrollTerminalToBottom(container, scrollBehavior);
      }
      previousScrollTopRef.current = container.scrollTop;
    });
  }, [filteredActivity, scrollAnchorKey, variant]);

  return (
    <div className={cn(
      "relative w-full",
      textSizeScope === "conversation" && "omni-conversation-text-scale",
      variant === "native"
        ? "flex flex-col bg-transparent text-foreground"
        : "h-full overflow-hidden rounded-[1.05rem] border border-border/70 bg-card text-foreground shadow-sm dark:border-transparent dark:bg-[#0b0d10] dark:text-zinc-100 dark:shadow-none",
      className,
    )}
      style={terminalZoomStyle}
    >
      {variant === "terminal" && showTextSizeControl ? (
        <TerminalTextSizeControl className="absolute right-2 top-2 z-20" />
      ) : null}
      <div
        ref={scrollRef}
        onScroll={(event) => {
          if (variant === "terminal") {
            shouldFollowLatestRef.current = shouldTerminalKeepFollowingLatest(event.currentTarget, previousScrollTopRef.current);
            previousScrollTopRef.current = event.currentTarget.scrollTop;
          }
          if (hasMoreHistory && shouldTerminalRequestMoreHistory(event.currentTarget)) {
            onRequestMoreHistory?.();
          }
        }}
        className={cn(
          variant === "native"
            ? "flex flex-1 flex-col overflow-visible px-1 py-2"
            : "h-full overflow-y-auto px-3 pb-2.5 pt-9 [scrollbar-color:rgba(113,113,122,0.28)_transparent] [scrollbar-width:thin] dark:[scrollbar-color:rgba(255,255,255,0.16)_transparent]",
        )}
      >
        {filteredActivity.length > 0 ? (
          <div className="relative flex flex-col gap-2">
            {filteredActivity.map((entry, index) => {
              const previousEntry = filteredActivity[index - 1];
              const nextEntry = filteredActivity[index + 1];

              return (
                <ActivityRow
                  key={entry.id}
                  activity={entry}
                  connectorExtendsBefore={shouldTerminalConnectorExtend(entry.kind, previousEntry?.kind)}
                  connectorExtendsAfter={shouldTerminalConnectorExtend(entry.kind, nextEntry?.kind)}
                  variant={variant}
                  editingUserMessageId={editingUserMessageId}
                  editingUserMessageValue={editingUserMessageValue}
                  isEditingUserMessageSaving={isEditingUserMessageSaving}
                  conversationMessageTextSize={conversationMessageTextSize}
                  onEditingUserMessageValueChange={onEditingUserMessageValueChange}
                  onCancelEditingUserMessage={onCancelEditingUserMessage}
                  onSaveEditedUserMessage={onSaveEditedUserMessage}
                  thoughtsDefaultOpen={thoughtsDefaultOpen}
                  toolGroupsDefaultOpen={effectiveToolGroupsDefaultOpen}
                  projectRoot={projectRoot}
                  onOpenProjectFile={handleProjectFileReferenceClick}
                />
              );
            })}
          </div>
        ) : emptyState !== undefined ? (
          <>{emptyState}</>
        ) : (
          <div className={cn(
            "flex h-full min-h-full flex-1 items-center justify-center gap-2 rounded-xl border border-dashed px-4 text-center text-sm",
            variant === "native"
              ? "border-border bg-muted/20 text-muted-foreground"
              : "border-border/70 bg-muted/25 text-muted-foreground dark:border-white/10 dark:bg-black/10 dark:text-zinc-500",
          )}>
            {isLoading ? (
              <>
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                <span>{t("terminal.empty.loadingSession")}</span>
              </>
            ) : (
              <span>{t("terminal.empty.noActivity")}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
