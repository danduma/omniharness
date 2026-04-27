import fs from "fs";
import path from "path";
import { test, expect } from "vitest";
import { shouldConversationFollowLatest } from "@/app/home/useRunSelectionEffects";

const readSource = (relativePath: string) => fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
const pageSource = [
  "src/app/page.tsx",
  "src/app/home/HomeApp.tsx",
  "src/app/home/constants.ts",
  "src/app/home/useAppErrors.ts",
  "src/app/home/useConversationExecutionStatus.ts",
  "src/app/home/useHomeLifecycle.ts",
  "src/app/home/useRunSelectionEffects.ts",
  "src/app/home/utils.ts",
  "src/components/home/ConversationComposer.tsx",
  "src/components/home/ConversationMain.tsx",
  "src/components/home/ConversationSidebar.tsx",
  "src/components/home/HomeHeader.tsx",
  "src/components/home/SettingsDialog.tsx",
  "src/components/home/WorkersSidebar.tsx",
].map(readSource).join("\n");
const conversationModePickerSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/components/ConversationModePicker.tsx"),
  "utf8"
);
const agentSurfaceSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/components/AgentSurface.tsx"),
  "utf8"
);
const workerCardSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/components/WorkerCard.tsx"),
  "utf8"
);

test("desktop conversation rail constrains overflowing run content", () => {
  expect(pageSource).toContain('hidden h-full w-[280px] shrink-0 overflow-hidden border-r border-border lg:flex');
  expect(pageSource).toContain('relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-muted/30');
  expect(pageSource).toContain('min-h-0 flex-1 overflow-hidden');
  expect(pageSource).toContain('mt-auto shrink-0 border-t border-border/60 bg-background/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/80');
  expect(pageSource).toContain('ml-3 group flex min-w-0 cursor-pointer gap-2 overflow-hidden rounded-lg border px-3 py-1.5 text-sm transition-colors');
  expect(pageSource).toContain('flex w-4 shrink-0 items-center justify-center');
  expect(pageSource).not.toContain('flex w-4 shrink-0 items-start justify-center pt-0.5');
  expect(pageSource).toContain('min-w-0 flex items-center justify-between gap-2');
  expect(agentSurfaceSource).toContain('className={cn("overflow-hidden rounded-2xl border border-white/10 bg-[#0d0f12] text-zinc-100 shadow-[0_24px_70px_rgba(0,0,0,0.32)]", className)}');
  expect(agentSurfaceSource).toContain('className="border-b border-white/10 bg-[#13161b] px-4 py-3"');
  expect(workerCardSource).toContain("Permissions waiting");
  expect(workerCardSource).toContain("Context usage unavailable");
  expect(workerCardSource).toContain("Context usage ");
  expect(pageSource).toContain("Claude Code");
  expect(workerCardSource).toContain("Context unavailable");
  expect(workerCardSource).toContain('className="truncate text-[13px] leading-5 text-zinc-400"');
  expect(pageSource).not.toContain("Recent output");
  expect(pageSource).toContain('className={cn(visibleWorkers.length > 0 ? "space-y-4" : "flex h-full min-h-full flex-col")}');
  expect(pageSource).toContain('className="flex h-full min-h-[16rem] flex-1 flex-col items-center justify-center rounded-md border border-dashed bg-transparent text-xs text-muted-foreground"');
  expect(pageSource).not.toContain('className="flex h-32 flex-col items-center justify-center rounded-md border border-dashed bg-transparent text-xs text-muted-foreground"');
});

