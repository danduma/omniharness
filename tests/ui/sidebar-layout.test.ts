import fs from "fs";
import path from "path";
import { test, expect } from "vitest";
import {
  getConversationOutputVersion,
  hasSelectedRunMessageOutput,
  hasMeaningfulConversationOverflow,
  shouldConversationFollowLatest,
  shouldConversationKeepFollowingLatest,
  shouldConversationRetryInitialLatestPosition,
  shouldConversationShowOutputBelow,
} from "@/app/home/useRunSelectionEffects";

const readSource = (relativePath: string) => fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
const pageSource = [
  "src/app/page.tsx",
  "src/app/home/HomeApp.tsx",
  "src/app/home/SideWindowManager.ts",
  "src/app/home/HomeUiStateManager.ts",
  "src/app/home/constants.ts",
  "src/app/home/types.ts",
  "src/app/home/useAppErrors.ts",
  "src/app/home/useConversationExecutionStatus.ts",
  "src/app/home/useHomeLifecycle.ts",
  "src/app/home/useRunSelectionEffects.ts",
  "src/app/home/useHomeMutations.ts",
  "src/app/home/useConversationActions.ts",
  "src/app/home/useHomeViewModel.ts",
  "src/app/home/ComposerContainer.tsx",
  "src/app/home/utils.ts",
  "src/components/home/ConversationComposer.tsx",
  "src/components/home/ConversationMain.tsx",
  "src/components/home/ConversationSidebar.tsx",
  "src/components/home/HomeHeader.tsx",
  "src/components/home/ThemeModeToggle.tsx",
  "src/components/home/SideWindow.tsx",
  "src/components/home/FileViewerPanel.tsx",
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
const terminalSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/components/Terminal.tsx"),
  "utf8"
);
const cliBrandIconsSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/components/cli-brand-icons.tsx"),
  "utf8"
);
const workersSidebarSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/components/home/WorkersSidebar.tsx"),
  "utf8"
);
const sideWindowSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/components/home/SideWindow.tsx"),
  "utf8"
);
const planningArtifactsSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/components/PlanningArtifactsPanel.tsx"),
  "utf8"
);

test("desktop conversation rail constrains overflowing run content", () => {
  expect(pageSource).toContain('leftSidebarOpen: true');
  expect(pageSource).toContain('leftSidebarWidth: DEFAULT_CONVERSATION_SIDEBAR_WIDTH');
  expect(pageSource).toContain('setLeftSidebarOpen: homeUiStateManager.createSetter("leftSidebarOpen")');
  expect(pageSource).toContain('setLeftSidebarWidth: homeUiStateManager.createSetter("leftSidebarWidth")');
  expect(pageSource).toContain('export const DEFAULT_CONVERSATION_SIDEBAR_WIDTH = 280;');
  expect(pageSource).toContain('setLeftSidebarWidth(getDefaultConversationSidebarWidth(window.innerWidth));');
  expect(pageSource).toContain('setLeftSidebarWidth(clampConversationSidebarWidth(nextWidth, window.innerWidth));');
  expect(pageSource).toContain('window.localStorage.getItem("omni-conversations-sidebar-width")');
  expect(pageSource).toContain('window.localStorage.setItem("omni-conversations-sidebar-width", String(leftSidebarWidth))');
  expect(pageSource).toContain('style={{ width: leftSidebarOpen ? leftSidebarWidth : 0 }}');
  expect(pageSource).toContain('aria-hidden={!leftSidebarOpen}');
  expect(pageSource).toContain('inert={!leftSidebarOpen ? true : undefined}');
  expect(pageSource).toContain("sidebar.resize.conversations");
  expect(pageSource).toContain('onPointerDown={layout.handleLeftSidebarResizeStart}');
  expect(pageSource).toContain('leftSidebarOpen ? "translate-x-0" : "-translate-x-3"');
  expect(pageSource).toContain('onCollapse={() => setLeftSidebarOpen(false)}');
  expect(pageSource).toContain('t("conversation.sidebar.collapseAria")');
  expect(pageSource).toContain('title="Open conversations sidebar"');
  expect(pageSource).toContain('<PanelLeftClose');
  expect(pageSource).toContain('<PanelLeft className="h-4 w-4" />');
  expect(pageSource).toContain('transition-[width,opacity] duration-150 ease-out');
  expect(pageSource).toContain('relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#f1f1f0] dark:bg-muted/30');
  expect(pageSource).toContain('space-y-1 px-3 pb-3 pt-2 lg:px-3 lg:pb-3 lg:pt-2');
  expect(pageSource).toContain('space-y-3 pb-4 pt-0.5');
  expect(pageSource).not.toContain('space-y-4 py-4');
  expect(pageSource).toContain('hidden min-w-0 flex-1 items-center gap-2 lg:flex');
  expect(pageSource).toContain('h-9 min-w-0 flex-1 justify-start px-2 text-sm text-[#333333]');
  expect(pageSource).toContain('min-h-0 flex-1 overflow-hidden');
  expect(pageSource).toContain('mt-auto shrink-0 border-t border-border/60 bg-background/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/80');
  expect(pageSource).toContain('"group flex min-w-0 cursor-pointer overflow-hidden rounded-xl py-1.5 pl-2.5 pr-2 text-sm transition-colors"');
  expect(pageSource).toContain('"bg-[#e2e1df] text-[#1f1f1f] dark:bg-white/[0.08] dark:text-zinc-100"');
  expect(pageSource).toContain('"text-[#424242] hover:bg-[#e8e7e5] hover:text-[#1f1f1f] dark:text-zinc-300 dark:hover:bg-white/[0.045] dark:hover:text-zinc-100"');
  expect(pageSource).not.toContain('ml-3 group flex min-w-0 cursor-pointer gap-2 overflow-hidden rounded-lg border px-3 py-1.5 text-sm transition-colors');
  expect(pageSource).not.toContain('border-primary/20 bg-primary/10 font-medium text-primary');
  expect(pageSource).not.toContain('flex w-4 shrink-0 items-start justify-center pt-0.5');
  expect(pageSource).toContain('min-w-0 flex items-center justify-between gap-2');
  expect(agentSurfaceSource).toContain('border border-border/70 bg-card text-card-foreground shadow-sm dark:border-white/10');
  expect(agentSurfaceSource).toContain('className="border-b border-border/70 bg-card px-4 py-3 dark:border-white/10');
  expect(workerCardSource).toContain("Permissions waiting");
  expect(workerCardSource).toContain("Context usage not reported");
  expect(workerCardSource).toContain("Context usage ");
  expect(cliBrandIconsSource).toContain("CLAUDE_ICON_PATH");
  expect(cliBrandIconsSource).toContain("GEMINI_ICON_PATH");
  expect(cliBrandIconsSource).not.toContain("simple-icons");
  expect(cliBrandIconsSource).toContain("Codex");
  expect(cliBrandIconsSource).toContain("OPENCODE_ICON_SRC");
  expect(pageSource).toContain("Claude Code");
  expect(pageSource).toContain('stroke="currentColor"');
  expect(workerCardSource).toContain('promptPreview?: string | null;');
  expect(workerCardSource).toContain('userMessages?: TerminalUserMessage[];');
  expect(workersSidebarSource).toContain('promptPreview={worker.initialPrompt}');
  expect(workersSidebarSource).toContain('supervisorInterventions={supervisorInterventions}');
  expect(workersSidebarSource).toContain("buildWorkerTerminalUserMessages");
  expect(workerCardSource).toContain("<Terminal");
  expect(workerCardSource).toContain('import { useWorkerStream } from "@/app/home/WorkerEntriesManager";');
  expect(workerCardSource).toContain("const workerStream = useWorkerStream(workerId);");
  expect(workerCardSource).toContain("const unifiedTerminalEntries = useMemo");
  expect(workerCardSource).toContain("const processEntries = useMemo");
  expect(workerCardSource).toContain("entries={unifiedTerminalEntries}");
  expect(workerCardSource).toContain("hasMoreHistory={hasMoreHistory}");
  expect(workerCardSource).toContain("hasOmittedWorkerStreamHistory(unifiedTerminalEntries)");
  expect(workerCardSource).toContain('entry.id === "output-archive-marker"');
  // WorkerCard now routes scroll-up through a local handler that
  // prefers the unified worker stream's loadOlder, falling back to
  // the legacy onLoadWorkerHistory prop for bridge-history hydration.
  expect(workerCardSource).toContain("onRequestMoreHistory={handleRequestMoreHistory}");
  expect(workerCardSource).toContain("onLoadWorkerHistory?.()");
  expect(workerCardSource).toContain("deriveVisibleWorkerTerminalProcesses");
  expect(workerCardSource).toContain("function shouldShowWorkerError(agent: WorkerCardAgent)");
  expect(workerCardSource).toContain('if (isWorkerActiveStatus(agent.state)) {');
  expect(workerCardSource).toContain("const showWorkerError = shouldShowWorkerError(agent);");
  expect(workerCardSource).toContain("{showWorkerError ? (");
  expect(workerCardSource).not.toContain("Terminal Processes");
  expect(workerCardSource).toContain("const activeProcesses = processes.filter((process) => process.active);");
  expect(workerCardSource).toContain('const summary = `Running ${activeProcesses.length} terminal${activeProcesses.length === 1 ? "" : "s"}`;');
  expect(workerCardSource).toContain("bg-muted/45 text-foreground");
  expect(workerCardSource).toContain("onStopWorker?: () => void;");
  expect(workerCardSource).toContain("terminalProcessesOpenByWorkerId");
  expect(workerCardSource).toContain("<SquareTerminal");
  expect(workerCardSource).toContain("terminalProcess.processId");
  expect(workerCardSource).toContain("terminalProcess.outputTail");
  expect(workerCardSource).toContain('const promptPreviewText = promptPreview?.trim() ?? "";');
  expect(workerCardSource).toContain('line-clamp-2 text-[11px] leading-[1.35] text-muted-foreground dark:text-zinc-500');
  expect(workerCardSource).not.toContain('const preview = buildWorkerPreview(agent);');
  expect(workerCardSource).not.toContain('className="truncate text-[13px] leading-5 text-zinc-400"');
  expect(pageSource).not.toContain("Recent output");
  expect(pageSource).not.toContain("Terminal Processes");
  expect(pageSource).toContain('hasSingleVisibleWorker ? "flex h-full min-h-full flex-col" : visibleWorkers.length > 0 ? "space-y-4" : "flex h-full min-h-full flex-col"');
  expect(pageSource).toContain('className="flex h-full min-h-[16rem] flex-1 flex-col items-center justify-center rounded-md border border-dashed bg-transparent text-xs text-muted-foreground"');
  expect(pageSource).not.toContain('className="flex h-32 flex-col items-center justify-center rounded-md border border-dashed bg-transparent text-xs text-muted-foreground"');
});

