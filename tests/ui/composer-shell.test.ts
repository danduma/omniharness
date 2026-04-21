import fs from "fs";
import path from "path";
import { test, expect } from "vitest";

const pageSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/app/page.tsx"),
  "utf8"
);

test("composer uses a filled textarea shell with inline cli agent, model, and effort controls", () => {
  expect(pageSource).toContain('const [selectedCliAgent, setSelectedCliAgent] = useState<ComposerWorkerOption>("auto")');
  expect(pageSource).toContain('const [selectedModel, setSelectedModel] = useState("GPT-5.4")');
  expect(pageSource).toContain('const [selectedEffort, setSelectedEffort] = useState("High")');
  expect(pageSource).toContain("rounded-[1.5rem] border border-transparent bg-muted/80");
  expect(pageSource).toContain("px-4 pb-0.5 pt-3");
  expect(pageSource).toContain("min-h-[56px] w-full resize-none bg-transparent");
  expect(pageSource).toContain("rows={1}");
  expect(pageSource).toContain("appearance-none border-0 bg-transparent");
  expect(pageSource).toContain("const WORKER_OPTIONS: Array<{ value: WorkerType; label: string }> = [");
  expect(pageSource).toContain('const COMPOSER_WORKER_OPTIONS: Array<{ value: ComposerWorkerOption; label: string }> = [');
  expect(pageSource).toContain('{ value: "auto", label: "Auto" }');
  expect(pageSource).toContain('{ value: "codex", label: "Codex" }');
  expect(pageSource).toContain('{ value: "claude", label: "Claude Code" }');
  expect(pageSource).toContain('const MODEL_OPTIONS = ["GPT-5.4", "GPT-5.4 Mini", "Claude Sonnet 4"]');
  expect(pageSource).toContain('const EFFORT_OPTIONS = ["Low", "Medium", "High"]');
  expect(pageSource).toContain('className="h-10 w-10 rounded-full bg-foreground text-background transition-all hover:bg-foreground/90 disabled:bg-foreground/50"');
});

test("composer supports auto agent selection while pinning explicit agent choices", () => {
  expect(pageSource).toContain('const isAutoWorkerSelection = selectedCliAgent === "auto"');
  expect(pageSource).toContain("preferredWorkerType: isAutoWorkerSelection ? null : selectedCliAgent");
  expect(pageSource).toContain("const resolvedSelectedModel = isAutoWorkerSelection ? null : resolveSelectedWorkerModel(selectedCliAgent, selectedModel)");
  expect(pageSource).toContain("preferredWorkerModel: resolvedSelectedModel");
  expect(pageSource).toContain("preferredWorkerEffort: selectedEffort.toLowerCase()");
  expect(pageSource).toContain("allowedWorkerTypes: isAutoWorkerSelection ? activeAllowedWorkerTypes : [selectedCliAgent]");
  expect(pageSource).toContain("composerWorkerOptions.map((agent) => (");
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

test("composer control row uses tighter centered spacing instead of bottom-heavy end alignment", () => {
  expect(pageSource).toContain('className="mt-0.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2"');
  expect(pageSource).not.toContain('className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2"');
});
