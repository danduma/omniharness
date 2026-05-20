import fs from "fs";
import path from "path";
import { test, expect } from "vitest";

const readSource = (relativePath: string) => fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
const pageSource = [
  "src/app/page.tsx",
  "src/app/home/HomeApp.tsx",
  "src/app/home/useAppErrors.ts",
  "src/app/home/useConversationExecutionStatus.ts",
  "src/app/home/useHomeLifecycle.ts",
  "src/app/home/useHomeMutations.ts",
  "src/app/home/useConversationActions.ts",
  "src/app/home/useHomeViewModel.ts",
  "src/app/home/LiveEventConnectionManager.ts",
  "src/app/home/utils.ts",
  "src/lib/conversation-visuals.ts",
  "src/lib/commit-workflow.ts",
  "src/components/home/ConversationMain.tsx",
  "src/components/home/ConversationSidebar.tsx",
  "src/components/home/HomeHeader.tsx",
  "src/components/home/SettingsDialog.tsx",
].map(readSource).join("\n");
const homeAppSource = [
  "src/app/home/HomeApp.tsx",
  "src/app/home/useHomeMutations.ts",
  "src/app/home/useConversationActions.ts",
  "src/app/home/useHomeViewModel.ts",
].map(readSource).join("\n");
const markdownContentSource = readSource("src/components/MarkdownContent.tsx");
const terminalSource = readSource("src/components/Terminal.tsx");

test("conversation rows expose rename and delete actions", () => {
  expect(pageSource).toContain('Rename');
  expect(pageSource).toContain('Delete');
  expect(pageSource).not.toContain('Rename conversation');
  expect(pageSource).not.toContain('Delete conversation');
  expect(pageSource).toContain('requestJson(`/api/runs/${runId}`');
});

test("double clicking a conversation row starts sidebar renaming for that row", () => {
  const sidebarSource = readSource("src/components/home/ConversationSidebar.tsx");
  const rowIndex = sidebarSource.indexOf("key={run.id}");
  const doubleClickIndex = sidebarSource.indexOf("onDoubleClick={(event) => {", rowIndex);
  const renameIndex = sidebarSource.indexOf("startRenamingRun(run);", doubleClickIndex);

  expect(rowIndex).toBeGreaterThanOrEqual(0);
  expect(doubleClickIndex).toBeGreaterThan(rowIndex);
  expect(renameIndex).toBeGreaterThan(doubleClickIndex);
});

test("conversation rows expose archive in the overflow menu and commit rows expose an inline archive icon", () => {
  const sidebarSource = readSource("src/components/home/ConversationSidebar.tsx");

  expect(sidebarSource).toContain("Archive");
  expect(sidebarSource).toContain("isCommitConversation");
  expect(sidebarSource).toContain("const canArchiveConversation = isArchivableRunStatus(run.status);");
  expect(sidebarSource).toContain('className: "border-[#c88b45]/30 bg-[#c88b45]/12 text-[#9e5f18] dark:border-[#f0b15d]/25 dark:bg-[#f0b15d]/10 dark:text-[#f0b15d]",');
  expect(sidebarSource).toContain('aria-label={`Archive ${run.title}`}');
  expect(sidebarSource).toContain("archiveRun(run)");
  expect(sidebarSource).toContain("{canArchiveConversation && isCommitConversation ? (");
  expect(sidebarSource).toContain("{canArchiveConversation ? (");
  expect(sidebarSource).not.toContain('{isCommitConversation ? (\n                                    <DropdownMenuItem');
  expect(homeAppSource).toContain("const archiveRun = useMutation({");
  expect(homeAppSource).toContain('body: JSON.stringify({ action: "archive" })');
  expect(homeAppSource).toContain('action: "Archive"');
  expect(homeAppSource).toContain("archiveRun: actions.handleArchiveRun");
});

