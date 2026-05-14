"use client";

import { useEffect, useMemo, useRef } from "react";
import { AlertTriangle, Bot, ChevronDown, Clock, Cpu, Hash, Maximize2, Minimize2, Square, SquareTerminal } from "lucide-react";
import { Terminal, TerminalTextSizeControl, type AgentTerminalPayload, type TerminalUserMessage } from "@/components/Terminal";
import { Collapsible, CollapsibleTrigger, COLLAPSIBLE_PANEL_CLOSED_CLASS, COLLAPSIBLE_PANEL_OPEN_CLASS, COLLAPSIBLE_PANEL_TRANSITION_CLASS } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { workerCardManager } from "@/components/component-state-managers";
import { sideWindowManager } from "@/app/home/SideWindowManager";
import { isWorkerActiveStatus } from "@/lib/conversation-workers";
import { cn } from "@/lib/utils";
import { useManagerSnapshot } from "@/lib/use-manager-snapshot";
import {
  deriveVisibleWorkerTerminalProcesses,
  type WorkerTerminalProcess,
} from "@/lib/worker-terminal-processes";

export type WorkerCardAgent = AgentTerminalPayload & {
  name: string;
  state: string;
  displayText?: string;
  lastError?: string | null;
  stopReason?: string | null;
  pendingPermissions?: Array<{
    requestId: number;
    requestedAt: string;
    sessionId?: string | null;
    toolCall?: {
      toolCallId?: string | null;
      kind?: string | null;
      title?: string | null;
      status?: string | null;
    } | null;
    options?: Array<{ optionId: string; kind: string; name: string }>;
  }>;
  contextUsage?: {
    inputTokens?: number | null;
    outputTokens?: number | null;
    totalTokens?: number | null;
    maxTokens?: number | null;
    fullnessPercent?: number | null;
  } | null;
};

type PendingPermissionRecord = NonNullable<WorkerCardAgent["pendingPermissions"]>[number];

export type WorkerCardProps = {
  workerId: string;
  workerNumber?: number | null;
  workerTitle?: string | null;
  agent: WorkerCardAgent;
  defaultOpen: boolean;
  runtimeLabel: string | null;
  runtimeDurationLabel?: string | null;
  activeModel: string | null;
  activeEffort: string | null;
  promptPreview?: string | null;
  userMessages?: TerminalUserMessage[];
  projectRoot?: string | null;
  pendingPermissions: PendingPermissionRecord[];
  terminalHeightClass: string;
  fillAvailable?: boolean;
  compact?: boolean;
  isFocused?: boolean;
  canFocus?: boolean;
  onToggleFocus?: () => void;
  onStopWorker?: () => void;
  onStopTerminalProcess?: (terminalProcess: WorkerTerminalProcess) => void;
  onLoadWorkerHistory?: () => void;
  isStopping?: boolean;
  stoppingTerminalProcessId?: string | null;
};

function renderContextMeter(fullnessPercent: number | null | undefined) {
  const normalized = typeof fullnessPercent === "number" && Number.isFinite(fullnessPercent)
    ? Math.min(100, Math.max(0, Math.round(fullnessPercent)))
    : null;
  const lightMeterTone = normalized === null
    ? "rgba(113,113,122,0.24)"
    : normalized >= 85
      ? "rgba(248,113,113,0.9)"
      : normalized >= 60
        ? "rgba(245,158,11,0.82)"
        : "rgba(71,85,105,0.58)";
  const darkMeterTone = normalized === null
    ? "rgba(212,212,216,0.38)"
    : normalized >= 85
      ? "rgba(252,165,165,0.88)"
      : normalized >= 60
        ? "rgba(250,204,21,0.86)"
        : "rgba(212,212,216,0.78)";
  const meterFill = normalized === null ? 0 : normalized;

  return (
    <div
      aria-label={normalized === null ? "Context usage not reported" : `Context usage ${normalized}%`}
      className="relative h-4 w-4 shrink-0 rounded-full border border-border/70 bg-muted/30 dark:border-white/25 dark:bg-white/[0.06]"
    >
      <div
        className="absolute inset-0 rounded-full dark:hidden"
        style={{
          background: `conic-gradient(${lightMeterTone} ${meterFill}%, rgba(113,113,122,0.18) ${meterFill}% 100%)`,
        }}
      />
      <div
        className="absolute inset-0 hidden rounded-full dark:block"
        style={{
          background: `conic-gradient(${darkMeterTone} ${meterFill}%, rgba(244,244,245,0.1) ${meterFill}% 100%)`,
        }}
      />
      <div className="absolute inset-[1.5px] rounded-full bg-card dark:inset-[3px] dark:bg-[#111315]" />
    </div>
  );
}

