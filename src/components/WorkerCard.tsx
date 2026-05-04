"use client";

import { useEffect, useMemo, useRef } from "react";
import { AlertTriangle, Bot, ChevronDown, Clock, Cpu, Square } from "lucide-react";
import { Terminal, type AgentTerminalPayload, type TerminalUserMessage } from "@/components/Terminal";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { workerCardManager } from "@/components/component-state-managers";
import { isWorkerActiveStatus } from "@/lib/conversation-workers";
import { cn } from "@/lib/utils";
import { useManagerSnapshot } from "@/lib/use-manager-snapshot";
import {
  deriveWorkerTerminalProcesses,
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
  pendingPermissions: PendingPermissionRecord[];
  terminalHeightClass: string;
  fillAvailable?: boolean;
  onStopWorker?: () => void;
  isStopping?: boolean;
};

function renderContextMeter(fullnessPercent: number | null | undefined) {
  const normalized = typeof fullnessPercent === "number" && Number.isFinite(fullnessPercent)
    ? Math.min(100, Math.max(0, Math.round(fullnessPercent)))
    : null;
  const meterTone = normalized === null
    ? "rgba(244,244,245,0.18)"
    : normalized >= 85
      ? "rgba(248,113,113,0.9)"
      : normalized >= 60
        ? "rgba(245,158,11,0.82)"
        : "rgba(226,232,240,0.78)";
  const meterFill = normalized === null ? 0 : normalized;

  return (
    <div
      aria-label={normalized === null ? "Context usage not reported" : `Context usage ${normalized}%`}
      className="relative h-4 w-4 shrink-0 rounded-full border border-white/10 bg-white/[0.03]"
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{ background: `conic-gradient(${meterTone} ${meterFill}%, rgba(255,255,255,0.07) ${meterFill}% 100%)` }}
      />
      <div className="absolute inset-[1.5px] rounded-full bg-[#111315]" />
    </div>
  );
}

function formatContextAvailability(fullnessPercent: number | null | undefined) {
  if (typeof fullnessPercent !== "number" || !Number.isFinite(fullnessPercent)) {
    return null;
  }

  const normalized = Math.max(0, Math.min(100, Math.round(fullnessPercent)));
  return `Context usage ${normalized}%`;
}

function formatWorkerStateLabel(state: string) {
  return state.replace(/[_-]+/g, " ");
}

