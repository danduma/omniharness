import { useMemo } from "react";
import { Cpu, Moon, Sun, Terminal as TerminalIcon, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { WorkerCard } from "@/components/WorkerCard";
import type { TerminalUserMessage } from "@/components/Terminal";
import { workersSidebarManager } from "@/components/component-state-managers";
import { WORKER_OPTIONS } from "@/app/home/constants";
import type { AgentSnapshot, SupervisorInterventionRecord } from "@/app/home/types";
import { buildWorkerLists, getWorkerRuntimeLabel, type ConversationWorkerRecord } from "@/lib/conversation-workers";
import { cn } from "@/lib/utils";
import { useManagerSnapshot } from "@/lib/use-manager-snapshot";

export interface WorkersSidebarProps {
  workers: ConversationWorkerRecord[];
  agents: AgentSnapshot[];
  supervisorInterventions: SupervisorInterventionRecord[];
  preferredModel: string | null;
  preferredEffort: string | null;
  onStopWorker?: (workerId: string) => void;
  stoppingWorkerId?: string | null;
  onClose?: () => void;
}

interface ThemeModeToggleProps {
  themeMode: "day" | "night";
  setThemeMode: React.Dispatch<React.SetStateAction<"day" | "night">>;
}

export function ThemeModeToggle({ themeMode, setThemeMode }: ThemeModeToggleProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8 text-muted-foreground hover:text-foreground"
      aria-label={themeMode === "night" ? "Switch to day mode" : "Switch to night mode"}
      title={themeMode === "night" ? "Switch to day mode" : "Switch to night mode"}
      onClick={() => setThemeMode((current) => (current === "day" ? "night" : "day"))}
    >
      {themeMode === "night" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
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
  defaultOpen,
  terminalHeightClass,
  fillAvailable = false,
  fallbackPreview,
  supervisorInterventions = [],
  onStopWorker,
  isStopping,
}: {
  worker: ConversationWorkerRecord;
  agent?: AgentSnapshot | null;
  preferredModel?: string | null;
  preferredEffort?: string | null;
  defaultOpen: boolean;
  terminalHeightClass: string;
  fillAvailable?: boolean;
  fallbackPreview?: string | null;
  supervisorInterventions?: SupervisorInterventionRecord[];
  onStopWorker?: (workerId: string) => void;
  isStopping?: boolean;
}) {
  const configuredModel = agent?.requestedModel || preferredModel || null;
  const configuredEffort = agent?.requestedEffort || preferredEffort || null;
  const activeModel = agent?.effectiveModel || configuredModel;
  const activeEffort = agent?.effectiveEffort || configuredEffort;
  const pendingPermissions = agent?.pendingPermissions ?? [];
  const runtimeLabel = formatWorkerRuntime(agent?.type || worker.type);
  const runtimeDurationLabel = getWorkerRuntimeLabel(worker);
  const fallbackAgent = agent ?? {
    name: worker.id,
    type: worker.type,
    state: worker.status,
    currentText: "",
    lastText: "",
    displayText: fallbackPreview ?? "",
  };
  const userMessages = useMemo<TerminalUserMessage[]>(() => {
    const messages: TerminalUserMessage[] = [];
    const initialPrompt = worker.initialPrompt?.trim();
    if (initialPrompt) {
      messages.push({
        id: `${worker.id}:initial-prompt`,
        content: initialPrompt,
        createdAt: worker.createdAt ?? new Date(0).toISOString(),
      });
    }

    for (const intervention of supervisorInterventions) {
      if (intervention.workerId !== worker.id || !intervention.prompt.trim()) {
        continue;
      }

      messages.push({
        id: intervention.id,
        content: intervention.prompt,
        createdAt: intervention.createdAt,
      });
    }

    return messages;
  }, [supervisorInterventions, worker.createdAt, worker.id, worker.initialPrompt]);

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
      pendingPermissions={pendingPermissions}
      terminalHeightClass={terminalHeightClass}
      fillAvailable={fillAvailable}
      onStopWorker={onStopWorker ? () => onStopWorker(worker.id) : undefined}
      isStopping={isStopping}
    />
  );
}

export function WorkersSidebar({ workers, agents, supervisorInterventions, preferredModel, preferredEffort, onStopWorker, stoppingWorkerId, onClose }: WorkersSidebarProps) {
  const { activeTab: requestedActiveTab } = useManagerSnapshot(workersSidebarManager);
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

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col bg-muted/10">
      <div className="flex items-center justify-between border-b p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Cpu className="h-4 w-4" /> Conversation Workers
        </h3>
        {onClose && (
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={onClose}>
            <XCircle className="h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="border-b border-border/60 px-4 py-3">
        <div className="inline-flex rounded-xl border border-border/60 bg-muted/30 p-1">
          <button
            type="button"
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
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
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
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
      <ScrollArea className="min-h-0 flex-1 p-4">
        <div className={cn(
          hasSingleVisibleWorker ? "flex h-full min-h-full flex-col" : visibleWorkers.length > 0 ? "space-y-4" : "flex h-full min-h-full flex-col",
        )}>
          {visibleWorkers.length > 0 ? (
            visibleWorkers.map((worker) => {
              const agent = agentsById.get(worker.id) ?? {
                name: worker.id,
                type: worker.type,
                state: worker.status,
                currentText: "",
                lastText: "",
              };
              const terminalHeightClass = hasSingleVisibleWorker ? "h-full min-h-[24rem]" : "h-44";

              return (
                <ConversationWorkerCard
                  key={`${activeTab}-${worker.id}`}
                  worker={worker}
                  agent={agent}
                  preferredModel={preferredModel}
                  preferredEffort={preferredEffort}
                  supervisorInterventions={supervisorInterventions}
                  defaultOpen={activeTab === "active" || hasSingleVisibleWorker}
                  terminalHeightClass={terminalHeightClass}
                  fillAvailable={hasSingleVisibleWorker}
                  onStopWorker={onStopWorker}
                  isStopping={stoppingWorkerId === worker.id}
                />
              );
            })
          ) : (
            <div className="flex h-full min-h-[16rem] flex-1 flex-col items-center justify-center rounded-md border border-dashed bg-transparent text-xs text-muted-foreground">
              <TerminalIcon className="mb-2 h-6 w-6 opacity-30" />
              {activeTab === "active" ? "No active workers for this conversation." : "No finished workers for this conversation."}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
