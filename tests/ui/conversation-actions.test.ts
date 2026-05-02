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
  "src/components/home/ConversationMain.tsx",
  "src/components/home/ConversationSidebar.tsx",
  "src/components/home/SettingsDialog.tsx",
].map(readSource).join("\n");
const markdownContentSource = readSource("src/components/MarkdownContent.tsx");

test("conversation rows expose rename and delete actions", () => {
  expect(pageSource).toContain('Rename conversation');
  expect(pageSource).toContain('Delete conversation');
  expect(pageSource).toContain('requestJson(`/api/runs/${runId}`');
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

test("user messages expose retry, edit, and fork recovery controls", () => {
  expect(pageSource).toContain("Retry from here");
  expect(pageSource).toContain("Edit in place");
  expect(pageSource).toContain("Fork from here");
  expect(pageSource).toContain('body: JSON.stringify({ action, targetMessageId, content })');
});

test("user input messages share the direct-control bubble renderer", () => {
  const userInputPath = path.resolve(process.cwd(), "src/components/home/UserInputMessage.tsx");
  expect(fs.existsSync(userInputPath)).toBe(true);

  const userInputSource = fs.readFileSync(userInputPath, "utf8");
  const conversationMainSource = readSource("src/components/home/ConversationMain.tsx");

  expect(userInputSource).toContain("export function UserInputMessage");
  expect(userInputSource).toContain('flex justify-start pl-4 sm:pl-6');
  expect(userInputSource).toContain('rounded-lg bg-[#3a3a3a]');
  expect(userInputSource).toContain('maxHeight: isExpanded ? undefined : "calc(1.5rem * 6)"');
  expect(userInputSource).toContain('aria-label={isExpanded ? "Show less message text" : "Show more message text"}');
  expect(userInputSource).toContain('aria-label="Copy message"');
  expect(conversationMainSource).toContain('from "./UserInputMessage";');
  expect(conversationMainSource).toContain('<UserInputMessage');
  expect(conversationMainSource).not.toContain('rounded-[1.9rem] rounded-br-lg bg-[#242424]');
  expect(conversationMainSource).not.toContain('msg.role === "user"\n                      ? "border-transparent bg-muted/30 text-foreground"');
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
  expect(pageSource).toContain('message.role === "system"');
  expect(pageSource).toContain('message.kind === "error"');
  expect(pageSource).toContain('conversationTimelineItems.map((item: ConversationTimelineItem) => {');
  expect(pageSource).toContain('action: workerFailureDetail ? "Worker setup" : staleFailure ? "Retry" : "Run failed"');
  expect(pageSource).toContain('message: workerFailureDetail || (staleFailure');
  expect(pageSource).toContain("Update the model or account, then retry.");
  expect(pageSource).toContain('`${workerLabel || "Worker"} available.`');
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
