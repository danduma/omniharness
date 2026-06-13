import type React from "react";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { Archive, Bug, ChevronDown, Folder, FolderPlus, GitCommitHorizontal, LoaderCircle, LogOut, MoreHorizontal, PanelLeftClose, Pencil, Plus, Search, Settings, Smartphone, SquareTerminal, Trash2, TriangleAlert, Wand2 } from "lucide-react";
import type { ConversationSidebarTab } from "@/app/home/types";
import { Button } from "@/components/ui/button";
import { requestBugDropOpen } from "@/components/BugDropBootstrap";
import { Collapsible, CollapsibleTrigger, COLLAPSIBLE_PANEL_CLOSED_CLASS, COLLAPSIBLE_PANEL_OPEN_CLASS, COLLAPSIBLE_PANEL_TRANSITION_CLASS } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { OmniHarnessMark } from "@/components/OmniHarnessMark";
import { CliBrandIcon } from "@/components/cli-brand-icons";
import { PRODUCT_NAME, PROJECT_SESSION_DISPLAY_BATCH_SIZE } from "@/app/home/constants";
import { getRunLatestUnreadTimestamp, isRunUnread } from "@/lib/conversation-state";
import { getConversationVisualKind, type ConversationVisualKind } from "@/lib/conversation-visuals";
import type { ManualCommitAction } from "@/lib/commit-workflow";
import { t, useI18nSnapshot } from "@/lib/i18n";
import { isArchivableRunStatus, normalizeRunStatus } from "@/lib/run-status";
import { cn } from "@/lib/utils";
import { StateManager } from "@/lib/state-manager";
import type { SidebarGroup, SidebarRun } from "@/app/home/types";

class ConversationSidebarHydrationManager extends StateManager<boolean> {
  constructor() {
    super(false);
  }

  markMounted() {
    this.update(true);
  }
}

const conversationSidebarHydrationManager = new ConversationSidebarHydrationManager();

type ConversationVisualIconProps = {
  className?: string;
} & React.SVGProps<SVGSVGElement>;

const CONVERSATION_VISUAL_CONFIG: Record<ConversationVisualKind, {
  label: string;
  Icon: React.ComponentType<ConversationVisualIconProps>;
  className: string;
}> = {
  supervisor: {
    label: "Supervisor",
    Icon: OmniHarnessLogoGlyph,
    className: "border-[#c88b45]/30 bg-[#c88b45]/12 text-[#9e5f18] dark:border-[#f0b15d]/25 dark:bg-[#f0b15d]/10 dark:text-[#f0b15d]",
  },
  direct: {
    label: "Direct control",
    Icon: SquareTerminal,
    className: "border-[#6688a0]/25 bg-[#6688a0]/10 text-[#4d6f87] dark:border-[#9fc8df]/25 dark:bg-[#9fc8df]/10 dark:text-[#9fc8df]",
  },
  commit: {
    label: "Commit",
    Icon: GitCommitHorizontal,
    className: "border-[#ad8247]/30 bg-[#ad8247]/10 text-[#846233] dark:border-[#e2b36b]/25 dark:bg-[#e2b36b]/10 dark:text-[#e2b36b]",
  },
};

function OmniHarnessLogoGlyph({ className, ...props }: ConversationVisualIconProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <g fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="butt" strokeLinejoin="miter">
        <path d="M6.5 28A25.8 25.8 0 0 1 57.5 28" />
        <path d="M57.5 36A25.8 25.8 0 0 1 6.5 36" />
        <path d="M23 24v16" />
        <path d="M41 24v16" />
        <path d="M26.417 32L37.466 32" />
      </g>
    </svg>
  );
}

interface ConversationProjectGroupListProps {
  groups: SidebarGroup[];
  isHydratingConversations: boolean;
  selectedRunId: string | null;
  messages: Array<{ runId: string; role?: string | null; kind?: string | null; content?: string | null; createdAt: string }> | undefined;
  readMarkers: Record<string, string>;
  collapsedProjectPaths: Set<string>;
  visibleProjectSessionCounts: Record<string, number>;
  onProjectOpenChange: (projectPath: string, open: boolean) => void;
  onShowMoreProjectSessions: (projectPath: string) => void;
  beginConversationInProject: (projectPath: string) => void;
  autoCommitProject: (projectPath: string, action?: import("@/lib/commit-workflow").ManualCommitAction) => void;
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
  emptyState: React.ReactNode;
}

