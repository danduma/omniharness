import fs from "fs";
import path from "path";
import { test, expect } from "vitest";
import { shouldConversationFollowLatest } from "@/app/home/useRunSelectionEffects";

const readSource = (relativePath: string) => fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
const pageSource = [
  "src/app/page.tsx",
  "src/app/home/HomeApp.tsx",
  "src/app/home/HomeUiStateManager.ts",
  "src/app/home/constants.ts",
  "src/app/home/types.ts",
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
  "src/components/home/UserInputMessage.tsx",
  "src/components/home/WorkersSidebar.tsx",
  "src/components/component-state-managers.ts",
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
const workersSidebarSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/components/home/WorkersSidebar.tsx"),
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
  expect(workerCardSource).toContain('promptPreview?: string | null;');
  expect(workerCardSource).toContain('userMessages?: TerminalUserMessage[];');
  expect(workersSidebarSource).toContain('promptPreview={worker.initialPrompt}');
  expect(workersSidebarSource).toContain('supervisorInterventions={supervisorInterventions}');
  expect(workersSidebarSource).toContain('content: intervention.prompt');
  expect(workerCardSource).toContain('<Terminal agent={agent} userMessages={userMessages} />');
  expect(workerCardSource).toContain('const promptPreviewText = promptPreview?.trim() ?? "";');
  expect(workerCardSource).toContain('line-clamp-2 text-[11px] leading-[1.35] text-zinc-500');
  expect(workerCardSource).not.toContain('const preview = buildWorkerPreview(agent);');
  expect(workerCardSource).not.toContain('className="truncate text-[13px] leading-5 text-zinc-400"');
  expect(pageSource).not.toContain("Recent output");
  expect(pageSource).toContain('hasSingleVisibleWorker ? "flex h-full min-h-full flex-col" : visibleWorkers.length > 0 ? "space-y-4" : "flex h-full min-h-full flex-col"');
  expect(pageSource).toContain('className="flex h-full min-h-[16rem] flex-1 flex-col items-center justify-center rounded-md border border-dashed bg-transparent text-xs text-muted-foreground"');
  expect(pageSource).not.toContain('className="flex h-32 flex-col items-center justify-center rounded-md border border-dashed bg-transparent text-xs text-muted-foreground"');
});

