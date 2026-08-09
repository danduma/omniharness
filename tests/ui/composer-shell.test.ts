import fs from "fs";
import path from "path";
import { test, expect } from "vitest";

const pageSource = [
  "src/interface/home/HomeApp.tsx",
  "src/interface/home/ComposerContainer.tsx",
  "src/interface/home/HomeUiStateManager.ts",
  "src/interface/home/HomeAppStateManager.ts",
  "src/interface/home/constants.ts",
  "src/interface/home/types.ts",
  "src/shared/home-types.ts",
  "src/interface/home/useHomeLifecycle.ts",
  "src/interface/home/useRunSelectionEffects.ts",
  "src/interface/home/useHomeMutations.ts",
  "src/interface/home/useHomeViewModel.ts",
  "src/interface/home/useConversationActions.ts",
  "src/components/home/ConversationComposer.tsx",
  "src/components/home/QueuedMessageDrawer.tsx",
  "src/components/home/WorkersSidebar.tsx",
  "src/components/WorkerCard.tsx",
].map((relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8")).join("\n");
const mobileComposerSettingsPath = path.resolve(process.cwd(), "src/components/composer/MobileComposerSettings.tsx");
const mobileComposerSettingsSource = fs.existsSync(mobileComposerSettingsPath)
  ? fs.readFileSync(mobileComposerSettingsPath, "utf8")
  : "";
const composerSelectSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/components/composer/ComposerSelect.tsx"),
  "utf8"
);
const composerModelPickerSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/components/composer/ComposerModelPicker.tsx"),
  "utf8"
);
const globalsSource = fs.readFileSync(path.resolve(process.cwd(), "src/interface/styles/globals.css"), "utf8");

test("composer uses a filled textarea shell with inline cli agent, model, and effort controls", () => {
  expect(pageSource).toContain('selectedCliAgent: "auto"');
  expect(pageSource).toContain('selectedModel: "gpt-5.6-sol"');
  expect(pageSource).toContain('selectedEffort: "High"');
  expect(pageSource).toContain('themeMode === "night"');
  expect(pageSource).toContain('rounded-[2rem] border border-[#dededd] bg-[#fdfdfc]');
  expect(pageSource).toContain('focus-within:border-[#d2d2d0] focus-within:bg-[#fdfdfc]');
  expect(pageSource).toContain("px-4 pb-0 pt-5");
  expect(pageSource).toContain('"omni-composer-input w-full resize-none bg-transparent outline-none"');
  expect(pageSource).toContain('hasAttachments ? "min-h-[152px] sm:min-h-[112px]" : "min-h-[112px] sm:min-h-[72px]"');
  expect(globalsSource).toContain(".omni-composer-input");
  expect(globalsSource).toContain("line-height: var(--omni-composer-line-height, 20px);");
  expect(pageSource).toContain("rows={1}");
  expect(composerSelectSource).toContain("<select");
  expect(composerSelectSource).toContain("<ChevronDownIcon");
  expect(composerSelectSource).not.toContain("selectedLabel");
  expect(composerSelectSource).not.toContain("opacity-0");
  expect(pageSource).toContain("<ComposerModelPicker");
  expect(pageSource).toContain('ariaLabel={t("conversation.composer.settings.effort")}');
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
  expect(pageSource).toContain('const EFFORT_OPTIONS = ["Low", "Medium", "High", "Extra High", "Max"]');
  expect(pageSource).toContain('codex: "gpt-5.6-sol"');
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
  expect(pageSource).toContain('const savedModel = resolveSavedComposerModel(savedModelValue)');
  expect(pageSource).toContain('if (savedModel) {\n      setSelectedModel(savedModel);\n    }');
  expect(pageSource).toContain('window.localStorage.getItem(getEffortStorageKey(savedWorker, savedModel))');
  expect(pageSource).toContain('safeSetBrowserStorageItem(window.localStorage, COMPOSER_WORKER_STORAGE_KEY, selectedCliAgent)');
  expect(pageSource).toContain('safeSetBrowserStorageItem(window.localStorage, COMPOSER_MODEL_STORAGE_KEY, selectedModel)');
  expect(pageSource).toContain('safeSetBrowserStorageItem(window.localStorage, getEffortStorageKey(selectedCliAgent, selectedModel), selectedEffort)');
  expect(pageSource).toContain("const activeWorkerModelOptions = useMemo(");
  expect(pageSource).toContain("options={activeWorkerModelOptions}");
  expect(composerModelPickerSource).toContain("options.map");
  expect(pageSource).not.toContain('if (selectedCliAgent !== "auto") {\n      setSelectedCliAgent("auto");');
  expect(pageSource).toContain('hydratedRunSelectionId: null');
  expect(pageSource).toContain('setHydratedRunSelectionId: homeUiStateManager.createSetter("hydratedRunSelectionId")');
  expect(pageSource).toContain('if (!selectedRunId || !selectedRun) {');
  expect(pageSource).toContain('if (hydratedRunSelectionId === selectedRunId) {');
});