test("conversation rows show left-side status attention indicators", () => {
  const sidebarSource = readSource("src/components/home/ConversationSidebar.tsx");
  const localeSource = readSource("shared/locales/en.json");

  expect(sidebarSource).toContain("TriangleAlert");
  expect(sidebarSource).toContain("normalizeRunStatus");
  expect(sidebarSource).toContain('const normalizedRunStatus = normalizeRunStatus(run.status);');
  expect(sidebarSource).toContain("const runIsUnread = isRunUnread({");
  expect(sidebarSource).toContain('const showCompletedAttentionIndicator = normalizedRunStatus === "done" && runIsUnread;');
  expect(sidebarSource).toContain('const showAwaitingUserIndicator = normalizedRunStatus === "awaiting_user";');
  expect(sidebarSource).toContain('conversation.sidebar.status.completedAttention');
  expect(sidebarSource).toContain('conversation.sidebar.status.awaitingUser');
  expect(sidebarSource).toContain("bg-sky-300");
  expect(sidebarSource).toContain("text-amber-500");
  expect(sidebarSource).toContain("{runIsUnread && !showCompletedAttentionIndicator ? (");
  expect(sidebarSource).toContain('<TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />');
  expect(localeSource).toContain('"conversation.sidebar.status.completedAttention": "Finished with unread messages"');
  expect(localeSource).toContain('"conversation.sidebar.status.awaitingUser": "Waiting for your input"');
});

test("top bar exposes an auto commit action for the selected chat", () => {
  expect(pageSource).toContain("MANUAL_COMMIT_CHAT_PROMPT");
  expect(pageSource).toContain("MANUAL_COMMIT_CHAT_PUSH_PROMPT");
  expect(pageSource).toContain('"Group the modified files from this conversation into logical git commits. Do not run tests. Do not modify files or do anything else. Only inspect the modified files as needed, create commits, and stop."');
  expect(pageSource).toContain('"Group the modified files from this conversation into logical git commits, then push the current branch. Do not run tests. Do not modify files or do anything else. Only inspect the modified files as needed, create commits, push, and stop."');
  expect(pageSource).toContain("mutations.autoCommitChat.mutate({ runId: selectedRunId, action })");
  expect(pageSource).toContain("ButtonGroup");
  expect(pageSource).toContain("DropdownMenu");
  expect(pageSource).toContain("commit.menu.label");
  expect(pageSource).toContain("commit.menu.commitAndPushNow");
  expect(pageSource).toContain("onAutoCommitMilestonesChange");
  expect(pageSource).toContain("onPushOnCommitChange");
  expect(pageSource).toContain("autoCommitMilestonesEnabled");
});

test("top bar conversation title is plain text until explicitly edited", () => {
  const homeHeaderSource = readSource("src/components/home/HomeHeader.tsx");

  expect(homeHeaderSource).toContain("Pencil");
  expect(homeHeaderSource).toContain("isEditingTitle ? (");
  expect(homeHeaderSource).toContain('aria-label="Conversation title"');
  expect(homeHeaderSource).toContain('aria-label="Edit conversation title"');
  expect(homeHeaderSource).toContain('className="hidden');
  expect(homeHeaderSource).toContain('lg:inline-flex');
  expect(homeHeaderSource).toContain('onClick={beginTopBarTitleEdit}');
  expect(homeHeaderSource).toContain('onClick={beginTopBarTitleEdit}');
  expect(homeHeaderSource).not.toContain("readOnly={!isEditingTitle}");
  expect(homeHeaderSource).not.toContain("titleInputValue");
});

test("user-initiated conversation sends reveal the appended turn", () => {
  expect(homeAppSource).toContain("const scrollConversationToBottom = useCallback");

  const sendConversationSuccessIndex = homeAppSource.indexOf("const sendConversationMessage = useMutation({");
  const sendConversationScrollIndex = homeAppSource.indexOf("scrollConversationToBottom();", sendConversationSuccessIndex);
  const autoCommitSuccessIndex = homeAppSource.indexOf("const autoCommitChat = useMutation({");
  const autoCommitScrollIndex = homeAppSource.indexOf("scrollConversationToBottom();", autoCommitSuccessIndex);
  const autoCommitProjectIndex = homeAppSource.indexOf("const autoCommitProject = useMutation({");

  expect(sendConversationSuccessIndex).toBeGreaterThanOrEqual(0);
  expect(sendConversationScrollIndex).toBeGreaterThan(sendConversationSuccessIndex);
  expect(autoCommitSuccessIndex).toBeGreaterThanOrEqual(0);
  expect(autoCommitScrollIndex).toBeGreaterThan(autoCommitSuccessIndex);
  expect(autoCommitScrollIndex).toBeLessThan(autoCommitProjectIndex);
});

test("project menus expose an auto commit action that starts a direct worker conversation", () => {
  expect(pageSource).toContain("AUTO_COMMIT_PROJECT_PROMPT");
  expect(pageSource).toContain("mode: \"direct\"");
  expect(pageSource).toContain("projectPath: payload.projectPath");
  expect(pageSource).toContain("autoCommitProject(group.path)");
  expect(pageSource).toContain("commit.menu.commitProjectNow");
});