function ConversationProjectGroupList({
  groups,
  isHydratingConversations,
  selectedRunId,
  messages,
  readMarkers,
  collapsedProjectPaths,
  visibleProjectSessionCounts,
  onProjectOpenChange,
  onShowMoreProjectSessions,
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
  emptyState,
}: ConversationProjectGroupListProps) {
  if (groups.length === 0) {
    return <>{emptyState}</>;
  }

  return (
    <>
      {groups.map((group) => {
        const projectOpen = !collapsedProjectPaths.has(group.path);
        const visibleSessionCount = visibleProjectSessionCounts[group.path] ?? PROJECT_SESSION_DISPLAY_BATCH_SIZE;
        const visibleRuns = group.runs.slice(0, visibleSessionCount);
        const hiddenSessionCount = Math.max(0, group.runs.length - visibleRuns.length);
        const nextSessionBatchCount = Math.min(PROJECT_SESSION_DISPLAY_BATCH_SIZE, hiddenSessionCount);

        return (
          <Collapsible
            key={group.path}
            open={projectOpen}
            onOpenChange={(open) => onProjectOpenChange(group.path, open)}
          >
            <div className="group mb-1 flex items-center justify-between gap-0.5 rounded px-2 hover:bg-muted/30">
              <CollapsibleTrigger className="flex flex-1 items-center gap-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                <Folder className="h-4 w-4 shrink-0 text-primary/70" />
                <span className="truncate">{group.name}</span>
                <ChevronDown
                  className={cn("ml-auto h-3.5 w-3.5 shrink-0 transition-transform duration-150 ease-out", projectOpen && "rotate-180")}
                  aria-hidden="true"
                />
              </CollapsibleTrigger>

              {group.path !== "other" && (
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground opacity-100 hover:text-foreground lg:opacity-0 lg:group-hover:opacity-100"
                    title={t("conversation.sidebar.newConversationInProject", { project: group.name })}
                    onClick={() => beginConversationInProject(group.path)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-sm font-medium text-muted-foreground opacity-100 transition-colors ring-offset-background hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 lg:opacity-0 lg:group-hover:opacity-100">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem
                        className="cursor-pointer whitespace-nowrap"
                        disabled={isAutoCommitProjectPending}
                        onClick={() => autoCommitProject(group.path)}
                      >
                        <GitCommitHorizontal className="mr-2 h-4 w-4" /> {t("commit.menu.commitProjectNow")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer whitespace-nowrap"
                        disabled={isAutoCommitProjectPending}
                        onClick={() => autoCommitProject(group.path, "commit-push")}
                      >
                        <GitCommitHorizontal className="mr-2 h-4 w-4" /> {t("commit.menu.commitAndPushProject")}
                      </DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer whitespace-nowrap text-destructive focus:bg-destructive/10 focus:text-destructive" onClick={() => handleRemoveProject(group.path)}>
                        <Trash2 className="mr-2 h-4 w-4" /> {t("conversation.sidebar.removeProject")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>

            <div
              className={cn(
                COLLAPSIBLE_PANEL_TRANSITION_CLASS,
                projectOpen ? COLLAPSIBLE_PANEL_OPEN_CLASS : COLLAPSIBLE_PANEL_CLOSED_CLASS,
              )}
              aria-hidden={!projectOpen}
            >
              <div className="min-h-0 space-y-0.5 overflow-hidden">
                {group.runs.length === 0 ? (
                  isHydratingConversations ? (
                    <div className="flex items-center gap-2 py-1 pl-8 text-xs text-muted-foreground/70">
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      <span>{t("conversation.sidebar.loadingConversations")}</span>
                    </div>
                  ) : (
                    <div className="py-1 pl-8 text-xs italic text-muted-foreground/60">No conversations</div>
                  )
                ) : null}
                {visibleRuns.map((run) => {
                  const visualKind = getConversationVisualKind(run);
                  const isCommitConversation = visualKind === "commit";
                  const canArchiveConversation = isArchivableRunStatus(run.status);
                  const normalizedRunStatus = normalizeRunStatus(run.status);
                  const runIsUnread = isRunUnread({
                    latestMessageAt: getRunLatestUnreadTimestamp(run, messages || []),
                    lastReadAt: readMarkers[run.id] ?? null,
                  });
                  const showCompletedAttentionIndicator = normalizedRunStatus === "done" && runIsUnread;
                  const showAwaitingUserIndicator = normalizedRunStatus === "awaiting_user";
                  const statusIndicatorLabel = showAwaitingUserIndicator
                    ? t("conversation.sidebar.status.awaitingUser")
                    : showCompletedAttentionIndicator
                      ? t("conversation.sidebar.status.completedAttention")
                      : null;
                  const visualConfig = CONVERSATION_VISUAL_CONFIG[visualKind];
                  const ConversationIcon = visualConfig.Icon;

                  return (
                    <div
                      key={run.id}
                      onClick={() => selectRun(run.id)}
                      onDoubleClick={(event) => {
                        const target = event.target;
                        if (target instanceof Element && target.closest("button,input,textarea,select,a")) {
                          return;
                        }
                        event.preventDefault();
                        startRenamingRun(run);
                      }}
                      className={cn(
                        "group flex min-w-0 cursor-pointer overflow-hidden rounded-xl py-1.5 pl-2.5 pr-2 text-sm transition-colors",
                        selectedRunId === run.id
                          ? "bg-[#e2e1df] text-[#1f1f1f] dark:bg-white/[0.08] dark:text-zinc-100"
                          : "text-[#424242] hover:bg-[#e8e7e5] hover:text-[#1f1f1f] dark:text-zinc-300 dark:hover:bg-white/[0.045] dark:hover:text-zinc-100",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="min-w-0 flex items-center justify-between gap-2">
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            <span className="inline-flex h-5 w-3 shrink-0 items-center justify-center">
                              {showAwaitingUserIndicator && statusIndicatorLabel ? (
                                <span
                                  className="inline-flex h-4 w-4 items-center justify-center text-amber-500"
                                  aria-label={statusIndicatorLabel}
                                  role="img"
                                  title={statusIndicatorLabel}
                                >
                                  <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
                                </span>
                              ) : null}
                              {showCompletedAttentionIndicator && statusIndicatorLabel && !showAwaitingUserIndicator ? (
                                <span
                                  className="h-2 w-2 rounded-full bg-sky-300"
                                  aria-label={statusIndicatorLabel}
                                  role="img"
                                  title={statusIndicatorLabel}
                                />
                              ) : null}
                            </span>
                            <span
                              className={cn("inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border", visualConfig.className)}
                              title={t("conversation.sidebar.conversationVisual", { kind: visualConfig.label })}
                              aria-label={t("conversation.sidebar.conversationVisual", { kind: visualConfig.label })}
                            >
                              {visualKind === "direct" ? (
                                <CliBrandIcon workerType={run.preferredWorkerType ?? null} className="h-3.5 w-3.5" />
                              ) : (
                                <ConversationIcon className="h-3.5 w-3.5" aria-hidden="true" />
                              )}
                            </span>
                            {renamingRunId === run.id && renameSource !== "topbar" ? (
                              <Input
                                value={renameValue}
                                onChange={(event) => setRenameValue(event.target.value)}
                                onClick={(event) => event.stopPropagation()}
                                onKeyDown={(event) => {
                                  event.stopPropagation();
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    commitRenamingRun(run.id);
                                  } else if (event.key === "Escape") {
                                    event.preventDefault();
                                    cancelRenamingRun();
                                  }
                                }}
                                onBlur={() => commitRenamingRun(run.id)}
                                autoFocus
                                className="h-7 min-w-0 text-[13px]"
                              />
                            ) : (
                              <span className="truncate text-[13px]">{run.title}</span>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            {run.status === "running" ? (
                              <LoaderCircle className="h-3.5 w-3.5 animate-spin text-muted-foreground motion-reduce:animate-none" />
                            ) : null}
                            {runIsUnread && !showCompletedAttentionIndicator ? (
                              <div className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                            ) : null}
                            {canArchiveConversation && isCommitConversation ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 shrink-0 text-muted-foreground opacity-100 hover:text-foreground lg:opacity-0 lg:group-hover:opacity-100"
                                aria-label={t("conversation.sidebar.archiveConversation", { title: run.title })}
                                title={t("conversation.sidebar.archiveConversation", { title: run.title })}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  archiveRun(run);
                                }}
                              >
                                <Archive className="h-3.5 w-3.5" />
                              </Button>
                            ) : null}
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                onClick={(event) => event.stopPropagation()}
                                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-sm font-medium text-muted-foreground opacity-100 transition-colors ring-offset-background hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 lg:opacity-0 lg:group-hover:opacity-100"
                                aria-label={t("conversation.sidebar.conversationActions", { title: run.title })}
                              >
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="min-w-28">
                                <DropdownMenuItem
                                  className="cursor-pointer whitespace-nowrap"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    startRenamingRun(run);
                                  }}
                                >
                                  <Pencil className="mr-2 h-4 w-4" /> {t("conversation.sidebar.rename")}
                                </DropdownMenuItem>
                                {canArchiveConversation ? (
                                  <DropdownMenuItem
                                    className="cursor-pointer whitespace-nowrap"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      archiveRun(run);
                                    }}
                                  >
                                    <Archive className="mr-2 h-4 w-4" /> {t("conversation.sidebar.archive")}
                                  </DropdownMenuItem>
                                ) : null}
                                <DropdownMenuItem
                                  variant="destructive"
                                  className="cursor-pointer whitespace-nowrap"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    deleteRun(run);
                                  }}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" /> {t("conversation.sidebar.delete")}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {hiddenSessionCount > 0 ? (
                  <button
                    type="button"
                    className="ml-7 mt-1 inline-flex h-7 items-center rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={t("conversation.sidebar.showMoreSessions", {
                      count: nextSessionBatchCount,
                      project: group.name,
                    })}
                    title={t("conversation.sidebar.showMoreSessions", {
                      count: nextSessionBatchCount,
                      project: group.name,
                    })}
                    onClick={() => onShowMoreProjectSessions(group.path)}
                  >
                    {t("conversation.sidebar.moreSessions")}
                  </button>
                ) : null}
              </div>
            </div>
          </Collapsible>
        );
      })}
    </>
  );
}

