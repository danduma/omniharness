import fs from "fs";
import path from "path";
import { test, expect } from "vitest";

const pageSource = [
  "src/app/page.tsx",
  "src/app/home/HomeApp.tsx",
  "src/app/home/ComposerContainer.tsx",
  "src/app/home/HomeUiStateManager.ts",
  "src/app/home/constants.ts",
  "src/app/home/types.ts",
  "src/app/home/useHomeLifecycle.ts",
  "src/app/home/useRunSelectionEffects.ts",
  "src/app/home/useHomeMutations.ts",
  "src/app/home/useHomeViewModel.ts",
  "src/app/home/useConversationActions.ts",
  "src/components/home/ConversationComposer.tsx",
  "src/components/home/QueuedMessageDrawer.tsx",
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
  expect(pageSource).toContain('selectedCliAgent: "auto"');
  expect(pageSource).toContain('selectedModel: "gpt-5.4"');
  expect(pageSource).toContain('selectedEffort: "High"');
  expect(pageSource).toContain('themeMode === "night"');
  expect(pageSource).toContain('rounded-[2rem] border border-[#dededd] bg-[#fdfdfc]');
  expect(pageSource).toContain('focus-within:border-[#d2d2d0] focus-within:bg-[#fdfdfc]');
  expect(pageSource).toContain("px-4 pb-0 pt-3");
  expect(pageSource).toContain('"w-full resize-none bg-transparent text-[15px] leading-6 outline-none"');
  expect(pageSource).toContain('hasAttachments ? "min-h-[112px]" : "min-h-[72px]"');
  expect(pageSource).toContain("rows={1}");
  expect(composerSelectSource).toContain("<select");
  expect(composerSelectSource).toContain("<ChevronDownIcon");
  expect(composerSelectSource).not.toContain("selectedLabel");
  expect(composerSelectSource).not.toContain("opacity-0");
  expect(pageSource).toContain("<ComposerModelPicker");
  expect(pageSource).toContain('ariaLabel="Worker effort"');
  expect(composerModelPickerSource).toContain("<select");
  expect(composerModelPickerSource).toContain('aria-label={t("conversation.composer.workerModelAria")}');
  expect(composerModelPickerSource).toContain("selectedLabel");
  expect(pageSource).toContain("const WORKER_OPTIONS: Array<{ value: WorkerType; label: string }> = [");
  expect(pageSource).toContain('const COMPOSER_WORKER_OPTIONS: Array<{ value: ComposerWorkerOption; label: string }> = [');
  expect(pageSource).toContain('{ value: "auto", label: "Auto" }');
  expect(pageSource).toContain('{ value: "codex", label: "Codex" }');
  expect(pageSource).toContain('{ value: "claude", label: "Claude Code" }');
  expect(pageSource).toContain("const FALLBACK_WORKER_MODEL_OPTIONS: WorkerModelCatalog = {");
  expect(pageSource).toContain('workerModels?: Partial<WorkerModelCatalog>');
  expect(pageSource).toContain('const EFFORT_OPTIONS = ["Low", "Medium", "High"]');
  expect(pageSource).toContain('bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-primary/[0.45]');
  expect(pageSource).toContain('placeholder:text-[#c4c4c2]');
});