test("composer never sends an account that belongs to a different worker type", () => {
  expect(pageSource).toContain("resolveCompatibleComposerAccountId({");
  expect(pageSource).toContain("selectedWorkerAccountId: effectiveSelectedWorkerAccountId");
});

test("direct mode requires an explicit cli agent and tightens dropdown alignment", () => {
  expect(pageSource).toContain('const shouldOfferAutoWorkerOption = activeComposerMode !== "direct"');
  expect(pageSource).toContain('return shouldOfferAutoWorkerOption');
  expect(pageSource).toContain('if (activeComposerMode === "direct") {');
  expect(pageSource).toContain('const nextDirectWorker = selectedCliAgent === "auto" ? (autoSelectedWorkerType ?? activeAllowedWorkerTypes[0] ?? "codex") : selectedCliAgent;');
  expect(pageSource).toContain('<ComposerSelect');
  expect(pageSource).toContain('<ComposerModelPicker');
  expect(composerSelectSource).toContain('"h-7 min-w-0 appearance-none rounded-md border-0 bg-transparent py-0 pl-1.5 pr-5 text-xs shadow-none outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/45 sm:h-8 sm:pl-2 sm:text-sm"');
  expect(composerModelPickerSource).toContain('"h-7 min-w-0 appearance-none rounded-md border-0 bg-transparent py-0 pl-1.5 pr-5 text-xs font-normal shadow-none outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/45 sm:h-8 sm:pl-2 sm:text-sm"');
});

test("composer exposes native file input, paste ingestion, previews, and removal controls", () => {
  expect(pageSource).toContain('attachments: []');
  expect(pageSource).toContain('type="file"');
  expect(pageSource).toContain('multiple');
  expect(pageSource).toContain('onAddAttachmentFiles(files)');
  expect(pageSource).toContain('event.clipboardData.items');
  expect(pageSource).toContain('onAddPastedImages(pastedImages)');
  expect(pageSource).toContain('attachment.kind === "image" && attachment.previewUrl');
  expect(pageSource).toContain('t("conversation.composer.removeAttachment", { attachment: attachment.name })');
  expect(pageSource).toContain('<Plus className="h-[18px] w-[18px]" />');
  expect(pageSource).not.toContain("FileAttachmentPickerDialog");
  expect(pageSource).toContain("attachments,");
});

