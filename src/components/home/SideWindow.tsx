"use client";

import { ArrowLeft, Cpu, FileText, PanelRightClose, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sideWindowManager, type SideWindowFileTab } from "@/app/home/SideWindowManager";
import type { AgentSnapshot, SupervisorInterventionRecord } from "@/app/home/types";
import { buildWorkerLists, type ConversationWorkerRecord } from "@/lib/conversation-workers";
import { cn } from "@/lib/utils";
import { useManagerSnapshot } from "@/lib/use-manager-snapshot";
import type { WorkerTerminalProcess } from "@/lib/worker-terminal-processes";
import { FileViewerPanel } from "./FileViewerPanel";
import { WorkersSidebar } from "./WorkersSidebar";

const WORKERS_TAB_LABEL = "Conversation Workers";

export function SideWindow({
  projectRoot,
  workers,
  agents,
  supervisorInterventions,
  preferredModel,
  preferredEffort,
  onStopWorker,
  onStopTerminalProcess,
  onLoadWorkerHistory,
  stoppingWorkerId,
  stoppingTerminalProcess,
  onCloseWindow,
  closeButtonVariant = "collapse",
}: {
  projectRoot: string | null;
  workers: ConversationWorkerRecord[];
  agents: AgentSnapshot[];
  supervisorInterventions: SupervisorInterventionRecord[];
  preferredModel: string | null;
  preferredEffort: string | null;
  onStopWorker?: (workerId: string) => void;
  onStopTerminalProcess?: (workerId: string, terminalProcess: WorkerTerminalProcess) => void;
  onLoadWorkerHistory?: (workerId: string) => void;
  stoppingWorkerId?: string | null;
  stoppingTerminalProcess?: { workerId: string; terminalProcessId: string } | null;
  onCloseWindow?: () => void;
  closeButtonVariant?: "collapse" | "back";
}) {
  const { tabs, activeTabId } = useManagerSnapshot(sideWindowManager);
  const workerGroups = buildWorkerLists(workers);
  const hasConversationWorkers = workerGroups.active.length > 0 || workerGroups.finished.length > 0;
  const visibleTabs = hasConversationWorkers ? tabs : tabs.filter((tab) => tab.kind !== "workers");
  const activeTab = visibleTabs.find((tab) => tab.id === activeTabId) ?? visibleTabs[0] ?? null;
  const closeButtonLabel = closeButtonVariant === "back" ? "Back" : "Collapse workspace side window";
  const CloseButtonIcon = closeButtonVariant === "back" ? ArrowLeft : PanelRightClose;
  const closeButton = onCloseWindow ? (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
      aria-label={closeButtonLabel}
      title={closeButtonLabel}
      onClick={onCloseWindow}
    >
      <CloseButtonIcon className="h-4 w-4" />
    </Button>
  ) : null;

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-background">
      <div className="flex shrink-0 items-center gap-1 border-b border-border/70 bg-muted/25 px-2 pt-2">
        {closeButtonVariant === "back" ? closeButton : null}
        <div className="flex min-w-0 flex-1 items-end gap-1 overflow-x-auto [scrollbar-width:none]">
          {visibleTabs.map((tab) => (
            <div
              key={tab.id}
              className={cn(
                "inline-flex h-8 max-w-44 shrink-0 items-center overflow-hidden rounded-t-md border px-0 text-xs font-medium transition-colors",
                tab.id === activeTabId
                  ? "-mb-px border-foreground/15 border-b-background bg-background text-foreground shadow-sm dark:border-foreground/20 dark:border-b-background"
                  : "border-border/80 bg-muted/35 text-muted-foreground hover:border-foreground/15 hover:bg-muted/65 hover:text-foreground dark:border-foreground/10 dark:bg-muted/25 dark:hover:border-foreground/18 dark:hover:bg-muted/45",
              )}
              title={tab.kind === "file" ? tab.relativePath : tab.title}
            >
              {tab.kind === "file" ? (
                <button
                  type="button"
                  aria-label={`Close ${tab.relativePath}`}
                  title={`Close ${tab.relativePath}`}
                  className="ml-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={(event) => {
                    event.stopPropagation();
                    sideWindowManager.closeTab(tab.id);
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => sideWindowManager.selectTab(tab.id)}
                aria-label={tab.kind === "workers" ? WORKERS_TAB_LABEL : `Open ${tab.relativePath}`}
                className="inline-flex min-w-0 flex-1 items-center gap-1.5 px-2"
              >
                {tab.kind === "file" ? <FileText className="h-3.5 w-3.5 shrink-0" /> : <Cpu className="h-3.5 w-3.5 shrink-0" />}
                <span className="truncate">{tab.title}</span>
              </button>
            </div>
          ))}
        </div>
        {closeButtonVariant === "collapse" ? closeButton : null}
      </div>
      <div className="min-h-0 flex-1">
        {activeTab?.kind === "file" ? (
          <FileViewerPanel
            root={(activeTab as SideWindowFileTab).root}
            relativePath={(activeTab as SideWindowFileTab).relativePath}
            line={(activeTab as SideWindowFileTab).line}
          />
        ) : activeTab?.kind === "workers" ? (
          <WorkersSidebar
            workers={workers}
            agents={agents}
            supervisorInterventions={supervisorInterventions}
            preferredModel={preferredModel}
            preferredEffort={preferredEffort}
            projectRoot={projectRoot}
            onStopWorker={onStopWorker}
            onStopTerminalProcess={onStopTerminalProcess}
            onLoadWorkerHistory={onLoadWorkerHistory}
            stoppingWorkerId={stoppingWorkerId}
            stoppingTerminalProcess={stoppingTerminalProcess}
            showHeader={false}
          />
        ) : null}
      </div>
    </div>
  );
}
