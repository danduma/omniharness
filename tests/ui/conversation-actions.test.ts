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
  "src/app/home/LiveEventConnectionManager.ts",
  "src/app/home/utils.ts",
  "src/lib/conversation-visuals.ts",
  "src/components/home/ConversationMain.tsx",
  "src/components/home/ConversationSidebar.tsx",
  "src/components/home/HomeHeader.tsx",
  "src/components/home/SettingsDialog.tsx",
].map(readSource).join("\n");
const homeAppSource = readSource("src/app/home/HomeApp.tsx");
const markdownContentSource = readSource("src/components/MarkdownContent.tsx");
const terminalSource = readSource("src/components/Terminal.tsx");

test("conversation rows expose rename and delete actions", () => {
  expect(pageSource).toContain('Rename');
  expect(pageSource).toContain('Delete');
  expect(pageSource).not.toContain('Rename conversation');
  expect(pageSource).not.toContain('Delete conversation');
  expect(pageSource).toContain('requestJson(`/api/runs/${runId}`');
});

test("top bar exposes an auto commit action for the selected chat", () => {
  expect(pageSource).toContain("AUTO_COMMIT_CHAT_PROMPT");
  expect(pageSource).toContain("AUTO_COMMIT_CHAT_PUSH_PROMPT");
  expect(pageSource).toContain('"Create a git commit including the changes you\'ve made"');
  expect(pageSource).toContain('"Create a git commit including the changes you\'ve made, then push the current branch"');
  expect(pageSource).toContain("autoCommitChat.mutate({ runId: selectedRunId, action })");
  expect(pageSource).toContain("ButtonGroup");
  expect(pageSource).toContain("DropdownMenu");
  expect(pageSource).toContain("Auto Commit Chat actions");
  expect(pageSource).toContain("Auto commit &amp; push");
  expect(pageSource).toContain("AUTO_COMMIT_CHAT_ACTION_STORAGE_KEY");
  expect(pageSource).toContain('window.localStorage.getItem(AUTO_COMMIT_CHAT_ACTION_STORAGE_KEY)');
  expect(pageSource).toContain('window.localStorage.setItem(AUTO_COMMIT_CHAT_ACTION_STORAGE_KEY, autoCommitChatAction)');
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
  expect(pageSource).toContain('"Group all modified files into commits as they fit best"');
  expect(pageSource).toContain("mode: \"direct\"");
  expect(pageSource).toContain("projectPath: payload.projectPath");
  expect(pageSource).toContain("autoCommitProject.mutate({ projectPath })");
  expect(pageSource).toContain("Auto Commit Project");
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

test("direct control user messages expose retry, edit, and fork recovery controls", () => {
  expect(pageSource).toContain("Retry from here");
  expect(pageSource).toContain("Edit in place");
  expect(pageSource).toContain("Fork from here");
  expect(pageSource).toContain("const canRecoverUserMessage = isDirectConversation || isImplementationConversation;");
  expect(pageSource).toContain("getUserMessageActions={getUserMessageActions}");
  expect(pageSource).toContain("actions={userMessageActions}");
  expect(pageSource).toContain('body: JSON.stringify({ action, targetMessageId, content })');
});

test("implementation failures expose retry without direct-control edit and fork actions", () => {
  expect(pageSource).toContain('const canRetryConversation = isDirectConversation || (isImplementationConversation && selectedRun?.status !== "failed");');
  expect(pageSource).toContain("const canRecoverUserMessage = isDirectConversation || isImplementationConversation;");
  expect(pageSource).toContain("if (!canRecoverUserMessage) {");
  expect(pageSource).toContain("if (!isDirectConversation) {");
  expect(pageSource).toContain("return retryActions;");
  expect(homeAppSource).toContain("const autoResumeRunKeysRef = useRef<Set<string>>(new Set());");
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
  expect(userInputSource).toContain('rounded-[1.55rem] bg-[#f3f3f3]');
  expect(userInputSource).toContain('dark:bg-[#3a3a3a]');
  expect(userInputSource).toContain('const timestampLabel = createdAt ? formatUserMessageTimestamp(createdAt) : "";');
  expect(userInputSource).toContain('{timestampLabel ? <span>{timestampLabel}</span> : null}');
  expect(userInputSource).toContain('px-5 py-3.5');
  expect(userInputSource).toContain('mt-1.5 flex w-full items-center justify-end gap-2 pr-4');
  expect(userInputSource).toContain('maxHeight: isExpanded ? undefined : "calc(1.5rem * 6)"');
  expect(userInputSource).toContain('aria-label={isExpanded ? "Show less message text" : "Show more message text"}');
  expect(userInputSource).toContain('aria-label="Copy message"');
  expect(conversationMainSource).toContain('from "./UserInputMessage";');
  expect(conversationMainSource).toContain('<UserInputMessage');
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
  expect(terminalSource).toContain('activity.attachments.length > 0');
  expect(terminalSource).toContain('attachmentImagePreviewManager.open({ url, name: attachment.name, size: attachment.size })');
  expect(terminalSource).toContain('title={`Preview ${attachment.name}`}');
  expect(terminalSource).toContain('{formatBytes(attachment.size)}');
});

test("attachment image previews use a global full-screen dialog", () => {
  const homeSource = readSource("src/app/home/HomeApp.tsx");
  const dialogSource = readSource("src/components/AttachmentImagePreviewDialog.tsx");
  const managerSource = readSource("src/components/component-state-managers.ts");

  expect(homeSource).toContain("<AttachmentImagePreviewDialog />");
  expect(managerSource).toContain("attachmentImagePreviewManager");
  expect(dialogSource).toContain("h-dvh w-screen max-w-none");
  expect(dialogSource).toContain("download={preview.name}");
  expect(dialogSource).toContain("aria-label=\"Close image preview\"");
  expect(dialogSource).toContain("right-4 top-4");
});

test("saving an edited message closes the inline editor before the rerun request resolves", () => {
  const handleSaveStart = pageSource.indexOf("const handleSaveEditedMessage = (messageId: string) => {");
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
  expect(pageSource).toContain('`Reconnecting to ${workerLabel || "worker"}.`');
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

test("supervisor conversation messages render markdown", () => {
  expect(pageSource).toContain('msg.role === "supervisor"');
  expect(pageSource).toContain("<MarkdownContent content={msg.content}");
  expect(markdownContentSource).toContain("function renderInlineMarkdown");
  expect(markdownContentSource).toContain("export function MarkdownContent");
  expect(markdownContentSource).not.toContain("dangerouslySetInnerHTML");
});

test("conversation error notices render below the thread content", () => {
  const messagesIndex = pageSource.indexOf("{conversationTimelineItems.length > 0 ? (");
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

test("direct control conversations show a tiny animated working indicator while stoppable", () => {
  expect(terminalSource).toContain("function PendingAssistantActivity()");
  expect(terminalSource).toContain('const PENDING_ASSISTANT_TEXT = "Thinking..."');
  expect(terminalSource).toContain('kind: "pending_assistant"');
  expect(terminalSource).toContain('aria-label="Agent is thinking"');
  expect(terminalSource).toContain("Array.from(PENDING_ASSISTANT_TEXT)");
  expect(terminalSource).toContain("text-[calc(var(--terminal-message-size)+1px)]");
  expect(pageSource).toContain("showDirectControlWorkingIndicator={showDirectControlWorkingIndicator}");
  expect(pageSource).toContain("showPendingAssistantIndicator={showDirectControlWorkingIndicator}");
  expect(pageSource).toContain('const showDirectControlWorkingIndicator = isDirectConversation && composerBehavior.buttonKind === "stop";');
  expect(terminalSource).toContain("showPendingAssistantIndicator = false");
  expect(terminalSource).toContain("pendingAssistantActivity");
  expect(terminalSource).toContain("const TERMINAL_BOTTOM_THRESHOLD_PX = 1");
  expect(terminalSource).toContain("getTerminalScrollElement");
  expect(terminalSource).toContain("scrollTerminalToBottom");
  expect(terminalSource).not.toContain("shouldForceFollowPendingAssistant");
  expect(terminalSource).toContain("const activityChanged = previousActivityVersionRef.current !== activityVersion;");
  expect(terminalSource).toContain("if (!container || !activityChanged || !shouldFollowLatestRef.current)");
  expect(terminalSource).toContain("shouldFollowLatestRef.current = true");
  expect(terminalSource).toContain('behavior: "smooth"');
  expect(terminalSource).toContain("inline-block animate-pulse text-foreground/80");
  expect(terminalSource).toContain("animationDuration:");
  expect(terminalSource).toContain("relative z-10 mt-3 flex w-full justify-start px-1");
  expect(terminalSource).toContain("animationDelay:");
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
