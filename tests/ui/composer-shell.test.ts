import fs from "fs";
import path from "path";
import { test, expect } from "vitest";

const pageSource = [
  "src/app/page.tsx",
  "src/app/home/HomeApp.tsx",
  "src/app/home/constants.ts",
  "src/app/home/types.ts",
  "src/app/home/useHomeLifecycle.ts",
  "src/app/home/useRunSelectionEffects.ts",
  "src/components/home/ConversationComposer.tsx",
  "src/components/home/WorkersSidebar.tsx",
  "src/components/WorkerCard.tsx",
].map((relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8")).join("\n");
const composerSelectSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/components/composer/ComposerSelect.tsx"),
  "utf8"
);
const composerModelPickerSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/components/composer/ComposerModelPicker.tsx"),
  "utf8"
);

test("composer uses a filled textarea shell with inline cli agent, model, and effort controls", () => {
  expect(pageSource).toContain('const [selectedCliAgent, setSelectedCliAgent] = useState<ComposerWorkerOption>("auto")');
  expect(pageSource).toContain('const [selectedModel, setSelectedModel] = useState("gpt-5.4")');
  expect(pageSource).toContain('const [selectedEffort, setSelectedEffort] = useState("High")');
  expect(pageSource).toContain('themeMode === "night"');
  expect(pageSource).toContain('border border-[#d8d8d8] bg-[#fbfbfa]');
  expect(pageSource).toContain('focus-within:bg-white');
  expect(pageSource).toContain("px-4 pb-0.5 pt-3");
  expect(pageSource).toContain("min-h-[56px] w-full resize-none bg-transparent");
  expect(pageSource).toContain("rows={1}");
  expect(composerSelectSource).toContain("<select");
  expect(composerSelectSource).not.toContain("selectedLabel");
  expect(composerSelectSource).not.toContain("opacity-0");
  expect(composerSelectSource).not.toContain("ChevronDown");
  expect(pageSource).toContain("<ComposerModelPicker");
  expect(pageSource).toContain('ariaLabel="Worker effort"');
  expect(composerModelPickerSource).toContain("Choose model");
  expect(composerModelPickerSource).toContain('side="bottom"');
  expect(composerModelPickerSource).toContain("Search models");
  expect(pageSource).toContain("const WORKER_OPTIONS: Array<{ value: WorkerType; label: string }> = [");
  expect(pageSource).toContain('const COMPOSER_WORKER_OPTIONS: Array<{ value: ComposerWorkerOption; label: string }> = [');
  expect(pageSource).toContain('{ value: "auto", label: "Auto" }');
  expect(pageSource).toContain('{ value: "codex", label: "Codex" }');
  expect(pageSource).toContain('{ value: "claude", label: "Claude Code" }');
  expect(pageSource).toContain("const FALLBACK_WORKER_MODEL_OPTIONS: WorkerModelCatalog = {");
  expect(pageSource).toContain('workerModels?: Partial<WorkerModelCatalog>');
  expect(pageSource).toContain('const EFFORT_OPTIONS = ["Low", "Medium", "High"]');
  expect(pageSource).toContain('bg-[#9d9d9d] text-white hover:bg-[#8b8b8b] disabled:bg-[#c9c9c9]');
  expect(pageSource).toContain('placeholder:text-[#c4c4c2]');
});

test("composer supports auto agent selection while pinning explicit agent choices", () => {
  expect(pageSource).toContain('const isAutoWorkerSelection = selectedCliAgent === "auto"');
  expect(pageSource).toContain("const autoSelectedWorkerType = useMemo(() => {");
  expect(pageSource).toContain('const normalizedDefaultWorkerType = parseWorkerType(apiKeys.WORKER_DEFAULT_TYPE)');
  expect(pageSource).toContain("preferredWorkerType: isAutoWorkerSelection ? autoSelectedWorkerType : selectedCliAgent");
  expect(pageSource).toContain("const resolvedSelectedModel = isAutoWorkerSelection ? null : resolveSelectedWorkerModel(selectedCliAgent, selectedModel)");
  expect(pageSource).toContain("preferredWorkerModel: resolvedSelectedModel");
  expect(pageSource).toContain("preferredWorkerEffort: selectedEffort.toLowerCase()");
  expect(pageSource).toContain("allowedWorkerTypes: isAutoWorkerSelection ? activeAllowedWorkerTypes : [selectedCliAgent]");
  expect(pageSource).toContain("options={composerWorkerOptions}");
  expect(composerSelectSource).toContain("options.map((option) => (");
  expect(pageSource).toContain('window.localStorage.getItem(COMPOSER_WORKER_STORAGE_KEY)');
  expect(pageSource).toContain('window.localStorage.getItem(COMPOSER_MODEL_STORAGE_KEY)');
  expect(pageSource).toContain('window.localStorage.getItem(COMPOSER_EFFORT_STORAGE_KEY)');
  expect(pageSource).toContain('window.localStorage.setItem(COMPOSER_WORKER_STORAGE_KEY, selectedCliAgent)');
  expect(pageSource).toContain('window.localStorage.setItem(COMPOSER_MODEL_STORAGE_KEY, selectedModel)');
  expect(pageSource).toContain('window.localStorage.setItem(COMPOSER_EFFORT_STORAGE_KEY, selectedEffort)');
  expect(pageSource).toContain("const activeWorkerModelOptions = useMemo(");
  expect(pageSource).toContain("options={activeWorkerModelOptions}");
  expect(composerModelPickerSource).toContain("filteredOptions.map");
  expect(pageSource).not.toContain('if (selectedCliAgent !== "auto") {\n      setSelectedCliAgent("auto");');
  expect(pageSource).toContain('const [hydratedRunSelectionId, setHydratedRunSelectionId] = useState<string | null>(null)');
  expect(pageSource).toContain('if (!selectedRunId || !selectedRun) {');
  expect(pageSource).toContain('if (hydratedRunSelectionId === selectedRunId) {');
});

