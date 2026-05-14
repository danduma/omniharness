import { useCallback, type Dispatch, type SetStateAction } from "react";
import dynamic from "next/dynamic";
import { AlertTriangle, ChevronDown, GitCommitHorizontal, Menu, PanelLeft, PanelRight, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { OmniHarnessMark } from "@/components/OmniHarnessMark";
import { PRODUCT_NAME } from "@/app/home/constants";
import type { AgentSnapshot, MessageRecord, RunRecord, SidebarGroup, SidebarRun, SupervisorInterventionRecord } from "@/app/home/types";
import type { ConversationWorkerRecord } from "@/lib/conversation-workers";
import type { WorkerTerminalProcess } from "@/lib/worker-terminal-processes";
import { t, useI18nSnapshot } from "@/lib/i18n";
import { ConversationSidebar } from "./ConversationSidebar";
import { RunWorkspaceBadge } from "./RunWorkspaceBadge";
import { ThemeModeToggle } from "./ThemeModeToggle";

const SideWindow = dynamic(
  () => import("./SideWindow").then((m) => m.SideWindow),
  { ssr: false },
);

interface HomeHeaderProps {
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
  leftSidebarOpen: boolean;
  setLeftSidebarOpen: (open: boolean) => void;
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
  openOnboarding: () => void;
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
  archiveRun: (run: SidebarRun) => void;
  deleteRun: (run: SidebarRun) => void;
  authEnabled: boolean;
  openPairDeviceDialog: () => void;
  logout: () => void;
  activeConversationCwd: string | null;
  selectedRun: RunRecord | null;
  isImplementationConversation: boolean;
  workspaceSideWindowAvailable: boolean;
  projectRoot: string | null;
  themeMode: "day" | "night";
  setThemeMode: Dispatch<SetStateAction<"day" | "night">>;
  rightSidebarOpen: boolean;
  setRightSidebarOpen: (open: boolean) => void;
  mobileWorkersOpen: boolean;
  setMobileWorkersOpen: (open: boolean) => void;
  selectedRunWorkers: ConversationWorkerRecord[];
  conversationAgents: AgentSnapshot[];
  supervisorInterventions: SupervisorInterventionRecord[];
  onPrimaryCommit: () => void;
  onCommitNow: () => void;
  onCommitAndPushNow: () => void;
  autoCommitMilestonesEnabled: boolean;
  pushOnCommitEnabled: boolean;
  onAutoCommitMilestonesChange: (checked: boolean) => void;
  onPushOnCommitChange: (checked: boolean) => void;
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
  leftSidebarOpen,
  setLeftSidebarOpen,
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
  openOnboarding,
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
  archiveRun,
  deleteRun,
  authEnabled,
  openPairDeviceDialog,
  logout,
  activeConversationCwd,
  selectedRun,
  isImplementationConversation,
  workspaceSideWindowAvailable,
  projectRoot,
  themeMode,
  setThemeMode,
  rightSidebarOpen,
  setRightSidebarOpen,
  mobileWorkersOpen,
  setMobileWorkersOpen,
  selectedRunWorkers,
  conversationAgents,
  supervisorInterventions,
  onPrimaryCommit,
  onCommitNow,
  onCommitAndPushNow,
  autoCommitMilestonesEnabled,
  pushOnCommitEnabled,
  onAutoCommitMilestonesChange,
  onPushOnCommitChange,
  isAutoCommitChatPending,
  onStopWorker,
  onStopTerminalProcess,
  onLoadWorkerHistory,
  stoppingWorkerId,
  stoppingTerminalProcess,
}: HomeHeaderProps) {
  useI18nSnapshot();
  const conversationTitle = selectedRun?.title?.trim() || "New conversation";
  const titleLabel = selectedRun ? conversationTitle : "";
  const isEditingTitle = Boolean(selectedRun && renamingRunId === selectedRun.id && renameSource === "topbar");
  const rootFolderLabel = activeConversationCwd
    ? activeConversationCwd.split(/[\\/]/).filter(Boolean).pop() || activeConversationCwd
    : "";
  const commitButtonLabel = pushOnCommitEnabled ? t("commit.menu.commitAndPushNow") : t("commit.menu.commitNow");

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
      {!leftSidebarOpen ? (
        <Button
          variant="ghost"
          size="icon"
          className="hidden h-8 w-8 text-muted-foreground transition-all duration-150 ease-out hover:text-foreground lg:inline-flex motion-reduce:transition-none"
          aria-label="Open conversations sidebar"
          title="Open conversations sidebar"
          onClick={() => setLeftSidebarOpen(true)}
        >
          <PanelLeft className="h-4 w-4" />
        </Button>
      ) : null}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <Button variant="ghost" size="icon" className="h-8 w-8 lg:hidden" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}>
          <Menu className="h-4 w-4" />
        </Button>
        {mobileNavOpen ? (
          <SheetContent side="left" className="w-[min(22rem,calc(100vw-1rem))] p-0 lg:hidden" showCloseButton={false}>
            <SheetHeader className="border-b border-border/60">
              <SheetTitle className="flex items-center gap-2 text-left">
                <OmniHarnessMark className="h-8 w-8 p-1" />
                <span>{PRODUCT_NAME}</span>
              </SheetTitle>
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
              openOnboarding={openOnboarding}
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
              archiveRun={archiveRun}
              deleteRun={deleteRun}
              authEnabled={authEnabled}
              openPairDeviceDialog={openPairDeviceDialog}
              logout={logout}
            />
          </SheetContent>
        ) : null}
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
            <RunWorkspaceBadge run={selectedRun} fallbackPath={activeConversationCwd} />
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
        <ButtonGroup aria-label={t("commit.menu.label")}>
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            aria-label={commitButtonLabel}
            title={commitButtonLabel}
            onClick={onPrimaryCommit}
            disabled={isAutoCommitChatPending}
          >
            <GitCommitHorizontal className="h-3.5 w-3.5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={(
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="h-8 w-7 text-muted-foreground hover:text-foreground"
                  aria-label={t("commit.menu.label")}
                  title={t("commit.menu.label")}
                  disabled={isAutoCommitChatPending}
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              )}
            />
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuItem
                onClick={(event) => {
                  event.preventDefault();
                  onAutoCommitMilestonesChange(!autoCommitMilestonesEnabled);
                }}
                className="gap-3"
              >
                <Switch
                  checked={autoCommitMilestonesEnabled}
                  onCheckedChange={onAutoCommitMilestonesChange}
                  onClick={(event) => {
                    event.stopPropagation();
                    onAutoCommitMilestonesChange(!autoCommitMilestonesEnabled);
                  }}
                  aria-label={t("commit.menu.autoCommitMilestones")}
                />
                <span>{t("commit.menu.autoCommitMilestones")}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(event) => {
                  event.preventDefault();
                  onPushOnCommitChange(!pushOnCommitEnabled);
                }}
                className="gap-3"
              >
                <Switch
                  checked={pushOnCommitEnabled}
                  onCheckedChange={onPushOnCommitChange}
                  onClick={(event) => {
                    event.stopPropagation();
                    onPushOnCommitChange(!pushOnCommitEnabled);
                  }}
                  aria-label={t("commit.menu.alwaysPushOnCommit")}
                />
                <span>{t("commit.menu.alwaysPushOnCommit")}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onCommitNow} disabled={isAutoCommitChatPending}>
                <GitCommitHorizontal className="h-4 w-4" />
                <span>{t("commit.menu.commitNow")}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onCommitAndPushNow} disabled={isAutoCommitChatPending}>
                <GitCommitHorizontal className="h-4 w-4" />
                <span>{t("commit.menu.commitAndPushNow")}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </ButtonGroup>
      ) : null}
      <ThemeModeToggle themeMode={themeMode} setThemeMode={setThemeMode} />
      {workspaceSideWindowAvailable && !rightSidebarOpen ? (
        <Button
          variant="ghost"
          size="icon"
          className="hidden h-8 w-8 text-muted-foreground hover:text-foreground lg:inline-flex"
          aria-label="Toggle workspace side window"
          title="Toggle workspace side window"
          onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
        >
          <PanelRight className="h-4 w-4" />
        </Button>
      ) : null}
      <Sheet open={mobileWorkersOpen} onOpenChange={setMobileWorkersOpen} disablePointerDismissal>
        {workspaceSideWindowAvailable ? (
          <Button variant="ghost" size="icon" className="h-8 w-8 lg:hidden" aria-label="Open workspace side window" onClick={() => setMobileWorkersOpen(true)}>
            <PanelRight className="h-4 w-4" />
          </Button>
        ) : null}
        {mobileWorkersOpen ? (
          <SheetContent side="right" className="!inset-0 h-[100dvh] !w-screen !max-w-none gap-0 !border-0 p-0 sm:!max-w-none lg:hidden" showCloseButton={false}>
            <SheetTitle className="sr-only">Workspace tools</SheetTitle>
            <SideWindow
              projectRoot={projectRoot}
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
              onCloseWindow={() => setMobileWorkersOpen(false)}
              closeButtonVariant="back"
            />
          </SheetContent>
        ) : null}
      </Sheet>
    </div>
  </header>
  );
}