function renderContextFill(fullnessPercent: number | null | undefined) {
  const normalized = typeof fullnessPercent === "number" && Number.isFinite(fullnessPercent)
    ? Math.min(100, Math.max(0, Math.round(fullnessPercent)))
    : null;
  const label = normalized === null ? "Context --" : `Context ${normalized}%`;
  const title = normalized === null ? "Context usage not reported" : `Context usage ${normalized}%`;

  return (
    <div
      aria-label={title}
      title={title}
      className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground dark:text-zinc-400"
    >
      {renderContextMeter(fullnessPercent)}
      <span className="shrink-0">{label}</span>
    </div>
  );
}

function formatWorkerStateLabel(state: string) {
  return state.replace(/[_-]+/g, " ");
}

function shouldShowWorkerError(agent: WorkerCardAgent) {
  if (!agent.lastError) {
    return false;
  }

  if (agent.state === "error") {
    return true;
  }

  if (isWorkerActiveStatus(agent.state)) {
    return false;
  }

  return !agent.currentText?.trim() && !agent.lastText?.trim() && (agent.outputEntries?.length ?? 0) === 0;
}

function hasOmittedWorkerHistory(agent: WorkerCardAgent) {
  return Boolean(agent.outputEntries?.some((entry) => (
    entry.id === "output-archive-marker"
    || entry.id.startsWith("output-entries-omitted:")
  )));
}

