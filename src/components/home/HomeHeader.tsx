import { useCallback, type Dispatch, type SetStateAction } from "react";
import { AlertTriangle, GitCommitHorizontal, Menu, PanelRight, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PRODUCT_NAME } from "@/app/home/constants";
import type { AgentSnapshot, MessageRecord, RunRecord, SidebarGroup, SidebarRun, SupervisorInterventionRecord } from "@/app/home/types";
import type { ConversationWorkerRecord } from "@/lib/conversation-workers";
import type { WorkerTerminalProcess } from "@/lib/worker-terminal-processes";
import { ConversationSidebar } from "./ConversationSidebar";
import { ThemeModeToggle, WorkersSidebar } from "./WorkersSidebar";

interface HomeHeaderProps {
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
  filteredProjects: SidebarGroup[];
  isHydratingConversations: boolean;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  selectedRunId: string | null;
  messages: MessageRecord[];
  readMarkers: Record<string, string>;
  collapsedProjectPaths: Set<string>;
  onProjectOpenChange: (projectPath: string, open: boolean) => void;
  setShowSettings: Dispatch<SetStateAction<boolean>>;
  openFolderPicker: () => void;
  startNewPlan: () => void;
  beginConversationInProject: (projectPath: string) => void;
  autoCommitProject: (projectPath: string) => void;
  isAutoCommitProjectPending: boolean;
  handleRemoveProject: (pathToRemove: string) => void;
  selectRun: (runId: string) => void;
  renamingRunId: string | null;
  renameValue: string;
  renameSource: "sidebar" | "topbar" | null;
  setRenameValue: (value: string) => void;
  startRenamingRun: (run: SidebarRun) => void;
  commitRenamingRun: (runId: string) => void;
  cancelRenamingRun: () => void;
  deleteRun: (run: SidebarRun) => void;
  authEnabled: boolean;
  openPairDeviceDialog: () => void;
  logout: () => void;
  activeConversationCwd: string | null;
  selectedRun: RunRecord | null;
  isImplementationConversation: boolean;
  themeMode: "day" | "night";
  setThemeMode: Dispatch<SetStateAction<"day" | "night">>;
  rightSidebarOpen: boolean;
  setRightSidebarOpen: (open: boolean) => void;
  mobileWorkersOpen: boolean;
  setMobileWorkersOpen: (open: boolean) => void;
  selectedRunWorkers: ConversationWorkerRecord[];
  conversationAgents: AgentSnapshot[];
  supervisorInterventions: SupervisorInterventionRecord[];
  onAutoCommitChat: () => void;
  isAutoCommitChatPending: boolean;
  onStopWorker?: (workerId: string) => void;
  onStopTerminalProcess?: (workerId: string, terminalProcess: WorkerTerminalProcess) => void;
  onLoadWorkerHistory?: (workerId: string) => void;
  stoppingWorkerId?: string | null;
  stoppingTerminalProcess?: { workerId: string; terminalProcessId: string } | null;
}

