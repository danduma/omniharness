import type React from "react";
import { AlertTriangle, Menu, PanelRight, RotateCcw, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { AgentSnapshot, MessageRecord, RunRecord, SidebarGroup, SidebarRun } from "@/app/home/types";
import type { ConversationWorkerRecord } from "@/lib/conversation-workers";
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
  setShowSettings: React.Dispatch<React.SetStateAction<boolean>>;
  openFolderPicker: () => void;
  startNewPlan: () => void;
  beginConversationInProject: (projectPath: string) => void;
  handleRemoveProject: (pathToRemove: string) => void;
  selectRun: (runId: string) => void;
  renamingRunId: string | null;
  renameValue: string;
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
  showRecoverableRunningState: boolean;
  hasStuckWorker: boolean;
  latestUserCheckpoint: MessageRecord | null;
  handleRetryMessage: (messageId: string) => void;
  recoverRun: { isPending: boolean };
  themeMode: "day" | "night";
  setThemeMode: React.Dispatch<React.SetStateAction<"day" | "night">>;
  rightSidebarOpen: boolean;
  setRightSidebarOpen: (open: boolean) => void;
  mobileWorkersOpen: boolean;
  setMobileWorkersOpen: (open: boolean) => void;
  selectedRunWorkers: ConversationWorkerRecord[];
  conversationAgents: AgentSnapshot[];
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
  setShowSettings,
  openFolderPicker,
  startNewPlan,
  beginConversationInProject,
  handleRemoveProject,
  selectRun,
  renamingRunId,
  renameValue,
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
  showRecoverableRunningState,
  hasStuckWorker,
  latestUserCheckpoint,
  handleRetryMessage,
  recoverRun,
  themeMode,
  setThemeMode,
  rightSidebarOpen,
  setRightSidebarOpen,
  mobileWorkersOpen,
  setMobileWorkersOpen,
  selectedRunWorkers,
  conversationAgents,
}: HomeHeaderProps) {
  return (
  <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border/50 px-3 sm:px-4">
    <div className="flex min-w-0 items-center gap-2 sm:gap-3">
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <Button variant="ghost" size="icon" className="h-8 w-8 lg:hidden" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}>
          <Menu className="h-4 w-4" />
        </Button>
        <SheetContent side="left" className="w-[min(22rem,calc(100vw-1rem))] p-0 lg:hidden" showCloseButton={false}>
          <SheetHeader className="border-b border-border/60">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <ConversationSidebar
            filteredProjects={filteredProjects as SidebarGroup[]}
            isHydratingConversations={isHydratingConversations}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedRunId={selectedRunId}
            messages={messages}
            readMarkers={readMarkers}
            setShowSettings={setShowSettings}
            openFolderPicker={openFolderPicker}
            startNewPlan={startNewPlan}
            beginConversationInProject={beginConversationInProject}
            handleRemoveProject={handleRemoveProject}
            selectRun={selectRun}
            renamingRunId={renamingRunId}
            renameValue={renameValue}
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
        <span
          aria-label="Current working directory"
          className="max-w-[24rem] truncate font-mono text-[11px] text-muted-foreground"
          title={activeConversationCwd || "No working directory"}
        >
          {activeConversationCwd || "No working directory"}
        </span>
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
      {authEnabled ? (
        <Button variant="outline" size="sm" className="h-8" onClick={openPairDeviceDialog}>
          <Smartphone className="mr-2 h-4 w-4" /> Connect Phone
        </Button>
      ) : null}
      {isImplementationConversation && (selectedRun?.status === "failed" || showRecoverableRunningState || hasStuckWorker) && latestUserCheckpoint ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleRetryMessage(latestUserCheckpoint.id)}
          disabled={recoverRun.isPending}
        >
          <RotateCcw className="mr-2 h-4 w-4" /> {selectedRun?.status === "failed" ? "Retry latest" : "Unstick latest"}
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
            preferredModel={selectedRun?.preferredWorkerModel ?? null}
            preferredEffort={selectedRun?.preferredWorkerEffort ?? null}
            onClose={() => setMobileWorkersOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </div>
  </header>
  );
}