export interface ConversationSidebarProps {
  filteredProjects: SidebarGroup[];
  activeProjects: SidebarGroup[];
  conversationSidebarTab: ConversationSidebarTab;
  setConversationSidebarTab: (tab: ConversationSidebarTab) => void;
  isHydratingConversations: boolean;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  selectedRunId: string | null;
  messages: Array<{ runId: string; role?: string | null; kind?: string | null; content?: string | null; createdAt: string }> | undefined;
  readMarkers: Record<string, string>;
  collapsedProjectPaths: Set<string>;
  visibleProjectSessionCounts: Record<string, number>;
  onProjectOpenChange: (projectPath: string, open: boolean) => void;
  onShowMoreProjectSessions: (projectPath: string) => void;
  setShowSettings: React.Dispatch<React.SetStateAction<boolean>>;
  openOnboarding: () => void;
  openFolderPicker: () => void;
  startNewPlan: () => void;
  beginConversationInProject: (projectPath: string) => void;
  autoCommitProject: (projectPath: string, action?: ManualCommitAction) => void;
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
  onCollapse?: () => void;
  onOpenExternalSessions?: () => void;
}

export function ConversationSidebar({
  filteredProjects,
  activeProjects,
  conversationSidebarTab,
  setConversationSidebarTab,
  isHydratingConversations,
  searchQuery,
  setSearchQuery,
  selectedRunId,
  messages,
  readMarkers,
  collapsedProjectPaths,
  visibleProjectSessionCounts,
  onProjectOpenChange,
  onShowMoreProjectSessions,
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
  onCollapse,
  onOpenExternalSessions,
}: ConversationSidebarProps) {
  useI18nSnapshot();
  const mounted = useSyncExternalStore(
    useCallback((listener) => conversationSidebarHydrationManager.subscribe(listener), []),
    useCallback(() => conversationSidebarHydrationManager.getSnapshot(), []),
    () => conversationSidebarHydrationManager.getSnapshot(),
  );
  useEffect(() => {
    conversationSidebarHydrationManager.markMounted();
  }, []);

  if (!mounted) {
    // First render (SSR + initial client paint) renders an empty shell so the
    // client tree shape matches the server's. Without this, the project/run
    // list populates from local state after hydration, shifting Base UI's
    // auto-generated IDs and producing a hydration mismatch warning across
    // every DropdownMenuTrigger in the sidebar.
    return (
      <div
        className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#f1f1f0] dark:bg-muted/30"
        aria-hidden="true"
      />
    );
  }

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#f1f1f0] dark:bg-muted/30">
      <div className="space-y-1 px-3 pb-3 pt-2 lg:px-3 lg:pb-3 lg:pt-2">
        <div className="flex items-center gap-1.5">
          <div className="hidden min-w-0 flex-1 items-center gap-2 lg:flex">
            <OmniHarnessMark className="h-8 w-8" />
            <span className="min-w-0 truncate text-sm font-semibold text-[#333333] dark:text-zinc-100">
              {PRODUCT_NAME}
            </span>
          </div>
          {onCollapse ? (
            <Button
              variant="ghost"
              size="icon"
              className="hidden h-9 w-9 text-[#333333]/75 transition-all duration-150 ease-out hover:bg-[#deddda] hover:text-[#1f1f1f] lg:inline-flex dark:text-zinc-300 dark:hover:bg-muted/70 dark:hover:text-zinc-100 motion-reduce:transition-none"
              aria-label={t("conversation.sidebar.collapseAria")}
              title={t("conversation.sidebar.collapseAria")}
              onClick={onCollapse}
            >
              <PanelLeftClose className="h-4 w-4 transition-transform duration-150 ease-out group-hover/button:-translate-x-0.5 motion-reduce:transition-none" />
            </Button>
          ) : null}
        </div>
        <div className="flex items-stretch gap-0">
          <Button variant="ghost" className="h-9 min-w-0 flex-1 justify-start px-2 text-sm text-[#333333] hover:bg-[#deddda] hover:text-[#1f1f1f] dark:text-zinc-200 dark:hover:bg-muted/70 dark:hover:text-zinc-100" onClick={startNewPlan}>
            <Plus className="mr-2 h-4 w-4 shrink-0" /> {t("conversation.sidebar.newSession")}
          </Button>
          {onOpenExternalSessions && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="inline-flex h-9 w-8 shrink-0 items-center justify-center rounded-md text-[#333333]/60 transition-colors hover:bg-[#deddda] hover:text-[#1f1f1f] focus-visible:outline-none dark:text-zinc-400 dark:hover:bg-muted/70 dark:hover:text-zinc-100"
                aria-label={t("externalSessions.moreOptionsAria")}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem className="cursor-pointer whitespace-nowrap" onClick={onOpenExternalSessions}>
                  <SquareTerminal className="mr-2 h-4 w-4" /> {t("externalSessions.title")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-[#333333] dark:text-zinc-300" />
          <Input
            type="text"
            placeholder={t("conversation.sidebar.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-full border-transparent bg-[#e4e3e1] pl-8 text-sm text-[#333333] transition-all placeholder:text-[#333333]/75 hover:bg-[#deddda] focus-visible:border-[#c8c7c5] focus-visible:bg-[#e4e3e1] focus-visible:ring-1 dark:bg-white/[0.08] dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:hover:bg-white/[0.095] dark:focus-visible:bg-white/[0.08]"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <ScrollArea className="h-full px-3">
          <div className="space-y-3 pb-4 pt-0.5">
          <div className="ml-2 mr-1 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setConversationSidebarTab("projects")}
                className={cn(
                  "rounded px-2 py-0.5 text-xs font-semibold transition-colors",
                  conversationSidebarTab === "projects"
                    ? "bg-[#deddda] text-[#1f1f1f] dark:bg-white/[0.12] dark:text-zinc-100"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t("conversation.sidebar.tab.projects")}
              </button>
              <button
                type="button"
                onClick={() => setConversationSidebarTab("recent")}
                className={cn(
                  "rounded px-2 py-0.5 text-xs font-semibold transition-colors",
                  conversationSidebarTab === "recent"
                    ? "bg-[#deddda] text-[#1f1f1f] dark:bg-white/[0.12] dark:text-zinc-100"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t("conversation.sidebar.tab.active")}
              </button>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={openFolderPicker}>
              <FolderPlus className="h-3.5 w-3.5" />
            </Button>
          </div>

          {conversationSidebarTab === "projects" ? (
            <ConversationProjectGroupList
              groups={filteredProjects}
              isHydratingConversations={isHydratingConversations}
              selectedRunId={selectedRunId}
              messages={messages}
              readMarkers={readMarkers}
              collapsedProjectPaths={collapsedProjectPaths}
              visibleProjectSessionCounts={visibleProjectSessionCounts}
              onProjectOpenChange={onProjectOpenChange}
              onShowMoreProjectSessions={onShowMoreProjectSessions}
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
              emptyState={<p className="pl-2 text-sm text-muted-foreground">{t("conversation.sidebar.empty.projects")}</p>}
            />
          ) : (
            <ConversationProjectGroupList
              groups={activeProjects}
              isHydratingConversations={false}
              selectedRunId={selectedRunId}
              messages={messages}
              readMarkers={readMarkers}
              collapsedProjectPaths={collapsedProjectPaths}
              visibleProjectSessionCounts={visibleProjectSessionCounts}
              onProjectOpenChange={onProjectOpenChange}
              onShowMoreProjectSessions={onShowMoreProjectSessions}
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
              emptyState={<p className="pl-2 text-sm text-muted-foreground">{t("conversation.sidebar.empty.active")}</p>}
            />
          )}
          </div>
        </ScrollArea>
      </div>

      <div className="mt-auto shrink-0 border-t border-border/60 bg-background/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex h-9 w-full items-center justify-start rounded-md px-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50">
            <Settings className="mr-2 h-4 w-4" /> {t("mainMenu.settings")}
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            side="top"
            className="w-fit min-w-fit max-lg:w-[min(20rem,calc(100vw-2rem))] max-lg:min-w-0 max-lg:rounded-xl max-lg:p-2 max-lg:shadow-2xl"
            positionerClassName="max-lg:!fixed max-lg:!inset-0 max-lg:!flex max-lg:!items-center max-lg:!justify-center max-lg:!p-4 max-lg:!transform-none max-lg:bg-background/55 max-lg:backdrop-blur-sm"
          >
            <DropdownMenuItem className="cursor-pointer whitespace-nowrap max-lg:h-12 max-lg:gap-3 max-lg:px-3 max-lg:text-base max-lg:[&_svg]:h-5 max-lg:[&_svg]:w-5" onClick={requestBugDropOpen}>
              <Bug className="mr-2 h-4 w-4" /> {t("mainMenu.reportBug")}
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer whitespace-nowrap max-lg:h-12 max-lg:gap-3 max-lg:px-3 max-lg:text-base max-lg:[&_svg]:h-5 max-lg:[&_svg]:w-5" onClick={() => setShowSettings(true)}>
              <Settings className="mr-2 h-4 w-4" /> {t("mainMenu.settings")}
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer whitespace-nowrap max-lg:h-12 max-lg:gap-3 max-lg:px-3 max-lg:text-base max-lg:[&_svg]:h-5 max-lg:[&_svg]:w-5" onClick={openOnboarding}>
              <Wand2 className="mr-2 h-4 w-4" /> {t("mainMenu.setupClis")}
            </DropdownMenuItem>
            <DropdownMenuItem className="hidden cursor-pointer whitespace-nowrap lg:flex" onClick={openPairDeviceDialog}>
              <Smartphone className="mr-2 h-4 w-4" /> {t("mainMenu.connectPhone")}
            </DropdownMenuItem>
            {authEnabled ? (
              <DropdownMenuItem variant="destructive" className="cursor-pointer whitespace-nowrap max-lg:h-12 max-lg:gap-3 max-lg:px-3 max-lg:text-base max-lg:[&_svg]:h-5 max-lg:[&_svg]:w-5" onClick={logout}>
                <LogOut className="mr-2 h-4 w-4" /> {t("mainMenu.signOut")}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