test("workers sidebar is conversation-scoped and resizable", () => {
  expect(pageSource).toContain('const [rightSidebarWidth, setRightSidebarWidth] = useState(420)');
  expect(pageSource).toContain('window.localStorage.getItem("omni-workers-sidebar-width")');
  expect(pageSource).toContain('window.localStorage.setItem("omni-workers-sidebar-width", String(rightSidebarWidth))');
  expect(pageSource).toContain('title="Toggle Conversation Workers"');
  expect(pageSource).toContain('<WorkersSidebar');
  expect(pageSource).toContain('workers={selectedRunWorkers}');
  expect(pageSource).toContain('agents={conversationAgents}');
  expect(pageSource).toContain('const [activeTab, setActiveTab] = useState<"active" | "finished">("active")');
  expect(pageSource).toContain("Active ({workerGroups.active.length})");
  expect(pageSource).toContain("Finished ({workerGroups.finished.length})");
  expect(pageSource).toContain('const liveAgentsById = new Map(');
  expect(pageSource).toContain('preferredModel={selectedRun?.preferredWorkerModel ?? null}');
  expect(pageSource).toContain('preferredEffort={selectedRun?.preferredWorkerEffort ?? null}');
  expect(pageSource).toContain('onClose={() => setMobileWorkersOpen(false)}');
  expect(pageSource).toContain('onClose={() => setRightSidebarOpen(false)}');
  expect(pageSource).toContain('style={{ width: rightSidebarWidth }}');
  expect(pageSource).toContain('aria-label="Resize workers sidebar"');
  expect(pageSource).toContain('onPointerDown={handleRightSidebarResizeStart}');
  expect(pageSource).toContain('export const PRODUCT_NAME = "OmniHarness";');
  expect(pageSource).toContain("<SheetTitle>{PRODUCT_NAME}</SheetTitle>");
  expect(pageSource).not.toContain("<SheetTitle>Navigation</SheetTitle>");
  expect(pageSource).not.toContain('queryClient.removeQueries({ queryKey: ["conversation-agent", workerId], exact: true })');
  expect(workerCardSource).toContain('function renderContextMeter(fullnessPercent: number | null | undefined)');
  expect(workerCardSource).toContain("Permissions waiting");
  expect(workerCardSource).toContain("Context usage unavailable");
  expect(workerCardSource).toContain("conic-gradient");
  expect(pageSource).not.toContain("Context window");
  expect(pageSource).not.toContain("Pending permissions");
  expect(pageSource).not.toContain('filter(([, value]) => Boolean(value))');
  expect(pageSource).not.toContain("Recent output");
  expect(pageSource).not.toContain("Session ID");
  expect(pageSource).not.toContain("Attention needed");
  expect(pageSource).not.toContain('border border-emerald-400/30 bg-emerald-400/10');
  expect(pageSource).not.toContain("Global Workers");
  expect(pageSource).not.toContain('<WorkersSidebar agents={state.agents ?? []} onClose={() => setRightSidebarOpen(false)} />');
});

test("worker detail renders from streamed agent state instead of per-worker polling", () => {
  expect(pageSource).not.toContain("const conversationAgentQueries = useQueries({");
  expect(pageSource).not.toContain('queryKey: ["conversation-agent", worker.id]');
  expect(pageSource).not.toContain('return requestJson<AgentSnapshot>(`/api/agents/${worker.id}`, undefined, {');
  expect(pageSource).not.toContain('refetchInterval: ["starting", "working", "stuck"].includes(normalizeWorkerStatus(worker.status)) ? 2000 : false');
  expect(pageSource).toContain('const liveAgentsById = new Map(');
  expect(pageSource).toContain('const liveAgent = liveAgentsById.get(worker.id);');
});

test("conversation output only follows live worker updates when already near the bottom", () => {
  expect(shouldConversationFollowLatest({
    scrollTop: 696,
    clientHeight: 300,
    scrollHeight: 1000,
  })).toBe(true);

  expect(shouldConversationFollowLatest({
    scrollTop: 680,
    clientHeight: 300,
    scrollHeight: 1000,
  })).toBe(false);
});

test("main conversation only renders active worker panes while the sidebar keeps finished workers", () => {
  expect(pageSource).toContain('{isImplementationConversation && conversationWorkerGroups.active.length > 0 && (');
  expect(pageSource).toContain('{conversationWorkerGroups.active.map((worker) => {');
  expect(pageSource).toContain('<AgentSurface');
  expect(pageSource).toContain('title="Planning agent"');
  expect(pageSource).toContain("<Cpu className=\"h-4 w-4\" /> CLI Agents");
  expect(pageSource).toContain('defaultOpen={false}');
  expect(pageSource).toContain('defaultOpen={activeTab === "active"}');
  expect(pageSource).not.toContain("<Cpu className=\"h-4 w-4\" /> Live CLI Agents");
  expect(pageSource).not.toContain('{conversationWorkers.length > 0 && (');
  expect(pageSource).not.toContain('{conversationWorkers.map((worker: any) => {');
});