test("workers sidebar is conversation-scoped and resizable", () => {
  expect(pageSource).toContain('rightSidebarWidth: 420');
  expect(pageSource).toContain('window.localStorage.getItem("omni-workers-sidebar-width")');
  expect(pageSource).toContain('window.localStorage.setItem("omni-workers-sidebar-width", String(rightSidebarWidth))');
  expect(pageSource).toContain('title="Toggle Conversation Workers"');
  expect(pageSource).toContain('<WorkersSidebar');
  expect(pageSource).toContain('workers={selectedRunWorkersForDisplay}');
  expect(pageSource).toContain('agents={conversationAgents}');
  expect(pageSource).toContain('workersSidebarManager');
  expect(pageSource).toContain('activeTab: "active"');
  expect(pageSource).toContain("Active ({workerGroups.active.length})");
  expect(pageSource).toContain("Finished ({workerGroups.finished.length})");
  expect(pageSource).toContain('const liveAgentsById = new Map(');
  expect(pageSource).toContain('preferredModel={selectedRun?.preferredWorkerModel ?? null}');
  expect(pageSource).toContain('preferredEffort={selectedRun?.preferredWorkerEffort ?? null}');
  expect(pageSource).toContain('onClose={() => setMobileWorkersOpen(false)}');
  expect(pageSource).toContain('onClose={() => setRightSidebarOpen(false)}');
  expect(pageSource).toContain('if (selectedRunId && isImplementationConversation && selectedRunWorkersForDisplay.length > 0) {');
  expect(pageSource).toContain('setRightSidebarOpen(true);');
  expect(pageSource).toContain('style={{ width: rightSidebarWidth }}');
  expect(pageSource).toContain('aria-label="Resize workers sidebar"');
  expect(pageSource).toContain('onPointerDown={handleRightSidebarResizeStart}');
  expect(pageSource).toContain('export const PRODUCT_NAME = "OmniHarness";');
  expect(pageSource).toContain("<SheetTitle>{PRODUCT_NAME}</SheetTitle>");
  expect(pageSource).not.toContain("<SheetTitle>Navigation</SheetTitle>");
  expect(pageSource).not.toContain('queryClient.removeQueries({ queryKey: ["conversation-agent", workerId], exact: true })');
  expect(workerCardSource).toContain('function renderContextMeter(fullnessPercent: number | null | undefined)');
  expect(workerCardSource).toContain('className="inline-flex items-center gap-1.5"');
  expect(workerCardSource).toContain('className="h-3.5 w-3.5"');
  expect(workerCardSource).toContain('const showStopWorker = Boolean(onStopWorker) && isWorkerActiveStatus(agent.state);');
  expect(workerCardSource).toContain('className="flex shrink-0 items-start gap-2.5"');
  expect(workerCardSource).toContain('className="inline-flex h-5 w-5 items-center justify-center rounded-full');
  expect(workerCardSource).toContain('className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")}');
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

test("workers sidebar gives a single visible worker the full available window and scrolls multi-worker lists", () => {
  expect(workersSidebarSource).toContain("const hasSingleVisibleWorker = visibleWorkers.length === 1;");
  expect(workersSidebarSource).toContain('className="min-h-0 flex-1 p-4"');
  expect(workersSidebarSource).toContain('hasSingleVisibleWorker ? "flex h-full min-h-full flex-col"');
  expect(workersSidebarSource).toContain('const terminalHeightClass = hasSingleVisibleWorker ? "h-full min-h-[24rem]" : "h-44";');
  expect(workersSidebarSource).toContain("fillAvailable={hasSingleVisibleWorker}");
  expect(workersSidebarSource).toContain('defaultOpen={activeTab === "active" || hasSingleVisibleWorker}');
  expect(workerCardSource).toContain("fillAvailable?: boolean;");
  expect(workerCardSource).toContain("const shouldFillAvailable = fillAvailable && open;");
  expect(workerCardSource).toContain('shouldFillAvailable && "flex h-full min-h-0 flex-col"');
  expect(workerCardSource).toContain('shouldFillAvailable && "min-h-0 flex-1"');
  expect(workerCardSource).not.toContain('fillAvailable && "flex h-full min-h-0 flex-col"');
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

test("main conversation does not duplicate worker panes from the sidebar", () => {
  expect(pageSource).toContain('<AgentSurface');
  expect(pageSource).toContain('title="Planning agent"');
  expect(pageSource).not.toContain("<Cpu className=\"h-4 w-4\" /> CLI Agents");
  expect(pageSource).not.toContain('{isImplementationConversation && conversationWorkerGroups.active.length > 0 && (');
  expect(pageSource).not.toContain('{conversationWorkerGroups.active.map((worker) => {');
  expect(pageSource).toContain('defaultOpen={false}');
  expect(pageSource).toContain('defaultOpen={activeTab === "active" || hasSingleVisibleWorker}');
  expect(pageSource).not.toContain("<Cpu className=\"h-4 w-4\" /> Live CLI Agents");
  expect(pageSource).not.toContain('{conversationWorkers.length > 0 && (');
  expect(pageSource).not.toContain('{conversationWorkers.map((worker: any) => {');
});

test("worker card action buttons render outside the collapsible trigger button", () => {
  const triggerCloseIndex = workerCardSource.indexOf("</CollapsibleTrigger>");
  const permissionButtonIndex = workerCardSource.indexOf("<PermissionWarning");
  const stopButtonIndex = workerCardSource.indexOf('aria-label={`Stop ${displayId}`}');

  expect(triggerCloseIndex).toBeGreaterThan(-1);
  expect(permissionButtonIndex).toBeGreaterThan(triggerCloseIndex);
  expect(stopButtonIndex).toBeGreaterThan(triggerCloseIndex);
});

test("implementation worker messages show a compact latest turn with expandable full output", () => {
  expect(pageSource).toContain("function WorkerOutputMessage");
  expect(pageSource).toContain("extractLatestPlainTextTurn");
  expect(pageSource).toContain('aria-label={fullOutputOpen ? "Hide full worker output" : "Show full worker output"}');
  expect(pageSource).toContain('{fullOutputOpen ? "Hide full output" : "Show full output"}');
  expect(pageSource).toContain("agent={fullOutputAgent}");
  expect(pageSource).not.toContain('msg.role === "worker"\n                          ? "border-[#333] bg-[#1e1e1e] font-mono text-[12px] text-emerald-400 shadow-sm"');
});

test("direct conversations render the user transcript next to the worker surface", () => {
  expect(pageSource).toContain("const directConversationMessages = useMemo(() => {");
  expect(pageSource).toContain("expandedDirectMessageIds: new Set()");
  expect(pageSource).toContain("function toggleDirectMessageExpansion(messageId: string)");
  expect(pageSource).toContain("const primaryConversationAgent = useMemo(() => {");
  expect(pageSource).toContain("if (!isDirectConversation) {");
  expect(pageSource).toContain('conversationAgents.find((agent) => agent.state === "working" || Boolean(agent.currentText?.trim()))');
  expect(pageSource).toContain('?? conversationAgents.find((agent) => agent.state !== "cancelled")');
  expect(pageSource).toContain('userMessages={directConversationMessages}');
  expect(pageSource).toContain('variant="native"');
  expect(pageSource).toContain('.filter((message) => message.role === "user")');
  expect(pageSource).not.toContain('message.role === "user" || (message.role === "worker" && message.content.trim())');
  expect(pageSource).toContain('const isExpanded = expandedDirectMessageIds.has(msg.id);');
  expect(pageSource).toContain('className="flex justify-start pl-4 sm:pl-6"');
  expect(pageSource).toContain('const handleCopyDirectMessage = async (content: string) => {');
  expect(pageSource).toContain('await navigator.clipboard.writeText(content);');
  expect(pageSource).toContain('select-text');
  expect(pageSource).toContain('aria-label={isExpanded ? "Show less message text" : "Show more message text"}');
  expect(pageSource).toContain('onToggleExpanded={() => toggleDirectMessageExpansion(msg.id)}');
  expect(pageSource).toContain('maxHeight: isExpanded ? undefined : "calc(1.5rem * 6)"');
  expect(pageSource).toContain('const isLongMessage = content.length > 420 || content.split(/\\r\\n|\\r|\\n/).length > 6;');
  expect(pageSource).toContain('{isExpanded || isLongMessage ? (');
  expect(pageSource).toContain('{isExpanded ? "less" : "...more"}');
  expect(pageSource).toContain('text-[#d8d8d8]');
  expect(pageSource).toContain('aria-label="Copy message"');
  expect(pageSource).toContain('label: "Retry from here"');
  expect(pageSource).toContain('aria-label={action.label}');
  expect(pageSource).toContain('onClick: () => handleRetryMessage(msg.id)');
  expect(pageSource).toContain('rounded-lg bg-[#3a3a3a]');
  expect(pageSource).toContain('px-3 py-2');
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
  expect(pageSource).toContain('className="flex max-h-[min(760px,calc(100dvh-2rem))] sm:max-h-[min(760px,calc(100dvh-3rem))] sm:max-w-xl flex-col overflow-hidden"');
  expect(pageSource).toContain('className="min-h-0 flex-1 overflow-y-auto pr-1"');
  expect(pageSource).toContain('className="shrink-0"');
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
  expect(pageSource).toContain('activeWorkerSettingsTab: "availability"');
  expect(pageSource).toContain('setActiveWorkerSettingsTab: homeUiStateManager.createSetter("activeWorkerSettingsTab")');
  expect(pageSource).toContain('export type WorkerSettingsTab = "availability" | "defaults" | "runtime"');
  expect(pageSource).toContain('activeWorkerSettingsTab === "availability"');
  expect(pageSource).toContain('activeWorkerSettingsTab === "defaults"');
  expect(pageSource).toContain('activeWorkerSettingsTab === "runtime"');
  expect(pageSource).toContain("Availability");
  expect(pageSource).toContain("Defaults");
  expect(pageSource).toContain("Runtime");
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
  expect(pageSource).toContain('themeMode: "day"');
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

test("sidebar phone pairing entry point lives in the settings menu", () => {
  expect(pageSource).toContain('<DropdownMenuItem className="cursor-pointer whitespace-nowrap" onClick={openPairDeviceDialog}>');
  expect(pageSource).toContain('<Smartphone className="mr-2 h-4 w-4" /> Connect Phone');
  expect(pageSource).not.toContain('className="mb-1 hidden h-9 w-full justify-start px-2 text-sm text-muted-foreground hover:text-foreground lg:flex"');
});

test("header syncs the active conversation path but only shows the cwd", () => {
  expect(pageSource).toContain('routeReady: false');
  expect(pageSource).toContain("const activeConversationCwd = selectedRun?.projectPath || activePlan?.path || draftProjectPath || null;");
  expect(pageSource).toContain('window.location.pathname');
  expect(pageSource).toContain('window.history.replaceState(window.history.state, "", nextPath)');
  expect(pageSource).toContain('`/session/${selectedRunId}`');
  expect(pageSource).not.toContain('window.localStorage.getItem(LAST_RUN_ROUTE_STORAGE_KEY)');
  expect(pageSource).not.toContain('window.localStorage.setItem(LAST_RUN_ROUTE_STORAGE_KEY, selectedRunId)');
  expect(pageSource).not.toContain('window.localStorage.removeItem(LAST_RUN_ROUTE_STORAGE_KEY)');
  expect(pageSource).toContain('aria-label="Root repository folder"');
  expect(pageSource).toContain('const titleLabel = selectedRun ? conversationTitle : "";');
  expect(pageSource).toContain(': "";');
  expect(pageSource).toContain("{titleLabel || rootFolderLabel ? (");
  expect(pageSource).not.toContain("No conversation selected");
  expect(pageSource).not.toContain("No working directory");
});

test("command input uses a fixed helper placeholder instead of echoing the selected directory", () => {
  expect(pageSource).toContain('placeholder="Ask Omni anything. @ to refer to files"');
  expect(pageSource).not.toContain('placeholder={draftProjectPath ? `${draftProjectPath}/...` : "e.g. vibes/test-plan.md or fix the login flow"}');
});

test("send button swaps to a spinner while a command submission is pending", () => {
  expect(pageSource).toContain("const isComposerSubmitting = runCommand.isPending || sendConversationMessage.isPending || promotePlanningConversation.isPending");
  expect(pageSource).toContain("const isSendButtonBusy = isComposerSubmitting && !isStopButtonVisible;");
  expect(pageSource).toContain('disabled={isSubmitButtonDisabled}');
  expect(pageSource).toContain('{isStoppingConversation || isSendButtonBusy ? (');
  expect(pageSource).toContain('<LoaderCircle className="h-[17px] w-[17px] animate-spin" />');
  expect(pageSource).toContain(') : isStopButtonVisible ? (');
  expect(pageSource).toContain('<Square className="h-[13.6px] w-[13.6px] fill-current" />');
  expect(pageSource).toContain('<ArrowUp className="h-[17px] w-[17px]" />');
});

test("project groups show a loading indicator while conversations are still hydrating", () => {
  expect(pageSource).toContain("hasReceivedInitialEventStreamPayload: false");
  expect(pageSource).toContain("const isHydratingConversations = appUnlocked && !hasReceivedInitialEventStreamPayload;");
  expect(pageSource).toContain("isHydratingConversations={isHydratingConversations}");
  expect(pageSource).toContain("Loading conversations...");
});

test("project group collapsed state survives page reloads", () => {
  expect(pageSource).toContain("collapsedProjectPaths: new Set()");
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
  expect(pageSource).toContain('label: "Runtime error"');
  expect(pageSource).toContain('msg.kind === "error"');
  expect(pageSource).toContain("Run failed");
});

test("running conversations render an in-thread execution indicator and timeline activity rows", () => {
  expect(pageSource).toContain("function ConversationExecutionStatus");
  expect(pageSource).toContain("function SupervisorActivityMessage");
  expect(pageSource).toContain('aria-label="Conversation event"');
  expect(pageSource).toContain("const isConversationThinking =");
  expect(pageSource).toContain("const liveThoughts = useMemo(() => {");
  expect(pageSource).toContain("const selectedRunExecutionEvents = useMemo(() => (");
  expect(pageSource).toContain("const conversationTimelineItems = useMemo(() => buildConversationTimelineItems");
  expect(pageSource).toContain('const conversationTimelineActivityCount = conversationTimelineItems.filter((item) => item.type === "activity").length;');
  expect(pageSource).toContain("const liveExecutionStatus =");
  expect(pageSource).toContain("buildConversationTimelineItems");
  expect(pageSource).toContain('item.type === "activity"');
  expect(pageSource).toContain("Thinking");
  expect(pageSource).toContain("animate-pulse");
  expect(pageSource).toContain("animationDelay:");
  expect(pageSource).toContain("activity");
  expect(pageSource).toContain("Awaiting permission");
  expect(pageSource).toContain("Waiting ");
  expect(pageSource).not.toContain(">System</span>");
  expect(pageSource).not.toContain("Show supervisor activity");
  expect(pageSource).not.toContain("Hide supervisor activity");
  expect(pageSource).not.toContain("SupervisorActivityPresentationManager");
  expect(pageSource).not.toContain("SupervisorActivityDrawer");
  expect(pageSource).not.toContain("ClarificationPanel");
  expect(pageSource).not.toContain("PlanProgress");
  expect(pageSource).not.toContain("ValidationSummary");
  expect(pageSource).not.toContain("No execution details yet.");
  expect(pageSource).not.toContain("Current status");
  expect(pageSource).not.toContain("Last bridge error");
  expect(pageSource).toContain("{isImplementationConversation && showConversationExecution ? (");
  expect(pageSource).toContain("executionEventCount: conversationTimelineActivityCount");
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
  expect(pageSource).toContain('renderComposer("mt-2 w-full pt-0 sm:pt-0")');
  expect(pageSource).toContain('{selectedRunId ? renderComposer("w-full") : null}');
  expect(pageSource).not.toContain("Welcome to OmniHarness");
  expect(pageSource).not.toContain("{getConversationModeCopy(selectedConversationMode).description}");
});