test("composer accepts dropped files and exposes an active drop target", () => {
  expect(pageSource).toContain("fileDragDepth");
  expect(pageSource).toContain('data-composer-dropzone="true"');
  expect(pageSource).toContain("onDragEnter");
  expect(pageSource).toContain("onDragOver");
  expect(pageSource).toContain("onDragLeave");
  expect(pageSource).toContain("onDrop");
  expect(pageSource).toContain("Array.from(event.dataTransfer.files)");
  expect(pageSource).toContain('t("conversation.composer.dropFilesActive")');
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

test("composer settings stay readable without clipping on either viewport", () => {
  expect(pageSource).toContain('className="mt-0 flex items-center gap-1 pb-2 sm:gap-2"');
  expect(pageSource).toContain('data-composer-settings="true"');
  expect(pageSource).toContain("flex-wrap");
  expect(pageSource).toContain('className="ml-auto sm:hidden"');
  expect(composerSelectSource).toContain("shrink-0");
  expect(composerModelPickerSource).toContain("shrink-0");
  expect(pageSource).toContain('"h-8 w-8 shrink-0 rounded-full transition-all"');
});

test("workspace control floats above the typing shell instead of joining settings", () => {
  const workspaceIndex = pageSource.indexOf("<BranchWorkspaceButton");
  const textareaIndex = pageSource.indexOf('data-composer-input="true"');
  const settingsIndex = pageSource.indexOf('data-composer-settings="true"');

  expect(workspaceIndex).toBeGreaterThan(-1);
  expect(workspaceIndex).toBeLessThan(textareaIndex);
  expect(settingsIndex).toBeGreaterThan(textareaIndex);
  expect(pageSource).toContain('data-composer-workspace="true"');
});

test("mobile composer settings expose one unlabeled summary chip in an upward-wrapping rail", () => {
  expect(mobileComposerSettingsSource).toContain('data-composer-mobile-settings="true"');
  expect(mobileComposerSettingsSource).toContain("bottom-full");
  expect(mobileComposerSettingsSource).toContain("max-w-full");
  expect(mobileComposerSettingsSource).toContain("min-w-0");
  expect(mobileComposerSettingsSource).toContain("pointer-events-auto");
  expect(mobileComposerSettingsSource).toContain("flex-wrap");
  expect(mobileComposerSettingsSource).toContain("sm:hidden");
  expect(mobileComposerSettingsSource).toContain('data-composer-settings-chip="true"');
  expect(mobileComposerSettingsSource).toContain('data-composer-settings-dialog="true"');
  expect(mobileComposerSettingsSource).toContain("SlidersHorizontal");
  expect(mobileComposerSettingsSource).toContain('<SheetContent data-composer-settings-dialog="true" side="bottom"');
  expect(mobileComposerSettingsSource).toContain("disabled={descriptorArgs.disabled}");
  expect(mobileComposerSettingsSource).not.toContain("MobileComposerChip");
  expect(mobileComposerSettingsSource).not.toContain('t("settings.commitAgent.cli")');
  expect(mobileComposerSettingsSource).toContain("getMobileComposerSettingDescriptors");
  expect(mobileComposerSettingsSource).toContain("useI18nSnapshot()");
  expect(pageSource).toContain("<MobileComposerSettings");
  expect(pageSource).toContain("mobileSettingsOpen");
  expect(pageSource).toContain("setMobileSettingsOpen");
  expect(pageSource).toContain("settingsOpen={mobileSettingsOpen}");
});

test("mobile and desktop composer placements remain distinct", () => {
  expect(mobileComposerSettingsSource).toContain("!selectedRunId ?");
  expect(pageSource).toContain('className="pointer-events-none absolute inset-x-0 -top-5 z-30 hidden justify-start px-3 sm:flex sm:px-4"');
  expect(mobileComposerSettingsSource).toContain("BranchWorkspaceButton");
});

test("composer draft state is isolated from the root home app subscription", () => {
  expect(pageSource).toContain("selectHomeAppState, shallowEqualRecord");
  expect(pageSource).toContain("selectComposerDraftState");
  expect(pageSource).toContain("function ComposerContainerInner");
  expect(pageSource).toContain("export const ComposerContainer = memo(ComposerContainerInner)");
  expect(pageSource).toContain("function ConversationComposerInner");
  expect(pageSource).toContain("export const ConversationComposer = memo(ConversationComposerInner)");
  expect(pageSource).toContain("const { command, commandCursor, mentionIndex, attachments } = useManagerSelector(");
  expect(pageSource).toContain("export type HomeAppState = Omit<");
  expect(pageSource).toContain('"command" | "commandCursor" | "mentionIndex" | "attachments"');
  expect(pageSource).toContain("const handleComposerInterruptQueuedMessage = useCallback(");
  expect(pageSource).toContain("const handleComposerCancelQueuedMessage = useCallback(");
  expect(pageSource).toContain("const handleComposerSendConversationMessage = useCallback(");
  expect(pageSource).toContain("const handleComposerRunCommand = useCallback(");
});

test("selecting a session preserves its restored composer draft", () => {
  const actionsSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/interface/home/useConversationActions.ts"),
    "utf8"
  );
  const start = actionsSource.indexOf("const handleSelectRun = (runId: string) => {");
  const end = actionsSource.indexOf("  };", start);
  const block = actionsSource.slice(start, end);

  expect(start).toBeGreaterThanOrEqual(0);
  expect(block).toContain("setSelectedRunId(runId);");
  expect(block).toContain("setDraftProjectPath(null);");
  expect(block).not.toContain("setCommand(");
  expect(block).not.toContain("setCommandCursor(");
  expect(block).not.toContain("clearAttachments(");
});

test("composer submit button sends text, stops live conversations, and disables when idle empty", () => {
  expect(pageSource).toContain("const isSupervisorRunning = Boolean(");
  expect(pageSource).toContain('selectedRunMode === "implementation"');
  expect(pageSource).toContain('selectedRunPhase !== "planning"');
  expect(pageSource).toContain('selectedRun.status === "running"');
  expect(pageSource).toContain("const busyConversationWorkerId = !isImplementationConversation");
  expect(pageSource).toContain("const isSendingSelectedConversationMessage = isMutationPendingForSelectedRun({");
  expect(pageSource).toContain("mutationRunId: sendConversationMessage.variables?.runId");
  expect(pageSource).toContain("const pendingConversationWorkerId = resolvePendingConversationWorkerId({");
  expect(pageSource).toContain("selectedWorkerIds: selectedRunWorkersForDisplay.map((worker) => worker.id)");
  expect(pageSource).toContain("const directRunningConversationWorkerId = isDirectConversation");
  expect(pageSource).toContain("const stoppableConversationWorkerId = busyConversationWorkerId ?? pendingConversationWorkerId ?? directRunningConversationWorkerId");
  expect(pageSource).toContain("const isConversationStoppable = isSupervisorRunning || Boolean(stoppableConversationWorkerId)");
  expect(pageSource).toContain("const isStopConversationPending = isStoppingSelectedSupervisor || isStoppingSelectedWorker");
  expect(pageSource).toContain('const isStopButtonVisible = composerBehavior.buttonKind === "stop"');
  expect(pageSource).toContain("const showSeparateStopButton = isConversationStoppable && !isStopButtonVisible");
  expect(pageSource).toContain('const isSubmitButtonDisabled = isStopButtonVisible\n    ? isStopConversationPending');
  expect(pageSource).toContain("resolveBusyComposerBehavior({");
  expect(pageSource).toContain('forceSteer: selectedConversationMode === "implementation"');
  expect(pageSource).toContain("disabled={isSubmitButtonDisabled}");
  expect(pageSource).toContain("aria-label={sendButtonAriaLabel}");
  expect(pageSource).toContain('composerBehavior.submitAction === "stop"');
  expect(pageSource).toContain("stopSupervisorMutate({ runId: selectedRunId })");
  expect(pageSource).toContain("stopWorkerMutate({ runId: selectedRunId, workerId: stoppableConversationWorkerId })");
  expect(pageSource).toContain("if (selectedRunId) {");
  expect(pageSource).toContain("sendConversationMessageMutate({ runId: selectedRunId, content, clientMessageId: createSentConversationMessageId(), attachments, busyAction })");
  expect(pageSource).toContain("resolveBusyMessageActionForSubmitAction(composerBehavior.submitAction");
  expect(pageSource).toContain("composerBehavior.allowAlternateBusyAction && useAlternateBusyAction");
  expect(pageSource).toContain("shouldUseAlternateComposerSubmitKeyDown({");
  expect(pageSource).toContain("getComposerSubmitShortcutLabel(isAppleComposerShortcutPlatform())");
  expect(pageSource).toContain("sendButtonTitle");
  expect(pageSource).toContain("isSendButtonBusy || isStopButtonBusy ? (");
  expect(pageSource).toContain("showSeparateStopButton && (");
  expect(pageSource).toContain("onClick={onStopConversation}");
  expect(pageSource).toContain("<Square className=\"h-[13.6px] w-[13.6px] fill-current\" />");
});

test("queued message drawer force-send arrow interrupts the active turn", () => {
  const drawerSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/components/home/QueuedMessageDrawer.tsx"),
    "utf8"
  );
  const editIndex = drawerSource.indexOf('queued.message.editAria');
  const sendNowIndex = drawerSource.indexOf('queued.message.interruptSendAria');
  const cancelIndex = drawerSource.indexOf('queued.message.cancelAria');

  expect(pageSource).toContain("onInterruptQueuedMessage");
  expect(pageSource).toContain("interruptQueuedMessageMutate({ runId: selectedRunId, messageId })");
  expect(drawerSource).toContain("onInterruptSendNow: (messageId: string) => void;");
  expect(drawerSource).toContain("onClick={() => onInterruptSendNow(message.id)}");
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

test("promotePlanningConversation.isPending is scoped to the selected run before use in isComposerSubmitting", () => {
  expect(pageSource).toContain("const isPromotePlanningPendingForSelectedRun = isMutationPendingForSelectedRun({");
  expect(pageSource).toContain("mutationRunId: promotePlanningConversation.variables?.runId,");
  expect(pageSource).toContain("isPromotePlanningPendingForSelectedRun || isStopConversationPending");
  // Unscoped isPending must not appear in the isComposerSubmitting expression.
  expect(pageSource).not.toContain("promotePlanningConversation.isPending || isStopConversationPending");
});

test("recoverRun.isPending is scoped to the selected run before suppressing auto-resume", () => {
  expect(pageSource).toContain("const isRecoverRunPendingForSelectedRun = isMutationPendingForSelectedRun({");
  expect(pageSource).toContain("mutationRunId: recoverRun.variables?.runId,");
  expect(pageSource).toContain("recoverRunIsPending: isRecoverRunPendingForSelectedRun,");
  expect(pageSource).toContain("|| isRecoverRunPendingForSelectedRun");
  // Unscoped recoverRun.isPending must not guard the auto-resume effect.
  expect(pageSource).not.toContain("|| recoverRun.isPending");
});

test("resumeRunRecovery.isPending is scoped to the selected run before being passed to ConversationMain", () => {
  expect(pageSource).toContain("const isResumeRunRecoveryPendingForSelectedRun = isMutationPendingForSelectedRun({");
  expect(pageSource).toContain("mutationRunId: resumeRunRecovery.variables?.runId,");
  expect(pageSource).toContain("resumeRunRecovery={{ isPending: isResumeRunRecoveryPendingForSelectedRun }}");
  // Unscoped object must not be forwarded.
  expect(pageSource).not.toContain("resumeRunRecovery={resumeRunRecovery}");
});

test("preflight confirmation answering uses the already-scoped send-message pending flag", () => {
  expect(pageSource).toContain("isPreflightConfirmationAnswering={isSendingSelectedConversationMessage}");
  // Unscoped global must not be used for this prop.
  expect(pageSource).not.toContain("isPreflightConfirmationAnswering={sendConversationMessage.isPending}");
});