test("direct conversations render the user transcript next to the worker surface", () => {
  expect(pageSource).toContain("const directConversationMessages = useMemo(() => {");
  expect(pageSource).toContain("const [expandedDirectMessageIds, setExpandedDirectMessageIds] = useState<Set<string>>(() => new Set())");
  expect(pageSource).toContain("function toggleDirectMessageExpansion(messageId: string)");
  expect(pageSource).toContain("const primaryConversationAgent = useMemo(() => {");
  expect(pageSource).toContain("if (!isDirectConversation) {");
  expect(pageSource).toContain('conversationAgents.find((agent) => agent.state === "working" || Boolean(agent.currentText?.trim()))');
  expect(pageSource).toContain('?? conversationAgents.find((agent) => agent.state !== "cancelled")');
  expect(pageSource).toContain('{directConversationMessages.length > 0 ? (');
  expect(pageSource).toContain('directConversationMessages.map((msg: MessageRecord) => {');
  expect(pageSource).toContain('.filter((message) => message.role === "user")');
  expect(pageSource).not.toContain('message.role === "user" || (message.role === "worker" && message.content.trim())');
  expect(pageSource).toContain('const isExpanded = expandedDirectMessageIds.has(msg.id);');
  expect(pageSource).toContain('className="flex justify-end"');
  expect(pageSource).toContain('const handleCopyDirectMessage = async (content: string) => {');
  expect(pageSource).toContain('await navigator.clipboard.writeText(content);');
  expect(pageSource).toContain('select-text');
  expect(pageSource).toContain('aria-label={isExpanded ? "Show less message text" : "Show more message text"}');
  expect(pageSource).toContain('onClick={() => toggleDirectMessageExpansion(msg.id)}');
  expect(pageSource).toContain('maxHeight: isExpanded ? undefined : "calc(1.5rem * 6)"');
  expect(pageSource).toContain('const isLongMessage = msg.content.length > 420 || msg.content.split(/\\r\\n|\\r|\\n/).length > 6;');
  expect(pageSource).toContain('{isExpanded || isLongMessage ? (');
  expect(pageSource).toContain('{isExpanded ? "less" : "...more"}');
  expect(pageSource).toContain('text-white');
  expect(pageSource).toContain('aria-label="Copy message"');
  expect(pageSource).toContain('aria-label="Rerun from here"');
  expect(pageSource).toContain('onClick={() => handleRetryMessage(msg.id)}');
  expect(pageSource).toContain('rounded-[1.9rem] rounded-br-lg bg-[#242424]');
  expect(pageSource).toContain('px-4 py-2.5');
  expect(pageSource).toContain('text-sm leading-6');
  expect(pageSource).not.toContain('text-[1.375rem]');
  expect(pageSource).toContain('cursor-pointer');
  expect(pageSource).toContain('overflow-hidden');
  expect(pageSource).toContain('<Terminal');
  expect(pageSource).toContain('variant="native"');
  expect(pageSource).toContain('agent={primaryConversationAgent}');
  expect(pageSource).not.toContain('Direct transcript');
  expect(pageSource).not.toContain('title={selectedRun?.title || "Direct control"}');
});

test("settings render as a centered app modal with supervisor llm controls", () => {
  expect(pageSource).toContain('import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox"');
  expect(pageSource).toContain('import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"');
  expect(pageSource).toContain('<Dialog open={open} onOpenChange={onOpenChange}>');
  expect(pageSource).toContain('className="sm:max-w-xl"');
  expect(pageSource).toContain("Supervisor LLM");
  expect(pageSource).toContain("Fallback LLM");
  expect(pageSource).toContain("LLM Settings");
  expect(pageSource).toContain("Supervisor Credentials");
  expect(pageSource).toContain("Fallback Credentials");
  expect(pageSource).toContain("activeSettingsTab === \"llm\"");
  expect(pageSource).toContain("activeSettingsTab === \"workers\"");
  expect(pageSource).toContain("SUPERVISOR_LLM_PROVIDER");
  expect(pageSource).toContain("SUPERVISOR_LLM_MODEL");
  expect(pageSource).toContain("SUPERVISOR_LLM_BASE_URL");
  expect(pageSource).toContain("SUPERVISOR_LLM_API_KEY");
  expect(pageSource).toContain("SUPERVISOR_FALLBACK_LLM_PROVIDER");
  expect(pageSource).toContain("SUPERVISOR_FALLBACK_LLM_MODEL");
  expect(pageSource).toContain("SUPERVISOR_FALLBACK_LLM_BASE_URL");
  expect(pageSource).toContain("SUPERVISOR_FALLBACK_LLM_API_KEY");
  expect(pageSource).toContain("/api/llm-models");
  expect(pageSource).toContain("/api/agents/catalog");
  expect(pageSource).toContain('enabled: provider === "gemini" && apiKey.trim().length > 0');
  expect(pageSource).toContain("<Combobox");
  expect(pageSource).toContain("Search Gemini models");
  expect(pageSource).toContain("Gemini model ids load automatically from the API key and appear in a searchable dropdown.");
  expect(pageSource).toContain("Worker Agents");
  expect(pageSource).toContain("Default Worker Agent");
  expect(pageSource).toContain("YOLO Worker Mode");
  expect(pageSource).toContain("WORKER_YOLO_MODE");
  expect(pageSource).toContain("Only currently available bridge workers can be enabled for new conversations.");
  expect(pageSource).toContain("WORKER_ALLOWED_TYPES");
  expect(pageSource).toContain("WORKER_DEFAULT_TYPE");
  expect(pageSource).toContain('className="flex min-w-0 flex-1 items-start gap-3"');
  expect(pageSource).toContain('className="text-sm font-medium break-words"');
  expect(pageSource).toContain('className="text-xs break-words text-muted-foreground"');
});