test("direct mode requires an explicit cli agent and tightens dropdown alignment", () => {
  expect(pageSource).toContain('const shouldOfferAutoWorkerOption = activeComposerMode !== "direct"');
  expect(pageSource).toContain('return shouldOfferAutoWorkerOption');
  expect(pageSource).toContain('if (activeComposerMode === "direct") {');
  expect(pageSource).toContain('const nextDirectWorker = selectedCliAgent === "auto" ? (autoSelectedWorkerType ?? activeAllowedWorkerTypes[0] ?? "codex") : selectedCliAgent;');
  expect(pageSource).toContain('<ComposerSelect');
  expect(pageSource).toContain('<ComposerModelPicker');
  expect(composerSelectSource).toContain('"h-8 max-w-[6.8rem] shrink truncate appearance-none border-0 bg-transparent px-1 text-right text-xs outline-none transition-colors sm:h-9 sm:max-w-none sm:px-2 sm:text-sm"');
});

test("composer exposes attachment entry and renders attached file chips", () => {
  expect(pageSource).toContain('const [showAttachmentPicker, setShowAttachmentPicker] = useState(false)');
  expect(pageSource).toContain('const [attachments, setAttachments] = useState<AttachmentItem[]>([])');
  expect(pageSource).toContain('setShowAttachmentPicker(true)');
  expect(pageSource).toContain('attachments.map((attachment) => (');
  expect(pageSource).toContain('aria-label={`Remove ${attachment.name}`}');
  expect(pageSource).toContain('<Plus className="h-5 w-5" />');
  expect(pageSource).toContain("FileAttachmentPickerDialog");
  expect(pageSource).toContain("attachments,");
});

test("composer control row stays on one compact mobile row", () => {
  expect(pageSource).toContain('className="mt-1 flex items-center gap-1 sm:gap-2"');
  expect(pageSource).toContain('className="ml-auto flex min-w-0 items-center justify-end gap-1 sm:gap-2"');
  expect(pageSource).toContain('"h-9 w-9 shrink-0 rounded-full transition-all sm:h-10 sm:w-10"');
  expect(pageSource).not.toContain('className="mt-0.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2"');
  expect(pageSource).not.toContain('className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-1 sm:gap-2"');
  expect(pageSource).not.toContain('className="ml-auto flex flex-wrap items-center gap-2"');
  expect(pageSource).not.toContain('className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2"');
});

test("composer submit button sends text, stops a running supervisor when empty, and disables when idle empty", () => {
  expect(pageSource).toContain("const isSupervisorRunning = Boolean(selectedRun && selectedRun.mode === \"implementation\" && selectedRun.status === \"running\")");
  expect(pageSource).toContain("const isStopButtonVisible = !command.trim() && isSupervisorRunning");
  expect(pageSource).toContain("disabled={isComposerSubmitting || (!command.trim() && !isSupervisorRunning)}");
  expect(pageSource).toContain('aria-label={isStopButtonVisible ? "Stop supervisor" : "Send message"}');
  expect(pageSource).toContain("if (!command.trim() && isSupervisorRunning) {");
  expect(pageSource).toContain("stopSupervisor.mutate({ runId: selectedRunId })");
  expect(pageSource).toContain("if (selectedRunId) {");
  expect(pageSource).toContain("sendConversationMessage.mutate({ runId: selectedRunId, content: command })");
  expect(pageSource).toContain("<Square className=\"h-4 w-4 fill-current\" />");
});

test("worker cards expose individual stop controls", () => {
  expect(pageSource).toContain("stopWorker.mutate({ runId: selectedRunId, workerId })");
  expect(pageSource).toContain("onStopWorker={onStopWorker}");
  expect(pageSource).toContain('aria-label={`Stop ${displayId}`}');
});
