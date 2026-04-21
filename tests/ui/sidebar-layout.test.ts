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
});

test("settings render as a centered app modal with supervisor llm controls", () => {
  expect(pageSource).toContain('import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox"');
  expect(pageSource).toContain('import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"');
  expect(pageSource).toContain('<Dialog open={showSettings} onOpenChange={setShowSettings}>');
  expect(pageSource).toContain('className="sm:max-w-xl"');
  expect(pageSource).toContain("Supervisor LLM");
  expect(pageSource).toContain("Fallback LLM");
  expect(pageSource).toContain("Supervisor Credentials");
  expect(pageSource).toContain("Fallback Credentials");
  expect(pageSource).toContain("SUPERVISOR_LLM_PROVIDER");
  expect(pageSource).toContain("SUPERVISOR_LLM_MODEL");
  expect(pageSource).toContain("SUPERVISOR_LLM_BASE_URL");
  expect(pageSource).toContain("SUPERVISOR_LLM_API_KEY");
  expect(pageSource).toContain("SUPERVISOR_FALLBACK_LLM_PROVIDER");
  expect(pageSource).toContain("SUPERVISOR_FALLBACK_LLM_MODEL");
  expect(pageSource).toContain("SUPERVISOR_FALLBACK_LLM_BASE_URL");
  expect(pageSource).toContain("SUPERVISOR_FALLBACK_LLM_API_KEY");
  expect(pageSource).toContain("/api/llm-models");
  expect(pageSource).toContain('enabled: provider === "gemini" && apiKey.trim().length > 0');
  expect(pageSource).toContain("<Combobox");
  expect(pageSource).toContain("Search Gemini models");
  expect(pageSource).toContain("Gemini model ids load automatically from the API key and appear in a searchable dropdown.");
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
  expect(pageSource).toContain('title="Toggle Global Workers"');
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
  expect(pageSource).toContain('msg.kind === "error"');
  expect(pageSource).toContain("Run failed");
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
