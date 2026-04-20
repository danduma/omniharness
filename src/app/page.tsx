"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Terminal } from "@/components/Terminal";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Folder, Settings, Terminal as TerminalIcon, PanelRight, Plus, Search, Blocks, Clock, CheckCircle2, XCircle, Cpu, ArrowUp, FolderPlus, MoreHorizontal, Trash2, LoaderCircle, Menu, Pencil } from "lucide-react";
import { FolderPickerDialog } from "@/components/FolderPickerDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ClarificationPanel } from "@/components/ClarificationPanel";
import { PlanProgress } from "@/components/PlanProgress";
import { ValidationSummary } from "@/components/ValidationSummary";
import { resolveProjectScope } from "@/lib/project-scope";
import { getActiveMentionQuery, replaceActiveMention } from "@/lib/mentions";
import { getRunLatestMessageTimestamp, isRunUnread } from "@/lib/conversation-state";
import { buildConversationGroups } from "@/lib/conversations";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type PlanRecord = { id: string; path: string };
type RunRecord = { id: string; planId: string; status: string; createdAt: string; projectPath: string | null; title: string | null };
type PlanItemRecord = { id: string; planId: string; title: string; phase: string | null; status: string };
type ClarificationRecord = { id: string; runId: string; question: string; answer: string | null; status: string };
type ValidationRecord = { id: string; runId: string; status: string; summary: string | null; evidence: string | null };
type ProjectFilesResponse = { root: string; files: string[] };

type SidebarRun = { id: string; title: string; path: string; status: string; createdAt: string };
type SidebarGroup = { path: string; name: string; runs: SidebarRun[] };

interface ConversationSidebarProps {
  filteredProjects: SidebarGroup[];
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  selectedRunId: string | null;
  messages: Array<{ runId: string; createdAt: string }> | undefined;
  readMarkers: Record<string, string>;
  showSettings: boolean;
  setShowSettings: React.Dispatch<React.SetStateAction<boolean>>;
  apiKeys: Record<string, string>;
  setApiKeys: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  saveSettings: { mutate: () => void; isPending: boolean };
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
}

function ConversationSidebar({
  filteredProjects,
  searchQuery,
  setSearchQuery,
  selectedRunId,
  messages,
  readMarkers,
  showSettings,
  setShowSettings,
  apiKeys,
  setApiKeys,
  saveSettings,
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
                  {group.runs.length === 0 && (
                    <div className="py-1 pl-8 text-xs italic text-muted-foreground/60">No conversations</div>
                  )}
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
                      <div className="flex w-4 shrink-0 items-start justify-center pt-0.5">
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
        <Button variant="ghost" className="h-9 w-full justify-start px-2 text-sm text-muted-foreground hover:text-foreground" onClick={() => setShowSettings(!showSettings)}>
          <Settings className="mr-2 h-4 w-4" /> Settings
        </Button>
      </div>
    </div>
  );
}

interface WorkersSidebarProps {
  agents: Array<{ name: string; state: string }>;
  onClose?: () => void;
}

