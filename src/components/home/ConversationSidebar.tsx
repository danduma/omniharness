import type React from "react";
import { CheckCircle2, Clock, Folder, FolderPlus, LoaderCircle, LogOut, MoreHorizontal, Pencil, Plus, Search, Settings, Smartphone, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getRunLatestMessageTimestamp, isRunUnread } from "@/lib/conversation-state";
import type { SidebarGroup, SidebarRun } from "@/app/home/types";

export interface ConversationSidebarProps {
  filteredProjects: SidebarGroup[];
  isHydratingConversations: boolean;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  selectedRunId: string | null;
  messages: Array<{ runId: string; createdAt: string }> | undefined;
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
}

export function ConversationSidebar({
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
}: ConversationSidebarProps) {
  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-muted/30">
      <div className="mt-2 space-y-1 p-3">
        <Button variant="ghost" className="h-9 w-full justify-start px-2 text-sm" onClick={startNewPlan}>
          <Plus className="mr-2 h-4 w-4" /> New chat
        </Button>
        <div className="relative mt-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-full border-transparent bg-muted/50 pl-8 text-sm transition-all hover:border-border focus-visible:border-border focus-visible:bg-background focus-visible:ring-1"
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
            filteredProjects.map((group) => (
              <Collapsible key={group.path} defaultOpen>
                <div className="group mb-1 flex items-center justify-between rounded px-2 hover:bg-muted/30">
                  <CollapsibleTrigger className="flex flex-1 items-center gap-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                    <Folder className="h-4 w-4 shrink-0 text-primary/70" />
                    <span className="truncate">{group.name}</span>
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
                          <DropdownMenuItem className="cursor-pointer whitespace-nowrap text-destructive focus:bg-destructive/10 focus:text-destructive" onClick={() => handleRemoveProject(group.path)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Remove Project
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>

                <CollapsibleContent className="space-y-0.5">
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
                  {group.runs.map((run) => (
                    <div
                      key={run.id}
                      onClick={() => selectRun(run.id)}
                      className={`ml-3 group flex min-w-0 cursor-pointer gap-2 overflow-hidden rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                        selectedRunId === run.id
                          ? "border-primary/20 bg-primary/10 font-medium text-primary"
                          : "border-transparent text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      <div className="flex w-4 shrink-0 items-center justify-center">
                        {run.status === "running" ? (
                          <LoaderCircle className="h-3.5 w-3.5 animate-spin text-blue-500" />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="min-w-0 flex items-center justify-between gap-2" title={run.path}>
                          {renamingRunId === run.id ? (
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
                          <div className="flex shrink-0 items-center gap-1">
                            {isRunUnread({
                              latestMessageAt: getRunLatestMessageTimestamp(run.id, messages || []),
                              lastReadAt: readMarkers[run.id] ?? null,
                            }) ? (
                              <div className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                            ) : run.status === "done" ? (
                              <CheckCircle2 className="ml-2 h-3 w-3 shrink-0 text-green-500" />
                            ) : run.status === "failed" ? (
                              <XCircle className="ml-2 h-3 w-3 shrink-0 text-red-500" />
                            ) : null}
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                onClick={(event) => event.stopPropagation()}
                                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-sm font-medium text-muted-foreground opacity-100 transition-colors ring-offset-background hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 lg:opacity-0 lg:group-hover:opacity-100"
                                aria-label={`Conversation actions for ${run.title}`}
                              >
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  className="cursor-pointer whitespace-nowrap"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    startRenamingRun(run);
                                  }}
                                >
                                  <Pencil className="mr-2 h-4 w-4" /> Rename conversation
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  variant="destructive"
                                  className="cursor-pointer whitespace-nowrap"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    deleteRun(run);
                                  }}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete conversation
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] opacity-70">
                          <Clock className="h-2.5 w-2.5" />
                          {new Date(run.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            ))
          ) : (
            <p className="pl-2 text-sm text-muted-foreground">No projects added.</p>
          )}
          </div>
        </ScrollArea>
      </div>

      <div className="mt-auto shrink-0 border-t border-border/60 bg-background/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <Button variant="ghost" className="mb-1 h-9 w-full justify-start px-2 text-sm text-muted-foreground hover:text-foreground" onClick={openPairDeviceDialog}>
          <Smartphone className="mr-2 h-4 w-4" /> Connect Phone
        </Button>
        <Button variant="ghost" className="h-9 w-full justify-start px-2 text-sm text-muted-foreground hover:text-foreground" onClick={() => setShowSettings(true)}>
          <Settings className="mr-2 h-4 w-4" /> Settings
        </Button>
        {authEnabled ? (
          <Button variant="ghost" className="mt-1 h-9 w-full justify-start px-2 text-sm text-muted-foreground hover:text-foreground" onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" /> Sign Out
          </Button>
        ) : null}
      </div>
    </div>
  );
}