test("composer supports auto agent selection while pinning explicit agent choices", () => {
  expect(pageSource).toContain('const isAutoWorkerSelection = selectedCliAgent === "auto"');
  expect(pageSource).toContain("const autoSelectedWorkerType = useMemo(() => {");
  expect(pageSource).toContain("return activeAllowedWorkerTypes[0] ?? null;");
  expect(pageSource).toContain("preferredWorkerType: isAutoWorkerSelection ? autoSelectedWorkerType : selectedCliAgent");
  expect(pageSource).toContain("const resolvedSelectedModel = isAutoWorkerSelection ? null : resolveSelectedWorkerModel(selectedCliAgent, selectedModel)");
  expect(pageSource).toContain("preferredWorkerModel: resolvedSelectedModel");
  expect(pageSource).toContain("preferredWorkerEffort: selectedEffort.toLowerCase()");
  expect(pageSource).toContain("allowedWorkerTypes: isAutoWorkerSelection ? activeAllowedWorkerTypes : [selectedCliAgent]");
  expect(pageSource).toContain("options={composerWorkerOptions}");
  expect(composerSelectSource).toContain("options.map");
  expect(pageSource).toContain('window.localStorage.getItem(COMPOSER_WORKER_STORAGE_KEY)');
  expect(pageSource).toContain('window.localStorage.getItem(COMPOSER_MODEL_STORAGE_KEY)');
  expect(pageSource).toContain('window.localStorage.getItem(COMPOSER_EFFORT_STORAGE_KEY)');
  expect(pageSource).toContain('window.localStorage.setItem(COMPOSER_WORKER_STORAGE_KEY, selectedCliAgent)');
  expect(pageSource).toContain('window.localStorage.setItem(COMPOSER_MODEL_STORAGE_KEY, selectedModel)');
  expect(pageSource).toContain('window.localStorage.setItem(COMPOSER_EFFORT_STORAGE_KEY, selectedEffort)');
  expect(pageSource).toContain("const activeWorkerModelOptions = useMemo(");
  expect(pageSource).toContain("options={activeWorkerModelOptions}");
  expect(composerModelPickerSource).toContain("options.map");
  expect(pageSource).not.toContain('if (selectedCliAgent !== "auto") {\n      setSelectedCliAgent("auto");');
  expect(pageSource).toContain('hydratedRunSelectionId: null');
  expect(pageSource).toContain('setHydratedRunSelectionId: homeUiStateManager.createSetter("hydratedRunSelectionId")');
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
  expect(composerSelectSource).toContain('"h-7 w-full min-w-0 appearance-none truncate rounded-md border-0 bg-transparent py-0 pl-1.5 pr-5 text-right text-xs shadow-none outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/45 sm:h-8 sm:pl-2 sm:text-sm"');
  expect(composerModelPickerSource).toContain('"h-7 w-full min-w-0 appearance-none truncate rounded-md border-0 bg-transparent py-0 pl-1.5 pr-5 text-right text-xs font-normal shadow-none outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/45 sm:h-8 sm:pl-2 sm:text-sm"');
});

test("composer exposes native file input, paste ingestion, previews, and removal controls", () => {
  expect(pageSource).toContain('attachments: []');
  expect(pageSource).toContain('type="file"');
  expect(pageSource).toContain('multiple');
  expect(pageSource).toContain('onAddAttachmentFiles(files)');
  expect(pageSource).toContain('event.clipboardData.items');
  expect(pageSource).toContain('onAddPastedImages(pastedImages)');
  expect(pageSource).toContain('attachment.kind === "image" && attachment.previewUrl');
  expect(pageSource).toContain('aria-label={`Remove ${attachment.name}`}');
  expect(pageSource).toContain('<Plus className="h-[18px] w-[18px]" />');
  expect(pageSource).not.toContain("FileAttachmentPickerDialog");
  expect(pageSource).toContain("attachments,");
});

test("composer mention picker can open a project file without inserting it", () => {
  expect(pageSource).toContain("onOpenProjectFile?: (filePath: string) => void;");
  expect(pageSource).toContain("onOpenProjectFile(filePath)");
  expect(pageSource).toContain("Open ${filePath} in side window");
  expect(pageSource).toContain("event.stopPropagation()");
  expect(pageSource).toContain("applyMention(filePath)");
});

test("composer mention picker anchors above the typing shell on mobile", () => {
  const queuedDrawerIndex = pageSource.indexOf("<QueuedMessageDrawer");
  const mentionPickerIndex = pageSource.indexOf("{showMentionPicker && (");
  const typingShellIndex = pageSource.indexOf('data-composer-input="true"');

  expect(pageSource).toContain('<div className="relative">');
  expect(pageSource).toContain("absolute inset-x-0 bottom-full z-30 mb-3");
  expect(pageSource).toContain("max-h-[min(45dvh,18rem)]");
  expect(queuedDrawerIndex).toBeGreaterThan(-1);
  expect(mentionPickerIndex).toBeGreaterThan(queuedDrawerIndex);
  expect(typingShellIndex).toBeGreaterThan(mentionPickerIndex);
});

test("composer controls stay on one mobile row while keeping readable label widths", () => {
  expect(pageSource).toContain('className="mt-0 flex items-center gap-1 pb-2 sm:gap-2"');
  expect(pageSource).toContain('className="ml-auto flex min-w-0 items-center justify-end gap-1 sm:gap-2"');
  expect(pageSource).toContain('"h-8 w-8 shrink-0 rounded-full transition-all"');
  expect(pageSource).not.toContain('className="mt-0 flex flex-wrap items-center gap-x-1 gap-y-1 pb-2 sm:flex-nowrap sm:gap-2"');
  expect(pageSource).not.toContain('className="order-3 flex min-w-0 basis-full items-center justify-end gap-1 sm:order-none sm:basis-auto sm:flex-1 sm:gap-2"');
  expect(pageSource).not.toContain('className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2"');
});