test("header includes a persistent day night mode toggle beside the workers sidebar button", () => {
  expect(pageSource).toContain('const [themeMode, setThemeMode] = useState<"day" | "night">("day")');
  expect(pageSource).toContain("const didMountThemeEffectRef = useRef(false)");
  expect(pageSource).toContain('window.localStorage.getItem("omni-theme-mode")');
  expect(pageSource).toContain("if (!didMountThemeEffectRef.current)");
  expect(pageSource).toContain('window.localStorage.setItem("omni-theme-mode", themeMode)');
  expect(pageSource).toContain('document.documentElement.classList.toggle("dark", themeMode === "night")');
  expect(pageSource).toContain('aria-label={themeMode === "night" ? "Switch to day mode" : "Switch to night mode"}');
  expect(pageSource).toContain('setThemeMode((current) => (current === "day" ? "night" : "day"))');
  expect(pageSource).toContain('themeMode === "night" ? <Sun');
  expect(pageSource).toContain(': <Moon');
  expect(pageSource).toContain('title="Toggle Conversation Workers"');
  expect(pageSource).not.toContain(">Day<");
  expect(pageSource).not.toContain(">Night<");
});

test("sidebar phone pairing entry point is hidden on mobile layouts", () => {
  expect(pageSource).toContain('className="mb-1 hidden h-9 w-full justify-start px-2 text-sm text-muted-foreground hover:text-foreground lg:flex"');
});

test("header syncs the active conversation path but only shows the cwd", () => {
  expect(pageSource).toContain('const [routeReady, setRouteReady] = useState(false)');
  expect(pageSource).toContain("const activeConversationCwd = selectedRun?.projectPath || activePlan?.path || draftProjectPath || null;");
  expect(pageSource).toContain('window.location.pathname');
  expect(pageSource).toContain('window.history.replaceState(window.history.state, "", nextPath)');
  expect(pageSource).toContain('`/session/${selectedRunId}`');
  expect(pageSource).not.toContain('window.localStorage.getItem(LAST_RUN_ROUTE_STORAGE_KEY)');
  expect(pageSource).not.toContain('window.localStorage.setItem(LAST_RUN_ROUTE_STORAGE_KEY, selectedRunId)');
  expect(pageSource).not.toContain('window.localStorage.removeItem(LAST_RUN_ROUTE_STORAGE_KEY)');
  expect(pageSource).toContain('aria-label="Current working directory"');
  expect(pageSource).toContain('{activeConversationCwd || "No working directory"}');
});

test("command input uses a fixed helper placeholder instead of echoing the selected directory", () => {
  expect(pageSource).toContain('placeholder="Ask Omni anything. @ to refer to files"');
  expect(pageSource).not.toContain('placeholder={draftProjectPath ? `${draftProjectPath}/...` : "e.g. vibes/test-plan.md or fix the login flow"}');
});

test("send button swaps to a spinner while a command submission is pending", () => {
  expect(pageSource).toContain("const isComposerSubmitting = runCommand.isPending || sendConversationMessage.isPending || promotePlanningConversation.isPending");
  expect(pageSource).toContain('disabled={isComposerSubmitting || (!command.trim() && !isSupervisorRunning)}');
  expect(pageSource).toContain('{isComposerSubmitting ? (');
  expect(pageSource).toContain('<LoaderCircle className="h-5 w-5 animate-spin" />');
  expect(pageSource).toContain(') : (');
  expect(pageSource).toContain('<ArrowUp className="h-5 w-5" />');
});

test("project groups show a loading indicator while conversations are still hydrating", () => {
  expect(pageSource).toContain("const [hasReceivedInitialEventStreamPayload, setHasReceivedInitialEventStreamPayload] = useState(false)");
  expect(pageSource).toContain("const isHydratingConversations = appUnlocked && !hasReceivedInitialEventStreamPayload;");
  expect(pageSource).toContain("isHydratingConversations={isHydratingConversations}");
  expect(pageSource).toContain("Loading conversations...");
});

