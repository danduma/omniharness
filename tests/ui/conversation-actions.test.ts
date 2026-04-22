import fs from "fs";
import path from "path";
import { test, expect } from "vitest";

const pageSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/app/page.tsx"),
  "utf8"
);

test("conversation rows expose rename and delete actions", () => {
  expect(pageSource).toContain('Rename conversation');
  expect(pageSource).toContain('Delete conversation');
  expect(pageSource).toContain('requestJson(`/api/runs/${runId}`');
});

test("user messages expose retry, edit, and fork recovery controls", () => {
  expect(pageSource).toContain("Retry from here");
  expect(pageSource).toContain("Edit in place");
  expect(pageSource).toContain("Fork from here");
  expect(pageSource).toContain('body: JSON.stringify({ action, targetMessageId, content })');
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
  expect(pageSource).toContain('msg.kind === "error"');
  expect(pageSource).toContain("Run failed");
});

test("frontend transport and mutation errors render as explicit notices", () => {
  expect(pageSource).toContain("const appErrors = useMemo");
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