test("deleting a conversation removes it optimistically before the request resolves", () => {
  const deleteMutationIndex = pageSource.indexOf("const deleteRun = useMutation({");
  const onMutateIndex = pageSource.indexOf("onMutate:", deleteMutationIndex);
  const requestIndex = pageSource.indexOf('requestJson(`/api/runs/${runId}`', deleteMutationIndex);
  const optimisticUpdateIndex = pageSource.indexOf("removeRunFromHomeState(current, variables.runId)", onMutateIndex);
  const rollbackIndex = pageSource.indexOf("previousState", optimisticUpdateIndex);

  expect(deleteMutationIndex).toBeGreaterThanOrEqual(0);
  expect(onMutateIndex).toBeGreaterThan(deleteMutationIndex);
  expect(requestIndex).toBeGreaterThan(deleteMutationIndex);
  expect(onMutateIndex).toBeLessThan(requestIndex);
  expect(optimisticUpdateIndex).toBeGreaterThan(onMutateIndex);
  expect(rollbackIndex).toBeGreaterThan(optimisticUpdateIndex);
});

test("stopping a conversation updates local worker state before the request resolves", () => {
  const stopWorkerMutationIndex = pageSource.indexOf("const stopWorker = useMutation({");
  const stopWorkerOnMutateIndex = pageSource.indexOf("onMutate:", stopWorkerMutationIndex);
  const stopWorkerRequestIndex = pageSource.indexOf('body: JSON.stringify({ action: "stop_worker", workerId })', stopWorkerMutationIndex);
  const stopWorkerOptimisticIndex = pageSource.indexOf("applyStopWorkerOptimisticUpdate(current, runId, workerId)", stopWorkerOnMutateIndex);
  const stopSupervisorMutationIndex = pageSource.indexOf("const stopSupervisor = useMutation({");
  const stopSupervisorOptimisticIndex = pageSource.indexOf("applyStopSupervisorOptimisticUpdate(current, runId)", stopSupervisorMutationIndex);

  expect(stopWorkerMutationIndex).toBeGreaterThanOrEqual(0);
  expect(stopWorkerOnMutateIndex).toBeGreaterThan(stopWorkerMutationIndex);
  expect(stopWorkerOnMutateIndex).toBeLessThan(stopWorkerRequestIndex);
  expect(stopWorkerOptimisticIndex).toBeGreaterThan(stopWorkerOnMutateIndex);
  expect(stopSupervisorOptimisticIndex).toBeGreaterThan(stopSupervisorMutationIndex);
  expect(pageSource).toContain('status: "cancelled"');
});

test("direct control user messages expose retry, edit, and fork recovery controls", () => {
  expect(pageSource).toContain("conversation.message.action.retryFromHere");
  expect(pageSource).toContain("conversation.message.action.editInPlace");
  expect(pageSource).toContain("conversation.message.action.forkFromHere");
  expect(pageSource).toContain("const canRecoverUserMessage = isDirectConversation || isImplementationConversation;");
  expect(pageSource).toContain("getUserMessageActions={getUserMessageActions}");
  expect(pageSource).toContain("actions={userMessageActions}");
  expect(pageSource).toContain('body: JSON.stringify({ action, targetMessageId, content, gitWorkspaceLaunch })');
});

test("implementation failures expose retry without direct-control edit and fork actions", () => {
  expect(pageSource).toContain('const canRetryConversation = isDirectConversation || (isImplementationConversation && selectedRun?.status !== "failed");');
  expect(pageSource).toContain("const canRecoverUserMessage = isDirectConversation || isImplementationConversation;");
  expect(pageSource).toContain("if (!canRecoverUserMessage) {");
  expect(pageSource).toContain("if (!isDirectConversation) {");
  expect(pageSource).toContain("return retryActions;");
  expect(homeAppSource).toContain("autoResumeStateRef");
  expect(homeAppSource).toContain("failedWorkerAvailability?.availability.status !== \"ok\"");
  expect(homeAppSource).toContain("recoverRun.mutate({");
  expect(homeAppSource).toContain('action: "retry"');
});