function WorkerExpandedFooter({
  workerId,
  displayId,
  runtimeDurationLabel,
  activeModel,
  activeEffort,
  state,
  stateLabel,
  contextFullnessPercent,
  processes,
  onStopTerminalProcess,
  stoppingTerminalProcessId,
}: {
  workerId: string;
  displayId: string;
  runtimeDurationLabel?: string | null;
  activeModel: string | null;
  activeEffort: string | null;
  state: string;
  stateLabel: string;
  contextFullnessPercent?: number | null;
  processes: WorkerTerminalProcess[];
  onStopTerminalProcess?: (terminalProcess: WorkerTerminalProcess) => void;
  stoppingTerminalProcessId?: string | null;
}) {
  const { terminalProcessesOpenByWorkerId } = useManagerSnapshot(workerCardManager);
  const activeProcesses = processes.filter((process) => process.active);
  const visibleProcesses = activeProcesses.slice(0, 3);
  const open = terminalProcessesOpenByWorkerId[workerId] ?? activeProcesses.length === 1;
  const summary = `Running ${activeProcesses.length} terminal${activeProcesses.length === 1 ? "" : "s"}`;

  const handleTerminalSummaryClick = () => {
    if (activeProcesses.length === 0) {
      return;
    }

    workerCardManager.setTerminalProcessesOpen(workerId, !open);
  };

  return (
    <div className="shrink-0 border-t border-border/70 bg-muted/45 text-foreground dark:border-white/8 dark:bg-[#242426] dark:text-zinc-200">
      {activeProcesses.length > 0 ? (
        <Collapsible
          open={open}
          onOpenChange={(nextOpen) => workerCardManager.setTerminalProcessesOpen(workerId, nextOpen)}
          className="border-b border-border/60 dark:border-white/8"
        >
          <button
            type="button"
            className="flex h-9 min-w-0 items-center gap-2 px-3.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground dark:text-zinc-400 dark:hover:text-zinc-100"
            onClick={handleTerminalSummaryClick}
            title={open ? "Collapse running terminals" : "Expand running terminals"}
          >
            <SquareTerminal className="h-3.5 w-3.5 shrink-0 text-muted-foreground dark:text-zinc-400" />
            <span className="truncate">{summary}</span>
            <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", open && "rotate-180")} />
          </button>
          <div
            className={cn(
              COLLAPSIBLE_PANEL_TRANSITION_CLASS,
              open ? COLLAPSIBLE_PANEL_OPEN_CLASS : COLLAPSIBLE_PANEL_CLOSED_CLASS,
            )}
            aria-hidden={!open}
          >
            <div className="min-h-0 space-y-1 overflow-hidden px-4 py-2">
              {visibleProcesses.map((terminalProcess) => {
                const canStopTerminalProcess = Boolean(onStopTerminalProcess && terminalProcess.processId);
                const isStoppingTerminalProcess = stoppingTerminalProcessId === terminalProcess.id;
                const terminalProcessTitle = terminalProcess.processId
                  ? `CLI process ${terminalProcess.processId}`
                  : "No terminal process id reported";

                return (
                  <div key={terminalProcess.id} className="flex min-w-0 items-center gap-2 font-mono text-[12px] leading-5" title={terminalProcessTitle}>
                    <div className="min-w-0 flex-1 truncate">
                      <span className="text-foreground dark:text-zinc-100">{terminalProcess.command}</span>
                      {terminalProcess.outputTail ? <span className="text-muted-foreground dark:text-zinc-500"> {terminalProcess.outputTail}</span> : null}
                    </div>
                    {onStopTerminalProcess ? (
                      <button
                        type="button"
                        aria-label={`Stop terminal ${terminalProcess.command} for ${displayId}`}
                        title={canStopTerminalProcess ? `Stop terminal process ${terminalProcess.processId}` : "This terminal did not report a process id"}
                        disabled={!canStopTerminalProcess || isStoppingTerminalProcess}
                        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-white/[0.08] dark:hover:text-zinc-100"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          onStopTerminalProcess(terminalProcess);
                        }}
                      >
                        <Square className="h-3 w-3 fill-current" />
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </Collapsible>
      ) : null}
      <div className="flex min-h-10 min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-3.5 py-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <div className="inline-flex min-w-0 shrink items-center gap-1.5 text-[11px] text-muted-foreground dark:text-zinc-400">
            <Cpu className="h-3.5 w-3.5 text-muted-foreground/80 dark:text-zinc-500" />
            <span className="truncate" title={activeModel || "Default"}>{activeModel || "Default"}</span>
          </div>
          {activeEffort ? <span className="shrink-0 text-[11px] text-muted-foreground dark:text-zinc-500">{activeEffort} effort</span> : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-x-2.5 gap-y-1.5">
          <div className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-muted-foreground dark:text-zinc-400">
            <span className={cn(
              "h-1.5 w-1.5 rounded-full",
              isWorkerActiveStatus(state) ? "bg-emerald-500 dark:bg-emerald-300" : "bg-muted-foreground dark:bg-zinc-500",
            )} />
            <span className="capitalize">{stateLabel}</span>
          </div>
          {runtimeDurationLabel ? (
            <div className="inline-flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground dark:text-zinc-400">
              <Clock className="h-3.5 w-3.5 text-muted-foreground/80 dark:text-zinc-500" />
              <span title={runtimeDurationLabel}>{runtimeDurationLabel}</span>
            </div>
          ) : null}
          {renderContextFill(contextFullnessPercent)}
          <TerminalTextSizeControl className="h-6 w-6 shadow-none" />
        </div>
      </div>
    </div>
  );
}

function PermissionWarning({ workerId, pendingPermissions }: { workerId: string; pendingPermissions: PendingPermissionRecord[] }) {
  const { permissionOpenByWorkerId } = useManagerSnapshot(workerCardManager);
  const open = Boolean(permissionOpenByWorkerId[workerId]);
  const popupRef = useRef<HTMLDivElement>(null);
  const permissionCount = pendingPermissions.length;
  const summary = `${permissionCount} permission request${permissionCount === 1 ? "" : "s"} waiting`;

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!popupRef.current?.contains(event.target as Node)) {
        workerCardManager.closePermission(workerId);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [open, workerId]);

  return (
    <div ref={popupRef} className="relative">
      <button
        type="button"
        aria-label={summary}
        title={summary}
        className="group relative flex h-8 w-8 items-center justify-center rounded-full border border-amber-500/25 bg-amber-500/10 text-amber-700 transition-colors hover:bg-amber-500/15 dark:border-amber-200/12 dark:bg-amber-50/[0.04] dark:text-amber-100/85 dark:hover:bg-amber-50/[0.08]"
        onClick={() => workerCardManager.togglePermission(workerId)}
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        {!open ? (
          <div className="pointer-events-none absolute right-0 top-10 hidden min-w-max rounded-full border border-border bg-popover px-2.5 py-1 text-[10px] font-medium text-popover-foreground shadow-lg group-hover:block dark:border-white/10 dark:bg-[#181513] dark:text-zinc-200">
            Permissions waiting
          </div>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 top-10 z-30 w-80 rounded-2xl border border-border bg-popover p-3.5 text-popover-foreground shadow-[0_22px_70px_rgba(15,23,42,0.16)] backdrop-blur dark:border-white/10 dark:bg-[#131517] dark:shadow-[0_22px_70px_rgba(0,0,0,0.45)]">
          <div className="mb-2 text-[11px] font-medium text-foreground dark:text-zinc-100">Permissions waiting</div>
          <div className="space-y-2">
            {pendingPermissions.map((permission) => (
              <div key={permission.requestId} className="rounded-xl border border-border/70 bg-muted/20 p-2.5 text-[11px] text-foreground dark:border-white/8 dark:bg-white/[0.03] dark:text-zinc-200">
                <div className="font-medium text-foreground dark:text-zinc-100">Request {permission.requestId}</div>
                <div className="mt-1 text-muted-foreground dark:text-zinc-500">{permission.requestedAt}</div>
                {permission.toolCall?.title ? (
                  <div className="mt-2 rounded-lg bg-amber-500/8 px-2 py-1.5 text-amber-900 dark:bg-amber-400/8 dark:text-amber-100">
                    {permission.toolCall.kind ? (
                      <span className="mr-1.5 font-medium uppercase tracking-[0.04em]">{permission.toolCall.kind}</span>
                    ) : null}
                    <span className="break-words font-mono text-[10.5px]">{permission.toolCall.title}</span>
                  </div>
                ) : null}
                {permission.options?.length ? (
                  <div className="mt-2 space-y-1">
                    {permission.options.map((option) => (
                      <div key={option.optionId} className="rounded-lg bg-muted/40 px-2 py-1.5 dark:bg-white/[0.04]">
                        <span className="font-medium text-foreground dark:text-zinc-100">{option.kind}</span>
                        <span className="text-muted-foreground dark:text-zinc-400"> {option.name}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 text-muted-foreground dark:text-zinc-400">No option details available yet.</div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function WorkerCard({
  workerId,
  workerNumber,
  workerTitle,
  agent,
  defaultOpen,
  runtimeLabel,
  runtimeDurationLabel,
  activeModel,
  activeEffort,
  promptPreview,
  userMessages = [],
  projectRoot,
  pendingPermissions,
  terminalHeightClass,
  fillAvailable = false,
  compact = false,
  isFocused = false,
  canFocus = false,
  onToggleFocus,
  onStopWorker,
  onStopTerminalProcess,
  onLoadWorkerHistory,
  isStopping,
  stoppingTerminalProcessId,
}: WorkerCardProps) {
  const { openByWorkerId } = useManagerSnapshot(workerCardManager);
  const open = isFocused || (openByWorkerId[workerId] ?? defaultOpen);
  const promptPreviewText = promptPreview?.trim() ?? "";
  const stateLabel = formatWorkerStateLabel(agent.state);
  const showPromptPreview = promptPreviewText.length > 0;
  const showStopWorker = Boolean(onStopWorker) && isWorkerActiveStatus(agent.state);
  const shouldFillAvailable = fillAvailable && open;
  const terminalProcesses = useMemo(() => deriveVisibleWorkerTerminalProcesses(agent.outputEntries, agent.state), [agent.outputEntries, agent.state]);
  const hasActiveTerminalProcesses = terminalProcesses.some((process) => process.active);
  const showHeaderStopWorker = showStopWorker && !hasActiveTerminalProcesses;
  const showWorkerError = shouldShowWorkerError(agent);
  const showFocusControl = canFocus && Boolean(onToggleFocus);

  const workerNumberLabel = useMemo(() => {
    if (typeof workerNumber === "number" && Number.isFinite(workerNumber)) {
      return `Worker ${workerNumber}`;
    }

    const match = workerId.match(/-worker-(\d+)$/);
    return match ? `Worker ${match[1]}` : null;
  }, [workerId, workerNumber]);
  const normalizedWorkerTitle = workerTitle?.trim() ?? "";
  const displayId = normalizedWorkerTitle || workerNumberLabel || workerId;
  const showWorkerNumberAfterTitle = Boolean(normalizedWorkerTitle && workerNumberLabel);
  const compactSubtitle = [
    stateLabel,
    runtimeLabel || "Unknown",
    activeModel || "Default",
    runtimeDurationLabel,
  ].filter(Boolean).join(" · ");
  const workerTitleSummary = (
    <div className="inline-flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] font-medium text-foreground dark:text-zinc-100" title={workerId}>
      <span className="break-words">{displayId}</span>
      {showWorkerNumberAfterTitle ? (
        <span className="inline-flex shrink-0 items-center gap-0.5 rounded border border-border/70 bg-muted/35 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-400">
          <Hash className="h-3 w-3" />
          {workerNumberLabel}
        </span>
      ) : null}
    </div>
  );
  const expandedHeaderSummary = (
    <div className="min-w-0 flex-1 space-y-1.5">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
        {workerTitleSummary}
      </div>
      {showPromptPreview && !compact ? (
        <Tooltip>
          <TooltipTrigger
            closeOnClick={false}
            render={<span className="block w-fit max-w-full" />}
          >
            <span className="line-clamp-2 text-[11px] leading-[1.35] text-muted-foreground dark:text-zinc-500">
              {promptPreviewText}
            </span>
          </TooltipTrigger>
          <TooltipContent
            side="bottom"
            align="start"
            sideOffset={8}
            className="block max-h-72 max-w-[min(34rem,calc(100vw-3rem))] overflow-auto rounded-lg border border-border bg-popover p-3 text-left text-[11px] leading-[1.5] text-popover-foreground shadow-[0_18px_60px_rgba(15,23,42,0.16)] dark:border-white/10 dark:bg-[#181a1d] dark:text-zinc-200 dark:shadow-[0_18px_60px_rgba(0,0,0,0.42)]"
          >
            {promptPreviewText}
          </TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );
  const collapsedHeaderSummary = (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1.5">
      {workerTitleSummary}
      <div className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-muted-foreground dark:text-zinc-400">
        <span className={cn(
          "h-1.5 w-1.5 rounded-full",
          isWorkerActiveStatus(agent.state) ? "bg-emerald-500 dark:bg-emerald-300" : "bg-muted-foreground dark:bg-zinc-500",
        )} />
        <span className="capitalize">{stateLabel}</span>
      </div>
      {runtimeDurationLabel ? (
        <div className="inline-flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground dark:text-zinc-400">
          <Clock className="h-3.5 w-3.5 text-muted-foreground/80 dark:text-zinc-500" />
          <span title={runtimeDurationLabel}>{runtimeDurationLabel}</span>
        </div>
      ) : null}
      <div className="inline-flex min-w-0 shrink items-center gap-1.5 text-[11px] text-muted-foreground dark:text-zinc-400">
        <Bot className="h-3.5 w-3.5 text-muted-foreground/80 dark:text-zinc-500" />
        <span className="truncate" title={runtimeLabel || "Unknown"}>{runtimeLabel || "Unknown"}</span>
      </div>
      <div className="inline-flex min-w-0 shrink items-center gap-1.5 text-[11px] text-muted-foreground dark:text-zinc-400">
        <Cpu className="h-3.5 w-3.5 text-muted-foreground/80 dark:text-zinc-500" />
        <span className="truncate" title={activeModel || "Default"}>{activeModel || "Default"}</span>
      </div>
    </div>
  );
  const actionControls = (
    <div className="flex shrink-0 items-center gap-1.5">
      {pendingPermissions.length > 0 ? <PermissionWarning workerId={workerId} pendingPermissions={pendingPermissions} /> : null}
      {showFocusControl ? (
        <button
          type="button"
          aria-label={isFocused ? `Show all workers` : `Focus terminal for ${displayId}`}
          title={isFocused ? "Show all workers" : "Focus terminal"}
          className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground dark:text-zinc-500 dark:hover:bg-white/[0.04] dark:hover:text-zinc-300"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onToggleFocus?.();
          }}
        >
          {isFocused ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </button>
      ) : null}
      {showHeaderStopWorker ? (
        <button
          type="button"
          aria-label={`Stop ${displayId}`}
          title={`Stop ${displayId}`}
          disabled={isStopping}
          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-stone-300/80 bg-stone-100/40 text-stone-500 transition-colors hover:border-rose-300/70 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-300/15 dark:bg-red-400/[0.06] dark:text-red-100/85 dark:hover:bg-red-400/[0.12]"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onStopWorker?.();
          }}
        >
          <Square className="h-3 w-3 fill-current" />
        </button>
      ) : null}
      {!compact ? (
        <CollapsibleTrigger
          className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground dark:text-zinc-500 dark:hover:bg-white/[0.04] dark:hover:text-zinc-300"
          aria-label={open ? `Collapse ${displayId}` : `Expand ${displayId}`}
        >
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
        </CollapsibleTrigger>
      ) : null}
    </div>
  );

  if (compact) {
    return (
      <div
        className={cn(
          "overflow-hidden rounded-[14px] border border-border/70 bg-card text-card-foreground shadow-sm transition-colors dark:border-white/8 dark:bg-[#111315] dark:text-zinc-100 dark:shadow-none",
          compact && "cursor-pointer hover:border-foreground/20 hover:bg-muted/20 dark:hover:border-white/14 dark:hover:bg-white/[0.03]",
        )}
      >
        <div className="border-b-0 bg-card px-3.5 py-2.5 dark:bg-[#111315]">
          <div className="flex min-h-12 items-center justify-between gap-3">
            <button type="button" className="min-w-0 flex-1 text-left" onClick={onToggleFocus}>
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-[12px] font-medium text-foreground dark:text-zinc-100" title={displayId}>
                  {displayId}
                </span>
                {showWorkerNumberAfterTitle ? (
                  <span className="inline-flex shrink-0 items-center gap-0.5 rounded border border-border/70 bg-muted/35 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-400">
                    <Hash className="h-3 w-3" />
                    {workerNumberLabel}
                  </span>
                ) : null}
              </div>
              <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground dark:text-zinc-500">
                <span className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  isWorkerActiveStatus(agent.state) ? "bg-emerald-500 dark:bg-emerald-300" : "bg-muted-foreground dark:bg-zinc-500",
                )} />
                <span className="truncate capitalize" title={compactSubtitle}>{compactSubtitle}</span>
              </div>
            </button>
            {actionControls}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={(nextOpen) => workerCardManager.setOpen(workerId, nextOpen)} className={cn(shouldFillAvailable && "flex h-full min-h-0 flex-col")}>
      <div className={cn(
        "overflow-hidden rounded-[18px] border border-border/70 bg-card text-card-foreground shadow-sm dark:border-white/8 dark:bg-[#111315] dark:text-zinc-100 dark:shadow-[0_20px_60px_rgba(0,0,0,0.24)]",
        shouldFillAvailable && "flex min-h-0 flex-1 flex-col shadow-none",
      )}>
        <div className="shrink-0 border-b border-border/70 bg-card px-3.5 py-3 dark:border-white/8 dark:bg-[#111315]">
          <div className="flex items-start justify-between gap-4">
            <CollapsibleTrigger className="min-w-0 flex-1 text-left">
              {open ? expandedHeaderSummary : collapsedHeaderSummary}
            </CollapsibleTrigger>
            {actionControls}
          </div>
        </div>
        <div
          className={cn(
            COLLAPSIBLE_PANEL_TRANSITION_CLASS,
            open ? COLLAPSIBLE_PANEL_OPEN_CLASS : COLLAPSIBLE_PANEL_CLOSED_CLASS,
            shouldFillAvailable && "min-h-0 flex-1",
          )}
          aria-hidden={!open}
        >
          <div className={cn("min-h-0 overflow-hidden", shouldFillAvailable && "flex flex-1 flex-col")}>
            {showWorkerError ? (
              <div className="shrink-0 border-b border-border/70 bg-destructive/8 px-4 py-3 dark:border-white/8 dark:bg-[#151012]">
                <div className="text-[11px] text-muted-foreground dark:text-zinc-500">Error</div>
                <div className="mt-1 break-all text-[12px] leading-[1.55] text-foreground dark:text-zinc-300">{agent.lastError}</div>
              </div>
            ) : null}
            <div className={cn("relative w-full bg-muted/20 p-2 dark:bg-[#0b0c0e]", terminalHeightClass, shouldFillAvailable && "min-h-0 flex-1")}>
              <Terminal
                agent={agent}
                userMessages={userMessages}
                projectRoot={projectRoot}
                onOpenProjectFile={(file) => sideWindowManager.openFile(file)}
                hasMoreHistory={hasOmittedWorkerHistory(agent)}
                onRequestMoreHistory={onLoadWorkerHistory}
                showTextSizeControl={false}
              />
            </div>
          </div>
        </div>
        {open ? (
          <WorkerExpandedFooter
            workerId={workerId}
            displayId={displayId}
            runtimeDurationLabel={runtimeDurationLabel}
            activeModel={activeModel}
            activeEffort={activeEffort}
            state={agent.state}
            stateLabel={stateLabel}
            contextFullnessPercent={agent.contextUsage?.fullnessPercent}
            processes={terminalProcesses}
            onStopTerminalProcess={showStopWorker ? onStopTerminalProcess : undefined}
            stoppingTerminalProcessId={stoppingTerminalProcessId}
          />
        ) : null}
      </div>
    </Collapsible>
  );
}
