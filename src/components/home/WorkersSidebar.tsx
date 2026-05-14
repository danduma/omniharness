import { useMemo } from "react";
import { Cpu, PanelRightClose, Terminal as TerminalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { WorkerCard } from "@/components/WorkerCard";
import { workersSidebarManager } from "@/components/component-state-managers";
import { WORKER_OPTIONS } from "@/app/home/constants";
import type { AgentSnapshot, SupervisorInterventionRecord } from "@/app/home/types";
import { buildWorkerLists, getWorkerRuntimeLabel, type ConversationWorkerRecord } from "@/lib/conversation-workers";
import { buildWorkerTerminalUserMessages } from "@/lib/worker-terminal-messages";
import { cn } from "@/lib/utils";
import { useManagerSnapshot } from "@/lib/use-manager-snapshot";
import type { WorkerTerminalProcess } from "@/lib/worker-terminal-processes";
import { t, useI18nSnapshot } from "@/lib/i18n";

export interface WorkersSidebarProps {
  workers: ConversationWorkerRecord[];
  agents: AgentSnapshot[];
  supervisorInterventions: SupervisorInterventionRecord[];
  preferredModel: string | null;
  preferredEffort: string | null;
  projectRoot?: string | null;
  onStopWorker?: (workerId: string) => void;
  onStopTerminalProcess?: (workerId: string, terminalProcess: WorkerTerminalProcess) => void;
  onLoadWorkerHistory?: (workerId: string) => void;
  stoppingWorkerId?: string | null;
  stoppingTerminalProcess?: { workerId: string; terminalProcessId: string } | null;
  onClose?: () => void;
  showHeader?: boolean;
}

function formatWorkerRuntime(type: string | undefined) {
  if (!type) {
    return null;
  }

  return WORKER_OPTIONS.find((option) => option.value === type)?.label ?? type;
}

export function ConversationWorkerCard({
  worker,
  agent,
  preferredModel,
  preferredEffort,
  projectRoot,
  defaultOpen,
  terminalHeightClass,
  fillAvailable = false,
  fallbackPreview,
  supervisorInterventions = [],
  onStopWorker,
  onStopTerminalProcess,
  onLoadWorkerHistory,
  isStopping,
  stoppingTerminalProcessId,
  compact = false,
  isFocused = false,
  canFocus = false,
  onToggleFocus,
}: {
  worker: ConversationWorkerRecord;
  agent?: AgentSnapshot | null;
  preferredModel?: string | null;
  preferredEffort?: string | null;
  projectRoot?: string | null;
  defaultOpen: boolean;
  terminalHeightClass: string;
  fillAvailable?: boolean;
  fallbackPreview?: string | null;
  supervisorInterventions?: SupervisorInterventionRecord[];
  onStopWorker?: (workerId: string) => void;
  onStopTerminalProcess?: (workerId: string, terminalProcess: WorkerTerminalProcess) => void;
  onLoadWorkerHistory?: (workerId: string) => void;
  isStopping?: boolean;
  stoppingTerminalProcessId?: string | null;
  compact?: boolean;
  isFocused?: boolean;
  canFocus?: boolean;
  onToggleFocus?: () => void;
}) {
  const configuredModel = agent?.requestedModel || preferredModel || null;
  const configuredEffort = agent?.requestedEffort || preferredEffort || null;
  const activeModel = agent?.effectiveModel || configuredModel;
  const activeEffort = agent?.effectiveEffort || configuredEffort;
  const pendingPermissions = agent?.pendingPermissions ?? [];
  const runtimeLabel = formatWorkerRuntime(agent?.type || worker.type);
  const runtimeDurationLabel = getWorkerRuntimeLabel(worker);
  const fallbackAgent = useMemo(() => agent ?? {
    name: worker.id,
    type: worker.type,
    state: worker.status,
    currentText: "",
    lastText: "",
    displayText: fallbackPreview ?? "",
  }, [agent, fallbackPreview, worker.id, worker.status, worker.type]);
  const userMessages = useMemo(() => buildWorkerTerminalUserMessages({
    worker,
    agent: fallbackAgent,
    supervisorInterventions,
  }), [fallbackAgent, supervisorInterventions, worker]);

  return (
    <WorkerCard
      workerId={worker.id}
      workerNumber={worker.workerNumber ?? null}
      workerTitle={worker.title ?? null}
      agent={fallbackAgent}
      defaultOpen={defaultOpen}
      runtimeLabel={runtimeLabel}
      runtimeDurationLabel={runtimeDurationLabel}
      activeModel={activeModel}
      activeEffort={activeEffort}
      promptPreview={worker.initialPrompt}
      userMessages={userMessages}
      projectRoot={projectRoot}
      pendingPermissions={pendingPermissions}
      terminalHeightClass={terminalHeightClass}
      fillAvailable={fillAvailable}
      compact={compact}
      isFocused={isFocused}
      canFocus={canFocus}
      onToggleFocus={onToggleFocus}
      onStopWorker={onStopWorker ? () => onStopWorker(worker.id) : undefined}
      onStopTerminalProcess={onStopTerminalProcess ? (terminalProcess) => onStopTerminalProcess(worker.id, terminalProcess) : undefined}
      onLoadWorkerHistory={onLoadWorkerHistory ? () => onLoadWorkerHistory(worker.id) : undefined}
      isStopping={isStopping}
      stoppingTerminalProcessId={stoppingTerminalProcessId}
    />
  );
}

export function WorkersSidebar({ workers, agents, supervisorInterventions, preferredModel, preferredEffort, projectRoot, onStopWorker, onStopTerminalProcess, onLoadWorkerHistory, stoppingWorkerId, stoppingTerminalProcess, onClose, showHeader = true }: WorkersSidebarProps) {
  useI18nSnapshot();
  const { activeTab: requestedActiveTab, focusedWorkerId } = useManagerSnapshot(workersSidebarManager);
  const workerGroups = buildWorkerLists(workers);
  const agentsById = useMemo(
    () => new Map(agents.map((agent) => [agent.name, agent])),
    [agents],
  );

  const activeTab = requestedActiveTab === "active" && workerGroups.active.length === 0 && workerGroups.finished.length > 0
    ? "finished"
    : requestedActiveTab === "finished" && workerGroups.finished.length === 0 && workerGroups.active.length > 0
      ? "active"
      : requestedActiveTab;
  const visibleWorkers = activeTab === "active" ? workerGroups.active : workerGroups.finished;
  const hasSingleVisibleWorker = visibleWorkers.length === 1;
  const focusedWorkerVisible = Boolean(focusedWorkerId && visibleWorkers.some((worker) => worker.id === focusedWorkerId));
  const isFocusMode = visibleWorkers.length > 1 && focusedWorkerVisible;
  const focusedWorker = isFocusMode ? visibleWorkers.find((worker) => worker.id === focusedWorkerId) ?? null : null;
  const renderWorkerCard = (worker: ConversationWorkerRecord, options: { compact?: boolean; isFocused?: boolean } = {}) => {
    const agent = agentsById.get(worker.id) ?? {
      name: worker.id,
      type: worker.type,
      state: worker.status,
      currentText: "",
      lastText: "",
    };
    const isFocusedWorker = Boolean(options.isFocused);
    const isCompactWorker = Boolean(options.compact);
    const terminalHeightClass = hasSingleVisibleWorker || isFocusedWorker ? "h-full min-h-[24rem]" : "h-44";

    return (
      <ConversationWorkerCard
        key={`${activeTab}-${worker.id}`}
        worker={worker}
        agent={agent}
        preferredModel={preferredModel}
        preferredEffort={preferredEffort}
        projectRoot={projectRoot}
        supervisorInterventions={supervisorInterventions}
        defaultOpen={isFocusedWorker || activeTab === "active" || hasSingleVisibleWorker}
        terminalHeightClass={terminalHeightClass}
        fillAvailable={hasSingleVisibleWorker || isFocusedWorker}
        compact={isCompactWorker}
        isFocused={isFocusedWorker}
        canFocus={visibleWorkers.length > 1}
        onToggleFocus={() => workersSidebarManager.toggleFocusedWorker(worker.id)}
        onStopWorker={onStopWorker}
        onStopTerminalProcess={onStopTerminalProcess}
        onLoadWorkerHistory={onLoadWorkerHistory}
        isStopping={stoppingWorkerId === worker.id}
        stoppingTerminalProcessId={stoppingTerminalProcess?.workerId === worker.id ? stoppingTerminalProcess.terminalProcessId : null}
      />
    );
  };

  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-col bg-muted/10"
      onKeyDown={(event) => {
        if (event.key === "Escape" && isFocusMode) {
          workersSidebarManager.setFocusedWorker(null);
        }
      }}
    >
      {showHeader ? (
      <div className="flex items-center justify-between border-b px-3 py-2.5">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Cpu className="h-4 w-4" /> {t("side.window.workersTabAria")}
        </h3>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground transition-all duration-150 ease-out hover:text-foreground motion-reduce:transition-none"
            aria-label={t("workers.sidebar.collapseAria")}
            title={t("workers.sidebar.collapseAria")}
            onClick={onClose}
          >
            <PanelRightClose className="h-4 w-4 transition-transform duration-150 ease-out group-hover/button:translate-x-0.5 motion-reduce:transition-none" />
          </Button>
        )}
      </div>
      ) : null}
      <div className="border-b border-border/60 px-3 py-2">
        <div className="inline-flex rounded-lg border border-border/60 bg-muted/30 p-0.5">
          <button
            type="button"
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
              activeTab === "active"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => workersSidebarManager.setActiveTab("active")}
          >
            Active ({workerGroups.active.length})
          </button>
          <button
            type="button"
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
              activeTab === "finished"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => workersSidebarManager.setActiveTab("finished")}
          >
            Finished ({workerGroups.finished.length})
          </button>
        </div>
      </div>
      {isFocusMode && focusedWorker ? (
        <div className="min-h-0 flex-1 p-3">
          <div className="h-full min-h-0">
            {renderWorkerCard(focusedWorker, { isFocused: true })}
          </div>
        </div>
      ) : (
        <ScrollArea className="min-h-0 flex-1 p-3">
          <div className={cn(
            hasSingleVisibleWorker ? "flex h-full min-h-full flex-col" : visibleWorkers.length > 0 ? "space-y-4" : "flex h-full min-h-full flex-col",
          )}>
            {visibleWorkers.length > 0 ? (
              visibleWorkers.map((worker) => renderWorkerCard(worker))
            ) : (
              <div className="flex h-full min-h-[16rem] flex-1 flex-col items-center justify-center rounded-md border border-dashed bg-transparent text-xs text-muted-foreground">
                <TerminalIcon className="mb-2 h-6 w-6 opacity-30" />
                {activeTab === "active" ? "No active workers for this conversation." : "No finished workers for this conversation."}
              </div>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