test("user input messages share the direct-control bubble renderer", () => {
  const userInputPath = path.resolve(process.cwd(), "src/components/home/UserInputMessage.tsx");
  expect(fs.existsSync(userInputPath)).toBe(true);

  const userInputSource = fs.readFileSync(userInputPath, "utf8");
  const conversationMainSource = readSource("src/components/home/ConversationMain.tsx");

  expect(userInputSource).toContain("export function UserInputMessage");
  expect(userInputSource).toContain('flex justify-end');
  expect(userInputSource).toContain('flex-col items-end');
  expect(userInputSource).toContain('omni-user-message group/user-message relative w-full overflow-hidden rounded-2xl');
  expect(userInputSource).toContain('transition-colors');
  expect(userInputSource).toContain('const timestampLabel = createdAt ? formatUserMessageTimestamp(createdAt) : "";');
  expect(userInputSource).toContain('{timestampLabel ? <span>{timestampLabel}</span> : null}');
  expect(userInputSource).toContain('px-5 py-3.5');
  expect(userInputSource).toContain('mt-1.5 flex w-full items-center justify-end gap-2 pr-4');
  expect(userInputSource).toContain('maxHeight: isExpanded ? undefined : "calc(1.5rem * 6)"');
  expect(userInputSource).toContain('aria-label={isExpanded ? "Show less message text" : "Show more message text"}');
  expect(userInputSource).toContain('conversation.message.copyAria');
  expect(userInputSource).toContain('conversation.message.copiedNotice');
  expect(userInputSource).toContain('conversationCopyNoticeManager');
  expect(userInputSource).toContain('copiedMessageId === messageId');
  expect(userInputSource).toContain('role="status"');
  expect(userInputSource).toContain('aria-live="polite"');
  expect(conversationMainSource).toContain('from "./UserInputMessage";');
  expect(conversationMainSource).toContain('<UserInputMessage');
  expect(conversationMainSource).toContain('messageId={msg.id}');
  expect(conversationMainSource).toContain('createdAt={msg.createdAt}');
  expect(conversationMainSource).not.toContain('rounded-[1.9rem] rounded-br-lg bg-[#242424]');
  expect(conversationMainSource).not.toContain('msg.role === "user"\n                      ? "border-transparent bg-muted/30 text-foreground"');
});

test("user input image attachments keep visible attachment metadata in history", () => {
  const userInputSource = readSource("src/components/home/UserInputMessage.tsx");

  expect(userInputSource).toContain('attachment.kind === "image" && url');
  expect(userInputSource).toContain('alt={attachment.name}');
  expect(userInputSource).toContain('{attachment.name}');
  expect(userInputSource).toContain('{formatBytes(attachment.size)}');
  expect(userInputSource).toContain('attachmentImagePreviewManager.open({ url, name: attachment.name, size: attachment.size })');
  expect(userInputSource).toContain('title={`Preview ${attachment.name}`}');
});

test("direct-control terminal user messages render attachment metadata", () => {
  expect(terminalSource).toContain('attachments?: ChatAttachment[]');
  expect(terminalSource).toContain('attachments: message.attachments ?? []');
  expect(terminalSource).toContain('actions: entry.entry.type === "user_input" ? getUserMessageActions?.({');
  expect(terminalSource).toContain('id: entry.entry.id,');
  expect(terminalSource).toContain('content: entry.entry.text,');
  expect(terminalSource).toContain('createdAt: entry.entry.timestamp,');
  expect(terminalSource).toContain('activity.attachments.length > 0');
  expect(terminalSource).toContain('attachmentImagePreviewManager.open({ url, name: attachment.name, size: attachment.size })');
  expect(terminalSource).toContain('title={`Preview ${attachment.name}`}');
  expect(terminalSource).toContain('{formatBytes(attachment.size)}');
});

test("conversation loading states use i18n resources", () => {
  const conversationMainSource = readSource("src/components/home/ConversationMain.tsx");
  const sidebarSource = readSource("src/components/home/ConversationSidebar.tsx");
  const localeSource = readSource("shared/locales/en.json");

  expect(conversationMainSource).toContain('t("conversation.loading")');
  expect(conversationMainSource).not.toContain("Loading conversation…");
  expect(sidebarSource).toContain('t("conversation.sidebar.loadingConversations")');
  expect(sidebarSource).not.toContain("Loading conversations...");
  expect(localeSource).toContain('"conversation.loading": "Loading conversation..."');
  expect(localeSource).toContain('"conversation.sidebar.loadingConversations": "Loading conversations..."');
});