function WorkersSidebar({ agents, onClose }: WorkersSidebarProps) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-muted/10">
      <div className="flex items-center justify-between border-b p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Cpu className="h-4 w-4" /> Global Workers
        </h3>
        {onClose && (
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={onClose}>
            <XCircle className="h-4 w-4" />
          </Button>
        )}
      </div>
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {agents.length > 0 ? (
            agents.map((agent) => (
              <div key={agent.name} className="flex flex-col overflow-hidden rounded-lg border border-border bg-background shadow-sm">
                <div className="flex items-center justify-between border-b border-border bg-muted/30 p-2">
                  <span className="mr-2 truncate font-mono text-xs font-semibold" title={agent.name}>{agent.name}</span>
                  <span className="text-[9px] font-bold uppercase text-muted-foreground">
                    {agent.state}
                  </span>
                </div>
                <div className="relative h-48 w-full bg-[#1e1e1e]">
                  <Terminal agentName={agent.name} />
                </div>
              </div>
            ))
          ) : (
            <div className="flex h-32 flex-col items-center justify-center rounded-md border border-dashed bg-transparent text-xs text-muted-foreground">
              <TerminalIcon className="mb-2 h-6 w-6 opacity-30" />
              No workers running.
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export default function Home() {
  const [command, setCommand] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({
    OPENAI_API_KEY: '',
    ANTHROPIC_API_KEY: '',
    GEMINI_API_KEY: '',
    SUPERVISOR_LLM_PROVIDER: 'gemini',
    SUPERVISOR_LLM_MODEL: 'gemini-3.1-pro-preview',
    SUPERVISOR_LLM_BASE_URL: '',
    SUPERVISOR_LLM_API_KEY: '',
    CREDIT_STRATEGY: 'swap_account',
    PROJECTS: '[]',
  });
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileWorkersOpen, setMobileWorkersOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [draftProjectPath, setDraftProjectPath] = useState<string | null>(null);
  const [commandCursor, setCommandCursor] = useState(0);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [readMarkers, setReadMarkers] = useState<Record<string, string>>({});
  const [renamingRunId, setRenamingRunId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [state, setState] = useState<any>({
    messages: [],
    plans: [],
    runs: [],
    accounts: [],
    agents: [],
    workers: [],
    planItems: [],
    clarifications: [],
    validationRuns: [],
    executionEvents: [],
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const commandInputRef = useRef<HTMLInputElement>(null);

  useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings");
      if (!res.ok) return {};
      const data = await res.json();
      setApiKeys(prev => ({ ...prev, ...data }));
      return data;
    },
  });

  const explicitProjects = apiKeys.PROJECTS ? JSON.parse(apiKeys.PROJECTS) : [];

  useEffect(() => {
    const eventSource = new EventSource("/api/events");
    eventSource.addEventListener("update", (e) => {
      try {
        const data = JSON.parse(e.data);
        setState(data);
      } catch {
        // ignore
      }
    });

    return () => {
      eventSource.close();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const saved = window.localStorage.getItem("omni-read-markers");
      if (saved) {
        setReadMarkers(JSON.parse(saved));
      }
    } catch {
      // ignore malformed local state
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem("omni-read-markers", JSON.stringify(readMarkers));
  }, [readMarkers]);

  const saveSettings = useMutation({
    mutationFn: async () => {
      await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(apiKeys) });
    },
    onSuccess: () => setShowSettings(false)
  });

  const answerClarification = useMutation({
    mutationFn: async ({ clarificationId, answer }: { clarificationId: string; answer: string }) => {
      if (!selectedRunId) throw new Error("No run selected");
      const res = await fetch(`/api/runs/${selectedRunId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clarificationId, answer }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const renameRun = useMutation({
    mutationFn: async ({ runId, title }: { runId: string; title: string }) => {
      const res = await fetch(`/api/runs/${runId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (_data, variables) => {
      setState((current: typeof state) => ({
        ...current,
        runs: (current.runs || []).map((run: RunRecord) =>
          run.id === variables.runId ? { ...run, title: variables.title } : run
        ),
      }));
      setRenamingRunId(null);
      setRenameValue("");
    },
  });

  const deleteRun = useMutation({
    mutationFn: async ({ runId }: { runId: string }) => {
      const res = await fetch(`/api/runs/${runId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (_data, variables) => {
      const runToDelete = (state.runs || []).find((run: RunRecord) => run.id === variables.runId);
      const workerIds = (state.workers || [])
        .filter((worker: { runId: string; id: string }) => worker.runId === variables.runId)
        .map((worker: { id: string }) => worker.id);

      setState((current: typeof state) => ({
        ...current,
        runs: (current.runs || []).filter((run: RunRecord) => run.id !== variables.runId),
        messages: (current.messages || []).filter((message: { runId: string }) => message.runId !== variables.runId),
        workers: (current.workers || []).filter((worker: { runId: string }) => worker.runId !== variables.runId),
        clarifications: (current.clarifications || []).filter((item: { runId: string }) => item.runId !== variables.runId),
        validationRuns: (current.validationRuns || []).filter((item: { runId: string }) => item.runId !== variables.runId),
        executionEvents: (current.executionEvents || []).filter((item: { runId: string; workerId?: string | null }) =>
          item.runId !== variables.runId && (!item.workerId || !workerIds.includes(item.workerId))
        ),
        plans: runToDelete
          ? (current.plans || []).filter((plan: PlanRecord) => plan.id !== runToDelete.planId)
          : current.plans,
        planItems: runToDelete
          ? (current.planItems || []).filter((item: PlanItemRecord) => item.planId !== runToDelete.planId)
          : current.planItems,
      }));

      if (selectedRunId === variables.runId) {
        setSelectedRunId(null);
      }
      if (renamingRunId === variables.runId) {
        setRenamingRunId(null);
        setRenameValue("");
      }
    },
  });

  const runCommand = useMutation({
    mutationFn: async (cmd: string) => {
      const res = await fetch("/api/supervisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: cmd, projectPath: currentProjectScope }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      setCommand("");
      if (data.runId) setSelectedRunId(data.runId);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (command.trim()) {
      runCommand.mutate(command);
    }
  };

  const handleStartNewPlan = () => {
    setSelectedRunId(null);
    setDraftProjectPath(null);
    setCommand("");
    setMobileNavOpen(false);
  };

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [state.messages, selectedRunId, state.agents]);

  const handleAddProject = (newPath: string) => {
    if (!explicitProjects.includes(newPath)) {
      const newProjects = [...explicitProjects, newPath];
      const updatedKeys = { ...apiKeys, PROJECTS: JSON.stringify(newProjects) };
      setApiKeys(updatedKeys);
      fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updatedKeys) });
    }
  };

  const handleRemoveProject = (pathToRemove: string) => {
    const newProjects = explicitProjects.filter((p: string) => p !== pathToRemove);
    const updatedKeys = { ...apiKeys, PROJECTS: JSON.stringify(newProjects) };
    setApiKeys(updatedKeys);
    fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updatedKeys) });
  };

  const beginConversationInProject = (projectPath: string) => {
    setSelectedRunId(null);
    setDraftProjectPath(projectPath);
    setCommand(`${projectPath}/`);
    setMobileNavOpen(false);
    requestAnimationFrame(() => {
      commandInputRef.current?.focus();
      commandInputRef.current?.select();
    });
  };

  const groupedProjects = buildConversationGroups({
    explicitProjects,
    plans: (state.plans || []) as PlanRecord[],
    runs: (state.runs || []) as RunRecord[],
  });

  const filteredProjects = groupedProjects.map((group: { path: string, name: string, runs: unknown[] }) => {
    if (!searchQuery) return group;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const runs = (group.runs as any[]).filter((run: { path: string; title: string }) =>
      run.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
      run.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      group.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return { ...group, runs };
  }).filter((group: { name: string, runs: unknown[] }) => group.runs.length > 0 || group.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleSelectRun = (runId: string) => {
    setSelectedRunId(runId);
    setDraftProjectPath(null);
    setMobileNavOpen(false);
  };

  const handleStartRenamingRun = (run: SidebarRun) => {
    setRenamingRunId(run.id);
    setRenameValue(run.title);
  };

  const handleCancelRenamingRun = () => {
    setRenamingRunId(null);
    setRenameValue("");
  };

  const handleCommitRenamingRun = (runId: string) => {
    const nextTitle = renameValue.trim().replace(/\s+/g, " ");
    const existingRun = (state.runs || []).find((run: RunRecord) => run.id === runId);
    if (!nextTitle || nextTitle === (existingRun?.title || "New conversation")) {
      handleCancelRenamingRun();
      return;
    }

    renameRun.mutate({ runId, title: nextTitle });
  };

  const handleDeleteRun = (run: SidebarRun) => {
    if (!window.confirm(`Delete "${run.title}"? This cannot be undone.`)) {
      return;
    }

    deleteRun.mutate({ runId: run.id });
  };

  const filteredMessages = selectedRunId 
    ? state.messages?.filter((m: { runId: string }) => m.runId === selectedRunId) 
    : [];

  // Active agents for the selected conversation
  const conversationWorkers = selectedRunId && state.workers && state.agents
    ? state.workers.filter((w: { runId: string, id: string }) => w.runId === selectedRunId && state.agents.some((a: { name: string }) => a.name === w.id))
    : [];

  const runs = (state.runs || []) as RunRecord[];
  const plans = (state.plans || []) as PlanRecord[];
  const planItems = (state.planItems || []) as PlanItemRecord[];
  const clarifications = (state.clarifications || []) as ClarificationRecord[];
  const validationRuns = (state.validationRuns || []) as ValidationRecord[];
  const currentProjectScope = resolveProjectScope({
    draftProjectPath,
    selectedRunId,
    plans,
    runs,
    explicitProjects,
  });

  const projectFilesQuery = useQuery<ProjectFilesResponse>({
    queryKey: ["project-files", currentProjectScope],
    queryFn: async () => {
      const res = await fetch(`/api/fs/files?root=${encodeURIComponent(currentProjectScope || "")}`);
      if (!res.ok) {
        throw new Error("Failed to load project files");
      }
      return res.json();
    },
    enabled: Boolean(currentProjectScope),
    staleTime: 60_000,
  });

  const activePlan = selectedRunId && runs.length && plans.length
    ? plans.find((p) => p.id === runs.find((r) => r.id === selectedRunId)?.planId) ?? null
    : null;
  const selectedRun = selectedRunId ? runs.find((run) => run.id === selectedRunId) ?? null : null;
  const activePlanItems = activePlan ? planItems.filter((item) => item.planId === activePlan.id) : [];
  const selectedClarifications = selectedRunId ? clarifications.filter((item) => item.runId === selectedRunId) : [];
  const selectedValidationRuns = selectedRunId ? validationRuns.filter((item) => item.runId === selectedRunId) : [];

  useEffect(() => {
    if (!selectedRunId) {
      return;
    }

    const latestForSelected = getRunLatestMessageTimestamp(selectedRunId, state.messages || []);
    if (!latestForSelected) {
      return;
    }

    setReadMarkers((current) => {
      if (current[selectedRunId] === latestForSelected) {
        return current;
      }
      return { ...current, [selectedRunId]: latestForSelected };
    });
  }, [selectedRunId, state.messages]);
  const activeMention = getActiveMentionQuery(command, commandCursor);
  const filteredProjectFiles = useMemo(() => {
    if (!activeMention) {
      return [];
    }

    const files = projectFilesQuery.data?.files ?? [];
    const needle = activeMention.query.toLowerCase();
    return files
      .filter((filePath) => needle.length === 0 || filePath.toLowerCase().includes(needle))
      .slice(0, 12);
  }, [activeMention, projectFilesQuery.data?.files]);
  const showMentionPicker = Boolean(
    activeMention && currentProjectScope && (filteredProjectFiles.length > 0 || projectFilesQuery.isFetched)
  );

  useEffect(() => {
    setMentionIndex(0);
  }, [activeMention?.query, currentProjectScope]);

  const applyMention = (filePath: string) => {
    if (!activeMention) {
      return;
    }

    const nextValue = replaceActiveMention(command, activeMention, filePath);
    const nextCursor = activeMention.start + filePath.length + 2;
    setCommand(nextValue);
    setCommandCursor(nextCursor);
    requestAnimationFrame(() => {
      commandInputRef.current?.focus();
      commandInputRef.current?.setSelectionRange(nextCursor, nextCursor);
    });
  };

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background text-foreground lg:h-screen">
      <div className="relative z-30 hidden h-full w-[280px] shrink-0 overflow-hidden border-r border-border lg:flex">
        <ConversationSidebar
          filteredProjects={filteredProjects as SidebarGroup[]}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedRunId={selectedRunId}
          messages={state.messages}
          readMarkers={readMarkers}
          showSettings={showSettings}
          setShowSettings={setShowSettings}
          apiKeys={apiKeys}
          setApiKeys={setApiKeys}
          saveSettings={saveSettings}
          openFolderPicker={() => setShowFolderPicker(true)}
          startNewPlan={handleStartNewPlan}
          beginConversationInProject={beginConversationInProject}
          handleRemoveProject={handleRemoveProject}
          selectRun={handleSelectRun}
          renamingRunId={renamingRunId}
          renameValue={renameValue}
          setRenameValue={setRenameValue}
          startRenamingRun={handleStartRenamingRun}
          commitRenamingRun={handleCommitRenamingRun}
          cancelRenamingRun={handleCancelRenamingRun}
          deleteRun={handleDeleteRun}
        />
      </div>

      <div className="relative flex min-w-0 flex-1 flex-col bg-background">
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
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  selectedRunId={selectedRunId}
                  messages={state.messages}
                  readMarkers={readMarkers}
                  showSettings={showSettings}
                  setShowSettings={setShowSettings}
                  apiKeys={apiKeys}
                  setApiKeys={setApiKeys}
                  saveSettings={saveSettings}
                  openFolderPicker={() => setShowFolderPicker(true)}
                  startNewPlan={handleStartNewPlan}
                  beginConversationInProject={beginConversationInProject}
                  handleRemoveProject={handleRemoveProject}
                  selectRun={handleSelectRun}
                  renamingRunId={renamingRunId}
                  renameValue={renameValue}
                  setRenameValue={setRenameValue}
                  startRenamingRun={handleStartRenamingRun}
                  commitRenamingRun={handleCommitRenamingRun}
                  cancelRenamingRun={handleCancelRenamingRun}
                  deleteRun={handleDeleteRun}
                />
              </SheetContent>
            </Sheet>

            {selectedRun ? (
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-semibold text-sm">{selectedRun.title || "New conversation"}</span>
                <span className="max-w-[24rem] truncate text-xs text-muted-foreground" title={selectedRun.projectPath || activePlan?.path || undefined}>
                  {selectedRun.projectPath || activePlan?.path || "Ad hoc request"}
                </span>
              </div>
            ) : draftProjectPath ? (
              <div className="flex min-w-0 flex-col">
                <span className="font-semibold text-sm">New Session</span>
                <span className="max-w-[24rem] truncate text-xs text-muted-foreground" title={draftProjectPath}>
                  Starting in {draftProjectPath}
                </span>
              </div>
            ) : (
              <span className="font-semibold text-sm">New Session</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="hidden h-8 w-8 text-muted-foreground hover:text-foreground lg:inline-flex" title="Toggle Global Workers" onClick={() => setRightSidebarOpen(!rightSidebarOpen)}>
              <PanelRight className="h-4 w-4" />
            </Button>
            <Sheet open={mobileWorkersOpen} onOpenChange={setMobileWorkersOpen}>
              <Button variant="ghost" size="icon" className="h-8 w-8 lg:hidden" aria-label="Open workers" onClick={() => setMobileWorkersOpen(true)}>
                <PanelRight className="h-4 w-4" />
              </Button>
              <SheetContent side="right" className="w-[min(22rem,calc(100vw-1rem))] p-0 lg:hidden" showCloseButton={false}>
                <SheetHeader className="border-b border-border/60">
                  <SheetTitle>Workers</SheetTitle>
                </SheetHeader>
                <WorkersSidebar agents={state.agents ?? []} onClose={() => setMobileWorkersOpen(false)} />
              </SheetContent>
            </Sheet>
          </div>
        </header>

        <ScrollArea className="min-h-0 flex-1" ref={scrollRef}>
          {selectedRunId ? (
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 pb-24 sm:gap-6 sm:p-6 sm:pb-20">
              {filteredMessages && filteredMessages.length > 0 ? (
                /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                filteredMessages.map((msg: any) => (
                  <div key={msg.id} className="group flex w-full flex-col text-sm">
                    <div className="mb-1.5 flex items-center gap-2 px-1">
                      <span className={`text-xs font-semibold capitalize tracking-wider ${msg.role === "user" ? "text-primary" : (msg.role === "system" ? "text-muted-foreground" : "text-emerald-600")}`}>
                        {msg.role === "user" ? "You" : msg.role}
                      </span>
                      <span className="text-[10px] text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100">
                        {new Date(msg.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className={`overflow-x-auto whitespace-pre-wrap rounded-xl border p-4 leading-relaxed ${msg.role === "user" ? "border-transparent bg-muted/30 text-foreground" : (msg.role === "system" ? "border-border/50 bg-background font-mono text-[11px] text-muted-foreground" : (msg.role === "worker" ? "border-[#333] bg-[#1e1e1e] font-mono text-[12px] text-emerald-400 shadow-sm" : "border-border bg-card"))}`}>
                      {msg.content}
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 pt-24 text-sm text-muted-foreground sm:pt-32">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
                    <Blocks className="h-6 w-6 opacity-50" />
                  </div>
                  <p>No output recorded yet for this run.</p>
                </div>
              )}

              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                <div>
                  <PlanProgress items={activePlanItems} />
                </div>
                <div>
                  <ClarificationPanel
                    clarifications={selectedClarifications}
                    onAnswer={(clarificationId, answer) => answerClarification.mutate({ clarificationId, answer })}
                  />
                </div>
                <div className="lg:col-span-2 xl:col-span-1">
                  <ValidationSummary validations={selectedValidationRuns} />
                </div>
              </div>

              {conversationWorkers.length > 0 && (
                <div className="mt-4 border-t border-border/50 pt-6 sm:mt-8">
                  <div className="mb-4 flex items-center gap-2 pl-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <Cpu className="h-4 w-4" /> Live CLI Agents
                  </div>
                  <div className="flex flex-col gap-6">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {conversationWorkers.map((worker: any) => {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const agent = state.agents.find((a: any) => a.name === worker.id);
                      return (
                        <div key={worker.id} className="flex flex-col overflow-hidden rounded-xl border border-border bg-background shadow-sm">
                          <div className="flex items-center justify-between border-b border-border bg-muted/20 p-2.5">
                            <span className="flex items-center gap-2 font-mono text-xs font-semibold text-foreground">
                              <TerminalIcon className="h-3 w-3" /> {worker.id}
                            </span>
                            <div className="flex items-center gap-2">
                              {agent?.state === "working" && <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />}
                              <span className="text-[10px] font-bold uppercase text-muted-foreground">
                                {agent?.type || worker.type}
                              </span>
                            </div>
                          </div>
                          <div className="relative h-64 w-full bg-[#1e1e1e] sm:h-72">
                            <Terminal agentName={worker.id} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center px-6 pt-[16vh] text-center sm:pt-[20vh]">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <Blocks className="h-8 w-8 text-primary" />
              </div>
              <h1 className="mb-2 text-2xl font-semibold">Welcome to OmniHarness</h1>
              <p className="mb-8 max-w-md text-sm text-muted-foreground">
                Enter a plan path or plain-English command below to spin up a supervised pool of headless CLI agents (Claude Code, Codex) and drive the work forward.
              </p>
            </div>
          )}
        </ScrollArea>

        <div className="relative z-20 w-full shrink-0 bg-background p-3 sm:p-4">
          <form onSubmit={handleSubmit} className="group relative mx-auto max-w-3xl">
            {showMentionPicker && (
              <div className="absolute inset-x-0 bottom-full mb-3 overflow-hidden rounded-2xl border border-border bg-background shadow-xl">
                <div className="border-b border-border/60 px-4 py-2 text-xs text-muted-foreground">
                  {currentProjectScope}
                </div>
                <div className="max-h-72 overflow-y-auto p-2">
                  {filteredProjectFiles.length > 0 ? (
                    filteredProjectFiles.map((filePath, index) => (
                      <button
                        key={filePath}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => applyMention(filePath)}
                        className={`flex w-full items-center rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                          index === mentionIndex ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted/60"
                        }`}
                      >
                        <span className="truncate">{filePath}</span>
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      No matching files in this project.
                    </div>
                  )}
                </div>
              </div>
            )}
            <Input
              type="text"
              ref={commandInputRef}
              value={command}
              onChange={(e) => {
                setCommand(e.target.value);
                setCommandCursor(e.target.selectionStart ?? e.target.value.length);
              }}
              onClick={(e) => setCommandCursor(e.currentTarget.selectionStart ?? 0)}
              onKeyUp={(e) => setCommandCursor(e.currentTarget.selectionStart ?? 0)}
              onKeyDown={(e) => {
                if (!showMentionPicker) {
                  return;
                }

                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setMentionIndex((current) => (current + 1) % Math.max(filteredProjectFiles.length, 1));
                  return;
                }

                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setMentionIndex((current) =>
                    current === 0 ? Math.max(filteredProjectFiles.length - 1, 0) : current - 1
                  );
                  return;
                }

                if ((e.key === "Enter" || e.key === "Tab") && filteredProjectFiles[mentionIndex]) {
                  e.preventDefault();
                  applyMention(filteredProjectFiles[mentionIndex]);
                  return;
                }

                if (e.key === "Escape") {
                  e.preventDefault();
                  setCommandCursor(0);
                }
              }}
              placeholder={draftProjectPath ? `${draftProjectPath}/...` : "e.g. vibes/test-plan.md or fix the login flow"}
              disabled={runCommand.isPending}
              className="h-14 w-full rounded-2xl border-border bg-background pl-4 pr-14 text-sm shadow-sm focus-visible:ring-1 focus-visible:ring-primary/50 sm:pl-5"
            />
            <Button 
              type="submit" 
              size="icon" 
              disabled={runCommand.isPending || !command.trim()} 
              className="absolute right-2 top-2 bottom-2 h-10 w-10 rounded-xl transition-all"
            >
              <ArrowUp className="h-5 w-5" />
            </Button>
          </form>
        </div>
      </div>

      {rightSidebarOpen && (
        <div className="hidden h-full w-80 shrink-0 border-l border-border lg:flex xl:w-96">
          <WorkersSidebar agents={state.agents ?? []} onClose={() => setRightSidebarOpen(false)} />
        </div>
      )}

      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>OmniHarness Configuration</DialogTitle>
            <DialogDescription>
              Configure the supervisor LLM and provider fallback credentials for this workspace.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
              <div>
                <div className="text-sm font-semibold">Supervisor LLM</div>
                <p className="text-xs text-muted-foreground">Configure the provider, model, endpoint, and credentials used by the supervisor.</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Provider</label>
                <select
                  className="h-8 w-full rounded border bg-muted/50 px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
                  value={apiKeys.SUPERVISOR_LLM_PROVIDER || "gemini"}
                  onChange={e => setApiKeys(p => ({ ...p, SUPERVISOR_LLM_PROVIDER: e.target.value }))}
                >
                  <option value="gemini">Gemini</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="openai">OpenAI</option>
                  <option value="openrouter">OpenRouter</option>
                  <option value="openai-compatible">OpenAI-Compatible</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Model</label>
                <Input
                  value={apiKeys.SUPERVISOR_LLM_MODEL || ""}
                  onChange={e => setApiKeys(p => ({ ...p, SUPERVISOR_LLM_MODEL: e.target.value }))}
                  placeholder="gemini-3.1-pro-preview"
                  className="h-8 bg-muted/50 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Endpoint</label>
                <Input
                  value={apiKeys.SUPERVISOR_LLM_BASE_URL || ""}
                  onChange={e => setApiKeys(p => ({ ...p, SUPERVISOR_LLM_BASE_URL: e.target.value }))}
                  placeholder="Optional custom base URL"
                  className="h-8 bg-muted/50 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">API Key</label>
                <Input
                  type="password"
                  value={apiKeys.SUPERVISOR_LLM_API_KEY || ""}
                  onChange={e => setApiKeys(p => ({ ...p, SUPERVISOR_LLM_API_KEY: e.target.value }))}
                  placeholder="Optional override for the selected provider"
                  className="h-8 bg-muted/50 text-xs"
                />
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Provider Fallback Keys</div>
              <p className="text-xs text-muted-foreground">Used when the generic supervisor API key above is blank.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">OpenAI API Key</label>
                <Input type="password" value={apiKeys.OPENAI_API_KEY} onChange={e => setApiKeys(p => ({ ...p, OPENAI_API_KEY: e.target.value }))} className="h-8 bg-muted/50 text-xs" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Anthropic API Key</label>
                <Input type="password" value={apiKeys.ANTHROPIC_API_KEY} onChange={e => setApiKeys(p => ({ ...p, ANTHROPIC_API_KEY: e.target.value }))} className="h-8 bg-muted/50 text-xs" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold text-muted-foreground">Gemini API Key</label>
                <Input type="password" value={apiKeys.GEMINI_API_KEY} onChange={e => setApiKeys(p => ({ ...p, GEMINI_API_KEY: e.target.value }))} className="h-8 bg-muted/50 text-xs" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Credit Exhaustion Strategy</label>
              <select
                className="h-8 w-full rounded border bg-muted/50 px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
                value={apiKeys.CREDIT_STRATEGY || "swap_account"}
                onChange={e => setApiKeys(p => ({ ...p, CREDIT_STRATEGY: e.target.value }))}
              >
                <option value="swap_account">Swap Account</option>
                <option value="fallback_api">Fallback API</option>
                <option value="wait_for_reset">Wait for Reset</option>
                <option value="cross_provider">Cross Provider</option>
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowSettings(false)}>Cancel</Button>
            <Button onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FolderPickerDialog 
        open={showFolderPicker} 
        onOpenChange={setShowFolderPicker} 
        onSelect={handleAddProject} 
      />
    </div>
  );
}