test("workers sidebar is conversation-scoped and resizable", () => {
  expect(pageSource).toContain('rightSidebarWidth: DEFAULT_WORKERS_SIDEBAR_WIDTH');
  expect(pageSource).toContain('export const DEFAULT_WORKERS_SIDEBAR_WIDTH = 580;');
  expect(pageSource).toContain('return clampWorkersSidebarWidth(remainingAfterConversationSidebar / 2, viewportWidth);');
  expect(pageSource).toContain('setRightSidebarWidth(getDefaultWorkersSidebarWidth(window.innerWidth));');
  expect(pageSource).toContain('setRightSidebarWidth(clampWorkersSidebarWidth(nextWidth, window.innerWidth));');
  expect(pageSource).toContain('window.localStorage.getItem("omni-workers-sidebar-width")');
  expect(pageSource).toContain('window.localStorage.setItem("omni-workers-sidebar-width", String(rightSidebarWidth))');
  expect(pageSource).toContain("{workspaceSideWindowAvailable && !rightSidebarOpen ? (");
  expect(pageSource).toContain('title="Toggle workspace side window"');
  expect(pageSource).toContain('title={closeButtonLabel}');
  expect(pageSource).toContain('const closeButtonLabel = closeButtonVariant === "back" ? t("common.back") : t("side.window.collapseAria")');
  expect(pageSource).toContain('const CloseButtonIcon = closeButtonVariant === "back" ? ArrowLeft : PanelRightClose;');
  expect(pageSource).toContain('<PanelRightClose');
  expect(pageSource).toContain('<SideWindow');
  expect(pageSource).toContain('workers={selectedRunId ? selectedRunWorkersForDisplay : []}');
  expect(pageSource).toContain('agents={selectedRunId ? conversationAgents : []}');
  expect(pageSource).toContain('workersSidebarManager');
  expect(pageSource).toContain('activeTab: "active"');
  expect(pageSource).toContain('t("workers.sidebar.activeTab", { count: workerGroups.active.length })');
  expect(pageSource).toContain('t("workers.sidebar.finishedTab", { count: workerGroups.finished.length })');
  expect(pageSource).toContain('activeTab === "active" ? t("workers.sidebar.emptyActive") : t("workers.sidebar.emptyFinished")');
  expect(pageSource).toContain('const liveAgentsById = new Map(');
  expect(pageSource).toContain('preferredModel={selectedRun?.preferredWorkerModel ?? null}');
  expect(pageSource).toContain('preferredEffort={selectedRun?.preferredWorkerEffort ?? null}');
  expect(pageSource).toContain('onCloseWindow={() => setMobileWorkersOpen(false)}');
  expect(pageSource).toContain('closeButtonVariant="back"');
  expect(pageSource).toContain('onCloseWindow={() => setRightSidebarOpen(false)}');
  expect(pageSource).toContain('if (selectedRunId && !isImplementationConversation) {');
  expect(pageSource).toContain('setRightSidebarOpen(false);');
  expect(pageSource).toContain('setMobileWorkersOpen(false);');
  expect(pageSource).toContain('transition-[width,opacity] duration-150 ease-out');
  expect(pageSource).toContain('style={{ width: rightSidebarOpen ? rightSidebarWidth : 0 }}');
  expect(pageSource).toContain('aria-hidden={!rightSidebarOpen}');
  expect(pageSource).toContain('inert={!rightSidebarOpen ? true : undefined}');
  expect(pageSource).toContain('rightSidebarOpen ? "translate-x-0" : "translate-x-3"');
  expect(pageSource).toContain("sidebar.resize.workspace");
  expect(pageSource).toContain('onPointerDown={layout.handleRightSidebarResizeStart}');
  expect(pageSource).not.toContain('h-14 w-1 rounded-full bg-border/80 transition-colors hover:bg-foreground/30');
  expect(pageSource).toContain('export const PRODUCT_NAME = "OmniHarness";');
  expect(pageSource).toContain('<SheetTitle className="flex items-center gap-2 text-left">');
  expect(pageSource).toContain('<span>{PRODUCT_NAME}</span>');
  expect(pageSource).not.toContain("<SheetTitle>Navigation</SheetTitle>");
  expect(pageSource).toContain('<Sheet open={mobileWorkersOpen} onOpenChange={setMobileWorkersOpen} disablePointerDismissal>');
  expect(pageSource).toContain('className="!inset-0 h-[100dvh] !w-screen !max-w-none gap-0 !border-0 p-0 sm:!max-w-none lg:hidden"');
  expect(pageSource).toContain('<SheetTitle className="sr-only">Workspace tools</SheetTitle>');
  expect(pageSource).not.toContain('<SheetTitle>Workspace side window</SheetTitle>');
  expect(pageSource).toContain('className="hidden min-w-0 flex-1 items-center gap-2 lg:flex"');
  expect(pageSource).not.toContain('queryClient.removeQueries({ queryKey: ["conversation-agent", workerId], exact: true })');
  expect(workerCardSource).toContain('function renderContextMeter(fullnessPercent: number | null | undefined)');
  expect(workerCardSource).toContain('{runtimeDurationLabel ? (');
  expect(workerCardSource).toContain("<Clock");
  expect(workerCardSource).toContain('className="inline-flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground dark:text-zinc-400"');
  expect(workerCardSource).toContain('render={<span className="block w-fit max-w-full" />}');
  expect(workerCardSource).not.toContain('title={normalized === null ? "Context usage');
  expect(workerCardSource).toContain('className="h-3.5 w-3.5"');
  expect(workerCardSource).toContain('const showStopWorker = Boolean(onStopWorker) && isWorkerActiveStatus(agent.state);');
  expect(workerCardSource).toContain('className="flex shrink-0 items-center gap-1.5"');
  expect(workerCardSource).toContain('<span className="capitalize">{stateLabel}</span>');
  expect(workerCardSource).toContain("Hash");
  expect(workerCardSource).toContain("const workerNumberLabel = useMemo");
  expect(workerCardSource).toContain("{showWorkerNumberAfterTitle ? (");
  expect(workerCardSource).toContain("<Hash className=\"h-3 w-3\" />");
  expect(workerCardSource).toContain('className="inline-flex h-5 w-5 items-center justify-center rounded-full');
  expect(workerCardSource).toContain('const showHeaderStopWorker = showStopWorker && !hasActiveTerminalProcesses;');
  expect(workerCardSource).toContain('onStopTerminalProcess?: (terminalProcess: WorkerTerminalProcess) => void;');
  expect(workerCardSource).toContain("onStopTerminalProcess(terminalProcess);");
  expect(workerCardSource).toContain("Stop terminal process");
  expect(workerCardSource).not.toContain("Stop ${summary.toLowerCase()}");
  expect(pageSource).toContain('action: "stop_worker_terminal"');
  expect(pageSource).toContain('terminalProcessId: terminalProcess.id');
  expect(workerCardSource).toContain('className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")}');
  expect(workerCardSource).toContain("Permissions waiting");
  expect(workerCardSource).toContain("Context usage not reported");
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

test("workspace side window owns workers and file tabs", () => {
  expect(pageSource).toContain("sideWindowManager");
  expect(pageSource).toContain("handleOpenProjectFile");
  expect(pageSource).toContain("shouldOpenMobileSideWindow()");
  expect(pageSource).toContain("<SideWindow");
  expect(pageSource).toContain('projectRoot={currentProjectScope}');
  expect(pageSource).toContain("onOpenProjectFile={actions.handleOpenProjectFile}");
  expect(pageSource).toContain("Boolean(selectedRunId || draftProjectPath) && Boolean(currentProjectScope)");
  expect(pageSource).toContain('title="Toggle workspace side window"');
  expect(pageSource).toContain("sidebar.resize.workspace");
  expect(pageSource).toContain('onCloseWindow={() => setRightSidebarOpen(false)}');
  expect(pageSource).toContain('onCloseWindow={() => setMobileWorkersOpen(false)}');
  expect(pageSource).toContain("sideWindowManager.resetFileTabs()");
  expect(sideWindowSource).toContain('side.window.workersTabAria');
  expect(sideWindowSource).toContain("FileViewerPanel");
  expect(sideWindowSource).toContain("sideWindowManager.closeTab(tab.id)");
  expect(sideWindowSource).toContain("sideWindowManager.selectTab(tab.id)");
  expect(sideWindowSource).toContain("tab.kind === \"file\"");
  expect(sideWindowSource).toContain("const hasConversationWorkers = workerGroups.active.length > 0 || workerGroups.finished.length > 0;");
  expect(sideWindowSource).toContain('const filteredTabs = hasConversationWorkers ? tabs : tabs.filter((tab) => tab.kind !== "workers");');
  expect(sideWindowSource).toContain('const visibleTabs = filteredTabs.length > 0 ? filteredTabs : tabs;');
  expect(sideWindowSource).toContain("const activeTab = visibleTabs.find((tab) => tab.id === activeTabId) ?? visibleTabs[0] ?? null;");
  expect(sideWindowSource).toContain("{visibleTabs.map((tab) => (");
  expect(sideWindowSource).toContain(') : activeTab?.kind === "workers" ? (');
  expect(pageSource).toContain("DropdownMenuCheckboxItem");
  expect(pageSource).toContain("fileViewerPanelManager.toggleWordWrap()");
  expect(pageSource).toContain("void fileQuery.refetch()");
  expect(pageSource).toContain('className="omni-conversation-text-scale min-h-0 flex-1 overflow-auto bg-muted/15 [scrollbar-width:thin]"');
  expect(pageSource).toContain('"syntax-highlight py-3 font-mono text-[length:var(--omni-conversation-font-size)] leading-[var(--omni-conversation-line-height)]"');
  expect(pageSource).toContain('t("fileViewer.menu.wordWrap")');
  expect(pageSource).toContain('t("fileViewer.menu.refresh")');
  expect(sideWindowSource.indexOf('aria-label={`Close ${tab.relativePath}`}')).toBeLessThan(
    sideWindowSource.indexOf('<span className="truncate">{tab.kind === "workers" ? workersTabLabel : tab.title}</span>'),
  );
  expect(sideWindowSource).toContain("showHeader={false}");
});

test("workers sidebar gives a single visible worker the full available window and scrolls multi-worker lists", () => {
  expect(workersSidebarSource).toContain("const hasSingleVisibleWorker = visibleWorkers.length === 1;");
  expect(workersSidebarSource).toContain('className="min-h-0 flex-1 p-3"');
  expect(workersSidebarSource).toContain('hasSingleVisibleWorker ? "flex h-full min-h-full flex-col"');
  expect(workersSidebarSource).toContain('const terminalHeightClass = hasSingleVisibleWorker || isFocusedWorker ? "h-full min-h-[24rem]" : "h-44";');
  expect(workersSidebarSource).toContain("fillAvailable={hasSingleVisibleWorker || isFocusedWorker}");
  expect(workersSidebarSource).toContain('defaultOpen={isFocusedWorker || activeTab === "active" || hasSingleVisibleWorker}');
  expect(workerCardSource).toContain("fillAvailable?: boolean;");
  expect(workerCardSource).toContain("const shouldFillAvailable = fillAvailable && open;");
  expect(workerCardSource).toContain('shouldFillAvailable && "flex h-full min-h-0 flex-col"');
  expect(workerCardSource).toContain('shouldFillAvailable && "flex min-h-0 flex-1 flex-col shadow-none"');
  expect(workerCardSource).not.toContain('rounded-none border-x-0 border-b-0');
  expect(workerCardSource).toContain('shouldFillAvailable && "min-h-0 flex-1"');
  expect(workerCardSource).not.toContain('fillAvailable && "flex h-full min-h-0 flex-col"');
});

test("workers sidebar can focus one terminal across the workers tab", () => {
  expect(pageSource).toContain('focusedWorkerId: null');
  expect(pageSource).toContain('setFocusedWorker = (focusedWorkerId: string | null)');
  expect(pageSource).toContain('toggleFocusedWorker = (workerId: string)');
  expect(workersSidebarSource).toContain("const focusedWorkerVisible = Boolean(focusedWorkerId && visibleWorkers.some((worker) => worker.id === focusedWorkerId));");
  expect(workersSidebarSource).toContain("const isFocusMode = visibleWorkers.length > 1 && focusedWorkerVisible;");
  expect(workersSidebarSource).toContain("const focusedWorker = isFocusMode ? visibleWorkers.find((worker) => worker.id === focusedWorkerId) ?? null : null;");
  expect(workersSidebarSource).toContain('className="min-h-0 flex-1 p-3"');
  expect(workersSidebarSource).toContain('className="h-full min-h-0"');
  expect(workersSidebarSource).not.toContain("const compactWorkers = isFocusMode ? visibleWorkers.filter((worker) => worker.id !== focusedWorkerId) : [];");
  expect(workersSidebarSource).not.toContain('className="max-h-64 shrink-0 pr-1"');
  expect(workersSidebarSource).toContain('import { workersSidebarManager } from "@/components/component-state-managers";');
  expect(workersSidebarSource).not.toContain("workerCardManager.setOpen(worker.id, true)");
  expect(workersSidebarSource).toContain("onToggleFocus={() => workersSidebarManager.toggleFocusedWorker(worker.id)}");
  expect(workerCardSource).toContain("const open = isFocused || (openByWorkerId[workerId] ?? defaultOpen);");
  expect(workersSidebarSource).toContain('const isCompactWorker = Boolean(options.compact);');
  expect(workersSidebarSource).toContain('compact={isCompactWorker}');
  expect(workersSidebarSource).toContain('isFocused={isFocusedWorker}');
  expect(workersSidebarSource).toContain('canFocus={visibleWorkers.length > 1}');
  expect(workerCardSource).toContain('compact?: boolean;');
  expect(workerCardSource).toContain('isFocused?: boolean;');
  expect(workerCardSource).toContain('canFocus?: boolean;');
  expect(workerCardSource).toContain('onToggleFocus?: () => void;');
  expect(workerCardSource).toContain('aria-label={isFocused ? `Show all workers` : `Focus terminal for ${displayId}`}');
  expect(workerCardSource).toContain('title={isFocused ? "Show all workers" : "Focus terminal"}');
  expect(workerCardSource).toContain('compact && "cursor-pointer hover:border-foreground/20 hover:bg-muted/20');
  expect(workerCardSource).toContain('if (compact) {');
  expect(workerCardSource).toContain('onClick={onToggleFocus}');
  expect(workerCardSource).toContain('const compactSubtitle = [');
  expect(workerCardSource).toContain('className="flex min-h-12 items-center justify-between gap-3"');
  expect(workerCardSource).toContain("<Maximize2");
  expect(workerCardSource).toContain("<Minimize2");
});

test("worker detail renders from streamed agent state instead of per-worker polling", () => {
  expect(pageSource).not.toContain("const conversationAgentQueries = useQueries({");
  expect(pageSource).not.toContain('queryKey: ["conversation-agent", worker.id]');
  expect(pageSource).not.toContain('return requestJson<AgentSnapshot>(`/api/agents/${worker.id}`, undefined, {');
  expect(pageSource).not.toContain('refetchInterval: ["starting", "working", "stuck"].includes(normalizeWorkerStatus(worker.status)) ? 2000 : false');
  expect(pageSource).toContain('const liveAgentsById = new Map(');
  expect(pageSource).toContain('const candidateAgent = liveAgentsById.get(worker.id);');
  expect(pageSource).toContain('if ((selectedRunIsTerminal || selectedRunNeedsRecovery) && isWorkerActiveStatus(candidateAgent.state)) {');
});

test("conversation output only follows live worker updates when already near the bottom", () => {
  expect(pageSource).toContain("const CONVERSATION_BOTTOM_THRESHOLD_PX = 8");
  expect(pageSource).toContain("const CONVERSATION_MEANINGFUL_OVERFLOW_PX = 112");
  expect(pageSource).toContain("const selectedRunHasOutput = hasSelectedRunMessageOutput(selectedRunId, state.messages);");
  expect(pageSource).toContain("const shouldRestoreInstantly = runChanged");
  expect(pageSource).toContain('const scrollBehavior: ScrollBehavior = shouldRestoreInstantly ? "auto" : "smooth";');
  expect(pageSource).toContain("shouldConversationRetryInitialLatestPosition({");
  expect(pageSource).toContain("const outputVersion = getConversationOutputVersion(selectedRunId, state.messages, state.agents);");
  expect(pageSource).toContain("if (!runChanged && !outputChanged) {");
  expect(pageSource).toContain("}, [scrollRef, outputVersion, selectedRunHasOutput, selectedRunId]);");

  expect(shouldConversationFollowLatest({
    scrollTop: 696,
    clientHeight: 300,
    scrollHeight: 1000,
  })).toBe(true);

  expect(shouldConversationKeepFollowingLatest({
    scrollTop: 696,
    clientHeight: 300,
    scrollHeight: 1000,
  }, 700)).toBe(false);

  expect(shouldConversationKeepFollowingLatest({
    scrollTop: 696,
    clientHeight: 300,
    scrollHeight: 1000,
  }, 695)).toBe(true);

  expect(shouldConversationFollowLatest({
    scrollTop: 680,
    clientHeight: 300,
    scrollHeight: 1000,
  })).toBe(false);

  expect(shouldConversationFollowLatest({
    scrollTop: 650,
    clientHeight: 300,
    scrollHeight: 1000,
  })).toBe(false);

  expect(shouldConversationShowOutputBelow({
    scrollTop: 696,
    clientHeight: 300,
    scrollHeight: 1000,
  })).toBe(false);

  expect(shouldConversationShowOutputBelow({
    scrollTop: 691,
    clientHeight: 300,
    scrollHeight: 1000,
  })).toBe(true);

  expect(hasMeaningfulConversationOverflow({
    clientHeight: 900,
    scrollHeight: 990,
  })).toBe(false);

  expect(shouldConversationRetryInitialLatestPosition({
    selectedRunId: "run-1",
    positionedRunId: null,
    selectedRunHasOutput: true,
    shouldFollowLatest: true,
    metrics: {
      clientHeight: 300,
      scrollHeight: 1000,
    },
  })).toBe(true);

  expect(shouldConversationRetryInitialLatestPosition({
    selectedRunId: "run-1",
    positionedRunId: "run-1",
    selectedRunHasOutput: true,
    shouldFollowLatest: true,
    metrics: {
      clientHeight: 300,
      scrollHeight: 1000,
    },
  })).toBe(false);

  expect(shouldConversationRetryInitialLatestPosition({
    selectedRunId: "run-1",
    positionedRunId: null,
    selectedRunHasOutput: true,
    shouldFollowLatest: false,
    metrics: {
      clientHeight: 300,
      scrollHeight: 1000,
    },
  })).toBe(false);

  expect(shouldConversationShowOutputBelow({
    scrollTop: 0,
    clientHeight: 900,
    scrollHeight: 990,
  })).toBe(false);

  expect(
    shouldConversationShowOutputBelow({
      scrollTop: 680,
      clientHeight: 300,
      scrollHeight: 1000,
    }) && shouldConversationFollowLatest({
      scrollTop: 680,
      clientHeight: 300,
      scrollHeight: 1000,
    })
  ).toBe(false);

  expect(hasSelectedRunMessageOutput("run-1", [
    { id: "message-1", runId: "run-1", role: "user", content: "hello", createdAt: "2026-05-09T00:00:00.000Z" },
  ])).toBe(true);

  expect(hasSelectedRunMessageOutput("run-1", [
    { id: "message-2", runId: "run-2", role: "user", content: "other", createdAt: "2026-05-09T00:00:00.000Z" },
  ])).toBe(false);
});

test("conversation output version ignores state refreshes without new rendered output", () => {
  const baseMessages = [{
    id: "message-1",
    runId: "run-1",
    role: "user",
    content: "hello",
    createdAt: "2026-05-09T00:00:00.000Z",
  }];
  const baseAgents = [{
    name: "worker-1",
    state: "working",
    currentText: "working",
    lastText: "started",
    outputEntries: [{
      id: "entry-1",
      type: "message" as const,
      text: "line",
      timestamp: "2026-05-09T00:00:01.000Z",
    }],
  }];

  expect(getConversationOutputVersion("run-1", baseMessages, baseAgents)).toBe(
    getConversationOutputVersion("run-1", [...baseMessages], baseAgents.map((agent) => ({ ...agent })))
  );
  expect(getConversationOutputVersion("run-1", baseMessages, baseAgents)).not.toBe(
    getConversationOutputVersion("run-1", [{ ...baseMessages[0], content: "hello again" }], baseAgents)
  );
  expect(getConversationOutputVersion("run-1", baseMessages, baseAgents)).not.toBe(
    getConversationOutputVersion("run-1", baseMessages, [{ ...baseAgents[0], currentText: "working more" }])
  );
});

test("conversation has a floating latest-output indicator above the composer", () => {
  const conversationMainSource = fs.readFileSync(path.resolve(process.cwd(), "src/components/home/ConversationMain.tsx"), "utf8");
  const managerSource = fs.readFileSync(path.resolve(process.cwd(), "src/components/component-state-managers.ts"), "utf8");
  const runSelectionEffectsSource = fs.readFileSync(path.resolve(process.cwd(), "src/app/home/useRunSelectionEffects.ts"), "utf8");

  expect(managerSource).toContain("hasOutputBelow: boolean;");
  expect(managerSource).toContain("setHasOutputBelow");
  expect(runSelectionEffectsSource).toContain("conversationMainManager.setHasOutputBelow(shouldConversationShowOutputBelow(viewport))");
  expect(conversationMainSource).toContain("const { hasOutputBelow } = useManagerSnapshot(conversationMainManager);");
  expect(conversationMainSource).toContain('aria-label="Scroll to latest output"');
  expect(conversationMainSource).toContain("<ArrowDown");
  expect(conversationMainSource).toContain("bg-primary text-primary-foreground");
});

test("main conversation does not duplicate worker panes from the sidebar or planning transcript", () => {
  expect(pageSource).not.toContain('<AgentSurface');
  expect(pageSource).not.toContain('title="Planning agent"');
  expect(pageSource).toContain('function PlannerOutputMessage');
  expect(pageSource).toContain("<Terminal");
  expect(pageSource).toContain("activityFilter={shouldShowPlanningTerminalActivity}");
  expect(pageSource).toContain("thoughtsDefaultOpen");
  expect(pageSource).toContain("emptyState={null}");
  expect(pageSource).not.toContain("function PlannerActivityItem");
  expect(pageSource).not.toContain("function PlannerToolPane");
  expect(pageSource).not.toContain("buildAgentOutputActivity");
  expect(pageSource).not.toContain("formatActivityStatus");
  expect(pageSource).not.toContain('t("planning.agent.thinking")');
  expect(pageSource).not.toContain('const summaryText = extractLatestPlainTextTurn({\n    outputEntries: agent?.outputEntries,\n    currentText: agent?.currentText,\n    lastText: agent?.lastText || message.content,\n  }) || message.content.trim();\n\n  return (\n    <MarkdownContent\n      content={summaryText}');
  expect(pageSource).toContain('const isPlanningWorkerMessage = msg.role === "worker" && msg.kind === "planning";');
  expect(pageSource).toContain(') || isPlanningWorkerMessage ? (');
  expect(pageSource).not.toContain("<Cpu className=\"h-4 w-4\" /> CLI Agents");
  expect(pageSource).not.toContain('{isImplementationConversation && conversationWorkerGroups.active.length > 0 && (');
  expect(pageSource).not.toContain('{conversationWorkerGroups.active.map((worker) => {');
  expect(pageSource).not.toContain('defaultOpen={false}');
  expect(pageSource).toContain('defaultOpen={isFocusedWorker || activeTab === "active" || hasSingleVisibleWorker}');
  expect(pageSource).not.toContain("<Cpu className=\"h-4 w-4\" /> Live CLI Agents");
  expect(pageSource).not.toContain('{conversationWorkers.length > 0 && (');
  expect(pageSource).not.toContain('{conversationWorkers.map((worker: any) => {');
});

test("terminal renderer owns reusable planning transcript behavior", () => {
  expect(terminalSource).toContain("activityFilter?: (activity: TerminalActivityItem) => boolean;");
  expect(terminalSource).toContain("thoughtsDefaultOpen?: boolean;");
  expect(terminalSource).toContain("toolGroupsDefaultOpen?: boolean;");
  expect(terminalSource).toContain("emptyState?: ReactNode;");
  expect(terminalSource).toContain("const filteredActivity = useMemo(");
  expect(terminalSource).toContain("activity.filter(activityFilter)");
  expect(terminalSource).toContain("const open = (thoughtOpenById[activity.id] ?? thoughtsDefaultOpen) || activity.inProgress;");
  expect(terminalSource).toContain("const open = toolGroupOpenById[activity.id] ?? toolGroupsDefaultOpen;");
  expect(terminalSource).toContain("{emptyState}");
});

test("worker card action buttons render outside the collapsible trigger button", () => {
  const headerTriggerIndex = workerCardSource.indexOf('<CollapsibleTrigger className="min-w-0 flex-1 text-left">');
  const headerTriggerCloseIndex = workerCardSource.indexOf("</CollapsibleTrigger>", headerTriggerIndex);
  const actionControlsIndex = workerCardSource.indexOf("{actionControls}", headerTriggerCloseIndex);

  expect(headerTriggerIndex).toBeGreaterThan(-1);
  expect(headerTriggerCloseIndex).toBeGreaterThan(headerTriggerIndex);
  expect(actionControlsIndex).toBeGreaterThan(headerTriggerCloseIndex);
  expect(workerCardSource).toContain("<PermissionWarning");
  expect(workerCardSource).toContain('aria-label={`Stop ${displayId}`}');
});

test("project and terminal collapses share the side panel transition", () => {
  expect(pageSource).toContain("COLLAPSIBLE_PANEL_TRANSITION_CLASS");
  expect(pageSource).toContain("COLLAPSIBLE_PANEL_OPEN_CLASS");
  expect(pageSource).toContain("COLLAPSIBLE_PANEL_CLOSED_CLASS");
  expect(workerCardSource).toContain("COLLAPSIBLE_PANEL_TRANSITION_CLASS");
  expect(workerCardSource).toContain("COLLAPSIBLE_PANEL_OPEN_CLASS");
  expect(workerCardSource).toContain("COLLAPSIBLE_PANEL_CLOSED_CLASS");
  expect(workerCardSource).toContain("onOpenChange={(nextOpen) => workerCardManager.setTerminalProcessesOpen(workerId, nextOpen)}");
  expect(workerCardSource).toContain("onOpenChange={(nextOpen) => workerCardManager.setOpen(workerId, nextOpen)}");
});

test("worker cards collapse into one header summary and keep expanded-only status at the bottom", () => {
  expect(workerCardSource).toContain("function WorkerExpandedFooter");
  expect(workerCardSource).toContain("const expandedHeaderSummary =");
  expect(workerCardSource).toContain("const collapsedHeaderSummary =");
  expect(workerCardSource).toContain("open ? expandedHeaderSummary : collapsedHeaderSummary");
  expect(workerCardSource).toContain("{open ? (");
  expect(workerCardSource).toContain("<WorkerExpandedFooter");
  expect(workerCardSource).toContain("function renderContextFill");
  expect(workerCardSource).toContain("activeModel={activeModel}");
  expect(workerCardSource).toContain("activeEffort={activeEffort}");
  expect(workerCardSource).toContain("{activeEffort ? <span className=\"shrink-0 text-[11px] text-muted-foreground dark:text-zinc-500\">{activeEffort} effort</span> : null}");
  expect(workerCardSource).not.toContain("w-14 overflow-hidden rounded-full");
  expect(workerCardSource).toContain("<TerminalTextSizeControl");
  expect(workerCardSource).toContain("showTextSizeControl={false}");
  expect(workerCardSource).not.toContain("showTerminalControls={open}");
  expect(workerCardSource).not.toContain("showContext={open}");

  const workerPanelIndex = workerCardSource.indexOf("open ? COLLAPSIBLE_PANEL_OPEN_CLASS : COLLAPSIBLE_PANEL_CLOSED_CLASS", workerCardSource.indexOf("<Collapsible open={open}"));
  const workerPanelCloseIndex = workerCardSource.indexOf("</div>", workerPanelIndex);
  const workerStatusBarIndex = workerCardSource.indexOf("<WorkerExpandedFooter", workerPanelCloseIndex);

  expect(workerPanelIndex).toBeGreaterThan(-1);
  expect(workerPanelCloseIndex).toBeGreaterThan(workerPanelIndex);
  expect(workerStatusBarIndex).toBeGreaterThan(workerPanelCloseIndex);
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
  expect(pageSource).toContain("const toggleDirectMessageExpansion = (messageId: string)");
  expect(pageSource).toContain("const primaryConversationAgent = useMemo(");
  expect(pageSource).toContain("selectPrimaryConversationAgent(conversationAgents, isDirectConversation)");
  expect(pageSource).toContain("selectPrimaryConversationAgent");
  expect(pageSource).toContain('userMessages={directConversationMessages}');
  expect(pageSource).toContain('variant="native"');
  expect(pageSource).toContain('textSizeScope="conversation"');
  expect(pageSource).toContain('.filter((message) => message.role === "user")');
  expect(pageSource).not.toContain('message.role === "user" || (message.role === "worker" && message.content.trim())');
  expect(pageSource).toContain('const isExpanded = expandedDirectMessageIds.has(msg.id);');
  expect(pageSource).toContain('className="flex justify-end"');
  expect(pageSource).toContain('flex-col items-end');
  expect(pageSource).toContain('const handleCopyDirectMessage = async (content: string, messageId: string) => {');
  expect(pageSource).toContain('await navigator.clipboard.writeText(content);');
  expect(pageSource).toContain('select-text');
  expect(pageSource).toContain('aria-label={isExpanded ? "Show less message text" : "Show more message text"}');
  expect(pageSource).toContain('onToggleExpanded={() => toggleDirectMessageExpansion(msg.id)}');
  expect(pageSource).toContain('maxHeight: isExpanded ? undefined : "calc(1.5rem * 6)"');
  expect(pageSource).toContain('const isLongMessage = content.length > 420 || content.split(/\\r\\n|\\r|\\n/).length > 6;');
  expect(pageSource).toContain('{isExpanded || isLongMessage ? (');
  expect(pageSource).toContain('{isExpanded ? "less" : "...more"}');
  expect(pageSource).toContain("omni-user-message");
  expect(pageSource).toContain("omni-user-message-expand");
  expect(pageSource).toContain("conversation.message.copyAria");
  expect(pageSource).toContain('label: t(isImplementationConversation ? "conversation.message.action.resumeFromHere" : "conversation.message.action.retryFromHere")');
  expect(pageSource).toContain('aria-label={action.label}');
  expect(pageSource).toContain('onClick: () => handleRetryMessage(message.id)');
  expect(pageSource).toContain("rounded-2xl");
  expect(pageSource).toContain('px-5 py-3.5');
  expect(pageSource).toContain('text-sm leading-6');
  expect(pageSource).toContain('createdAt={msg.createdAt}');
  expect(pageSource).not.toContain('text-[1.375rem]');
  expect(pageSource).toContain('cursor-pointer');
  expect(pageSource).toContain('overflow-hidden');
  expect(pageSource).toContain('<Terminal');
  expect(pageSource).toContain('variant="native"');
  expect(pageSource).toContain('agent={primaryConversationAgent}');
  expect(pageSource).not.toContain('Direct transcript');
  expect(pageSource).not.toContain('title={selectedRun?.title || "Direct control"}');
});

test("settings entry opens the reorganized settings dialog", () => {
  expect(pageSource).toContain('activeSettingsTab: "general"');
  expect(pageSource).toContain('export type SettingsTab = "general" | "models" | "credentials" | "agents" | "runtime" | "memory"');
  expect(pageSource).toContain('import("@/components/home/SettingsDialog")');
  expect(pageSource).toContain("settingsDraftManager");
});

test("header includes a persistent day night mode toggle beside the workers sidebar button", () => {
  expect(pageSource).toContain('themeMode: "day"');
  expect(pageSource).toContain("const didMountThemeEffectRef = useRef(false)");
  expect(pageSource).toContain('window.localStorage.getItem("omni-theme-mode")');
  expect(pageSource).toContain("if (!didMountThemeEffectRef.current)");
  expect(pageSource).toContain('window.localStorage.setItem("omni-theme-mode", themeMode)');
  expect(pageSource).toContain('document.documentElement.classList.toggle("dark", themeMode === "night")');
  expect(pageSource).toContain('const label = t(themeMode === "night" ? "theme.mode.switchDay" : "theme.mode.switchNight")');
  expect(pageSource).toContain("aria-label={label}");
  expect(pageSource).toContain('setThemeMode((current) => (current === "day" ? "night" : "day"))');
  expect(pageSource).toContain('themeMode === "night" ? <Sun');
  expect(pageSource).toContain(': <Moon');
  expect(pageSource).toContain('title="Toggle workspace side window"');
  expect(pageSource).not.toContain(">Day<");
  expect(pageSource).not.toContain(">Night<");
});

test("sidebar phone pairing entry point is hidden from the mobile settings menu", () => {
  expect(pageSource).toContain('<DropdownMenuItem className="hidden cursor-pointer whitespace-nowrap lg:flex" onClick={openPairDeviceDialog}>');
  expect(pageSource).toContain('<Smartphone className="mr-2 h-4 w-4" /> {t("mainMenu.connectPhone")}');
  expect(pageSource).not.toContain('max-lg:h-12 max-lg:gap-3 max-lg:px-3 max-lg:text-base max-lg:[&_svg]:h-5 max-lg:[&_svg]:w-5" onClick={openPairDeviceDialog}');
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

test("command input uses mode-aware helper placeholders instead of echoing the selected directory", () => {
  expect(pageSource).toContain("const composerPlaceholder = selectedRunId");
  expect(pageSource).toContain('t("conversation.composer.placeholder.planning")');
  expect(pageSource).toContain('t("conversation.composer.placeholder.direct")');
  expect(pageSource).toContain('t("conversation.composer.placeholder.implementation")');
  expect(pageSource).toContain('t("conversation.composer.placeholder.default")');
  expect(pageSource).toContain("placeholder={composerPlaceholder}");
  expect(pageSource).not.toContain('placeholder={draftProjectPath ? `${draftProjectPath}/...` : "e.g. vibes/test-plan.md or fix the login flow"}');
});

test("send button swaps to a spinner while a command submission is pending", () => {
  expect(pageSource).toContain("const isComposerSubmitting = isStartingCurrentProjectConversation || isSendingSelectedConversationMessage || isSendingSelectedQueuedMessage || isPromotePlanningPendingForSelectedRun || isStopConversationPending;");
  expect(pageSource).toContain("const isSendButtonBusy = isComposerSubmitting && !isStopButtonVisible;");
  expect(pageSource).toContain("const isStopButtonBusy = isStopButtonVisible && isStopConversationPending;");
  expect(pageSource).toContain('disabled={isSubmitButtonDisabled}');
  expect(pageSource).toContain('{isSendButtonBusy || isStopButtonBusy ? (');
  expect(pageSource).toContain('<LoaderCircle className="h-[17px] w-[17px] animate-spin" />');
  expect(pageSource).toContain(') : isStopButtonVisible ? (');
  expect(pageSource).toContain('<Square className="h-[13.6px] w-[13.6px] fill-current" />');
  expect(pageSource).toContain('<ArrowUp className="h-[17px] w-[17px]" />');
});

test("project groups show a loading indicator while conversations are still hydrating", () => {
  expect(pageSource).toContain("hasReceivedInitialEventStreamPayload: false");
  expect(pageSource).toContain("const isHydratingConversations = appUnlocked && !hasReceivedInitialEventStreamPayload;");
  expect(pageSource).toContain("isHydratingConversations={isHydratingConversations}");
  expect(pageSource).toContain('t("conversation.sidebar.loadingConversations")');
});

test("project group collapsed state survives page reloads", () => {
  expect(pageSource).toContain("collapsedProjectPaths: new Set()");
  expect(pageSource).toContain('window.localStorage.getItem("omni-collapsed-projects")');
  expect(pageSource).toContain('window.localStorage.setItem("omni-collapsed-projects", JSON.stringify(Array.from(collapsedProjectPaths)))');
  expect(pageSource).toContain("collapsedProjectPaths={collapsedProjectPaths}");
  expect(pageSource).toContain("onProjectOpenChange: actions.handleProjectOpenChange,");
  expect(pageSource).toContain("collapseProjects: (projectPaths: string[]) => homeUiStateManager.collapseProjects(projectPaths)");
  expect(pageSource).toContain("onCollapseAllProjects: collapseProjects,");
  expect(pageSource).toContain('t("conversation.sidebar.collapseAllProjects")');
  expect(pageSource).toContain('t("conversation.sidebar.addProject")');
  expect(pageSource).toContain("ListChevronsDownUp");
  expect(pageSource).toContain("<TooltipContent side=\"bottom\" align=\"end\">");
  expect(pageSource).toContain("onClick={() => onCollapseAllProjects(visibleProjectGroups.map((group) => group.path))}");
  expect(pageSource).toContain("const projectOpen = !collapsedProjectPaths.has(group.path);");
  expect(pageSource).toContain("open={projectOpen}");
  expect(pageSource).toContain("COLLAPSIBLE_PANEL_TRANSITION_CLASS");
  expect(pageSource).toContain('projectOpen && "rotate-180"');
});

test("project groups can be reordered from the projects tab without replacing the collapse trigger", () => {
  expect(pageSource).toContain("reorderExplicitProjectPaths");
  expect(pageSource).toContain("onReorderProjects: actions.handleReorderProjects,");
  expect(pageSource).toContain("onReorderProjects={onReorderProjects}");
  expect(pageSource).toContain('const canDragProject = canReorderProjects && group.path !== "other";');
  expect(pageSource).toContain('data-project-drag-row="true"');
  expect(pageSource).toContain("draggable={canDragProject}");
  expect(pageSource).toContain("event.dataTransfer.setData(PROJECT_DRAG_DATA_TYPE, group.path);");
  expect(pageSource).toContain('event.currentTarget.closest<HTMLElement>(\'[data-project-drag-row="true"]\')');
  expect(pageSource).toContain("event.dataTransfer.setDragImage(projectDragRow, 16, projectDragRow.offsetHeight / 2);");
  expect(pageSource).toContain("onDrop={(event) => handleProjectDrop(event, group.path)}");
  expect(pageSource).toContain("conversationSidebarTab === \"projects\"");
  expect(pageSource).toContain("GripVertical");
  expect(pageSource).toContain('t("conversation.sidebar.dragProject", { project: group.name })');
});

test("project groups reveal sessions ten at a time and reset on project toggles", () => {
  expect(pageSource).toContain("export const PROJECT_SESSION_DISPLAY_BATCH_SIZE = 10;");
  expect(pageSource).toContain("visibleProjectSessionCounts: {}");
  expect(pageSource).toContain("revealMoreProjectSessions(projectPath: string)");
  expect(pageSource).toContain("resetProjectSessionDisplayLimit(projectPath: string)");
  expect(pageSource).toContain("setVisibleProjectSessionCounts: homeUiStateManager.createSetter(\"visibleProjectSessionCounts\")");
  expect(pageSource).toContain("const visibleSessionCount = visibleProjectSessionCounts[group.path] ?? PROJECT_SESSION_DISPLAY_BATCH_SIZE;");
  expect(pageSource).toContain("const visibleRuns = group.runs.slice(0, visibleSessionCount);");
  expect(pageSource).toContain("const hiddenSessionCount = Math.max(0, group.runs.length - visibleRuns.length);");
  expect(pageSource).toContain("visibleRuns.map((run) => {");
  expect(pageSource).toContain('t("conversation.sidebar.moreSessions")');
  expect(pageSource).toContain("onShowMoreProjectSessions(group.path)");
  expect(pageSource).toContain("homeUiStateManager.resetProjectSessionDisplayLimit(projectPath);");
  expect(pageSource).not.toContain("omni-visible-project-sessions");
});

test("failed runs surface recovery UI in the header and conversation feed", () => {
  expect(pageSource).toContain('selectedRun?.status === "failed"');
  expect(pageSource).toContain("Resume worker");
  expect(pageSource).toContain('const canRetryConversation = isDirectConversation || (isImplementationConversation && selectedRun?.status !== "failed");');
  expect(pageSource).toContain("Unstick latest");
  expect(pageSource).toContain('label: "Stuck"');
  expect(pageSource).toContain('label: "Needs recovery"');
  expect(pageSource).toContain('label: "Runtime error"');
  expect(pageSource).toContain('msg.kind === "error"');
  expect(pageSource).toContain("Run failed");
});

test("running conversations render an in-thread execution indicator and timeline activity rows", () => {
  expect(pageSource).toContain("function ConversationExecutionPanel");
  expect(pageSource).not.toContain("function ConversationRunLog");
  expect(pageSource).toContain("function SupervisorActivityMessage");
  expect(pageSource).toContain("function renderSupervisorActivityText");
  expect(pageSource).toContain("Starting (?:worker \\d+|planning agent)|Steering worker \\d+");
  expect(pageSource).toContain('text.startsWith("Starting planning agent")');
  expect(pageSource).toContain('text-[13px] leading-[1.45]');
  expect(pageSource).toContain('<strong className="font-semibold text-foreground">{match[1]}</strong>');
  expect(pageSource).toContain('aria-label="Supervisor action"');
  expect(pageSource).toContain('aria-label="Run Log"');
  expect(pageSource).toContain('Run Log');
  expect(pageSource).toContain('runLogOpenByRunId');
  expect(pageSource).toContain("const isConversationThinking =");
  expect(pageSource).toContain("const isConversationThinking = isSupervisorRunning");
  expect(pageSource).toContain("const liveThoughts = useMemo(() => {");
  expect(pageSource).toContain("const selectedRunExecutionEvents = useMemo(() => (");
  expect(pageSource).toContain("const conversationTimelineItems = useMemo(() => buildConversationTimelineItems");
  expect(pageSource).toContain('const conversationTimelineActivityCount = conversationTimelineItems.filter((item) => item.type === "activity").length;');
  expect(pageSource).toContain("const liveExecutionStatus =");
  expect(pageSource).toContain("buildConversationTimelineItems");
  expect(pageSource).toContain('item.type === "activity"');
  expect(pageSource).toContain('statusText');
  expect(pageSource).toContain("liveThoughts.map");
  expect(pageSource).toContain("thought.text");
  expect(pageSource).toContain("Working");
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
  expect(pageSource).not.toContain("No execution details yet.");
  expect(pageSource).not.toContain("Current status");
  expect(pageSource).not.toContain("Last bridge error");
  expect(pageSource).toContain("{isImplementationConversation && showConversationExecution ? (");
  expect(pageSource).toContain("executionEventCount: conversationTimelineActivityCount");
  expect(pageSource).toContain("executionEvents={selectedRunExecutionEvents}");
  expect(pageSource).not.toContain('msg.role === "system"');
  expect(pageSource).not.toContain('parseSpawnedWorkerMessage');
});

test("planning artifacts are shown as relative file links without card chrome", () => {
  expect(planningArtifactsSource).toContain("function displayProjectPath");
  expect(planningArtifactsSource).toContain("reference.relativePath");
  expect(planningArtifactsSource).toContain("displayPath");
  expect(planningArtifactsSource).toContain('role="note"');
  expect(planningArtifactsSource).toContain('text-sm leading-relaxed text-foreground');
  expect(planningArtifactsSource).not.toContain("rounded-xl border");
  expect(planningArtifactsSource).not.toContain("shadow-sm");
  expect(planningArtifactsSource).not.toContain(">{candidate.path}<");
});

test("new conversations expose a mode picker and only existing direct runs lock the worker type", () => {
  expect(pageSource).toContain('import { ConversationModePicker, type ConversationModeOption } from "@/components/ConversationModePicker"');
  expect(pageSource).toContain('selectedConversationMode={activeComposerMode}');
  expect(pageSource).toContain('value={selectedConversationMode as ConversationModeOption}');
  expect(conversationModePickerSource).toContain("conversation.mode.omni.label");
  expect(conversationModePickerSource).toContain("conversation.mode.direct.label");
  expect(conversationModePickerSource).toContain("useI18nSnapshot()");
  expect(conversationModePickerSource).toContain('const MODE_ORDER: ConversationModeOption[] = ["omni", "direct"]');
  expect(conversationModePickerSource).toContain("w-fit max-w-full");
  expect(conversationModePickerSource).toContain("break-words hyphens-auto");
  expect(conversationModePickerSource).not.toContain("overflow-x-auto");
  expect(conversationModePickerSource).not.toContain("whitespace-nowrap rounded-xl");
  expect(pageSource).toContain('const shouldLockDirectWorker = Boolean(selectedRunId) && activeComposerMode === "direct"');
  expect(pageSource).not.toContain("Direct worker:");
  expect(pageSource).toContain("{shouldLockDirectWorker ? (");
  expect(pageSource).toContain('mode: selectedConversationMode');
});

test("starting a project-scoped conversation keeps the composer empty", () => {
  expect(pageSource).toContain('setDraftProjectPath(projectPath)');
  expect(pageSource).toContain('t("conversation.composer.placeholder.default")');
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

test("live event updates reuse sidebar project derivations while typing stays responsive", () => {
  expect(pageSource).toContain("const groupedProjects = useMemo(() => buildConversationGroups({");
  expect(pageSource).toContain("}), [explicitProjects, plans, runs]);");
  expect(pageSource).toContain("const filteredProjects = useMemo(() => {");
  expect(pageSource).toContain("const normalizedSearchQuery = searchQuery.toLowerCase();");
  expect(pageSource).toContain("}, [groupedProjects, searchQuery]);");
  expect(pageSource).toContain("buildActiveConversationGroups({");
  expect(pageSource).toContain("}, [groupedProjects, state.messages, state.workers, state.agents, state.queuedMessages, readMarkers, searchQuery, selectedRunId]);");
});