test("direct conversations keep the terminal mounted during worker stream refreshes", () => {
  const conversationMainSource = readSource("src/components/home/ConversationMain.tsx");
  const loadingGateStart = conversationMainSource.indexOf("{!isSelectedConversationLoaded ? (");
  const terminalStart = conversationMainSource.indexOf("<DirectControlTerminalColumn>", loadingGateStart);
  const loadingGate = conversationMainSource.slice(loadingGateStart, terminalStart);

  expect(loadingGateStart).toBeGreaterThanOrEqual(0);
  expect(terminalStart).toBeGreaterThan(loadingGateStart);
  expect(loadingGate).not.toContain("directWorkerStream.isLoaded");
  expect(conversationMainSource).toContain("deriveConversationLoadState({");
  expect(conversationMainSource).toContain("shouldShowDirectConversationLoading(directConversationLoadState)");
  expect(conversationMainSource).toContain("isLoading={isHydratingConversations || isDirectWorkerStreamLoading}");
});

test("attachment image previews use a global full-screen dialog", () => {
  const homeSource = readSource("src/app/home/HomeApp.tsx");
  const dialogSource = readSource("src/components/AttachmentImagePreviewDialog.tsx");
  const managerSource = readSource("src/components/component-state-managers.ts");

  expect(homeSource).toContain("<AttachmentImagePreviewDialog />");
  expect(managerSource).toContain("attachmentImagePreviewManager");
  expect(dialogSource).toContain("h-dvh w-screen max-w-none");
  expect(dialogSource).toContain("download={preview.name}");
  expect(dialogSource).toContain("attachment.preview.closeAria");
  expect(dialogSource).toContain("right-4 top-4");
});

test("saving an edited message closes the inline editor before the rerun request resolves", () => {
  const handleSaveStart = pageSource.indexOf("const handleSaveEditedMessage = (messageId: string");
  const clearEditorIndex = pageSource.indexOf("setEditingMessageId(null);", handleSaveStart);
  const clearDraftIndex = pageSource.indexOf('setEditingMessageValue("");', handleSaveStart);
  const mutateIndex = pageSource.indexOf("recoverRun.mutate(", handleSaveStart);
  const restoreEditorIndex = pageSource.indexOf("setEditingMessageId(messageId);", mutateIndex);
  const restoreDraftIndex = pageSource.indexOf("setEditingMessageValue(content);", mutateIndex);

  expect(handleSaveStart).toBeGreaterThanOrEqual(0);
  expect(clearEditorIndex).toBeGreaterThan(handleSaveStart);
  expect(clearDraftIndex).toBeGreaterThan(clearEditorIndex);
  expect(mutateIndex).toBeGreaterThan(clearDraftIndex);
  expect(restoreEditorIndex).toBeGreaterThan(mutateIndex);
  expect(restoreDraftIndex).toBeGreaterThan(restoreEditorIndex);
});

test("direct-control terminal user messages can render the inline edit form", () => {
  expect(pageSource).toContain("editingUserMessageId={editingMessageId}");
  expect(pageSource).toContain("editingUserMessageValue={editingMessageValue}");
  expect(pageSource).toContain("onEditingUserMessageValueChange={setEditingMessageValue}");
  expect(pageSource).toContain("onCancelEditingUserMessage={handleCancelEditingMessage}");
  expect(pageSource).toContain("onSaveEditedUserMessage={handleSaveEditedMessage}");
  expect(terminalSource).toContain("editingUserMessageId?: string | null;");
  expect(terminalSource).toContain("activity.messageId === editingUserMessageId");
  expect(terminalSource).toContain("function UserMessageEditForm");
});

test("failed runs render a single persisted error in the conversation view", () => {
  expect(pageSource).not.toContain("Execution failed");
  expect(pageSource).toContain("function extractWorkerFailureDetail(messages: MessageRecord[])");
  expect(pageSource).toContain("const visibleMessages = useMemo(() => {");
  expect(pageSource).toContain("shouldRenderMessageInMainConversation");
  expect(pageSource).not.toContain('message.role === "system"');
  expect(pageSource).toContain('conversationTimelineItems.map((item: ConversationTimelineItem) => {');
  expect(pageSource).toContain('action: workerFailureDetail ? "Worker setup" : staleFailure ? "Reconnecting" : "Run failed"');
  expect(pageSource).toContain('message: workerFailureDetail || (staleFailure');
  expect(pageSource).toContain("Update the model or account, then resume.");
  expect(pageSource).toContain('`to ${workerLabel || "worker"}`');
  expect(pageSource).not.toContain("This failure was recorded earlier and may be stale.");
  expect(pageSource).not.toContain('<div className="font-semibold">Run failed</div>');
  expect(pageSource).toContain("Run failed");
});

