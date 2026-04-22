import fs from "fs";
import path from "path";
import { test, expect } from "vitest";

const pageSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/app/page.tsx"),
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
  expect(pageSource).toContain('className="overflow-hidden rounded-xl border border-white/10 bg-[#0d0f12] text-zinc-100 shadow-[0_18px_60px_rgba(0,0,0,0.28)]"');
  expect(pageSource).toContain('className="border-b border-white/10 bg-[#13161b] p-3"');
  expect(pageSource).toContain("Permissions waiting");
  expect(pageSource).toContain("Context usage unavailable");
  expect(pageSource).toContain("Context usage ");
  expect(pageSource).toContain("Claude Code");
  expect(pageSource).not.toContain("Recent output");
  expect(pageSource).toContain('className={cn(agents.length > 0 ? "space-y-4" : "flex h-full min-h-full flex-col")}');
  expect(pageSource).toContain('className="flex h-full min-h-[16rem] flex-1 flex-col items-center justify-center rounded-md border border-dashed bg-transparent text-xs text-muted-foreground"');
  expect(pageSource).not.toContain('className="flex h-32 flex-col items-center justify-center rounded-md border border-dashed bg-transparent text-xs text-muted-foreground"');
});

test("workers sidebar is conversation-scoped and resizable", () => {
  expect(pageSource).toContain('const [rightSidebarWidth, setRightSidebarWidth] = useState(420)');
  expect(pageSource).toContain('window.localStorage.getItem("omni-workers-sidebar-width")');
  expect(pageSource).toContain('window.localStorage.setItem("omni-workers-sidebar-width", String(rightSidebarWidth))');
  expect(pageSource).toContain('title="Toggle Conversation Workers"');
  expect(pageSource).toContain('<WorkersSidebar');
  expect(pageSource).toContain('agents={conversationAgents}');
  expect(pageSource).toContain('preferredModel={selectedRun?.preferredWorkerModel ?? null}');
  expect(pageSource).toContain('preferredEffort={selectedRun?.preferredWorkerEffort ?? null}');
  expect(pageSource).toContain('onClose={() => setMobileWorkersOpen(false)}');
  expect(pageSource).toContain('onClose={() => setRightSidebarOpen(false)}');
  expect(pageSource).toContain('style={{ width: rightSidebarWidth }}');
  expect(pageSource).toContain('aria-label="Resize workers sidebar"');
  expect(pageSource).toContain('onPointerDown={handleRightSidebarResizeStart}');
  expect(pageSource).toContain('function renderContextMeter(fullnessPercent: number | null | undefined)');
  expect(pageSource).toContain("Permissions waiting");
  expect(pageSource).toContain("Context usage unavailable");
  expect(pageSource).toContain("conic-gradient");
  expect(pageSource).not.toContain("Context window");
  expect(pageSource).not.toContain("Pending permissions");
  expect(pageSource).not.toContain('filter(([, value]) => Boolean(value))');
  expect(pageSource).not.toContain("Recent output");
  expect(pageSource).not.toContain("Session ID");
  expect(pageSource).not.toContain("Attention needed");
  expect(pageSource).not.toContain('border border-fuchsia-400/30 bg-fuchsia-400/10');
  expect(pageSource).not.toContain('border border-emerald-400/30 bg-emerald-400/10');
  expect(pageSource).not.toContain("Global Workers");
  expect(pageSource).not.toContain('<WorkersSidebar agents={state.agents ?? []} onClose={() => setRightSidebarOpen(false)} />');
});

test("settings render as a centered app modal with supervisor llm controls", () => {
  expect(pageSource).toContain('import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox"');
  expect(pageSource).toContain('import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"');
  expect(pageSource).toContain('<Dialog open={showSettings} onOpenChange={setShowSettings}>');
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
  expect(pageSource).toContain('window.localStorage.getItem("omni-theme-mode")');
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

test("command input uses a fixed helper placeholder instead of echoing the selected directory", () => {
  expect(pageSource).toContain('placeholder="Ask Omni anything. @ to refer to files"');
  expect(pageSource).not.toContain('placeholder={draftProjectPath ? `${draftProjectPath}/...` : "e.g. vibes/test-plan.md or fix the login flow"}');
});

test("send button swaps to a spinner while a command submission is pending", () => {
  expect(pageSource).toContain('disabled={runCommand.isPending || !command.trim()}');
  expect(pageSource).toContain('{runCommand.isPending ? (');
  expect(pageSource).toContain('<LoaderCircle className="h-5 w-5 animate-spin" />');
  expect(pageSource).toContain(') : (');
  expect(pageSource).toContain('<ArrowUp className="h-5 w-5" />');
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
  expect(pageSource).toContain("const conversationThinking =");
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
  expect(pageSource).toContain("{showConversationExecution ? conversationThinking : null}");
});

test("starting a project-scoped conversation keeps the composer empty", () => {
  expect(pageSource).toContain('setDraftProjectPath(projectPath)');
  expect(pageSource).toContain('placeholder="Ask Omni anything. @ to refer to files"');
  expect(pageSource).not.toContain('setCommand(`${projectPath}/`)');
});

test("empty state centers the composer with the welcome stack instead of docking it to the bottom", () => {
  expect(pageSource).toContain("const composer = (");
  expect(pageSource).toContain('{selectedRunId ? (');
  expect(pageSource).toContain('{composer("mt-6 w-full")}');
  expect(pageSource).toContain('{selectedRunId ? composer("w-full") : null}');
});