export function HomeHeader({
  mobileNavOpen,
  setMobileNavOpen,
  filteredProjects,
  isHydratingConversations,
  searchQuery,
  setSearchQuery,
  selectedRunId,
  messages,
  readMarkers,
  collapsedProjectPaths,
  onProjectOpenChange,
  setShowSettings,
  openFolderPicker,
  startNewPlan,
  beginConversationInProject,
  autoCommitProject,
  isAutoCommitProjectPending,
  handleRemoveProject,
  selectRun,
  renamingRunId,
  renameValue,
  renameSource,
  setRenameValue,
  startRenamingRun,
  commitRenamingRun,
  cancelRenamingRun,
  deleteRun,
  authEnabled,
  openPairDeviceDialog,
  logout,
  activeConversationCwd,
  selectedRun,
  isImplementationConversation,
  themeMode,
  setThemeMode,
  rightSidebarOpen,
  setRightSidebarOpen,
  mobileWorkersOpen,
  setMobileWorkersOpen,
  selectedRunWorkers,
  conversationAgents,
  supervisorInterventions,
  onAutoCommitChat,
  isAutoCommitChatPending,
  onStopWorker,
  onStopTerminalProcess,
  onLoadWorkerHistory,
  stoppingWorkerId,
  stoppingTerminalProcess,
}: HomeHeaderProps) {
  const conversationTitle = selectedRun?.title?.trim() || "New conversation";
  const titleLabel = selectedRun ? conversationTitle : "";
  const isEditingTitle = Boolean(selectedRun && renamingRunId === selectedRun.id && renameSource === "topbar");
  const rootFolderLabel = activeConversationCwd
    ? activeConversationCwd.split(/[\\/]/).filter(Boolean).pop() || activeConversationCwd
    : "";

  const beginTopBarTitleEdit = () => {
    if (!selectedRun) {
      return;
    }

    startRenamingRun({
      id: selectedRun.id,
      title: conversationTitle,
      path: activeConversationCwd || selectedRun.projectPath || "",
      status: selectedRun.status,
      createdAt: selectedRun.createdAt,
    });
  };

  const focusTitleInput = useCallback((node: HTMLInputElement | null) => {
    if (!node || !isEditingTitle) {
      return;
    }

    node.focus();
    node.select();
  }, [isEditingTitle]);

  return (
  <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border/50 px-3 sm:px-4">
    <div className="flex min-w-0 items-center gap-2 sm:gap-3">
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <Button variant="ghost" size="icon" className="h-8 w-8 lg:hidden" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}>
          <Menu className="h-4 w-4" />
        </Button>
        <SheetContent side="left" className="w-[min(22rem,calc(100vw-1rem))] p-0 lg:hidden" showCloseButton={false}>
          <SheetHeader className="border-b border-border/60">
            <SheetTitle>{PRODUCT_NAME}</SheetTitle>
          </SheetHeader>
          <ConversationSidebar
            filteredProjects={filteredProjects as SidebarGroup[]}
            isHydratingConversations={isHydratingConversations}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedRunId={selectedRunId}
            messages={messages}
            readMarkers={readMarkers}
            collapsedProjectPaths={collapsedProjectPaths}
            onProjectOpenChange={onProjectOpenChange}
            setShowSettings={setShowSettings}
            openFolderPicker={openFolderPicker}
            startNewPlan={startNewPlan}
            beginConversationInProject={beginConversationInProject}
            autoCommitProject={autoCommitProject}
            isAutoCommitProjectPending={isAutoCommitProjectPending}
            handleRemoveProject={handleRemoveProject}
            selectRun={selectRun}
            renamingRunId={renamingRunId}
            renameValue={renameValue}
            renameSource={renameSource}
            setRenameValue={setRenameValue}
            startRenamingRun={startRenamingRun}
            commitRenamingRun={commitRenamingRun}
            cancelRenamingRun={cancelRenamingRun}
            deleteRun={deleteRun}
            authEnabled={authEnabled}
            openPairDeviceDialog={openPairDeviceDialog}
            logout={logout}
          />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 items-center gap-2">
        {titleLabel || rootFolderLabel ? (
          <div className="flex min-w-0 items-baseline gap-2">
            {titleLabel && selectedRun ? (
              isEditingTitle ? (
                <Input
                  ref={focusTitleInput}
                  aria-label="Edit conversation title"
                  value={renameValue}
                  onChange={(event) => setRenameValue(event.target.value)}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commitRenamingRun(selectedRun.id);
                    } else if (event.key === "Escape") {
                      event.preventDefault();
                      cancelRenamingRun();
                    }
                  }}
                  className="h-8 w-[18rem] max-w-[calc(100vw-10rem)] rounded-md border-border/70 bg-background px-2 text-sm font-semibold sm:w-[26rem]"
                />
              ) : (
                <div className="group/title flex min-w-0 items-center gap-1.5">
                  <button
                    type="button"
                    aria-label="Conversation title"
                    title={`${titleLabel} — tap to rename`}
                    className="min-w-0 truncate rounded-sm px-1 text-left text-sm font-semibold text-foreground lg:hidden"
                    onClick={beginTopBarTitleEdit}
                  >
                    {titleLabel}
                  </button>
                  <span
                    aria-label="Conversation title"
                    className="hidden min-w-0 max-w-[26rem] truncate px-1 text-sm font-semibold text-foreground lg:block"
                    title={titleLabel}
                  >
                    {titleLabel}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Edit conversation title"
                    title="Edit conversation title"
                    className="pointer-events-none hidden h-7 w-7 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:pointer-events-auto focus-visible:opacity-100 group-hover/title:pointer-events-auto group-hover/title:opacity-100 lg:inline-flex"
                    onClick={beginTopBarTitleEdit}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )
            ) : null}
            {rootFolderLabel ? (
              <span
                aria-label="Root repository folder"
                className="max-w-[10rem] shrink-0 truncate font-mono text-[10px] text-muted-foreground"
                title={activeConversationCwd || rootFolderLabel}
              >
                {rootFolderLabel}
              </span>
            ) : null}
          </div>
        ) : null}
        {selectedRun?.status === "failed" ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive">
            <AlertTriangle className="h-3 w-3" /> Failed
          </span>
        ) : null}
        {selectedRun?.status === "cancelling" ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
            Cancelling
          </span>
        ) : null}
      </div>
    </div>

    <div className="flex items-center gap-2">
      {selectedRunId ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
          aria-label="Auto Commit Chat"
          title="Create a git commit for this chat"
          onClick={onAutoCommitChat}
          disabled={isAutoCommitChatPending}
        >
          <GitCommitHorizontal className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Auto Commit Chat</span>
        </Button>
      ) : null}
      <ThemeModeToggle themeMode={themeMode} setThemeMode={setThemeMode} />
      {selectedRunId && isImplementationConversation ? (
        <Button variant="ghost" size="icon" className="hidden h-8 w-8 text-muted-foreground hover:text-foreground lg:inline-flex" title="Toggle Conversation Workers" onClick={() => setRightSidebarOpen(!rightSidebarOpen)}>
          <PanelRight className="h-4 w-4" />
        </Button>
      ) : null}
      <Sheet open={mobileWorkersOpen} onOpenChange={setMobileWorkersOpen}>
        <Button variant="ghost" size="icon" className="h-8 w-8 lg:hidden" aria-label="Open workers" onClick={() => setMobileWorkersOpen(true)}>
          <PanelRight className="h-4 w-4" />
        </Button>
        <SheetContent side="right" className="w-[min(22rem,calc(100vw-1rem))] p-0 lg:hidden" showCloseButton={false}>
          <SheetHeader className="border-b border-border/60">
            <SheetTitle>Workers</SheetTitle>
          </SheetHeader>
          <WorkersSidebar
            workers={selectedRunId && isImplementationConversation ? selectedRunWorkers : []}
            agents={selectedRunId && isImplementationConversation ? conversationAgents : []}
            supervisorInterventions={selectedRunId && isImplementationConversation ? supervisorInterventions : []}
            preferredModel={selectedRun?.preferredWorkerModel ?? null}
            preferredEffort={selectedRun?.preferredWorkerEffort ?? null}
            onStopWorker={onStopWorker}
            onStopTerminalProcess={onStopTerminalProcess}
            onLoadWorkerHistory={onLoadWorkerHistory}
            stoppingWorkerId={stoppingWorkerId}
            stoppingTerminalProcess={stoppingTerminalProcess}
            onClose={() => setMobileWorkersOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </div>
  </header>
  );
}