test("clarification requests stay in the normal supervisor conversation", () => {
  expect(pageSource).not.toContain("shouldHideMessageForClarificationPanel");
  expect(pageSource).not.toContain("selectedClarifications");
  expect(pageSource).not.toContain("ClarificationPanel");
  expect(pageSource).toContain('return "Waiting for your reply";');
  expect(pageSource).not.toContain("Waiting for your reply${summary");
});

test("preflight implementation confirmations expose remembered quick actions", () => {
  const conversationMainSource = readSource("src/components/home/ConversationMain.tsx");
  const homeAppSource = readSource("src/app/home/HomeApp.tsx");
  const managerSource = readSource("src/app/home/PreflightConfirmationActionsManager.ts");
  const localeSource = readSource("shared/locales/en.json");

  expect(conversationMainSource).toContain("isPreflightConfirmationMessage");
  expect(conversationMainSource).toContain('t("conversation.preflightConfirmation.yes")');
  expect(conversationMainSource).toContain('t("conversation.preflightConfirmation.no")');
  expect(conversationMainSource).toContain("preflightConfirmationActionsManager.rememberMessage(msg.id)");
  expect(conversationMainSource).toContain("handlePreflightConfirmationAnswer");
  expect(homeAppSource).toContain("preflightConfirmationActionsManager.hydrateFromBrowser()");
  expect(homeAppSource).toContain("sendConversationMessage.mutate({ runId: selectedRunId, content, attachments: [] })");
  expect(managerSource).toContain("omni.preflight-confirmation-actions.handled");
  expect(localeSource).toContain('"conversation.preflightConfirmation.yes": "Yes, implement it"');
  expect(localeSource).toContain('"conversation.preflightConfirmation.no": "No, let me clarify"');
});

test("supervisor conversation messages render markdown", () => {
  expect(pageSource).toContain('msg.role === "supervisor"');
  expect(pageSource).toContain("<MarkdownContent");
  expect(pageSource).toContain("content={msg.content}");
  expect(markdownContentSource).toContain("function renderInlineMarkdown");
  expect(markdownContentSource).toContain("export function MarkdownContent");
  expect(markdownContentSource).not.toContain("dangerouslySetInnerHTML");
});

test("conversation error notices render below the thread content", () => {
  const messagesIndex = pageSource.indexOf("conversationTimelineItems.length > 0 ? (");
  const executionIndex = pageSource.indexOf("{isImplementationConversation && showConversationExecution ? (");
  const appErrorsIndex = pageSource.indexOf("{appErrors.length > 0 ? (", executionIndex);
  const failureNoticeIndex = pageSource.indexOf("{conversationFailure ? (", appErrorsIndex);

  expect(messagesIndex).toBeGreaterThanOrEqual(0);
  expect(executionIndex).toBeGreaterThan(messagesIndex);
  expect(appErrorsIndex).toBeGreaterThan(executionIndex);
  expect(failureNoticeIndex).toBeGreaterThan(appErrorsIndex);
});

test("send queued now failures do not leak into every conversation notice stack", () => {
  const useAppErrorsSource = readSource("src/app/home/useAppErrors.ts");

  expect(homeAppSource).not.toContain("sendQueuedMessageNowError: sendQueuedMessageNow.error");
  expect(useAppErrorsSource).not.toContain("sendQueuedMessageNowError");
  expect(useAppErrorsSource).not.toContain('action: "Send queued message now"');
});

test("send queued now hides accepted direct messages from the queued drawer", () => {
  const useHomeMutationsSource = readSource("src/app/home/useHomeMutations.ts");

  expect(useHomeMutationsSource).toContain('if (data.message && data.queuedMessage?.status === "delivering")');
  expect(useHomeMutationsSource).toContain("busyMessageQueueManager.hideQueuedMessage(variables.messageId);");
});

