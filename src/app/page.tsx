"use client";

import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Terminal } from "@/components/Terminal";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Folder, Settings, Terminal as TerminalIcon, PanelRight, Plus, Search, Blocks, Clock, CheckCircle2, XCircle, Cpu, ArrowUp, FolderPlus, MoreHorizontal, Trash2 } from "lucide-react";
import { FolderPickerDialog } from "@/components/FolderPickerDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ClarificationPanel } from "@/components/ClarificationPanel";
import { PlanProgress } from "@/components/PlanProgress";
import { ValidationSummary } from "@/components/ValidationSummary";

type PlanRecord = { id: string; path: string };
type RunRecord = { id: string; planId: string; status: string; createdAt: string };
type PlanItemRecord = { id: string; planId: string; title: string; phase: string | null; status: string };
type ClarificationRecord = { id: string; runId: string; question: string; answer: string | null; status: string };
type ValidationRecord = { id: string; runId: string; status: string; summary: string | null; evidence: string | null };

export default function Home() {
  const [command, setCommand] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({ OPENAI_API_KEY: '', ANTHROPIC_API_KEY: '', GEMINI_API_KEY: '', CREDIT_STRATEGY: 'swap_account', PROJECTS: '[]' });
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
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

  useEffect(() => {
    const eventSource = new EventSource("/api/events");
    eventSource.addEventListener("update", (e) => {
      try {
        const data = JSON.parse(e.data);
        setState(data);
      } catch (_err) {
        // ignore
      }
    });

    return () => {
      eventSource.close();
    };
  }, []);

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

  const runCommand = useMutation({
    mutationFn: async (cmd: string) => {
      const res = await fetch("/api/supervisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: cmd }),
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

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [state.messages, selectedRunId, state.agents]);

  // Explicit Projects
  const explicitProjects = apiKeys.PROJECTS ? JSON.parse(apiKeys.PROJECTS) : [];

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

  const groupedProjects = explicitProjects.map((projPath: string) => {
    const runsInProj = (state.runs || []).filter((run: { planId: string }) => {
      const plan = state.plans?.find((p: { id: string, path: string }) => p.id === run.planId);
      return plan && (plan.path.startsWith(projPath) || plan.path.includes(projPath.split('/').pop() || projPath));
    }).map((run: { planId: string, id: string, status: string, createdAt: string }) => {
      const plan = state.plans.find((p: { id: string, path: string }) => p.id === run.planId);
      return { ...run, path: plan?.path || "Unknown Plan" };
    });
    return { path: projPath, name: projPath.split('/').pop() || projPath, runs: runsInProj };
  });

  const otherRuns = (state.runs || []).filter((run: { planId: string }) => {
    const plan = state.plans?.find((p: { id: string, path: string }) => p.id === run.planId);
    if (!plan) return false;
    return !explicitProjects.some((projPath: string) => plan.path.startsWith(projPath) || plan.path.includes(projPath.split('/').pop() || projPath));
  }).map((run: { planId: string, id: string, status: string, createdAt: string }) => {
    const plan = state.plans.find((p: { id: string, path: string }) => p.id === run.planId);
    return { ...run, path: plan?.path || "Unknown Plan" };
  });

  if (otherRuns.length > 0) {
    groupedProjects.push({ path: "other", name: "Other Conversations", runs: otherRuns });
  }

  const filteredProjects = groupedProjects.map((group: { path: string, name: string, runs: unknown[] }) => {
    if (!searchQuery) return group;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const runs = (group.runs as any[]).filter((run: { path: string }) => 
      run.path.toLowerCase().includes(searchQuery.toLowerCase()) || 
      group.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return { ...group, runs };
  }).filter((group: { name: string, runs: unknown[] }) => group.runs.length > 0 || group.name.toLowerCase().includes(searchQuery.toLowerCase()));

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

  const activePlan = selectedRunId && runs.length && plans.length
    ? plans.find((p) => p.id === runs.find((r) => r.id === selectedRunId)?.planId) ?? null
    : null;
  const activePlanItems = activePlan ? planItems.filter((item) => item.planId === activePlan.id) : [];
  const selectedClarifications = selectedRunId ? clarifications.filter((item) => item.runId === selectedRunId) : [];
  const selectedValidationRuns = selectedRunId ? validationRuns.filter((item) => item.runId === selectedRunId) : [];

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden text-foreground">
      
      {/* Left Sidebar: Conversations & Settings */}
      <div className="w-[280px] flex flex-col bg-muted/30 border-r border-border shrink-0 h-full relative z-30">
        
        <div className="p-3 space-y-1 mt-2">
          <Button variant="ghost" className="w-full justify-start text-sm h-9 px-2" onClick={() => setSelectedRunId(null)}>
            <Plus className="mr-2 h-4 w-4" /> New plan
          </Button>
          <div className="relative mt-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              type="text" 
              placeholder="Search..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-8 text-sm bg-muted/50 border-transparent hover:border-border focus-visible:border-border focus-visible:ring-1 focus-visible:bg-background transition-all"
            />
          </div>
        </div>

        {/* Conversations List */}
        <ScrollArea className="flex-1 px-3 mt-4">
          <div className="space-y-4 pb-20">
            <div className="flex items-center justify-between ml-2 mr-1">
              <h3 className="text-xs font-semibold text-muted-foreground">PROJECTS</h3>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => setShowFolderPicker(true)}>
                <FolderPlus className="h-3.5 w-3.5" />
              </Button>
            </div>
            
            {filteredProjects.length > 0 ? (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              filteredProjects.map((group: any) => (
                <Collapsible key={group.path} defaultOpen>
                  <div className="flex items-center justify-between hover:bg-muted/30 rounded px-2 mb-1 group">
                    <CollapsibleTrigger className="flex flex-1 items-center gap-2 font-medium hover:text-foreground text-muted-foreground transition-colors text-sm py-1">
                      <Folder className="h-4 w-4 shrink-0 text-primary/70" /> 
                      <span className="truncate">{group.name}</span>
                    </CollapsibleTrigger>
                    
                    {group.path !== "other" && (
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground shrink-0">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer" onClick={() => handleRemoveProject(group.path)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Remove Project
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>

                  <CollapsibleContent className="space-y-0.5">
                    {group.runs.length === 0 && (
                      <div className="pl-8 py-1 text-xs text-muted-foreground/60 italic">No conversations</div>
                    )}
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {group.runs.map((run: any) => (
                      <div 
                        key={run.id} 
                        onClick={() => setSelectedRunId(run.id)}
                        className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors text-sm flex flex-col gap-0.5 ml-3 border border-transparent ${selectedRunId === run.id ? 'bg-primary/10 text-primary font-medium border-primary/20' : 'hover:bg-muted/80 text-muted-foreground'}`}
                      >
                        <div className="truncate flex items-center justify-between" title={run.path}>
                          <span className="truncate text-[13px]">{run.path.split('/').pop()}</span>
                          {run.status === 'running' && <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse ml-2 shrink-0" />}
                          {run.status === 'done' && <CheckCircle2 className="h-3 w-3 text-green-500 ml-2 shrink-0" />}
                          {run.status === 'failed' && <XCircle className="h-3 w-3 text-red-500 ml-2 shrink-0" />}
                        </div>
                        <div className="text-[10px] opacity-70 flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {new Date(run.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              ))
            ) : (
              <p className="text-muted-foreground text-sm pl-2">No projects added.</p>
            )}
          </div>
        </ScrollArea>

        {/* Settings Footer */}
        <div className="p-3 shrink-0">
          <Button variant="ghost" className="w-full justify-start text-sm h-9 px-2 text-muted-foreground hover:text-foreground" onClick={() => setShowSettings(!showSettings)}>
            <Settings className="mr-2 h-4 w-4" /> Settings
          </Button>

          {showSettings && (
            <div className="absolute bottom-14 left-4 w-[320px] bg-background border border-border rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col">
              <div className="p-3 border-b bg-muted/20 font-semibold text-sm">
                OmniHarness Configuration
              </div>
              <div className="p-4 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">OpenAI API Key</label>
                  <Input type="password" value={apiKeys.OPENAI_API_KEY} onChange={e => setApiKeys(p => ({ ...p, OPENAI_API_KEY: e.target.value }))} className="h-8 text-xs bg-muted/50" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Anthropic API Key</label>
                  <Input type="password" value={apiKeys.ANTHROPIC_API_KEY} onChange={e => setApiKeys(p => ({ ...p, ANTHROPIC_API_KEY: e.target.value }))} className="h-8 text-xs bg-muted/50" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Gemini API Key</label>
                  <Input type="password" value={apiKeys.GEMINI_API_KEY} onChange={e => setApiKeys(p => ({ ...p, GEMINI_API_KEY: e.target.value }))} className="h-8 text-xs bg-muted/50" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Credit Exhaustion Strategy</label>
                  <select
                    className="w-full border rounded h-8 text-xs px-2 bg-muted/50 text-foreground outline-none focus:ring-1 focus:ring-ring"
                    value={apiKeys.CREDIT_STRATEGY || 'swap_account'}
                    onChange={e => setApiKeys(p => ({ ...p, CREDIT_STRATEGY: e.target.value }))}
                  >
                    <option value="swap_account">Swap Account</option>
                    <option value="fallback_api">Fallback API</option>
                    <option value="wait_for_reset">Wait for Reset</option>
                    <option value="cross_provider">Cross Provider</option>
                  </select>
                </div>
                <div className="pt-2 flex justify-end gap-2">
                  <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setShowSettings(false)}>Cancel</Button>
                  <Button size="sm" className="h-8 text-xs" onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>Save</Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area (Chat Panel) */}
      <div className="flex-1 flex flex-col h-full bg-background min-w-0 relative">
        
        {/* Header */}
        <header className="h-14 flex items-center justify-between px-4 shrink-0 border-b border-border/50">
          <div className="flex items-center gap-3">
            {activePlan ? (
              <span className="font-semibold text-sm">{activePlan.path}</span>
            ) : (
              <span className="font-semibold text-sm">New Session</span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Toggle Global Workers" onClick={() => setRightSidebarOpen(!rightSidebarOpen)}>
              <PanelRight className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Chat Messages */}
        <ScrollArea className="flex-1" ref={scrollRef}>
          {selectedRunId ? (
            <div className="max-w-3xl mx-auto flex flex-col gap-6 p-6 pb-20">
              
              {filteredMessages && filteredMessages.length > 0 ? (
                /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                filteredMessages.map((msg: any) => (
                  <div key={msg.id} className="flex flex-col text-sm w-full group">
                    <div className="flex items-center gap-2 mb-1.5 px-1">
                      <span className={`font-semibold capitalize text-xs tracking-wider ${msg.role === 'user' ? 'text-primary' : (msg.role === 'system' ? 'text-muted-foreground' : 'text-emerald-600')}`}>
                        {msg.role === 'user' ? 'You' : msg.role}
                      </span>
                      <span className="text-[10px] text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity">
                        {new Date(msg.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className={`p-4 rounded-xl leading-relaxed whitespace-pre-wrap border overflow-x-auto ${msg.role === 'user' ? 'bg-muted/30 border-transparent text-foreground' : (msg.role === 'system' ? 'bg-background border-border/50 font-mono text-[11px] text-muted-foreground' : (msg.role === 'worker' ? 'bg-[#1e1e1e] text-emerald-400 border-[#333] font-mono text-[12px] shadow-sm' : 'bg-card border-border'))}`}>
                      {msg.content}
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center text-muted-foreground text-sm pt-32 gap-3">
                  <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center">
                    <Blocks className="h-6 w-6 opacity-50" />
                  </div>
                  <p>No output recorded yet for this run.</p>
                </div>
              )}

              {/* Inline Live Terminals for active conversation */}
              <div className="grid gap-4 xl:grid-cols-3">
                <div className="xl:col-span-1">
                  <PlanProgress items={activePlanItems} />
                </div>
                <div className="xl:col-span-1">
                  <ClarificationPanel
                    clarifications={selectedClarifications}
                    onAnswer={(clarificationId, answer) => answerClarification.mutate({ clarificationId, answer })}
                  />
                </div>
                <div className="xl:col-span-1">
                  <ValidationSummary validations={selectedValidationRuns} />
                </div>
              </div>

              {conversationWorkers.length > 0 && (
                <div className="mt-8 pt-6 border-t border-border/50">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 pl-1">
                    <Cpu className="h-4 w-4" /> Live CLI Agents
                  </div>
                  <div className="flex flex-col gap-6">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {conversationWorkers.map((worker: any) => {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const agent = state.agents.find((a: any) => a.name === worker.id);
                      return (
                        <div key={worker.id} className="flex flex-col rounded-xl border border-border shadow-sm overflow-hidden bg-background">
                          <div className="p-2.5 border-b border-border flex flex-row justify-between items-center bg-muted/20">
                            <span className="font-mono text-xs font-semibold text-foreground flex items-center gap-2">
                              <TerminalIcon className="h-3 w-3" /> {worker.id}
                            </span>
                            <div className="flex items-center gap-2">
                              {agent?.state === 'working' && <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />}
                              <span className="text-[10px] uppercase font-bold text-muted-foreground">
                                {agent?.type || worker.type}
                              </span>
                            </div>
                          </div>
                          <div className="h-72 w-full bg-[#1e1e1e] relative">
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
            <div className="h-full flex flex-col items-center justify-center pt-[20vh] max-w-2xl mx-auto px-6">
              <div className="h-16 w-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-6">
                <Blocks className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-2xl font-semibold mb-2">Welcome to OmniHarness</h1>
              <p className="text-muted-foreground text-center mb-8 text-sm max-w-md">
                Enter a plan path below to automatically spin up a supervised pool of headless CLI agents (Claude Code, Codex) to complete the tasks.
              </p>
            </div>
          )}
        </ScrollArea>

        {/* Input Form at Bottom */}
        <div className="p-4 bg-background shrink-0 w-full relative z-20">
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto relative group">
            <Input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="e.g. implement vibes/test-plan.md"
              disabled={runCommand.isPending}
              className="w-full h-14 pl-5 pr-14 text-sm rounded-2xl border-border shadow-sm focus-visible:ring-1 focus-visible:ring-primary/50 bg-background"
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

      {/* Right Sidebar (Global Workers) */}
      {rightSidebarOpen && (
        <div className="w-80 border-l border-border bg-muted/10 flex flex-col shrink-0 h-full">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Cpu className="h-4 w-4" /> Global Workers
            </h3>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => setRightSidebarOpen(false)}>
              <XCircle className="h-4 w-4" />
            </Button>
          </div>
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {state.agents && state.agents.length > 0 ? (
                /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                state.agents.map((agent: any) => (
                  <div key={agent.name} className="flex flex-col border border-border rounded-lg bg-background overflow-hidden shadow-sm">
                    <div className="p-2 border-b border-border flex flex-row justify-between items-center bg-muted/30">
                      <span className="font-mono text-xs font-semibold truncate mr-2" title={agent.name}>{agent.name}</span>
                      <span className="text-[9px] uppercase font-bold text-muted-foreground">
                        {agent.state}
                      </span>
                    </div>
                    <div className="h-48 w-full bg-[#1e1e1e] relative">
                      <Terminal agentName={agent.name} />
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-xs border border-dashed rounded-md bg-transparent">
                  <TerminalIcon className="h-6 w-6 mb-2 opacity-30" />
                  No workers running.
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      )}
      
      <FolderPickerDialog 
        open={showFolderPicker} 
        onOpenChange={setShowFolderPicker} 
        onSelect={handleAddProject} 
      />

    </div>
  );
}
