import type React from "react";
import { Archive, Bolt, ChevronDown, Folder, FolderPlus, GitCommitHorizontal, LoaderCircle, LogOut, MoreHorizontal, PanelLeftClose, Pencil, Plus, Search, Settings, Smartphone, SquareTerminal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleTrigger, COLLAPSIBLE_PANEL_CLOSED_CLASS, COLLAPSIBLE_PANEL_OPEN_CLASS, COLLAPSIBLE_PANEL_TRANSITION_CLASS } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { OmniHarnessMark } from "@/components/OmniHarnessMark";
import { PRODUCT_NAME } from "@/app/home/constants";
import { getRunLatestMessageTimestamp, isRunUnread } from "@/lib/conversation-state";
import { getConversationVisualKind, type ConversationVisualKind } from "@/lib/conversation-visuals";
import { isArchivableRunStatus } from "@/lib/run-status";
import { cn } from "@/lib/utils";
import type { SidebarGroup, SidebarRun } from "@/app/home/types";

const CONVERSATION_VISUAL_CONFIG: Record<ConversationVisualKind, {
  label: string;
  Icon: typeof Bolt;
  className: string;
}> = {
  supervisor: {
    label: "Supervisor",
    Icon: Bolt,
    className: "border-[#858a68]/25 bg-[#858a68]/10 text-[#5f6548] dark:border-[#c5ca9a]/25 dark:bg-[#c5ca9a]/10 dark:text-[#c5ca9a]",
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

export interface ConversationSidebarProps {
  filteredProjects: SidebarGroup[];
  isHydratingConversations: boolean;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  selectedRunId: string | null;
  messages: Array<{ runId: string; role?: string | null; kind?: string | null; content?: string | null; createdAt: string }> | undefined;
  readMarkers: Record<string, string>;
  collapsedProjectPaths: Set<string>;
  onProjectOpenChange: (projectPath: string, open: boolean) => void;
  setShowSettings: React.Dispatch<React.SetStateAction<boolean>>;
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
  onCollapse?: () => void;
}

export function ConversationSidebar({
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
  archiveRun,
  deleteRun,
  authEnabled,
  openPairDeviceDialog,
  logout,
  onCollapse,
}: ConversationSidebarProps) {
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
              aria-label="Collapse conversations sidebar"
              title="Collapse conversations sidebar"
              onClick={onCollapse}
            >
              <PanelLeftClose className="h-4 w-4 transition-transform duration-150 ease-out group-hover/button:-translate-x-0.5 motion-reduce:transition-none" />
            </Button>
          ) : null}
        </div>
        <Button variant="ghost" className="h-9 w-full shrink-0 justify-start px-2 text-sm text-[#333333] hover:bg-[#deddda] hover:text-[#1f1f1f] dark:text-zinc-200 dark:hover:bg-muted/70 dark:hover:text-zinc-100" onClick={startNewPlan}>
          <Plus className="mr-2 h-4 w-4" /> New session
        </Button>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-[#333333] dark:text-zinc-300" />
          <Input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-full border-transparent bg-[#e4e3e1] pl-8 text-sm text-[#333333] transition-all placeholder:text-[#333333]/75 hover:bg-[#deddda] focus-visible:border-[#c8c7c5] focus-visible:bg-[#e4e3e1] focus-visible:ring-1 dark:bg-muted/50 dark:text-zinc-100 dark:placeholder:text-zinc-400 dark:hover:bg-muted/60 dark:focus-visible:bg-muted/50"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <ScrollArea className="h-full px-3">
          <div className="space-y-4 py-4">
          <div className="ml-2 mr-1 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-muted-foreground">PROJECTS</h3>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={openFolderPicker}>
              <FolderPlus className="h-3.5 w-3.5" />
            </Button>
          </div>

          {filteredProjects.length > 0 ? (
            filteredProjects.map((group) => {
              const projectOpen = !collapsedProjectPaths.has(group.path);

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
                        title={`New conversation in ${group.name}`}
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
                            <GitCommitHorizontal className="mr-2 h-4 w-4" /> Auto Commit Project
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer whitespace-nowrap text-destructive focus:bg-destructive/10 focus:text-destructive" onClick={() => handleRemoveProject(group.path)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Remove Project
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
                          <span>Loading conversations...</span>
                        </div>
                      ) : (
                        <div className="py-1 pl-8 text-xs italic text-muted-foreground/60">No conversations</div>
                      )
                    ) : null}
                    {group.runs.map((run) => {
                      const visualKind = getConversationVisualKind(run, messages ?? []);
                      const isCommitConversation = visualKind === "commit";
                      const canArchiveConversation = isArchivableRunStatus(run.status);
                      const visualConfig = CONVERSATION_VISUAL_CONFIG[visualKind];
                      const ConversationIcon = visualConfig.Icon;

                      return (
                      <div
                        key={run.id}
                        onClick={() => selectRun(run.id)}
                        className={cn(
                          "group flex min-w-0 cursor-pointer overflow-hidden rounded-xl py-1.5 pl-4 pr-2 text-sm transition-colors",
                          selectedRunId === run.id
                            ? "bg-[#e2e1df] text-[#1f1f1f] dark:bg-white/[0.08] dark:text-zinc-100"
                            : "text-[#424242] hover:bg-[#e8e7e5] hover:text-[#1f1f1f] dark:text-zinc-300 dark:hover:bg-white/[0.045] dark:hover:text-zinc-100",
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="min-w-0 flex items-center justify-between gap-2" title={run.path}>
                            <div className="flex min-w-0 flex-1 items-center gap-2">
                              <span
                                className={cn("inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border", visualConfig.className)}
                                title={`${visualConfig.label} conversation`}
                                aria-label={`${visualConfig.label} conversation`}
                              >
                                <ConversationIcon className="h-3.5 w-3.5" aria-hidden="true" />
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
                              {isRunUnread({
                                latestMessageAt: getRunLatestMessageTimestamp(run.id, messages || []),
                                lastReadAt: readMarkers[run.id] ?? null,
                              }) ? (
                                <div className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                              ) : null}
                              {canArchiveConversation && isCommitConversation ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 shrink-0 text-muted-foreground opacity-100 hover:text-foreground lg:opacity-0 lg:group-hover:opacity-100"
                                  aria-label={`Archive ${run.title}`}
                                  title={`Archive ${run.title}`}
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
                                  aria-label={`Conversation actions for ${run.title}`}
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
                                    <Pencil className="mr-2 h-4 w-4" /> Rename
                                  </DropdownMenuItem>
                                  {canArchiveConversation ? (
                                    <DropdownMenuItem
                                      className="cursor-pointer whitespace-nowrap"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        archiveRun(run);
                                      }}
                                    >
                                      <Archive className="mr-2 h-4 w-4" /> Archive
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
                                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </div>
              </Collapsible>
              );
            })
          ) : (
            <p className="pl-2 text-sm text-muted-foreground">No projects added.</p>
          )}
          </div>
        </ScrollArea>
      </div>

      <div className="mt-auto shrink-0 border-t border-border/60 bg-background/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex h-9 w-full items-center justify-start rounded-md px-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50">
            <Settings className="mr-2 h-4 w-4" /> Settings
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            side="top"
            className="w-56 max-lg:w-[min(20rem,calc(100vw-2rem))] max-lg:rounded-xl max-lg:p-2 max-lg:shadow-2xl"
            positionerClassName="max-lg:!fixed max-lg:!inset-0 max-lg:!flex max-lg:!items-center max-lg:!justify-center max-lg:!p-4 max-lg:!transform-none max-lg:bg-background/55 max-lg:backdrop-blur-sm"
          >
            <DropdownMenuItem className="cursor-pointer whitespace-nowrap max-lg:h-12 max-lg:gap-3 max-lg:px-3 max-lg:text-base max-lg:[&_svg]:h-5 max-lg:[&_svg]:w-5" onClick={() => setShowSettings(true)}>
              <Settings className="mr-2 h-4 w-4" /> Settings
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer whitespace-nowrap max-lg:h-12 max-lg:gap-3 max-lg:px-3 max-lg:text-base max-lg:[&_svg]:h-5 max-lg:[&_svg]:w-5" onClick={openPairDeviceDialog}>
              <Smartphone className="mr-2 h-4 w-4" /> Connect Phone
            </DropdownMenuItem>
            {authEnabled ? (
              <DropdownMenuItem variant="destructive" className="cursor-pointer whitespace-nowrap max-lg:h-12 max-lg:gap-3 max-lg:px-3 max-lg:text-base max-lg:[&_svg]:h-5 max-lg:[&_svg]:w-5" onClick={logout}>
                <LogOut className="mr-2 h-4 w-4" /> Sign Out
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