function formatTerminalProcessStatus(status: WorkerTerminalProcess["status"]) {
  return status
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function terminalProcessStatusClass(process: WorkerTerminalProcess) {
  if (process.active) {
    return "bg-emerald-300";
  }

  if (process.status === "failed" || process.status === "error" || process.status === "cancelled") {
    return "bg-red-300";
  }

  return "bg-zinc-500";
}

function TerminalProcessSummary({ processes }: { processes: WorkerTerminalProcess[] }) {
  if (processes.length === 0) {
    return null;
  }

  const visibleProcesses = processes.slice(0, 3);
  const activeProcessCount = processes.filter((process) => process.active).length;

  return (
    <div className="shrink-0 border-b border-white/8 bg-[#0e1012] px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-[11px] font-medium text-zinc-200">Terminal Processes</div>
        <div className="text-[10px] font-medium uppercase tracking-normal text-zinc-500">
          {activeProcessCount > 0 ? `${activeProcessCount} active` : "Recent"}
        </div>
      </div>
      <div className="space-y-2">
        {visibleProcesses.map((terminalProcess) => (
          <div key={terminalProcess.id} className="min-w-0 text-[11px] leading-5">
            <div className="flex min-w-0 items-center gap-2">
              <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", terminalProcessStatusClass(terminalProcess))} />
              <span className="shrink-0 font-medium text-zinc-400">{formatTerminalProcessStatus(terminalProcess.status)}</span>
              <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-zinc-200" title={terminalProcess.command}>
                {terminalProcess.command}
              </code>
            </div>
            {terminalProcess.outputTail ? (
              <div className="line-clamp-2 pl-3.5 font-mono text-[10px] leading-4 text-zinc-500" title={terminalProcess.outputTail}>
                {terminalProcess.outputTail}
              </div>
            ) : null}
          </div>
        ))}
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
        className="group relative flex h-8 w-8 items-center justify-center rounded-full border border-amber-200/12 bg-amber-50/[0.04] text-amber-100/85 transition-colors hover:bg-amber-50/[0.08]"
        onClick={() => workerCardManager.togglePermission(workerId)}
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        {!open ? (
          <div className="pointer-events-none absolute right-0 top-10 hidden min-w-max rounded-full border border-white/10 bg-[#181513] px-2.5 py-1 text-[10px] font-medium text-zinc-200 shadow-lg group-hover:block">
            Permissions waiting
          </div>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 top-10 z-30 w-80 rounded-2xl border border-white/10 bg-[#131517] p-3.5 shadow-[0_22px_70px_rgba(0,0,0,0.45)] backdrop-blur">
          <div className="mb-2 text-[11px] font-medium text-zinc-100">Permissions waiting</div>
          <div className="space-y-2">
            {pendingPermissions.map((permission) => (
              <div key={permission.requestId} className="rounded-xl border border-white/8 bg-white/[0.03] p-2.5 text-[11px] text-zinc-200">
                <div className="font-medium text-zinc-100">Request {permission.requestId}</div>
                <div className="mt-1 text-zinc-500">{permission.requestedAt}</div>
                {permission.options?.length ? (
                  <div className="mt-2 space-y-1">
                    {permission.options.map((option) => (
                      <div key={option.optionId} className="rounded-lg bg-white/[0.04] px-2 py-1.5">
                        <span className="font-medium text-zinc-100">{option.kind}</span>
                        <span className="text-zinc-400"> {option.name}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 text-zinc-400">No option details available yet.</div>
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
  pendingPermissions,
  terminalHeightClass,
  fillAvailable = false,
  onStopWorker,
  isStopping,
}: WorkerCardProps) {
  const { openByWorkerId } = useManagerSnapshot(workerCardManager);
  const open = openByWorkerId[workerId] ?? defaultOpen;
  const contextLabel = formatContextAvailability(agent.contextUsage?.fullnessPercent);
  const promptPreviewText = promptPreview?.trim() ?? "";
  const stateLabel = formatWorkerStateLabel(agent.state);
  const showPromptPreview = promptPreviewText.length > 0;
  const showStopWorker = Boolean(onStopWorker) && isWorkerActiveStatus(agent.state);
  const shouldFillAvailable = fillAvailable && open;
  const terminalProcesses = useMemo(() => deriveWorkerTerminalProcesses(agent.outputEntries), [agent.outputEntries]);

  const displayId = useMemo(() => {
    const normalizedTitle = workerTitle?.trim();
    if (normalizedTitle) {
      return normalizedTitle;
    }

    if (typeof workerNumber === "number" && Number.isFinite(workerNumber)) {
      return `Worker ${workerNumber}`;
    }

    const match = workerId.match(/-worker-(\d+)$/);
    return match ? `Worker ${match[1]}` : workerId;
  }, [workerId, workerNumber, workerTitle]);

  return (
    <Collapsible open={open} onOpenChange={(nextOpen) => workerCardManager.setOpen(workerId, nextOpen)} className={cn(shouldFillAvailable && "flex h-full min-h-0 flex-col")}>
      <div className={cn(
        "overflow-hidden rounded-[18px] border border-white/8 bg-[#111315] text-zinc-100 shadow-[0_20px_60px_rgba(0,0,0,0.24)]",
        shouldFillAvailable && "flex min-h-0 flex-1 flex-col rounded-none border-x-0 border-b-0 shadow-none",
      )}>
        <div className="shrink-0 border-b border-white/8 bg-[#111315] px-3.5 py-3">
          <div className="flex items-start justify-between gap-4">
            <CollapsibleTrigger className="min-w-0 flex-1 text-left">
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  <div className="break-words text-[12px] font-medium text-zinc-100" title={workerId}>
                    {displayId}
                  </div>
                  <div className="inline-flex min-w-0 items-center gap-1.5 text-[11px] text-zinc-400">
                    <Bot className="h-3.5 w-3.5 text-zinc-500" />
                    <span className="truncate" title={runtimeLabel || "Unknown"}>{runtimeLabel || "Unknown"}</span>
                  </div>
                  <div className="inline-flex min-w-0 items-center gap-1.5 text-[11px] text-zinc-400">
                    <Cpu className="h-3.5 w-3.5 text-zinc-500" />
                    <span className="truncate" title={activeModel || "Default"}>{activeModel || "Default"}</span>
                  </div>
                  {activeEffort ? <span className="text-[11px] text-zinc-500">{activeEffort} effort</span> : null}
                  {contextLabel ? (
                    <Tooltip>
                      <TooltipTrigger
                        closeOnClick={false}
                        onClick={(event) => event.stopPropagation()}
                        render={<span className="inline-flex items-center" />}
                      >
                        {renderContextMeter(agent.contextUsage?.fullnessPercent)}
                      </TooltipTrigger>
                      <TooltipContent side="bottom" align="center" sideOffset={8}>
                        {contextLabel}
                      </TooltipContent>
                    </Tooltip>
                  ) : null}
                  {runtimeDurationLabel ? (
                    <div className="inline-flex min-w-0 items-center gap-1.5 text-[11px] text-zinc-400">
                      <Clock className="h-3.5 w-3.5 text-zinc-500" />
                      <span className="truncate" title={runtimeDurationLabel}>{runtimeDurationLabel}</span>
                    </div>
                  ) : null}
                </div>
                {showPromptPreview ? (
                  <Tooltip>
                    <TooltipTrigger
                      closeOnClick={false}
                      render={<span className="block w-fit max-w-full" />}
                    >
                      <span className="line-clamp-2 text-[11px] leading-[1.35] text-zinc-500">
                        {promptPreviewText}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent
                      side="bottom"
                      align="start"
                      sideOffset={8}
                      className="block max-h-72 max-w-[min(34rem,calc(100vw-3rem))] overflow-auto rounded-lg border border-white/10 bg-[#181a1d] p-3 text-left text-[11px] leading-[1.5] text-zinc-200 shadow-[0_18px_60px_rgba(0,0,0,0.42)]"
                    >
                      {promptPreviewText}
                    </TooltipContent>
                  </Tooltip>
                ) : null}
              </div>
            </CollapsibleTrigger>
            <div className="flex shrink-0 items-start gap-2.5">
              <div className="inline-flex items-center gap-2 text-[11px] font-medium text-zinc-400">
                <span className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  isWorkerActiveStatus(agent.state) ? "bg-emerald-300" : "bg-zinc-500",
                )} />
                <span className="capitalize">{stateLabel}</span>
              </div>
              {pendingPermissions.length > 0 ? <PermissionWarning workerId={workerId} pendingPermissions={pendingPermissions} /> : null}
              {showStopWorker ? (
                <button
                  type="button"
                  aria-label={`Stop ${displayId}`}
                  title={`Stop ${displayId}`}
                  disabled={isStopping}
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-red-300/15 bg-red-400/[0.06] text-red-100/85 transition-colors hover:bg-red-400/[0.12] disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onStopWorker?.();
                  }}
                >
                  <Square className="h-3 w-3 fill-current" />
                </button>
              ) : null}
              <CollapsibleTrigger
                className="flex h-6 w-6 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-zinc-300"
                aria-label={open ? `Collapse ${displayId}` : `Expand ${displayId}`}
              >
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
              </CollapsibleTrigger>
            </div>
          </div>
        </div>
        <CollapsibleContent className={cn(shouldFillAvailable && "flex min-h-0 flex-1 flex-col")}>
          {agent.lastError ? (
            <div className="shrink-0 border-b border-white/8 bg-[#151012] px-4 py-3">
              <div className="text-[11px] text-zinc-500">Error</div>
              <div className="mt-1 break-all text-[12px] leading-[1.55] text-zinc-300">{agent.lastError}</div>
            </div>
          ) : null}
          <TerminalProcessSummary processes={terminalProcesses} />
          <div className={cn("relative w-full bg-[#0b0c0e]", terminalHeightClass, shouldFillAvailable && "min-h-0 flex-1")}>
            <Terminal agent={agent} userMessages={userMessages} />
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