test("direct control conversations show a tiny animated working indicator while stoppable", () => {
  expect(terminalSource).toContain("function PendingAssistantActivity()");
  expect(terminalSource).toContain('const PENDING_ASSISTANT_TEXT = "Thinking..."');
  expect(terminalSource).toContain('kind: "pending_assistant"');
  expect(terminalSource).toContain('aria-label="Agent is thinking"');
  expect(terminalSource).toContain("Array.from(PENDING_ASSISTANT_TEXT)");
  expect(terminalSource).toContain("text-[calc(var(--terminal-message-size)+1px)]");
  expect(pageSource).toContain("showDirectControlWorkingIndicator={showDirectControlWorkingIndicator}");
  expect(pageSource).toContain("showPendingAssistantIndicator={showDirectControlWorkingIndicator}");
  expect(pageSource).toContain("const hasBusyConversation = isSupervisorRunning || Boolean(stoppableConversationWorkerId);");
  expect(pageSource).toContain('const directConversationIsRunning = selectedRun?.mode === "direct" && selectedRun.status === "running";');
  expect(pageSource).toContain("const showDirectControlWorkingIndicator = isDirectConversation && (hasBusyConversation || directConversationIsRunning);");
  expect(terminalSource).toContain("showPendingAssistantIndicator = false");
  expect(terminalSource).toContain("pendingAssistantActivity");
  expect(terminalSource).toContain("const TERMINAL_BOTTOM_THRESHOLD_PX = 1");
  expect(terminalSource).toContain("getTerminalScrollElement");
  expect(terminalSource).toContain("scrollTerminalToBottom");
  expect(terminalSource).not.toContain("shouldForceFollowPendingAssistant");
  expect(terminalSource).toContain("const activityChanged = previousActivityVersionRef.current !== activityVersion;");
  expect(terminalSource).toContain("scrollAnchorKey = null");
  expect(terminalSource).toContain("const scrollAnchorChanged = previousScrollAnchorKeyRef.current !== scrollAnchorKey;");
  expect(terminalSource).toContain("|| (!shouldFollowLatestRef.current && !isFirstRenderedActivity)");
  expect(terminalSource).toContain("shouldFollowLatestRef.current = true");
  expect(terminalSource).toContain("hasPositionedFirstActivityRef");
  expect(terminalSource).toContain('const scrollBehavior: ScrollBehavior = isFirstRenderedActivity ? "auto" : "smooth";');
  expect(terminalSource).toContain('scrollTerminalToBottom(container, "auto")');
  expect(terminalSource).toContain("inline-block animate-pulse text-foreground/80");
  expect(terminalSource).toContain("animationDuration:");
  expect(terminalSource).toContain("relative z-10 mt-3 flex w-full justify-start px-1");
  expect(terminalSource).toContain("animationDelay:");
});

test("starting a new conversation immediately selects the reserved session route", () => {
  expect(pageSource).toContain("requestedRunId: createClientRunId()");
  expect(pageSource).toContain("requestedRunId: payload.requestedRunId");
  expect(pageSource).toContain("const requestedRunId = payload.requestedRunId;");
  expect(pageSource).toContain("setSelectedRunId(requestedRunId);");
  expect(pageSource).toContain("replaceBrowserConversationPath(requestedRunId, null);");
  expect(pageSource).toContain("const createdRunId = data.runId ?? data.run?.id ?? variables.requestedRunId;");
  expect(pageSource).toContain("setSelectedRunId(createdRunId);");
  expect(pageSource).toContain("replaceBrowserConversationPath(createdRunId, null);");
  expect(pageSource).toContain("setSelectedRunId(context.previousSelectedRunId);");
  expect(pageSource).toContain("replaceBrowserConversationPath(context.previousSelectedRunId, context.previousDraftProjectPath);");
  expect(pageSource).toContain("export function createClientRunId()");
  expect(pageSource).toContain("&& (!selectedRunId || selectedRunId === runCommand.variables?.requestedRunId)");
});

test("frontend transport and mutation errors render as explicit notices", () => {
  expect(pageSource).toContain("return useMemo(() => {");
  expect(pageSource).toContain("<ErrorNotice");
  expect(pageSource).toContain('source: "Events"');
  expect(pageSource).toContain('action: "Start a run"');
});

test("dropdown menus size to fit action labels instead of the trigger width", () => {
  const dropdownSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/components/ui/dropdown-menu.tsx"),
    "utf8"
  );

  expect(dropdownSource).not.toContain("w-(--anchor-width)");
  expect(dropdownSource).toContain("w-fit");
  expect(dropdownSource).toContain("min-w-[12rem]");
});