test("composer draft state is isolated from the root home app subscription", () => {
  expect(pageSource).toContain("selectHomeAppState, shallowEqualRecord");
  expect(pageSource).toContain("selectComposerDraftState");
  expect(pageSource).toContain("function ComposerContainer");
  expect(pageSource).toContain("const { command, commandCursor, mentionIndex, attachments } = useManagerSelector(");
  expect(pageSource).toContain('type HomeAppState = Omit<HomeUiState, "command" | "commandCursor" | "mentionIndex" | "attachments">;');
});

test("composer submit button sends text, stops live conversations, and disables when idle empty", () => {
  expect(pageSource).toContain("const isSupervisorRunning = Boolean(selectedRun && selectedRun.mode === \"implementation\" && selectedRun.status === \"running\")");
  expect(pageSource).toContain("const busyConversationWorkerId = !isImplementationConversation");
  expect(pageSource).toContain("const pendingConversationWorkerId = !isImplementationConversation && sendConversationMessage.isPending");
  expect(pageSource).toContain("const stoppableConversationWorkerId = busyConversationWorkerId ?? pendingConversationWorkerId");
  expect(pageSource).toContain("const isConversationStoppable = isSupervisorRunning || Boolean(stoppableConversationWorkerId)");
  expect(pageSource).toContain("const isStopConversationPending = stopSupervisor.isPending || stopWorker.isPending");
  expect(pageSource).toContain('const isStopButtonVisible = composerBehavior.buttonKind === "stop"');
  expect(pageSource).toContain('const isSubmitButtonDisabled = isStopButtonVisible\n    ? isStopConversationPending');
  expect(pageSource).toContain("resolveBusyComposerBehavior({");
  expect(pageSource).toContain('forceSteer: selectedConversationMode === "implementation"');
  expect(pageSource).toContain("disabled={isSubmitButtonDisabled}");
  expect(pageSource).toContain("aria-label={sendButtonAriaLabel}");
  expect(pageSource).toContain('composerBehavior.submitAction === "stop"');
  expect(pageSource).toContain("stopSupervisor.mutate({ runId: selectedRunId })");
  expect(pageSource).toContain("stopWorker.mutate({ runId: selectedRunId, workerId: stoppableConversationWorkerId })");
  expect(pageSource).toContain("if (selectedRunId) {");
  expect(pageSource).toContain("sendConversationMessage.mutate({ runId: selectedRunId, content, attachments, busyAction })");
  expect(pageSource).toContain("resolveBusyMessageActionForSubmitAction(composerBehavior.submitAction");
  expect(pageSource).toContain("composerBehavior.allowAlternateBusyAction && useAlternateBusyAction");
  expect(pageSource).toContain("shouldUseAlternateComposerSubmitKeyDown({");
  expect(pageSource).toContain("getComposerSubmitShortcutLabel(isAppleComposerShortcutPlatform())");
  expect(pageSource).toContain("sendButtonTitle");
  expect(pageSource).toContain("isSendButtonBusy || isStopButtonBusy ? (");
  expect(pageSource).toContain("<Square className=\"h-[13.6px] w-[13.6px] fill-current\" />");
});

test("queued message drawer can send a pending item immediately as steering", () => {
  const drawerSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/components/home/QueuedMessageDrawer.tsx"),
    "utf8"
  );
  const editIndex = drawerSource.indexOf('queued.message.editAria');
  const sendNowIndex = drawerSource.indexOf('queued.message.sendNowAria');
  const cancelIndex = drawerSource.indexOf('queued.message.cancelAria');

  expect(pageSource).toContain("onSendQueuedMessageNow");
  expect(pageSource).toContain("sendQueuedMessageNow.mutate({ runId: selectedRunId, messageId })");
  expect(drawerSource).toContain("onSendNow: (messageId: string) => void;");
  expect(drawerSource).toContain("onClick={() => onSendNow(message.id)}");
  expect(drawerSource).toContain('<ArrowUp className="h-[17px] w-[17px]" />');
  expect(drawerSource).not.toContain("SendHorizontal");
  expect(sendNowIndex).toBeGreaterThan(editIndex);
  expect(sendNowIndex).toBeLessThan(cancelIndex);
});

test("new-conversation mode selection locks while the send mutation is pending", () => {
  const modePickerSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/components/ConversationModePicker.tsx"),
    "utf8"
  );

  expect(pageSource).toContain("disabled={isComposerSubmitting}");
  expect(modePickerSource).toContain("disabled?: boolean");
  expect(modePickerSource).toContain("disabled={disabled}");
  expect(modePickerSource).toContain("if (disabled) {");
});

test("worker cards expose individual stop controls", () => {
  expect(pageSource).toContain("stopWorker.mutate({ runId: selectedRunId, workerId })");
  expect(pageSource).toContain("onStopWorker={onStopWorker}");
  expect(pageSource).toContain('aria-label={`Stop ${displayId}`}');
});