test("project group collapsed state survives page reloads", () => {
  expect(pageSource).toContain("const [collapsedProjectPaths, setCollapsedProjectPaths] = useState<Set<string>>(() => new Set())");
  expect(pageSource).toContain('window.localStorage.getItem("omni-collapsed-projects")');
  expect(pageSource).toContain('window.localStorage.setItem("omni-collapsed-projects", JSON.stringify(Array.from(collapsedProjectPaths)))');
  expect(pageSource).toContain("collapsedProjectPaths={collapsedProjectPaths}");
  expect(pageSource).toContain("onProjectOpenChange: handleProjectOpenChange,");
  expect(pageSource).toContain("open={!collapsedProjectPaths.has(group.path)}");
});

test("failed runs surface recovery UI in the header and conversation feed", () => {
  expect(pageSource).toContain('selectedRun?.status === "failed"');
  expect(pageSource).toContain("Retry latest");
  expect(pageSource).toContain("Unstick latest");
  expect(pageSource).toContain('label: "Stuck"');
  expect(pageSource).toContain('label: "Needs recovery"');
  expect(pageSource).toContain('msg.kind === "error"');
  expect(pageSource).toContain("Run failed");
});

test("running conversations render an in-thread execution indicator with expandable trace details", () => {
  expect(pageSource).toContain("function ConversationExecutionStatus");
  expect(pageSource).toContain("const isConversationThinking =");
  expect(pageSource).toContain("const liveThoughts =");
  expect(pageSource).toContain("const selectedRunExecutionEvents =");
  expect(pageSource).toContain("const liveExecutionStatus =");
  expect(pageSource).toContain("const executionDetailLines =");
  expect(pageSource).toContain("const [executionDetailsOpen, setExecutionDetailsOpen] = useState(false)");
  expect(pageSource).toContain("Thinking");
  expect(pageSource).toContain("animate-pulse");
  expect(pageSource).toContain("animationDelay:");
  expect(pageSource).toContain("Show details");
  expect(pageSource).toContain("Hide details");
  expect(pageSource).toContain("Connecting to ACP bridge");
  expect(pageSource).toContain("waiting for LLM API");
  expect(pageSource).toContain("Awaiting permission");
  expect(pageSource).toContain("Waiting ");
  expect(pageSource).toContain("No execution details yet.");
  expect(pageSource).not.toContain("Current status");
  expect(pageSource).not.toContain("Last bridge error");
  expect(pageSource).toContain("{isImplementationConversation && showConversationExecution ? (");
});

test("new conversations expose a mode picker and only existing direct runs lock the worker type", () => {
  expect(pageSource).toContain('import { ConversationModePicker, type ConversationModeOption } from "@/components/ConversationModePicker"');
  expect(pageSource).toContain('value={selectedConversationMode}');
  expect(conversationModePickerSource).toContain("Create plan");
  expect(conversationModePickerSource).toContain("Implement plan");
  expect(conversationModePickerSource).toContain("Direct control");
  expect(pageSource).toContain('const shouldLockDirectWorker = Boolean(selectedRunId) && activeComposerMode === "direct"');
  expect(pageSource).not.toContain("Direct worker:");
  expect(pageSource).toContain("{shouldLockDirectWorker ? (");
  expect(pageSource).toContain('mode: selectedConversationMode');
});

test("starting a project-scoped conversation keeps the composer empty", () => {
  expect(pageSource).toContain('setDraftProjectPath(projectPath)');
  expect(pageSource).toContain('placeholder="Ask Omni anything. @ to refer to files"');
  expect(pageSource).not.toContain('setCommand(`${projectPath}/`)');
});

test("empty state centers the composer with the welcome stack instead of docking it to the bottom", () => {
  expect(pageSource).toContain("const renderComposer = (");
  expect(pageSource).toContain('{selectedRunId ? (');
  expect(pageSource).toContain("What shall we build in {welcomeRepoName}?");
  expect(pageSource).toContain("const welcomeRepoName = resolveRepoName(currentProjectScope)");
  expect(pageSource).toContain('renderComposer("mt-6 w-full")');
  expect(pageSource).toContain('{selectedRunId ? renderComposer("w-full") : null}');
  expect(pageSource).not.toContain("Welcome to OmniHarness");
  expect(pageSource).not.toContain("{getConversationModeCopy(selectedConversationMode).description}");
});
